// Fluxo de 4 etapas do widget de pagamento: WhatsApp -> Nome/E-mail -> CPF -> PIX (PrimeCash Brasil).
// IMPORTANTE: este arquivo só fala com o próprio backend (server.js -> /api/pix/*).
// A Chave Secreta da PrimeCash Brasil nunca fica exposta aqui — toda chamada à API fica no servidor.

const leadData = { phone: '', name: '', email: '', cpf: '' };
let pixPollTimer = null;

function onlyDigits(value) {
    return (value || '').replace(/\D/g, '');
}

function maskPhone(value) {
    const digits = onlyDigits(value).slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function maskCpf(value) {
    const digits = onlyDigits(value).slice(0, 11);
    return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function isValidPhone(value) {
    return onlyDigits(value).length >= 10;
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || '').trim());
}

// Validação de CPF com dígitos verificadores (algoritmo padrão da Receita Federal).
function isValidCpf(value) {
    const cpf = onlyDigits(value);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
    let check1 = (sum * 10) % 11;
    if (check1 === 10) check1 = 0;
    if (check1 !== parseInt(cpf[9], 10)) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
    let check2 = (sum * 10) % 11;
    if (check2 === 10) check2 = 0;
    return check2 === parseInt(cpf[10], 10);
}

function goToStep(stepId) {
    ['step-phone', 'step-name', 'step-cpf'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === stepId ? 'block' : 'none';
    });
    updateCheckoutProgress(stepId);

    const label = document.getElementById('payment-step-label');
    if (stepId === 'step-name' && label) {
        label.textContent = 'Como podemos te chamar?';
    } else if (stepId === 'step-cpf' && label) {
        label.textContent = 'Informe seu CPF para gerar o PIX';
    }
}

function updateCheckoutProgress(stepId) {
    const stepsContainer = document.querySelector('.checkout-steps');
    const stepOrder = ['you', 'phone', 'name', 'cpf'];
    const currentByForm = {
        'step-phone': 'phone',
        'step-name': 'name',
        'step-cpf': 'cpf',
        complete: null
    };
    const currentStep = currentByForm[stepId];
    const currentIndex = currentStep ? stepOrder.indexOf(currentStep) : stepOrder.length;
    const progressByForm = {
        'step-phone': '15%',
        'step-name': '48%',
        'step-cpf': '80%',
        complete: '100%'
    };

    if (stepsContainer) {
        stepsContainer.style.setProperty('--progress', progressByForm[stepId]);
    }

    stepOrder.forEach((stepName, index) => {
        const step = document.querySelector(`[data-checkout-step="${stepName}"]`);
        if (!step) return;
        step.classList.toggle('is-complete', index < currentIndex);
        step.classList.toggle('is-current', index === currentIndex);
        step.setAttribute('aria-current', index === currentIndex ? 'step' : 'false');
    });
}

function handlePhoneStep(event) {
    event.preventDefault();
    const input = document.getElementById('input-phone');
    const error = document.getElementById('error-phone');
    input.value = maskPhone(input.value);

    if (!isValidPhone(input.value)) {
        error.style.display = 'block';
        return false;
    }
    error.style.display = 'none';
    leadData.phone = input.value;
    goToStep('step-name');
    return false;
}

function handleNameStep(event) {
    event.preventDefault();
    const nameInput = document.getElementById('input-name');
    const nameError = document.getElementById('error-name');
    const emailInput = document.getElementById('input-email');
    const emailError = document.getElementById('error-email');
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    let valid = true;

    if (name.length < 2) {
        nameError.style.display = 'block';
        valid = false;
    } else {
        nameError.style.display = 'none';
    }

    if (!isValidEmail(email)) {
        emailError.style.display = 'block';
        valid = false;
    } else {
        emailError.style.display = 'none';
    }

    if (!valid) return false;

    leadData.name = name;
    leadData.email = email;
    goToStep('step-cpf');
    return false;
}

function handleCpfStep(event) {
    event.preventDefault();
    const input = document.getElementById('input-cpf');
    const error = document.getElementById('error-cpf');
    input.value = maskCpf(input.value);

    if (!isValidCpf(input.value)) {
        error.style.display = 'block';
        return false;
    }
    error.style.display = 'none';
    leadData.cpf = input.value;
    updateCheckoutProgress('complete');

    const payButton = document.getElementById('pay-button');
    payButton.disabled = true;
    payButton.textContent = 'Gerando PIX...';

    saveLeadLocally(leadData).finally(() => requestPixCharge(leadData));
    return false;
}

// Salva o lead apenas no seu próprio backend local (server.js), nunca em domínios externos.
async function saveLeadLocally(data) {
    try {
        await fetch('/api/lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (err) {
        console.warn('Não foi possível salvar o lead localmente:', err);
    }
}

// Procura, de forma tolerante, o código "copia e cola" dentro da resposta do gateway
// (a PrimeCash Brasil manda em pix.qrcode; outros nomes ficam como fallback caso a
// API mude ou o provedor de pagamento seja trocado de novo no futuro).
function extractPixCopyCode(transaction) {
    const pix = transaction.pix || transaction.pixData || {};
    const candidates = [
        pix.code, pix.qrcodeText, pix.qrCodeText, pix.copyPaste, pix.copyAndPaste,
        pix.payload, pix.emv, transaction.qrcodeText, transaction.pixCopyPaste
    ];
    let found = candidates.find(v => typeof v === 'string' && v.length > 20 && !v.startsWith('data:image'));
    if (found) return found;

    if (typeof pix.qrcode === 'string' && !pix.qrcode.startsWith('data:image') && !/^https?:\/\//.test(pix.qrcode)) {
        return pix.qrcode;
    }
    return '';
}

// Procura a imagem do QR Code (base64 ou URL) dentro da resposta do gateway, caso
// algum provedor mande a imagem pronta (ex.: em pix.imageBase64, "cru", sem o
// prefixo "data:image/..." — nesse caso completamos o prefixo aqui).
function extractPixQrImage(transaction) {
    const pix = transaction.pix || transaction.pixData || {};
    const rawBase64 = pix.imageBase64;
    if (typeof rawBase64 === 'string' && rawBase64.length > 0) {
        return rawBase64.startsWith('data:') ? rawBase64 : `data:image/png;base64,${rawBase64}`;
    }

    const candidates = [
        pix.qrcodeBase64, pix.qrCodeBase64, pix.qrcodeImage,
        pix.qrCodeImageUrl, pix.qrcodeUrl, pix.imageUrl, pix.qrcode
    ];
    const found = candidates.find(v => typeof v === 'string' && (v.startsWith('data:image') || /^https?:\/\//.test(v)));
    return found || '';
}

// A qrcode.min.js usa por padrão um "typeNumber" (versão do QR) fixo e pequeno
// demais para caber o código PIX inteiro (~150-250 caracteres), e lança um erro
// quando o texto não cabe. Aqui tentamos versões cada vez maiores até uma caber.
function renderPixQrCode(container, text) {
    for (let typeNumber = 4; typeNumber <= 40; typeNumber++) {
        container.innerHTML = '';
        try {
            new QRCode(container, { text, width: 200, height: 200, typeNumber, correctLevel: QRCode.CorrectLevel.M });
            return true;
        } catch (err) {
            // Não coube nessa versão: limpa e tenta a próxima.
        }
    }
    container.innerHTML = '';
    return false;
}

// Status possíveis retornados pela PrimeCash Brasil (DepositResource.status).
const PIX_STATUS_LABELS = {
    processing: 'Processando pagamento…',
    waiting_payment: 'Aguardando pagamento…',
    in_review: 'Pagamento em análise…',
    in_dispute: 'Pagamento em disputa…',
    pre_chargeback: 'Pagamento em contestação…',
    paid: 'Pagamento confirmado! ✅',
    refused: 'Pagamento recusado.',
    refunded: 'Pagamento estornado.',
    chargeback: 'Pagamento contestado.',
    chargedback: 'Pagamento contestado.',
    cancelled: 'Cobrança cancelada.',
    failed: 'Falha no pagamento.',
    antifraud: 'Pagamento bloqueado pelo antifraude.',
    unpaid: 'PIX expirou sem pagamento.',
    abandoned: 'Cobrança abandonada.'
};

const PIX_TERMINAL_STATUSES = [
    'paid', 'refused', 'refunded', 'chargeback', 'chargedback', 'cancelled',
    'failed', 'antifraud', 'unpaid', 'abandoned'
];

function updatePixStatusUI(status) {
    const statusEl = document.getElementById('pix-status');
    if (!statusEl) return;
    statusEl.textContent = PIX_STATUS_LABELS[status] || `Status: ${status}`;
    statusEl.classList.toggle('paid', status === 'paid');
}

function pollPixStatus(transactionId) {
    if (pixPollTimer) clearInterval(pixPollTimer);

    pixPollTimer = setInterval(async () => {
        try {
            const res = await fetch(`/api/pix/status/${encodeURIComponent(transactionId)}`);
            const data = await res.json();
            if (!res.ok) return;

            updatePixStatusUI(data.status);
            if (PIX_TERMINAL_STATUSES.includes(data.status)) {
                clearInterval(pixPollTimer);
            }
        } catch (err) {
            console.warn('Falha ao consultar status do PIX:', err);
        }
    }, 5000);
}

// Cria a cobrança PIX de R$ 49,90 via PrimeCash Brasil (rota /api/pix/create do próprio servidor).
async function requestPixCharge(data) {
    const payButton = document.getElementById('pay-button');
    const errorPix = document.getElementById('error-pix');
    if (errorPix) errorPix.style.display = 'none';

    try {
        const res = await fetch('/api/pix/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const transaction = await res.json();

        if (!res.ok) {
            throw new Error(transaction && transaction.error ? transaction.error : 'Falha ao gerar PIX');
        }

        document.getElementById('step-cpf').style.display = 'none';
        const resultBox = document.getElementById('pix-result');
        resultBox.style.display = 'block';

        const copyCode = extractPixCopyCode(transaction);
        const qrImage = extractPixQrImage(transaction);

        document.getElementById('pix-copy-text').value = copyCode
            || 'Código PIX não veio na resposta da API — consulte o painel da PrimeCash Brasil pelo id da transação.';

        const imgEl = document.getElementById('pix-qrcode-img');
        const qrBox = document.getElementById('pix-qrcode-box');
        if (qrImage) {
            // A própria PrimeCash Brasil já retornou uma imagem/URL de QR Code pronta.
            imgEl.src = qrImage;
            imgEl.style.display = 'flex';
        } else if (copyCode && qrBox && window.QRCode) {
            // Sem imagem na resposta: gera o QR Code no próprio navegador a partir
            // do código copia-e-cola, sem enviar esse código para nenhum serviço externo.
            if (renderPixQrCode(qrBox, copyCode)) {
                qrBox.style.display = 'flex';
            }
        }

        updatePixStatusUI(transaction.status || 'waiting_payment');
        if (transaction.id) pollPixStatus(transaction.id);

        // Pixel do Facebook: dispara "Purchase" assim que o PIX é gerado.
        if (typeof fbq === 'function') {
            fbq('track', 'Purchase', { value: 49.90, currency: 'BRL' });
        }
    } catch (err) {
        console.error('Erro ao gerar PIX:', err);
        if (errorPix) {
            errorPix.textContent = err.message || 'Não foi possível gerar o PIX. Tente novamente.';
            errorPix.style.display = 'block';
        }
    } finally {
        if (payButton) {
            payButton.disabled = false;
            payButton.textContent = 'Pagar R$ 49,90 com PIX';
        }
    }
}

function copyPixCode() {
    const textarea = document.getElementById('pix-copy-text');
    const btn = document.getElementById('pix-copy-btn');
    if (!textarea) return;

    textarea.focus();
    textarea.select();

    const markCopied = () => {
        if (!btn) return;
        btn.textContent = 'Copiado!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = 'Copiar código PIX';
            btn.classList.remove('copied');
        }, 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textarea.value).then(markCopied).catch(() => {
            document.execCommand('copy');
            markCopied();
        });
    } else {
        document.execCommand('copy');
        markCopied();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const phoneInput = document.getElementById('input-phone');
    const cpfInput = document.getElementById('input-cpf');
    updateCheckoutProgress('step-phone');
    if (phoneInput) phoneInput.addEventListener('input', () => { phoneInput.value = maskPhone(phoneInput.value); });
    if (cpfInput) cpfInput.addEventListener('input', () => { cpfInput.value = maskCpf(cpfInput.value); });
});

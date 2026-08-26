// Integração com a MagicPay, compartilhada entre o servidor local (dev-server.js)
// e as funções serverless da Vercel (api/*.js).
//
// As chaves NUNCA ficam hardcoded aqui — vêm sempre de variáveis de ambiente
// (MAGICPAY_PUBLIC_KEY / MAGICPAY_SECRET_KEY), definidas em .env localmente e
// no painel da Vercel (Project Settings -> Environment Variables) em produção.

const MAGICPAY_BASE_URL = 'https://api.dashboardmagicpay.com/v1';
const PIX_AMOUNT_CENTS = 4990; // R$ 49,90 fixo

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function getCredentials() {
  const publicKey = process.env.MAGICPAY_PUBLIC_KEY;
  const secretKey = process.env.MAGICPAY_SECRET_KEY;
  if (!publicKey || !secretKey) {
    throw new Error('MAGICPAY_PUBLIC_KEY / MAGICPAY_SECRET_KEY não configuradas nas variáveis de ambiente.');
  }
  return { publicKey, secretKey };
}

function authHeader() {
  const { publicKey, secretKey } = getCredentials();
  return 'Basic ' + Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
}

async function magicPayFetch(urlPath, options = {}) {
  const res = await fetch(`${MAGICPAY_BASE_URL}${urlPath}`, {
    ...options,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `MagicPay respondeu ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function createPixTransaction({ name, email, phone, cpf }) {
  return magicPayFetch('/transactions', {
    method: 'POST',
    body: JSON.stringify({
      amount: PIX_AMOUNT_CENTS,
      paymentMethod: 'pix',
      pix: { expiresInDays: 1 },
      items: [
        {
          title: 'KIT ANUAL - 8 Whey, 4 Creatina, 3 Pré-Treino e 1 Barrinha',
          unitPrice: PIX_AMOUNT_CENTS,
          quantity: 1,
          tangible: false
        }
      ],
      customer: {
        name,
        email,
        phone,
        document: { number: cpf, type: 'cpf' }
      }
    })
  });
}

function getTransaction(id) {
  return magicPayFetch(`/transactions/${encodeURIComponent(id)}`);
}

module.exports = { PIX_AMOUNT_CENTS, onlyDigits, createPixTransaction, getTransaction };

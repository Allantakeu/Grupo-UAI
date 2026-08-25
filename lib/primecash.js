// Integração com a PrimeCash Brasil (https://primecashbrasil.readme.io), compartilhada
// entre o servidor local (dev-server.js) e as funções serverless da Vercel (api/*.js).
//
// A chave NUNCA fica hardcoded aqui — vem sempre de variáveis de ambiente
// (PRIMECASH_SECRET_KEY), definidas em .env localmente e no painel da Vercel
// (Project Settings -> Environment Variables) em produção.

const PRIMECASH_BASE_URL = 'https://api.primecashbrasil.com/v1';
const PIX_AMOUNT_CENTS = 4990; // R$ 49,90 fixo

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function getSecretKey() {
  const secretKey = process.env.PRIMECASH_SECRET_KEY;
  if (!secretKey) {
    throw new Error('PRIMECASH_SECRET_KEY não configurada nas variáveis de ambiente.');
  }
  return secretKey;
}

function authHeader() {
  // A PrimeCash Brasil autentica só com a chave secreta: Basic base64("{SECRET_KEY}:x").
  return 'Basic ' + Buffer.from(`${getSecretKey()}:x`).toString('base64');
}

async function primeCashFetch(urlPath, options = {}) {
  const res = await fetch(`${PRIMECASH_BASE_URL}${urlPath}`, {
    ...options,
    headers: {
      authorization: authHeader(),
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
    const message = (data && (data.message || data.error)) || `PrimeCash Brasil respondeu ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function createPixTransaction({ name, email, phone, cpf }) {
  return primeCashFetch('/transactions', {
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
  return primeCashFetch(`/transactions/${encodeURIComponent(id)}`);
}

module.exports = { PIX_AMOUNT_CENTS, onlyDigits, createPixTransaction, getTransaction };

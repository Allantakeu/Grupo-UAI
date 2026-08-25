// Integração com a CreedX (https://api.creedx.com.br/docs/cash), compartilhada entre
// o servidor local (dev-server.js) e as funções serverless da Vercel (api/*.js).
//
// O token NUNCA fica hardcoded aqui — vem sempre de variável de ambiente
// (CREEDX_API_TOKEN), definida em .env localmente e no painel da Vercel
// (Project Settings -> Environment Variables) em produção.

const CREEDX_BASE_URL = 'https://api.creedx.com.br/api/public/cash';
const PIX_AMOUNT_CENTS = 4990; // R$ 49,90 fixo

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function getApiToken() {
  const token = process.env.CREEDX_API_TOKEN;
  if (!token) {
    throw new Error('CREEDX_API_TOKEN não configurada nas variáveis de ambiente.');
  }
  return token;
}

async function creedxFetch(urlPath, options = {}) {
  const res = await fetch(`${CREEDX_BASE_URL}${urlPath}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiToken()}`,
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
    const message = (data && (data.message || data.error)) || `CreedX respondeu ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function createPixTransaction({ name, email, phone, cpf }) {
  return creedxFetch('/deposits/pix', {
    method: 'POST',
    body: JSON.stringify({
      amount: PIX_AMOUNT_CENTS,
      method: 'pix',
      transactionOrigin: 'cashin',
      document: cpf,
      payer: {
        name,
        email,
        document: cpf,
        phone: { number: phone }
      }
    })
  });
}

function getTransaction(id) {
  return creedxFetch(`/deposits/${encodeURIComponent(id)}`);
}

module.exports = { PIX_AMOUNT_CENTS, onlyDigits, createPixTransaction, getTransaction };

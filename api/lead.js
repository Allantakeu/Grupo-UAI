const fs = require('fs');
const path = require('path');

// ATENÇÃO: no ambiente serverless da Vercel o sistema de arquivos é somente
// leitura, exceto /tmp — e /tmp é efêmero (some a cada cold start / nova
// instância / redeploy, e não é compartilhado entre instâncias). Isto evita
// que a função quebre, mas NÃO é armazenamento confiável em produção.
// Para persistir leads de verdade, troque isto por um banco de dados,
// planilha (Google Sheets/Airtable) ou um serviço de KV (Vercel KV, Upstash).
const LEADS_FILE = path.join('/tmp', 'leads.json');

// POST /api/lead — salva o lead do formulário (WhatsApp/nome/e-mail/CPF).
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const payload = req.body || {};
  const phone = String(payload.phone || '').slice(0, 20);
  const name = String(payload.name || '').slice(0, 100);
  const email = String(payload.email || '').slice(0, 100);
  const cpf = String(payload.cpf || '').slice(0, 20);

  if (!phone || !name || !cpf) {
    res.status(400).json({ error: 'Campos obrigatórios: phone, name, cpf' });
    return;
  }

  const lead = { phone, name, email, cpf, receivedAt: new Date().toISOString() };

  let leads = [];
  try {
    leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
  } catch {
    leads = [];
  }
  leads.push(lead);

  try {
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
  } catch (err) {
    console.warn('Não foi possível gravar leads.json em /tmp:', err.message);
  }

  res.status(200).json({ ok: true });
};

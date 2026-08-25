const { onlyDigits, createPixTransaction } = require('../../lib/primecash');

// POST /api/pix/create — cria a cobrança PIX de R$ 49,90 na PrimeCash Brasil.
// A Chave Secreta nunca sai desta função: o navegador só recebe de volta
// o id da transação e os dados do QR Code/copia-e-cola.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const payload = req.body || {};
  const name = String(payload.name || '').trim().slice(0, 100);
  const email = String(payload.email || '').trim().slice(0, 100);
  const phone = onlyDigits(payload.phone).slice(0, 11);
  const cpf = onlyDigits(payload.cpf).slice(0, 11);

  if (!name || !email || !phone || cpf.length !== 11) {
    res.status(400).json({ error: 'Campos obrigatórios: name, email, phone, cpf' });
    return;
  }

  try {
    const transaction = await createPixTransaction({ name, email, phone, cpf });
    res.status(200).json(transaction);
  } catch (err) {
    console.error('Falha ao criar cobrança PIX na PrimeCash Brasil:', err.message, err.data || '');
    res.status(err.status && err.status >= 400 && err.status < 500 ? 422 : 502).json({
      error: err.message || 'Falha ao criar cobrança PIX'
    });
  }
};

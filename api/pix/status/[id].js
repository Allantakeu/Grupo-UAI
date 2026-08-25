const { getTransaction } = require('../../../lib/primecash');

// GET /api/pix/status/:id — consulta o status atual de uma transação PIX
// (usado pelo front-end para saber quando o pagamento foi confirmado).
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { id } = req.query;

  try {
    const transaction = await getTransaction(id);
    res.status(200).json(transaction);
  } catch (err) {
    console.error('Falha ao consultar transação PIX na PrimeCash Brasil:', err.message, err.data || '');
    res.status(err.status && err.status >= 400 && err.status < 500 ? 404 : 502).json({
      error: err.message || 'Falha ao consultar transação PIX'
    });
  }
};

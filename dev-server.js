const http = require('http');
const fs = require('fs');
const path = require('path');

// Carrega .env para desenvolvimento local (arquivo não versionado — veja .env.example).
// Em produção (Vercel) as variáveis vêm do painel do projeto, não deste arquivo.
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // .env é opcional: sem ele, as chamadas à PrimeCash Brasil falham com um erro claro.
}

const { onlyDigits, createPixTransaction, getTransaction } = require('./lib/primecash');

const PUBLIC_DIR = __dirname;
const LEADS_FILE = path.join(__dirname, 'leads.json');
const MAX_BODY_SIZE = 10 * 1024; // 10KB é mais que suficiente para {phone, name, email, cpf}

function serveStaticFile(req, res) {
  const requestedPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  // Normaliza e garante que o caminho resolvido continua dentro da pasta pública
  // (evita path traversal via "../" no req.url).
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(PUBLIC_DIR, safePath);

  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(file);
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.avif': 'image/avif',
      '.woff2': 'font/woff2',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif'
    };

    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// Lê e valida o corpo JSON de uma requisição, respeitando MAX_BODY_SIZE.
// Em caso de erro, já escreve a resposta e resolve com null (chamador deve checar).
function readJsonBody(req, res) {
  return new Promise(resolve => {
    let body = '';
    let tooLarge = false;

    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        tooLarge = true;
        res.writeHead(413);
        res.end('Payload Too Large');
        req.destroy();
        resolve(null);
      }
    });

    req.on('end', () => {
      if (tooLarge) return;

      try {
        resolve(JSON.parse(body));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'JSON inválido' }));
        resolve(null);
      }
    });
  });
}

// Recebe o lead do formulário (WhatsApp/nome/e-mail/CPF) e salva SOMENTE em disco local.
async function handleLeadSubmission(req, res) {
  const payload = await readJsonBody(req, res);
  if (!payload) return;

  const phone = String(payload.phone || '').slice(0, 20);
  const name = String(payload.name || '').slice(0, 100);
  const email = String(payload.email || '').slice(0, 100);
  const cpf = String(payload.cpf || '').slice(0, 20);

  if (!phone || !name || !cpf) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Campos obrigatórios: phone, name, cpf' }));
    return;
  }

  const lead = { phone, name, email, cpf, receivedAt: new Date().toISOString() };

  fs.readFile(LEADS_FILE, (err, data) => {
    let leads = [];
    if (!err) {
      try { leads = JSON.parse(data); } catch { leads = []; }
    }
    leads.push(lead);

    fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2), writeErr => {
      if (writeErr) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Falha ao salvar lead' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });
}

// Cria a cobrança PIX na PrimeCash Brasil pelo valor fixo de R$ 49,90.
async function handlePixCreate(req, res) {
  const payload = await readJsonBody(req, res);
  if (!payload) return;

  const name = String(payload.name || '').trim().slice(0, 100);
  const email = String(payload.email || '').trim().slice(0, 100);
  const phone = onlyDigits(payload.phone).slice(0, 11);
  const cpf = onlyDigits(payload.cpf).slice(0, 11);

  if (!name || !email || !phone || cpf.length !== 11) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Campos obrigatórios: name, email, phone, cpf' }));
    return;
  }

  try {
    const transaction = await createPixTransaction({ name, email, phone, cpf });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(transaction));
  } catch (err) {
    console.error('Falha ao criar cobrança PIX na PrimeCash Brasil:', err.message, err.data || '');
    res.writeHead(err.status && err.status >= 400 && err.status < 500 ? 422 : 502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Falha ao criar cobrança PIX' }));
  }
}

// Consulta o status atual de uma transação PIX (usado pelo front-end para
// saber quando o pagamento foi confirmado).
async function handlePixStatus(req, res, id) {
  try {
    const transaction = await getTransaction(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(transaction));
  } catch (err) {
    console.error('Falha ao consultar transação PIX na PrimeCash Brasil:', err.message, err.data || '');
    res.writeHead(err.status && err.status >= 400 && err.status < 500 ? 404 : 502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Falha ao consultar transação PIX' }));
  }
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  if (req.method === 'POST' && urlPath === '/api/lead') {
    handleLeadSubmission(req, res);
    return;
  }

  if (req.method === 'POST' && urlPath === '/api/pix/create') {
    handlePixCreate(req, res);
    return;
  }

  if (req.method === 'GET' && urlPath.startsWith('/api/pix/status/')) {
    const id = urlPath.slice('/api/pix/status/'.length);
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Id da transação ausente' }));
      return;
    }
    handlePixStatus(req, res, id);
    return;
  }

  serveStaticFile(req, res);
});

server.listen(8000, () => {
  console.log('Server running at http://localhost:8000/');
});

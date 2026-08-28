const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const initSqlJs = require('sql.js');

const app = express();
const port = Number(process.env.PORT || 3000);
const rootDir = __dirname;
const dataDir = process.env.DATA_DIR || path.join(rootDir, 'data');
const dbPath = process.env.DB_PATH || path.join(dataDir, 'sigraf.sqlite');
const allowedKeys = new Set(['clients', 'services', 'sales', 'cash', 'settings']);
const arrayKeys = new Set(['clients', 'services', 'sales', 'cash']);
const sessionCookie = 'sigraf_session';
const sessionMaxAge = 1000 * 60 * 60 * 12;
const sessionSecret = process.env.SIGRAF_SESSION_SECRET || crypto.randomBytes(48).toString('hex');

fs.mkdirSync(dataDir, { recursive: true });

function hashPassword(text) {
  let h = 2166136261;
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8);
}

function loadUsers() {
  const users = new Map();
  const source = process.env.SIGRAF_USERS || '';

  for (const entry of source.split(/[;,]/)) {
    const [rawUser, ...rawPassword] = entry.split(':');
    const username = String(rawUser || '').trim();
    const password = rawPassword.join(':').trim();
    if (username && password) users.set(username, hashPassword(password));
  }

  return users;
}

const users = loadUsers();

function readCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => {
    const [name, ...value] = part.trim().split('=');
    return [name, decodeURIComponent(value.join('='))];
  }).filter(([name]) => name));
}

function signSession(username) {
  const payload = Buffer.from(JSON.stringify({
    username,
    exp: Date.now() + sessionMaxAge
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readSession(req) {
  const token = readCookies(req.headers.cookie)[sessionCookie];
  if (!token || !token.includes('.')) return null;

  const [payload, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session.username || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  if (!users.size) {
    res.status(503).json({ error: 'Configure SIGRAF_USERS no servidor.' });
    return;
  }

  const session = readSession(req);
  if (!session || !users.has(session.username)) {
    res.status(401).json({ error: 'Login necessário.' });
    return;
  }

  req.session = session;
  next();
}

function saveDatabase(db) {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

function getValue(db, key, fallback) {
  const stmt = db.prepare('SELECT value FROM app_data WHERE key = ?');
  stmt.bind([key]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();

  if (!row) return fallback;

  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}

function setValue(db, key, value) {
  db.run(`
    INSERT INTO app_data (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now')
  `, [key, JSON.stringify(value ?? null)]);
  saveDatabase(db);
}

function currentState(db) {
  const keys = db.exec('SELECT key FROM app_data').flatMap(result => result.values.map(row => row[0]));
  return {
    _keys: keys,
    clients: getValue(db, 'clients', []),
    services: getValue(db, 'services', []),
    sales: getValue(db, 'sales', []),
    cash: getValue(db, 'cash', []),
    settings: getValue(db, 'settings', { businessName: 'Sigraf Gráfica', adminName: 'Administrador' })
  };
}

function isValidValue(key, value) {
  if (arrayKeys.has(key)) return Array.isArray(value);
  if (key === 'settings') return value && typeof value === 'object' && !Array.isArray(value);
  return false;
}

async function main() {
  const SQL = await initSqlJs();
  const db = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS app_data (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  saveDatabase(db);

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.static(rootDir, { extensions: ['html'] }));

  app.post('/api/login', (req, res) => {
    if (!users.size) {
      res.status(503).json({ error: 'Configure SIGRAF_USERS no servidor.' });
      return;
    }

    const username = String(req.body?.username || '').trim();
    const passwordHash = hashPassword(req.body?.password || '');
    const expectedHash = users.get(username);

    if (!expectedHash || passwordHash !== expectedHash) {
      res.status(401).json({ error: 'Usuário ou senha inválidos.' });
      return;
    }

    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie(sessionCookie, signSession(username), {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: sessionMaxAge,
      path: '/'
    });
    res.json({ ok: true, username });
  });

  app.post('/api/logout', (_req, res) => {
    res.clearCookie(sessionCookie, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/session', (req, res) => {
    const session = readSession(req);
    if (!session || !users.has(session.username)) {
      res.status(401).json({ logged: false });
      return;
    }
    res.json({ logged: true, username: session.username });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, database: dbPath, usersConfigured: users.size });
  });

  app.get('/api/state', requireAuth, (_req, res) => {
    res.json(currentState(db));
  });

  app.put('/api/state/:key', requireAuth, (req, res) => {
    const { key } = req.params;
    if (!allowedKeys.has(key)) {
      res.status(400).json({ error: 'Chave de dados inválida.' });
      return;
    }
    if (!isValidValue(key, req.body)) {
      res.status(400).json({ error: 'Formato de dados inválido.' });
      return;
    }

    setValue(db, key, req.body);
    res.json({ ok: true });
  });

  app.put('/api/state', requireAuth, (req, res) => {
    const payload = req.body || {};
    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        if (!isValidValue(key, payload[key])) {
          res.status(400).json({ error: `Formato inválido para ${key}.` });
          return;
        }
        setValue(db, key, payload[key]);
      }
    }
    res.json({ ok: true });
  });

  app.get('*', (_req, res) => {
    res.sendFile(path.join(rootDir, 'index.html'));
  });

  app.listen(port, () => {
    console.log(`Sigraf Gestão rodando em http://localhost:${port}`);
    console.log(`Banco SQLite: ${dbPath}`);
    console.log(`Usuários configurados: ${users.size}`);
  });
}

main().catch(error => {
  console.error('Falha ao iniciar o servidor:', error);
  process.exit(1);
});

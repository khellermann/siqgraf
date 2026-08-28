const path = require('path');
const fs = require('fs');
const express = require('express');
const initSqlJs = require('sql.js');

const app = express();
const port = Number(process.env.PORT || 3000);
const rootDir = __dirname;
const dataDir = process.env.DATA_DIR || path.join(rootDir, 'data');
const dbPath = process.env.DB_PATH || path.join(dataDir, 'sigraf.sqlite');
const allowedKeys = new Set(['clients', 'services', 'sales', 'cash', 'settings', 'auth']);
const arrayKeys = new Set(['clients', 'services', 'sales', 'cash']);

fs.mkdirSync(dataDir, { recursive: true });

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
    settings: getValue(db, 'settings', { businessName: 'Sigraf Gráfica', adminName: 'Administrador' }),
    auth: getValue(db, 'auth', null)
  };
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

app.use(express.json({ limit: '10mb' }));
app.use(express.static(rootDir, { extensions: ['html'] }));

function isValidValue(key, value) {
  if (arrayKeys.has(key)) return Array.isArray(value);
  if (key === 'settings' || key === 'auth') return value && typeof value === 'object' && !Array.isArray(value);
  return false;
}

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, database: dbPath });
  });

  app.get('/api/state', (_req, res) => {
    res.json(currentState(db));
  });

  app.put('/api/state/:key', (req, res) => {
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

  app.put('/api/state', (req, res) => {
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
  });
}

main().catch(error => {
  console.error('Falha ao iniciar o servidor:', error);
  process.exit(1);
});

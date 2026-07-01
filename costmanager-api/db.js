const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'costmanager.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS platform_owners (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  city TEXT,
  subscription_plan TEXT,
  subscription_expires TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trial',
  trial_started TEXT,
  created_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS subscription_pricing (
  plan TEXT PRIMARY KEY,
  amount INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscription_payments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  plan TEXT NOT NULL,
  amount INTEGER NOT NULL,
  transfer_ref TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_login TEXT,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  UNIQUE(business_id, username)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  platform_owner_id TEXT REFERENCES platform_owners(id),
  business_id TEXT,
  refresh_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS business_data (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  store_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  UNIQUE(business_id, store_name, record_id)
);

CREATE INDEX IF NOT EXISTS idx_business_data_lookup
  ON business_data(business_id, updated_at);

CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  device_id TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  records_pushed INTEGER NOT NULL DEFAULT 0,
  records_pulled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS platform_metrics (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  date TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  metric_value REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_broadcasts (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS petty_cash_transactions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_by_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  approved_at TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  receipt_url TEXT
);

CREATE TABLE IF NOT EXISTS petty_cash_permissions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  can_view INTEGER NOT NULL DEFAULT 1,
  can_withdraw INTEGER NOT NULL DEFAULT 0,
  can_request INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(business_id, user_id)
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ingredient_id TEXT,
  requested_qty REAL,
  items TEXT NOT NULL,
  needed_by_datetime TEXT,
  estimated_total REAL,
  note TEXT,
  accepted_by TEXT,
  accepted_at TEXT,
  estimated_purchase_datetime TEXT,
  completed_by TEXT,
  completed_at TEXT,
  actual_price REAL,
  actual_qty REAL,
  actual_total REAL,
  payment_method TEXT,
  cash_amount REAL,
  credit_amount REAL,
  supplier_id TEXT,
  invoice_ref TEXT,
  invoice_image_url TEXT,
  receipt_url TEXT,
  completion_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  phone TEXT,
  balance REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_transactions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  purchase_request_id TEXT,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  detail TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  uploaded_by TEXT,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

function migrate() {
  db.exec(SCHEMA);

  const ownerCount = db.prepare('SELECT COUNT(*) AS n FROM platform_owners').get().n;
  if (ownerCount === 0) {
    const bcrypt = require('bcrypt');
    const { v4: uuid } = require('uuid');
    const username = process.env.PLATFORM_OWNER_USERNAME || 'platform_admin';
    const password = process.env.PLATFORM_OWNER_PASSWORD;
    if (password) {
      db.prepare(
        'INSERT INTO platform_owners (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
      ).run(uuid(), username, bcrypt.hashSync(password, 12), new Date().toISOString());
      console.log(`Platform owner seeded: ${username}`);
    } else {
      console.warn('No PLATFORM_OWNER_PASSWORD in .env — run setup.sh first.');
    }
  }

  const pricingCount = db.prepare('SELECT COUNT(*) AS n FROM subscription_pricing').get().n;
  if (pricingCount === 0) {
    const now = new Date().toISOString();
    const defaults = [
      ['1m', 990000],
      ['3m', 2700000],
      ['6m', 4990000],
      ['12m', 8990000],
    ];
    const insert = db.prepare(
      'INSERT INTO subscription_pricing (plan, amount, updated_at) VALUES (?, ?, ?)',
    );
    for (const [plan, amount] of defaults) insert.run(plan, amount, now);
  }

  // Add new purchase_request columns to existing databases (idempotent — fails silently if already present)
  const prNewCols = [
    ['ingredient_id', 'TEXT'],
    ['requested_qty', 'REAL'],
    ['actual_price', 'REAL'],
    ['actual_qty', 'REAL'],
    ['payment_method', 'TEXT'],
    ['cash_amount', 'REAL'],
    ['credit_amount', 'REAL'],
    ['supplier_id', 'TEXT'],
    ['invoice_ref', 'TEXT'],
    ['invoice_image_url', 'TEXT'],
  ];
  for (const [col, type] of prNewCols) {
    try { db.exec(`ALTER TABLE purchase_requests ADD COLUMN ${col} ${type}`); } catch {}
  }

  console.log('Migrations complete.');
}

module.exports = { db, migrate };

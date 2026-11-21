import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'makhzouni.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function ensureColumnExists(tableName: string, columnName: string, columnDef: string) {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
  }
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      barcode TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'عام',
      currency TEXT NOT NULL DEFAULT 'ر.س',
      cost_price REAL NOT NULL DEFAULT 0,
      sell_price REAL NOT NULL DEFAULT 0,
      stock_qty INTEGER NOT NULL DEFAULT 0,
      min_stock_threshold INTEGER NOT NULL DEFAULT 5,
      unit_label TEXT NOT NULL DEFAULT 'قطعة',
      image_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      tax_id TEXT NOT NULL DEFAULT '',
      customer_type TEXT NOT NULL DEFAULT 'business',
      is_vip INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'ر.س',
      credit_limit REAL NOT NULL DEFAULT 50000,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      customer_name_snapshot TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'ر.س',
      subtotal REAL NOT NULL DEFAULT 0,
      vat_rate REAL NOT NULL DEFAULT 15,
      vat_amount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      remaining_amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      paid_channel TEXT NOT NULL DEFAULT 'cash',
      status TEXT NOT NULL DEFAULT 'paid',
      due_date TEXT,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      cost_price REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
      currency TEXT NOT NULL DEFAULT 'ر.س',
      amount REAL NOT NULL,
      method TEXT NOT NULL DEFAULT 'cash',
      reference_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity_change INTEGER NOT NULL,
      previous_qty INTEGER NOT NULL,
      new_qty INTEGER NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      reference_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Safe schema migrations for existing SQLite databases
  ensureColumnExists('products', 'currency', `TEXT NOT NULL DEFAULT 'ر.س'`);
  ensureColumnExists('customers', 'currency', `TEXT NOT NULL DEFAULT 'ر.س'`);
  ensureColumnExists('invoices', 'currency', `TEXT NOT NULL DEFAULT 'ر.س'`);
  ensureColumnExists('payments', 'currency', `TEXT NOT NULL DEFAULT 'ر.س'`);

  seedDefaultSettingsOnly();
}

function seedDefaultSettingsOnly() {
  const defaultSettings: Record<string, string> = {
    store_name: 'مخزوني بلس',
    manager_name: 'مدير المتجر',
    tax_number: '',
    vat_rate: '15',
    currency: 'ر.س',
    monthly_sales_target: '100000',
    quarterly_profit_target: '50000',
    invoice_footer: 'شكراً لتعاملكم معنا',
    low_stock_default_threshold: '5',
  };

  const upsertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  for (const [k, v] of Object.entries(defaultSettings)) {
    upsertSetting.run(k, v);
  }
}

export function clearAllBusinessData() {
  db.transaction(() => {
    db.exec(`
      DELETE FROM invoice_items;
      DELETE FROM payments;
      DELETE FROM stock_movements;
      DELETE FROM invoices;
      DELETE FROM customers;
      DELETE FROM products;
      DELETE FROM sqlite_sequence WHERE name IN ('products','customers','invoices','invoice_items','payments','stock_movements');
    `);
  })();
}

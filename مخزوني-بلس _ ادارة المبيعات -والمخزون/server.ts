import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { clearAllBusinessData, db, initDatabase } from './server/db.ts';

initDatabase();

const app = express();
app.use(express.json({ limit: '5mb' }));

function normalizeCurrency(input: unknown, fallback = 'ر.س'): 'ر.س' | 'ر.ي' {
  return input === 'ر.ي' ? 'ر.ي' : input === 'ر.س' ? 'ر.س' : fallback === 'ر.ي' ? 'ر.ي' : 'ر.س';
}

function getSettingsMap() {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    store_name: map.store_name || 'مخزوني بلس',
    manager_name: map.manager_name || 'مدير المتجر',
    tax_number: map.tax_number || '',
    vat_rate: Number(map.vat_rate ?? 15),
    currency: normalizeCurrency(map.currency, 'ر.س'),
    monthly_sales_target: Number(map.monthly_sales_target ?? 100000),
    quarterly_profit_target: Number(map.quarterly_profit_target ?? 50000),
    invoice_footer: map.invoice_footer || 'شكراً لتعاملكم معنا',
    low_stock_default_threshold: Number(map.low_stock_default_threshold ?? 5),
  };
}

function enrichCustomers(rows: any[]) {
  const nowMs = Date.now();
  const invStmt = db.prepare(`
    SELECT id, total_amount, paid_amount, remaining_amount, status, due_date, created_at
    FROM invoices
    WHERE customer_id = ? AND status != 'cancelled'
  `);

  return rows.map((c) => {
    const invs = invStmt.all(c.id) as any[];
    let total_purchases = 0;
    let total_paid = 0;
    let balance_due = 0;
    let unpaid_invoice_count = 0;
    let maxOverdueDays = 0;
    let nextDueDate: string | null = null;

    for (const inv of invs) {
      total_purchases += Number(inv.total_amount || 0);
      total_paid += Number(inv.paid_amount || 0);
      const rem = Number(inv.remaining_amount || 0);
      if (rem > 0.01) {
        balance_due += rem;
        unpaid_invoice_count += 1;
        if (inv.due_date) {
          const dueMs = new Date(inv.due_date).getTime();
          const diffDays = Math.floor((nowMs - dueMs) / (1000 * 60 * 60 * 24));
          if (diffDays > maxOverdueDays) {
            maxOverdueDays = diffDays;
          }
          if (!nextDueDate || inv.due_date < nextDueDate) {
            nextDueDate = inv.due_date;
          }
        }
      }
    }

    return {
      ...c,
      currency: normalizeCurrency(c.currency, 'ر.س'),
      total_purchases: Number(total_purchases.toFixed(2)),
      total_paid: Number(total_paid.toFixed(2)),
      balance_due: Number(balance_due.toFixed(2)),
      invoice_count: invs.length,
      unpaid_invoice_count,
      overdue_days: maxOverdueDays,
      next_due_date: nextDueDate,
    };
  });
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Reset all business data
app.post('/api/reset-all', (_req, res) => {
  clearAllBusinessData();
  res.json({ reset: true });
});

// Settings
app.get('/api/settings', (_req, res) => {
  res.json(getSettingsMap());
});

app.put('/api/settings', (req, res) => {
  const allowed = [
    'store_name',
    'manager_name',
    'tax_number',
    'vat_rate',
    'currency',
    'monthly_sales_target',
    'quarterly_profit_target',
    'invoice_footer',
    'low_stock_default_threshold',
  ];
  const stmt = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  const tx = db.transaction((body: Record<string, any>) => {
    for (const key of allowed) {
      if (body[key] !== undefined && body[key] !== null) {
        stmt.run(key, String(body[key]));
      }
    }
  });
  tx(req.body || {});
  res.json(getSettingsMap());
});

// Dashboard
app.get('/api/dashboard', (req, res) => {
  const period = (req.query.period as string) || 'daily';
  const settings = getSettingsMap();

  const invAgg = db.prepare(`
    SELECT
      COALESCE(SUM(total_amount), 0) as totalSales,
      COALESCE(SUM(paid_amount), 0) as totalCollected,
      COALESCE(SUM(remaining_amount), 0) as totalDebts
    FROM invoices
    WHERE status != 'cancelled'
  `).get() as { totalSales: number; totalCollected: number; totalDebts: number };

  const debtorCount = (db.prepare(`
    SELECT COUNT(DISTINCT customer_id) as cnt
    FROM invoices
    WHERE status != 'cancelled' AND remaining_amount > 0.01 AND customer_id IS NOT NULL
  `).get() as { cnt: number }).cnt;

  const prodAgg = db.prepare(`
    SELECT
      COUNT(*) as totalProducts,
      COALESCE(SUM(CASE WHEN stock_qty > 0 THEN 1 ELSE 0 END), 0) as availableProducts,
      COALESCE(SUM(CASE WHEN stock_qty > 0 AND stock_qty <= min_stock_threshold THEN 1 ELSE 0 END), 0) as lowStockCount,
      COALESCE(SUM(CASE WHEN stock_qty <= 0 THEN 1 ELSE 0 END), 0) as outOfStockCount
    FROM products
  `).get() as any;

  const activeCustomers = (db.prepare(`SELECT COUNT(*) as cnt FROM customers`).get() as { cnt: number }).cnt;
  const repeatCustomers = (db.prepare(`
    SELECT COUNT(*) as cnt FROM (
      SELECT customer_id FROM invoices WHERE status != 'cancelled' AND customer_id IS NOT NULL GROUP BY customer_id HAVING COUNT(*) >= 1
    )
  `).get() as { cnt: number }).cnt;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayStats = db.prepare(`
    SELECT
      COUNT(*) as todayInvoicesCount,
      COALESCE(SUM(total_amount), 0) as todayTotalRevenue,
      COALESCE(SUM(CASE WHEN paid_channel = 'cash' THEN paid_amount ELSE 0 END), 0) as todayCashTotal,
      COALESCE(SUM(CASE WHEN paid_channel = 'card' THEN paid_amount ELSE 0 END), 0) as todayCardTotal,
      COALESCE(SUM(CASE WHEN paid_channel = 'transfer' THEN paid_amount ELSE 0 END), 0) as todayTransferTotal
    FROM invoices
    WHERE status != 'cancelled' AND substr(created_at, 1, 10) = ?
  `).get(todayStr) as any;

  const allInvoices = db.prepare(`SELECT total_amount, created_at FROM invoices WHERE status != 'cancelled'`).all() as { total_amount: number; created_at: string }[];
  let chartSeries: { label: string; current: number; previous: number }[] = [];

  if (period === 'daily') {
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - i);
      const dateStr = dt.toISOString().split('T')[0];
      const prevDt = new Date(dt);
      prevDt.setDate(prevDt.getDate() - 7);
      const prevStr = prevDt.toISOString().split('T')[0];

      const current = allInvoices
        .filter((inv) => inv.created_at.startsWith(dateStr))
        .reduce((acc, inv) => acc + Number(inv.total_amount), 0);
      const previous = allInvoices
        .filter((inv) => inv.created_at.startsWith(prevStr))
        .reduce((acc, inv) => acc + Number(inv.total_amount), 0);

      chartSeries.push({
        label: dayNames[dt.getDay()],
        current: Number(current.toFixed(2)),
        previous: Number(previous.toFixed(2)),
      });
    }
  } else if (period === 'weekly') {
    const now = new Date();
    for (let w = 3; w >= 0; w--) {
      const start = new Date(now);
      start.setDate(start.getDate() - (w + 1) * 7);
      const end = new Date(now);
      end.setDate(end.getDate() - w * 7);
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 28);
      const prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 28);

      const current = allInvoices
        .filter((inv) => {
          const d = new Date(inv.created_at);
          return d >= start && d < end;
        })
        .reduce((acc, inv) => acc + Number(inv.total_amount), 0);
      const previous = allInvoices
        .filter((inv) => {
          const d = new Date(inv.created_at);
          return d >= prevStart && d < prevEnd;
        })
        .reduce((acc, inv) => acc + Number(inv.total_amount), 0);

      chartSeries.push({
        label: `الأسبوع ${4 - w}`,
        current: Number(current.toFixed(2)),
        previous: Number(previous.toFixed(2)),
      });
    }
  } else {
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const now = new Date();
    for (let m = 5; m >= 0; m--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const prevDt = new Date(now.getFullYear(), now.getMonth() - m - 1, 1);
      const prevYm = `${prevDt.getFullYear()}-${String(prevDt.getMonth() + 1).padStart(2, '0')}`;

      const current = allInvoices
        .filter((inv) => inv.created_at.startsWith(ym))
        .reduce((acc, inv) => acc + Number(inv.total_amount), 0);
      const previous = allInvoices
        .filter((inv) => inv.created_at.startsWith(prevYm))
        .reduce((acc, inv) => acc + Number(inv.total_amount), 0);

      chartSeries.push({
        label: monthNames[dt.getMonth()],
        current: Number(current.toFixed(2)),
        previous: Number(previous.toFixed(2)),
      });
    }
  }

  let peakDay = { label: 'اليوم', amount: 0 };
  for (const pt of chartSeries) {
    if (pt.current > peakDay.amount) {
      peakDay = { label: pt.label, amount: pt.current };
    }
  }

  const currentPeriodSum = chartSeries.reduce((s, x) => s + x.current, 0);
  const previousPeriodSum = chartSeries.reduce((s, x) => s + x.previous, 0);
  const salesGrowthPct =
    previousPeriodSum > 0
      ? Number((((currentPeriodSum - previousPeriodSum) / previousPeriodSum) * 100).toFixed(1))
      : 0;

  const criticalStock = db.prepare(`
    SELECT * FROM products
    WHERE stock_qty <= min_stock_threshold
    ORDER BY stock_qty ASC, id ASC
    LIMIT 6
  `).all();

  const latestInvoices = db.prepare(`
    SELECT * FROM invoices
    WHERE status != 'cancelled'
    ORDER BY created_at DESC, id DESC
    LIMIT 5
  `).all();

  const totalSales = Number(invAgg.totalSales.toFixed(2));
  const totalCollected = Number(invAgg.totalCollected.toFixed(2));
  const totalDebts = Number(invAgg.totalDebts.toFixed(2));
  const collectionRate = totalSales > 0 ? Math.round((totalCollected / totalSales) * 100) : 0;
  const targetProgress = settings.monthly_sales_target > 0
    ? Math.min(100, Math.round((totalSales / settings.monthly_sales_target) * 100))
    : 0;
  const retentionRate = activeCustomers > 0 ? Math.min(100, Math.round((repeatCustomers / activeCustomers) * 100)) : 0;

  res.json({
    settings,
    kpis: {
      totalSales,
      totalCollected,
      collectionRate,
      totalDebts,
      debtorCount,
      totalProducts: prodAgg.totalProducts || 0,
      availableProducts: prodAgg.availableProducts || 0,
      lowStockCount: prodAgg.lowStockCount || 0,
      outOfStockCount: prodAgg.outOfStockCount || 0,
      activeCustomers,
      retentionRate,
      monthlyTarget: settings.monthly_sales_target,
      targetProgress,
      todaySales: Number((todayStats.todayTotalRevenue || 0).toFixed(2)),
      salesGrowthPct,
    },
    chartSeries,
    peakDaySales: peakDay,
    criticalStock,
    latestInvoices,
    dailyClosure: {
      todayInvoicesCount: todayStats.todayInvoicesCount || 0,
      todayCashTotal: Number((todayStats.todayCashTotal || 0).toFixed(2)),
      todayCardTotal: Number((todayStats.todayCardTotal || 0).toFixed(2)),
      todayTransferTotal: Number((todayStats.todayTransferTotal || 0).toFixed(2)),
      todayTotalRevenue: Number((todayStats.todayTotalRevenue || 0).toFixed(2)),
    },
  });
});

// Products CRUD
app.get('/api/products', (_req, res) => {
  const rows = db.prepare(`
    SELECT p.*, COALESCE(SUM(CASE WHEN inv.id IS NOT NULL THEN ii.quantity ELSE 0 END), 0) as total_sold
    FROM products p
    LEFT JOIN invoice_items ii ON ii.product_id = p.id
    LEFT JOIN invoices inv ON inv.id = ii.invoice_id AND inv.status != 'cancelled'
    GROUP BY p.id
    ORDER BY p.created_at DESC, p.id DESC
  `).all();
  res.json(rows);
});

app.post('/api/products', (req, res) => {
  const { name, sku, barcode, category, currency, cost_price, sell_price, stock_qty, min_stock_threshold, unit_label, image_url } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'اسم المنتج مطلوب' });
  }
  const settings = getSettingsMap();
  const cleanSku = String(sku || `PRD-${Date.now().toString().slice(-6)}`).trim();
  const qty = Math.max(0, Math.floor(Number(stock_qty ?? 0)));
  const cost = Math.max(0, Number(cost_price ?? 0));
  const sell = Math.max(0, Number(sell_price ?? 0));
  const minThresh = Math.max(0, Math.floor(Number(min_stock_threshold ?? settings.low_stock_default_threshold)));
  const prodCurrency = normalizeCurrency(currency, settings.currency);

  try {
    const created = db.transaction(() => {
      const nowIso = new Date().toISOString();
      const info = db.prepare(`
        INSERT INTO products (name, sku, barcode, category, currency, cost_price, sell_price, stock_qty, min_stock_threshold, unit_label, image_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(name).trim(),
        cleanSku,
        String(barcode || cleanSku).trim(),
        String(category || 'عام').trim(),
        prodCurrency,
        cost,
        sell,
        qty,
        minThresh,
        String(unit_label || 'قطعة').trim(),
        String(image_url || '').trim(),
        nowIso,
        nowIso
      );
      const pid = Number(info.lastInsertRowid);
      if (qty > 0) {
        db.prepare(`
          INSERT INTO stock_movements (product_id, product_name, type, quantity_change, previous_qty, new_qty, reason, reference_id, created_at)
          VALUES (?, ?, 'in', ?, 0, ?, 'إضافة منتج جديد', ?, ?)
        `).run(pid, String(name).trim(), qty, qty, cleanSku, nowIso);
      }
      return db.prepare('SELECT * FROM products WHERE id = ?').get(pid);
    })();
    res.status(201).json(created);
  } catch (err: any) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(400).json({ error: 'رمز SKU مستخدم بالفعل لمنتج آخر' });
    }
    res.status(500).json({ error: 'تعذر إضافة المنتج' });
  }
});

app.put('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
  if (!existing) return res.status(404).json({ error: 'المنتج غير موجود' });

  const { name, sku, barcode, category, currency, cost_price, sell_price, stock_qty, min_stock_threshold, unit_label, image_url } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'اسم المنتج مطلوب' });
  }

  const newQty = stock_qty !== undefined ? Math.max(0, Math.floor(Number(stock_qty))) : existing.stock_qty;
  const prodCurrency = currency !== undefined ? normalizeCurrency(currency, existing.currency) : normalizeCurrency(existing.currency);
  const nowIso = new Date().toISOString();

  try {
    const updated = db.transaction(() => {
      db.prepare(`
        UPDATE products
        SET name = ?, sku = ?, barcode = ?, category = ?, currency = ?, cost_price = ?, sell_price = ?, stock_qty = ?, min_stock_threshold = ?, unit_label = ?, image_url = ?, updated_at = ?
        WHERE id = ?
      `).run(
        String(name).trim(),
        String(sku || existing.sku).trim(),
        String(barcode ?? existing.barcode).trim(),
        String(category || existing.category || 'عام').trim(),
        prodCurrency,
        Math.max(0, Number(cost_price ?? existing.cost_price)),
        Math.max(0, Number(sell_price ?? existing.sell_price)),
        newQty,
        Math.max(0, Math.floor(Number(min_stock_threshold ?? existing.min_stock_threshold))),
        String(unit_label || existing.unit_label).trim(),
        String(image_url ?? existing.image_url),
        nowIso,
        id
      );

      if (newQty !== existing.stock_qty) {
        const diff = newQty - existing.stock_qty;
        db.prepare(`
          INSERT INTO stock_movements (product_id, product_name, type, quantity_change, previous_qty, new_qty, reason, reference_id, created_at)
          VALUES (?, ?, 'adjust', ?, ?, ?, 'تعديل يدوي للمخزون', ?, ?)
        `).run(id, String(name).trim(), diff, existing.stock_qty, newQty, String(sku || existing.sku), nowIso);
      }

      return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    })();
    res.json(updated);
  } catch (err: any) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(400).json({ error: 'رمز SKU مستخدم بالفعل لمنتج آخر' });
    }
    res.status(500).json({ error: 'تعذر تحديث بيانات المنتج' });
  }
});

app.post('/api/products/:id/restock', (req, res) => {
  const id = Number(req.params.id);
  const qty = Math.floor(Number(req.body?.quantity ?? 0));
  const reason = String(req.body?.reason || 'طلب توريد سريع للمخزون').trim();

  if (qty <= 0) {
    return res.status(400).json({ error: 'يجب إدخال كمية توريد أكبر من صفر' });
  }

  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
  if (!existing) return res.status(404).json({ error: 'المنتج غير موجود' });

  const nowIso = new Date().toISOString();
  const updated = db.transaction(() => {
    const newQty = existing.stock_qty + qty;
    db.prepare(`UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?`).run(newQty, nowIso, id);
    db.prepare(`
      INSERT INTO stock_movements (product_id, product_name, type, quantity_change, previous_qty, new_qty, reason, reference_id, created_at)
      VALUES (?, ?, 'in', ?, ?, ?, ?, ?, ?)
    `).run(id, existing.name, qty, existing.stock_qty, newQty, reason, `SUP-${Date.now().toString().slice(-5)}`, nowIso);
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  })();

  res.json(updated);
});

app.delete('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'المنتج غير موجود' });
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ deleted: true, id });
});

app.get('/api/stock-movements', (_req, res) => {
  const rows = db.prepare('SELECT * FROM stock_movements ORDER BY created_at DESC, id DESC LIMIT 100').all();
  res.json(rows);
});

// Customers CRUD & Statement
app.get('/api/customers', (_req, res) => {
  const rows = db.prepare('SELECT * FROM customers ORDER BY id DESC').all();
  const enriched = enrichCustomers(rows);
  enriched.sort((a, b) => b.balance_due - a.balance_due || b.total_purchases - a.total_purchases);
  res.json(enriched);
});

app.get('/api/customers/:id/statement', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'العميل غير موجود' });

  const [customer] = enrichCustomers([row]);
  const invoices = db.prepare(`
    SELECT i.*, c.phone as customer_phone, c.tax_id as customer_tax_id
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.customer_id = ?
    ORDER BY i.created_at DESC, i.id DESC
  `).all(id) as any[];

  for (const inv of invoices) {
    inv.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(inv.id);
  }

  const payments = db.prepare(`
    SELECT p.*, i.invoice_number
    FROM payments p
    LEFT JOIN invoices i ON i.id = p.invoice_id
    WHERE p.customer_id = ?
    ORDER BY p.created_at DESC, p.id DESC
  `).all(id);

  const purchasedItems = db.prepare(`
    SELECT
      ii.product_name,
      ii.sku,
      SUM(ii.quantity) as total_qty,
      SUM(ii.line_total) as total_spent,
      MAX(inv.created_at) as last_purchased_at
    FROM invoice_items ii
    JOIN invoices inv ON inv.id = ii.invoice_id
    WHERE inv.customer_id = ? AND inv.status != 'cancelled'
    GROUP BY ii.product_name, ii.sku
    ORDER BY total_spent DESC
  `).all(id);

  res.json({ customer, invoices, payments, purchasedItems });
});

app.post('/api/customers', (req, res) => {
  const { name, company_name, phone, tax_id, customer_type, is_vip, currency, credit_limit, notes } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'اسم العميل مطلوب' });
  }
  const settings = getSettingsMap();
  const custCurrency = normalizeCurrency(currency, settings.currency);
  const nowIso = new Date().toISOString();

  const info = db.prepare(`
    INSERT INTO customers (name, company_name, phone, tax_id, customer_type, is_vip, currency, credit_limit, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(name).trim(),
    String(company_name || '').trim(),
    String(phone || '').trim(),
    String(tax_id || '').trim(),
    customer_type === 'individual' ? 'individual' : 'business',
    is_vip ? 1 : 0,
    custCurrency,
    Math.max(0, Number(credit_limit ?? 50000)),
    String(notes || '').trim(),
    nowIso
  );

  const created = db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json(enrichCustomers([created])[0]);
});

app.put('/api/customers/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as any;
  if (!existing) return res.status(404).json({ error: 'العميل غير موجود' });

  const { name, company_name, phone, tax_id, customer_type, is_vip, currency, credit_limit, notes } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'اسم العميل مطلوب' });
  }
  const custCurrency = currency !== undefined ? normalizeCurrency(currency, existing.currency) : normalizeCurrency(existing.currency);

  db.prepare(`
    UPDATE customers
    SET name = ?, company_name = ?, phone = ?, tax_id = ?, customer_type = ?, is_vip = ?, currency = ?, credit_limit = ?, notes = ?
    WHERE id = ?
  `).run(
    String(name).trim(),
    String(company_name ?? existing.company_name).trim(),
    String(phone ?? existing.phone).trim(),
    String(tax_id ?? existing.tax_id).trim(),
    customer_type === 'individual' ? 'individual' : 'business',
    is_vip ? 1 : 0,
    custCurrency,
    Math.max(0, Number(credit_limit ?? existing.credit_limit)),
    String(notes ?? existing.notes).trim(),
    id
  );

  const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  res.json(enrichCustomers([updated])[0]);
});

app.delete('/api/customers/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'العميل غير موجود' });

  const [enriched] = enrichCustomers([existing]);
  if (enriched.balance_due > 0.01) {
    return res.status(400).json({ error: 'لا يمكن حذف عميل لديه مديونية مستحقة غير مسددة' });
  }

  db.prepare('DELETE FROM customers WHERE id = ?').run(id);
  res.json({ deleted: true, id });
});

// Invoices CRUD & POS Checkout
app.get('/api/invoices', (_req, res) => {
  const rows = db.prepare(`
    SELECT i.*, c.phone as customer_phone, c.tax_id as customer_tax_id
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    ORDER BY i.created_at DESC, i.id DESC
  `).all() as any[];

  const itemsStmt = db.prepare(`
    SELECT ii.*, p.image_url
    FROM invoice_items ii
    LEFT JOIN products p ON p.id = ii.product_id
    WHERE ii.invoice_id = ?
  `);

  for (const inv of rows) {
    inv.items = itemsStmt.all(inv.id);
  }
  res.json(rows);
});

app.get('/api/invoices/:id', (req, res) => {
  const id = Number(req.params.id);
  const inv = db.prepare(`
    SELECT i.*, c.phone as customer_phone, c.tax_id as customer_tax_id
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.id = ?
  `).get(id) as any;
  if (!inv) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
  inv.items = db.prepare(`
    SELECT ii.*, p.image_url
    FROM invoice_items ii
    LEFT JOIN products p ON p.id = ii.product_id
    WHERE ii.invoice_id = ?
  `).all(id);
  res.json(inv);
});

app.post('/api/invoices', (req, res) => {
  const {
    customer_id,
    items,
    currency,
    discount_amount = 0,
    payment_method = 'cash',
    paid_channel = 'cash',
    paid_amount: inputPaidAmount,
    due_days = 30,
    notes = '',
  } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'يجب إضافة منتج واحد على الأقل للفاتورة' });
  }

  const settings = getSettingsMap();
  const invCurrency = normalizeCurrency(currency, settings.currency);

  try {
    const createdInvoice = db.transaction(() => {
      let customerName = 'عميل نقدي عام';
      let validCustomerId: number | null = null;
      if (customer_id) {
        const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(customer_id)) as any;
        if (!cust) throw new Error('العميل المحدد غير موجود');
        validCustomerId = cust.id;
        customerName = cust.name;
      }

      if (payment_method === 'credit' && !validCustomerId) {
        throw new Error('يجب اختيار عميل مسجل لإصدار فاتورة آجلة');
      }

      let subtotal = 0;
      const verifiedItems: any[] = [];

      for (const reqItem of items) {
        const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(reqItem.product_id)) as any;
        if (!prod) throw new Error('أحد المنتجات المختارة غير موجود');
        const qty = Math.floor(Number(reqItem.quantity));
        if (qty <= 0) throw new Error(`كمية غير صالحة للمنتج "${prod.name}"`);
        if (prod.stock_qty < qty) {
          throw new Error(`الكمية المتاحة من "${prod.name}" هي ${prod.stock_qty} فقط`);
        }

        const unitPrice = reqItem.unit_price !== undefined ? Math.max(0, Number(reqItem.unit_price)) : Number(prod.sell_price);
        const lineTotal = Number((unitPrice * qty).toFixed(2));
        subtotal += lineTotal;

        verifiedItems.push({
          product: prod,
          qty,
          unitPrice,
          costPrice: Number(prod.cost_price),
          lineTotal,
        });
      }

      subtotal = Number(subtotal.toFixed(2));
      const vatRate = settings.vat_rate;
      const vatAmount = Number(((subtotal * vatRate) / 100).toFixed(2));
      const discount = Math.max(0, Math.min(subtotal + vatAmount, Number(discount_amount || 0)));
      const totalAmount = Number((subtotal + vatAmount - discount).toFixed(2));

      let paidAmount = totalAmount;
      if (payment_method === 'credit') {
        paidAmount = 0;
      } else if (payment_method === 'split') {
        paidAmount = Math.max(0, Math.min(totalAmount, Number(inputPaidAmount ?? 0)));
      }
      paidAmount = Number(paidAmount.toFixed(2));
      const remainingAmount = Number((totalAmount - paidAmount).toFixed(2));

      if (remainingAmount > 0.01 && !validCustomerId) {
        throw new Error('لا يمكن ترحيل مبلغ آجل لعميل نقدي عام — يرجى اختيار عميل مسجل');
      }

      const status = remainingAmount <= 0.01 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
      const channel = paid_channel === 'card' || paid_channel === 'transfer' ? paid_channel : 'cash';

      const lastInv = db.prepare('SELECT MAX(id) as maxId FROM invoices').get() as { maxId: number | null };
      const nextNum = 1001 + (lastInv.maxId || 0);
      const invoiceNumber = `INV-${new Date().getFullYear()}-${nextNum}`;

      const dueDt = new Date();
      dueDt.setDate(dueDt.getDate() + Math.max(1, Number(due_days || 30)));
      const dueDateStr = dueDt.toISOString().split('T')[0];

      const nowIso = new Date().toISOString();
      const invRes = db.prepare(`
        INSERT INTO invoices (
          invoice_number, customer_id, customer_name_snapshot, currency, subtotal, vat_rate, vat_amount,
          discount_amount, total_amount, paid_amount, remaining_amount, payment_method, paid_channel,
          status, due_date, notes, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceNumber,
        validCustomerId,
        customerName,
        invCurrency,
        subtotal,
        vatRate,
        vatAmount,
        discount,
        totalAmount,
        paidAmount,
        remainingAmount,
        payment_method,
        channel,
        status,
        dueDateStr,
        String(notes || ''),
        nowIso
      );
      const invoiceId = Number(invRes.lastInsertRowid);

      const insItem = db.prepare(`
        INSERT INTO invoice_items (invoice_id, product_id, product_name, sku, quantity, unit_price, cost_price, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const updStock = db.prepare(`UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?`);
      const insMove = db.prepare(`
        INSERT INTO stock_movements (product_id, product_name, type, quantity_change, previous_qty, new_qty, reason, reference_id, created_at)
        VALUES (?, ?, 'out', ?, ?, ?, ?, ?, ?)
      `);

      for (const item of verifiedItems) {
        insItem.run(invoiceId, item.product.id, item.product.name, item.product.sku, item.qty, item.unitPrice, item.costPrice, item.lineTotal);
        const newQty = item.product.stock_qty - item.qty;
        updStock.run(newQty, nowIso, item.product.id);
        insMove.run(
          item.product.id,
          item.product.name,
          -item.qty,
          item.product.stock_qty,
          newQty,
          `مبيعات فاتورة ${invoiceNumber}`,
          invoiceNumber,
          nowIso
        );
      }

      if (paidAmount > 0) {
        const lastPay = db.prepare('SELECT MAX(id) as maxId FROM payments').get() as { maxId: number | null };
        const recNum = `REC-${1000 + (lastPay.maxId || 0) + 1}`;
        db.prepare(`
          INSERT INTO payments (receipt_number, customer_id, invoice_id, currency, amount, method, reference_note, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(recNum, validCustomerId, invoiceId, invCurrency, paidAmount, channel, `دفعة فورية - فاتورة ${invoiceNumber}`, nowIso);
      }

      const fullInv = db.prepare(`
        SELECT i.*, c.phone as customer_phone, c.tax_id as customer_tax_id
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        WHERE i.id = ?
      `).get(invoiceId) as any;
      fullInv.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId);
      return fullInv;
    })();

    res.status(201).json(createdInvoice);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'تعذر إصدار الفاتورة' });
  }
});

app.post('/api/invoices/:id/cancel', (req, res) => {
  const id = Number(req.params.id);
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
  if (!inv) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
  if (inv.status === 'cancelled') return res.status(400).json({ error: 'الفاتورة ملغاة مسبقاً' });

  const nowIso = new Date().toISOString();
  db.transaction(() => {
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id) as any[];
    const updStock = db.prepare(`UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?`);
    const insMove = db.prepare(`
      INSERT INTO stock_movements (product_id, product_name, type, quantity_change, previous_qty, new_qty, reason, reference_id, created_at)
      VALUES (?, ?, 'return', ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      if (item.product_id) {
        const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id) as any;
        if (prod) {
          const newQty = prod.stock_qty + item.quantity;
          updStock.run(newQty, nowIso, prod.id);
          insMove.run(prod.id, prod.name, item.quantity, prod.stock_qty, newQty, `إلغاء فاتورة ${inv.invoice_number}`, inv.invoice_number, nowIso);
        }
      }
    }

    db.prepare(`UPDATE invoices SET status = 'cancelled', remaining_amount = 0 WHERE id = ?`).run(id);
  })();

  res.json({ cancelled: true, id });
});

// Payments & Debt Collection
app.get('/api/payments', (_req, res) => {
  const rows = db.prepare(`
    SELECT p.*, c.name as customer_name, i.invoice_number
    FROM payments p
    LEFT JOIN customers c ON c.id = p.customer_id
    LEFT JOIN invoices i ON i.id = p.invoice_id
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT 100
  `).all();
  res.json(rows);
});

app.post('/api/payments', (req, res) => {
  const { customer_id, invoice_id, currency, amount, method = 'cash', reference_note = '' } = req.body || {};
  const payAmount = Number(amount || 0);
  if (payAmount <= 0) {
    return res.status(400).json({ error: 'يجب إدخال مبلغ سداد أكبر من صفر' });
  }
  const channel = method === 'card' || method === 'transfer' ? method : 'cash';
  const settings = getSettingsMap();
  const payCurrency = normalizeCurrency(currency, settings.currency);

  try {
    const created = db.transaction(() => {
      let targetCustomerId = customer_id ? Number(customer_id) : null;
      let remainingToAllocate = Number(payAmount.toFixed(2));
      let linkedInvoiceId: number | null = invoice_id ? Number(invoice_id) : null;

      if (linkedInvoiceId) {
        const inv = db.prepare(`SELECT * FROM invoices WHERE id = ? AND status != 'cancelled'`).get(linkedInvoiceId) as any;
        if (!inv) throw new Error('الفاتورة غير موجودة');
        if (!targetCustomerId) targetCustomerId = inv.customer_id;

        const applyAmt = Math.min(remainingToAllocate, Number(inv.remaining_amount));
        const newPaid = Number((Number(inv.paid_amount) + applyAmt).toFixed(2));
        const newRem = Number(Math.max(0, Number(inv.total_amount) - newPaid).toFixed(2));
        const newStatus = newRem <= 0.01 ? 'paid' : 'partial';

        db.prepare(`UPDATE invoices SET paid_amount = ?, remaining_amount = ?, status = ? WHERE id = ?`).run(
          newPaid,
          newRem,
          newStatus,
          inv.id
        );
        remainingToAllocate = Number((remainingToAllocate - applyAmt).toFixed(2));
      }

      if (remainingToAllocate > 0.01 && targetCustomerId) {
        const openInvoices = db.prepare(`
          SELECT * FROM invoices
          WHERE customer_id = ? AND status IN ('unpaid', 'partial') AND remaining_amount > 0.01
          ORDER BY created_at ASC, id ASC
        `).all(targetCustomerId) as any[];

        for (const inv of openInvoices) {
          if (remainingToAllocate <= 0.01) break;
          const applyAmt = Math.min(remainingToAllocate, Number(inv.remaining_amount));
          const newPaid = Number((Number(inv.paid_amount) + applyAmt).toFixed(2));
          const newRem = Number(Math.max(0, Number(inv.total_amount) - newPaid).toFixed(2));
          const newStatus = newRem <= 0.01 ? 'paid' : 'partial';
          db.prepare(`UPDATE invoices SET paid_amount = ?, remaining_amount = ?, status = ? WHERE id = ?`).run(
            newPaid,
            newRem,
            newStatus,
            inv.id
          );
          if (!linkedInvoiceId) linkedInvoiceId = inv.id;
          remainingToAllocate = Number((remainingToAllocate - applyAmt).toFixed(2));
        }
      }

      const lastPay = db.prepare('SELECT MAX(id) as maxId FROM payments').get() as { maxId: number | null };
      const recNum = `REC-${1000 + (lastPay.maxId || 0) + 1}`;
      const info = db.prepare(`
        INSERT INTO payments (receipt_number, customer_id, invoice_id, currency, amount, method, reference_note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        recNum,
        targetCustomerId,
        linkedInvoiceId,
        payCurrency,
        Number(payAmount.toFixed(2)),
        channel,
        String(reference_note || 'تحصيل دفعة من العميل'),
        new Date().toISOString()
      );

      return db.prepare(`
        SELECT p.*, c.name as customer_name, i.invoice_number
        FROM payments p
        LEFT JOIN customers c ON c.id = p.customer_id
        LEFT JOIN invoices i ON i.id = p.invoice_id
        WHERE p.id = ?
      `).get(Number(info.lastInsertRowid));
    })();

    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'تعذر تسجيل الدفعة' });
  }
});

// Financial Reports
app.get('/api/reports', (req, res) => {
  const range = (req.query.range as string) || 'month';
  const fromQuery = req.query.from as string | undefined;
  const toQuery = req.query.to as string | undefined;
  const settings = getSettingsMap();

  const now = new Date();
  let startDate = new Date(now);
  let endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  if (range === 'today') {
    startDate.setHours(0, 0, 0, 0);
  } else if (range === 'week') {
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
  } else if (range === 'month') {
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
  } else if (range === 'quarter') {
    startDate.setDate(startDate.getDate() - 90);
    startDate.setHours(0, 0, 0, 0);
  } else if (range === 'custom' && fromQuery && toQuery) {
    startDate = new Date(fromQuery);
    endDate = new Date(toQuery);
    endDate.setHours(23, 59, 59, 999);
  } else {
    startDate.setDate(startDate.getDate() - 30);
  }

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const periodSpan = Math.max(1, endMs - startMs);
  const prevStartMs = startMs - periodSpan;
  const prevEndMs = startMs - 1;

  const allActiveInvoices = db.prepare(`
    SELECT * FROM invoices
    WHERE status != 'cancelled'
    ORDER BY created_at ASC
  `).all() as any[];

  const parseCreatedMs = (val: string) => {
    const normalized = String(val).includes('T') ? val : String(val).replace(' ', 'T') + 'Z';
    return new Date(normalized).getTime();
  };

  const invoices = allActiveInvoices.filter((inv) => {
    const t = parseCreatedMs(inv.created_at);
    return !Number.isNaN(t) && t >= startMs && t <= endMs;
  });

  const prevInvoices = allActiveInvoices.filter((inv) => {
    const t = parseCreatedMs(inv.created_at);
    return !Number.isNaN(t) && t >= prevStartMs && t <= prevEndMs;
  });

  const invoiceIds = invoices.map((i) => i.id);
  let items: any[] = [];
  if (invoiceIds.length > 0) {
    const placeholders = invoiceIds.map(() => '?').join(',');
    items = db.prepare(`
      SELECT ii.*, p.category, p.image_url
      FROM invoice_items ii
      LEFT JOIN products p ON p.id = ii.product_id
      WHERE ii.invoice_id IN (${placeholders})
    `).all(...invoiceIds) as any[];
  }

  let prevItems: any[] = [];
  if (prevInvoices.length > 0) {
    const prevIds = prevInvoices.map((i) => i.id);
    const placeholders = prevIds.map(() => '?').join(',');
    prevItems = db.prepare(`SELECT * FROM invoice_items WHERE invoice_id IN (${placeholders})`).all(...prevIds) as any[];
  }

  const salesRevenue = invoices.reduce((acc, inv) => acc + Number(inv.total_amount), 0);
  const cogs = items.reduce((acc, it) => acc + Number(it.cost_price) * Number(it.quantity), 0);
  const netProfit = Math.max(0, salesRevenue - cogs);

  const prevSales = prevInvoices.reduce((acc, inv) => acc + Number(inv.total_amount), 0);
  const prevCogs = prevItems.reduce((acc, it) => acc + Number(it.cost_price) * Number(it.quantity), 0);
  const prevProfit = Math.max(0, prevSales - prevCogs);

  const profitDeltaValue = Number((netProfit - prevProfit).toFixed(2));
  const profitChangePct = prevProfit > 0 ? Number((((netProfit - prevProfit) / prevProfit) * 100).toFixed(1)) : 0;
  const revenueSharePct = prevSales > 0 ? Number((((salesRevenue - prevSales) / prevSales) * 100).toFixed(1)) : 0;

  const avgInvoice = invoices.length > 0 ? salesRevenue / invoices.length : 0;
  const profitMarginPct = salesRevenue > 0 ? (netProfit / salesRevenue) * 100 : 0;
  const cogsRatioPct = salesRevenue > 0 ? (cogs / salesRevenue) * 100 : 0;
  const targetProgressPct = settings.quarterly_profit_target > 0
    ? Math.min(100, (netProfit / settings.quarterly_profit_target) * 100)
    : 0;

  const trajectory: { label: string; sales: number; profit: number }[] = [];
  const totalMs = Math.max(1, endDate.getTime() - startDate.getTime());
  const bucketMs = totalMs / 4;
  for (let b = 0; b < 4; b++) {
    const bStart = new Date(startDate.getTime() + b * bucketMs);
    const bEnd = new Date(startDate.getTime() + (b + 1) * bucketMs);
    const bucketInvs = invoices.filter((inv) => {
      const t = parseCreatedMs(inv.created_at);
      return t >= bStart.getTime() && t <= bEnd.getTime();
    });
    const bIds = new Set(bucketInvs.map((i) => i.id));
    const bSales = bucketInvs.reduce((s, i) => s + Number(i.total_amount), 0);
    const bCogs = items.filter((it) => bIds.has(it.invoice_id)).reduce((s, it) => s + Number(it.cost_price) * Number(it.quantity), 0);
    trajectory.push({
      label: b === 3 ? 'الفترة 4 (الحالية)' : `الفترة ${b + 1}`,
      sales: Number(bSales.toFixed(2)),
      profit: Number(Math.max(0, bSales - bCogs).toFixed(2)),
    });
  }

  const catMap = new Map<string, number>();
  let totalItemSales = 0;
  for (const it of items) {
    const cat = it.category || 'عام';
    catMap.set(cat, (catMap.get(cat) || 0) + Number(it.line_total));
    totalItemSales += Number(it.line_total);
  }
  const categories = Array.from(catMap.entries())
    .map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
      percentage: totalItemSales > 0 ? Math.round((amount / totalItemSales) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);

  const prodMap = new Map<string, { id: number; name: string; image_url: string; units: number; revenue: number; cost: number }>();
  for (const it of items) {
    const key = it.product_name;
    const prev = prodMap.get(key) || {
      id: it.product_id || 0,
      name: it.product_name,
      image_url: it.image_url || '',
      units: 0,
      revenue: 0,
      cost: 0,
    };
    prev.units += Number(it.quantity);
    prev.revenue += Number(it.line_total);
    prev.cost += Number(it.cost_price) * Number(it.quantity);
    prodMap.set(key, prev);
  }
  const topProducts = Array.from(prodMap.values())
    .map((p) => ({
      id: p.id,
      name: p.name,
      image_url: p.image_url,
      units_sold: p.units,
      margin_pct: p.revenue > 0 ? Math.round(((p.revenue - p.cost) / p.revenue) * 100) : 0,
      revenue: Number(p.revenue.toFixed(2)),
      income_share_pct: totalItemSales > 0 ? Number(((p.revenue / totalItemSales) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 4);

  const invValuation = db.prepare(`
    SELECT COALESCE(SUM(stock_qty * cost_price), 0) as totalValue, COALESCE(SUM(stock_qty), 0) as totalUnits
    FROM products
  `).get() as { totalValue: number; totalUnits: number };

  const moves = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN quantity_change > 0 THEN quantity_change ELSE 0 END), 0) as inboundUnits,
      COALESCE(SUM(CASE WHEN quantity_change < 0 THEN ABS(quantity_change) ELSE 0 END), 0) as outboundUnits
    FROM stock_movements
  `).get() as { inboundUnits: number; outboundUnits: number };

  const turnoverRate = invValuation.totalUnits > 0 ? Number(((moves.outboundUnits / Math.max(1, invValuation.totalUnits)) * 3.2).toFixed(1)) : 0;

  const recAgg = db.prepare(`
    SELECT
      COALESCE(SUM(total_amount), 0) as totalBilled,
      COALESCE(SUM(paid_amount), 0) as collectedAmount,
      COALESCE(SUM(remaining_amount), 0) as pendingDebt
    FROM invoices
    WHERE status != 'cancelled'
  `).get() as { totalBilled: number; collectedAmount: number; pendingDebt: number };

  const debtorCount = (db.prepare(`
    SELECT COUNT(DISTINCT customer_id) as cnt
    FROM invoices
    WHERE status != 'cancelled' AND remaining_amount > 0.01 AND customer_id IS NOT NULL
  `).get() as { cnt: number }).cnt;

  const liquidityPct = recAgg.totalBilled > 0 ? Math.round((recAgg.collectedAmount / recAgg.totalBilled) * 100) : 0;

  res.json({
    range,
    settings,
    kpis: {
      netProfit: Number(netProfit.toFixed(2)),
      profitChangePct,
      profitDeltaValue,
      quarterlyTarget: settings.quarterly_profit_target,
      targetProgressPct: Number(targetProgressPct.toFixed(1)),
      salesRevenue: Number(salesRevenue.toFixed(2)),
      revenueSharePct,
      cogs: Number(cogs.toFixed(2)),
      cogsRatioPct: Number(cogsRatioPct.toFixed(1)),
      avgInvoice: Number(avgInvoice.toFixed(0)),
      profitMarginPct: Number(profitMarginPct.toFixed(1)),
    },
    trajectory,
    categories,
    topProducts,
    inventoryStats: {
      totalValue: Number(invValuation.totalValue.toFixed(2)),
      totalUnits: invValuation.totalUnits,
      turnoverRate,
      inboundUnits: moves.inboundUnits,
      outboundUnits: moves.outboundUnits,
      status: invValuation.totalUnits === 0 ? 'المخزون فارغ حالياً' : invValuation.totalUnits > 20 ? 'مستوى آمن ومستقر' : 'يحتاج تعزيز مخزون',
    },
    receivablesSummary: {
      totalBilled: Number(recAgg.totalBilled.toFixed(2)),
      collectedAmount: Number(recAgg.collectedAmount.toFixed(2)),
      pendingDebt: Number(recAgg.pendingDebt.toFixed(2)),
      liquidityPct,
      debtorCount,
    },
  });
});

async function startServer() {
  const PORT = 3000;
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        hmr: process.env.DISABLE_HMR === 'true' ? false : true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();

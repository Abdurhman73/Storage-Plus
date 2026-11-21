import type {
  AppSettings,
  CurrencyCode,
  Customer,
  CustomerStatement,
  DashboardData,
  Invoice,
  InvoiceItem,
  PaidChannel,
  Payment,
  PaymentMethod,
  Product,
  ReportsData,
  StockMovement,
} from '../types';

const DB_NAME = 'makhzouni_offline_db';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'snapshots';
const QUEUE_STORE = 'sync_queue';

export type OfflineMutation =
  | { id?: number; type: 'createProduct'; tempId: number; payload: Partial<Product>; createdAt: string }
  | { id?: number; type: 'updateProduct'; targetId: number; payload: Partial<Product>; createdAt: string }
  | { id?: number; type: 'restockProduct'; targetId: number; quantity: number; reason?: string; createdAt: string }
  | { id?: number; type: 'deleteProduct'; targetId: number; createdAt: string }
  | { id?: number; type: 'createCustomer'; tempId: number; payload: Partial<Customer>; createdAt: string }
  | { id?: number; type: 'updateCustomer'; targetId: number; payload: Partial<Customer>; createdAt: string }
  | { id?: number; type: 'deleteCustomer'; targetId: number; createdAt: string }
  | {
      id?: number;
      type: 'createInvoice';
      tempId: number;
      payload: {
        customer_id: number | null;
        items: { product_id: number; quantity: number; unit_price?: number }[];
        currency?: string;
        discount_amount: number;
        payment_method: string;
        paid_channel: string;
        paid_amount?: number;
        due_days?: number;
        notes?: string;
      };
      createdAt: string;
    }
  | { id?: number; type: 'cancelInvoice'; targetId: number; createdAt: string }
  | {
      id?: number;
      type: 'createPayment';
      tempId: number;
      payload: {
        customer_id: number | null;
        invoice_id?: number | null;
        currency?: string;
        amount: number;
        method: PaidChannel;
        reference_note?: string;
      };
      createdAt: string;
    }
  | { id?: number; type: 'updateSettings'; payload: Partial<AppSettings>; createdAt: string }
  | { id?: number; type: 'resetAll'; createdAt: string };

export const DEFAULT_OFFLINE_SETTINGS: AppSettings = {
  store_name: 'مخزوني بلس',
  manager_name: 'مدير المتجر',
  tax_number: '',
  vat_rate: 15,
  currency: 'ر.س',
  monthly_sales_target: 100000,
  quarterly_profit_target: 50000,
  invoice_footer: 'شكراً لتعاملكم معنا',
  low_stock_default_threshold: 5,
};

interface LocalSnapshot {
  settings: AppSettings;
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  stock_movements: StockMovement[];
}

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE);
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

async function idbGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await openIDB();
    return await new Promise<T>((resolve) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
      const store = tx.objectStore(SNAPSHOT_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? (req.result as T) : fallback);
      req.onerror = () => resolve(fallback);
    });
  } catch {
    try {
      const raw = localStorage.getItem(`makhzouni_${key}`);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
      const store = tx.objectStore(SNAPSHOT_STORE);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      localStorage.setItem(`makhzouni_${key}`, JSON.stringify(value));
    } catch {
      // ignore storage quota errors
    }
  }
}

export async function getQueue(): Promise<OfflineMutation[]> {
  try {
    const db = await openIDB();
    return await new Promise<OfflineMutation[]>((resolve) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as OfflineMutation[]) || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    try {
      const raw = localStorage.getItem('makhzouni_sync_queue');
      return raw ? (JSON.parse(raw) as OfflineMutation[]) : [];
    } catch {
      return [];
    }
  }
}

async function enqueueMutation(item: OfflineMutation): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.add(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const existing = await getQueue();
    existing.push({ ...item, id: Date.now() });
    localStorage.setItem('makhzouni_sync_queue', JSON.stringify(existing));
  }
  notifySyncListeners();
}

async function removeQueueItem(id: number): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const existing = await getQueue();
    const filtered = existing.filter((q) => q.id !== id);
    localStorage.setItem('makhzouni_sync_queue', JSON.stringify(filtered));
  }
  notifySyncListeners();
}

async function clearQueue(): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    localStorage.removeItem('makhzouni_sync_queue');
  }
  notifySyncListeners();
}

const syncListeners = new Set<() => void>();
export function subscribeSyncState(cb: () => void): () => void {
  syncListeners.add(cb);
  return () => {
    syncListeners.delete(cb);
  };
}
function notifySyncListeners() {
  for (const cb of syncListeners) cb();
}

export async function getPendingSyncCount(): Promise<number> {
  const q = await getQueue();
  return q.length;
}

export async function saveSnapshotPart<K extends keyof LocalSnapshot>(key: K, value: LocalSnapshot[K]): Promise<void> {
  await idbSet(key, value);
}

export async function getSnapshotPart<K extends keyof LocalSnapshot>(key: K, fallback: LocalSnapshot[K]): Promise<LocalSnapshot[K]> {
  return idbGet(key, fallback);
}

function normalizeCurrency(input: unknown, fallback = 'ر.س'): CurrencyCode {
  return input === 'ر.ي' ? 'ر.ي' : input === 'ر.س' ? 'ر.س' : fallback === 'ر.ي' ? 'ر.ي' : 'ر.س';
}

function enrichCustomerStats(customers: Customer[], invoices: Invoice[]): Customer[] {
  const nowMs = Date.now();
  return customers.map((c) => {
    const invs = invoices.filter((i) => i.customer_id === c.id && i.status !== 'cancelled');
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
          if (diffDays > maxOverdueDays) maxOverdueDays = diffDays;
          if (!nextDueDate || inv.due_date < nextDueDate) nextDueDate = inv.due_date;
        }
      }
    }

    return {
      ...c,
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

// ---------- Offline Read & Compute ----------

export async function offlineGetSettings(): Promise<AppSettings> {
  return getSnapshotPart('settings', DEFAULT_OFFLINE_SETTINGS);
}

export async function offlineGetProducts(): Promise<Product[]> {
  const prods = await getSnapshotPart('products', []);
  const invs = await getSnapshotPart('invoices', []);
  const soldMap = new Map<number, number>();
  for (const inv of invs) {
    if (inv.status === 'cancelled') continue;
    for (const item of inv.items || []) {
      if (item.product_id) {
        soldMap.set(item.product_id, (soldMap.get(item.product_id) || 0) + item.quantity);
      }
    }
  }
  return prods.map((p) => ({ ...p, total_sold: soldMap.get(p.id) || 0 }));
}

export async function offlineGetCustomers(): Promise<Customer[]> {
  const custs = await getSnapshotPart('customers', []);
  const invs = await getSnapshotPart('invoices', []);
  const enriched = enrichCustomerStats(custs, invs);
  enriched.sort((a, b) => b.balance_due - a.balance_due || b.total_purchases - a.total_purchases);
  return enriched;
}

export async function offlineGetInvoices(): Promise<Invoice[]> {
  return getSnapshotPart('invoices', []);
}

export async function offlineGetInvoice(id: number): Promise<Invoice> {
  const invs = await getSnapshotPart('invoices', []);
  const found = invs.find((i) => i.id === id);
  if (!found) throw new Error('الفاتورة غير موجودة');
  return found;
}

export async function offlineGetPayments(): Promise<Payment[]> {
  return getSnapshotPart('payments', []);
}

export async function offlineGetStockMovements(): Promise<StockMovement[]> {
  return getSnapshotPart('stock_movements', []);
}

export async function offlineGetCustomerStatement(id: number): Promise<CustomerStatement> {
  const custs = await offlineGetCustomers();
  const customer = custs.find((c) => c.id === id);
  if (!customer) throw new Error('العميل غير موجود');
  const allInvs = await getSnapshotPart('invoices', []);
  const allPays = await getSnapshotPart('payments', []);

  const invoices = allInvs.filter((i) => i.customer_id === id);
  const payments = allPays.filter((p) => p.customer_id === id);
  const itemMap = new Map<string, { product_name: string; sku: string; total_qty: number; total_spent: number; last_purchased_at: string }>();

  for (const inv of invoices) {
    if (inv.status === 'cancelled') continue;
    for (const it of inv.items || []) {
      const key = `${it.product_name}__${it.sku}`;
      const prev = itemMap.get(key) || {
        product_name: it.product_name,
        sku: it.sku,
        total_qty: 0,
        total_spent: 0,
        last_purchased_at: inv.created_at,
      };
      prev.total_qty += it.quantity;
      prev.total_spent += it.line_total;
      if (inv.created_at > prev.last_purchased_at) prev.last_purchased_at = inv.created_at;
      itemMap.set(key, prev);
    }
  }

  return {
    customer,
    invoices,
    payments,
    purchasedItems: Array.from(itemMap.values()).sort((a, b) => b.total_spent - a.total_spent),
  };
}

export async function offlineGetDashboard(period: 'daily' | 'weekly' | 'monthly'): Promise<DashboardData> {
  const settings = await offlineGetSettings();
  const prods = await offlineGetProducts();
  const custs = await offlineGetCustomers();
  const allInvs = (await offlineGetInvoices()).filter((i) => i.status !== 'cancelled');

  const totalSales = allInvs.reduce((s, i) => s + Number(i.total_amount), 0);
  const totalCollected = allInvs.reduce((s, i) => s + Number(i.paid_amount), 0);
  const totalDebts = allInvs.reduce((s, i) => s + Number(i.remaining_amount), 0);
  const debtorCount = new Set(allInvs.filter((i) => i.remaining_amount > 0.01 && i.customer_id).map((i) => i.customer_id)).size;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayInvs = allInvs.filter((i) => i.created_at.startsWith(todayStr));
  const todayTotalRevenue = todayInvs.reduce((s, i) => s + Number(i.total_amount), 0);
  const todayCashTotal = todayInvs.filter((i) => i.paid_channel === 'cash').reduce((s, i) => s + Number(i.paid_amount), 0);
  const todayCardTotal = todayInvs.filter((i) => i.paid_channel === 'card').reduce((s, i) => s + Number(i.paid_amount), 0);
  const todayTransferTotal = todayInvs.filter((i) => i.paid_channel === 'transfer').reduce((s, i) => s + Number(i.paid_amount), 0);

  const chartSeries: { label: string; current: number; previous: number }[] = [];
  const now = new Date();
  if (period === 'daily') {
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(now);
      dt.setDate(dt.getDate() - i);
      const dateStr = dt.toISOString().split('T')[0];
      const prevDt = new Date(dt);
      prevDt.setDate(prevDt.getDate() - 7);
      const prevStr = prevDt.toISOString().split('T')[0];
      chartSeries.push({
        label: dayNames[dt.getDay()],
        current: allInvs.filter((inv) => inv.created_at.startsWith(dateStr)).reduce((s, inv) => s + Number(inv.total_amount), 0),
        previous: allInvs.filter((inv) => inv.created_at.startsWith(prevStr)).reduce((s, inv) => s + Number(inv.total_amount), 0),
      });
    }
  } else if (period === 'weekly') {
    for (let w = 3; w >= 0; w--) {
      const start = new Date(now);
      start.setDate(start.getDate() - (w + 1) * 7);
      const end = new Date(now);
      end.setDate(end.getDate() - w * 7);
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 28);
      const prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 28);
      chartSeries.push({
        label: `الأسبوع ${4 - w}`,
        current: allInvs.filter((inv) => { const d = new Date(inv.created_at); return d >= start && d < end; }).reduce((s, inv) => s + Number(inv.total_amount), 0),
        previous: allInvs.filter((inv) => { const d = new Date(inv.created_at); return d >= prevStart && d < prevEnd; }).reduce((s, inv) => s + Number(inv.total_amount), 0),
      });
    }
  } else {
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    for (let m = 5; m >= 0; m--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const prevDt = new Date(now.getFullYear(), now.getMonth() - m - 1, 1);
      const prevYm = `${prevDt.getFullYear()}-${String(prevDt.getMonth() + 1).padStart(2, '0')}`;
      chartSeries.push({
        label: monthNames[dt.getMonth()],
        current: allInvs.filter((inv) => inv.created_at.startsWith(ym)).reduce((s, inv) => s + Number(inv.total_amount), 0),
        previous: allInvs.filter((inv) => inv.created_at.startsWith(prevYm)).reduce((s, inv) => s + Number(inv.total_amount), 0),
      });
    }
  }

  let peakDaySales = { label: 'اليوم', amount: 0 };
  for (const pt of chartSeries) {
    if (pt.current > peakDaySales.amount) peakDaySales = { label: pt.label, amount: pt.current };
  }

  const curSum = chartSeries.reduce((s, c) => s + c.current, 0);
  const prevSum = chartSeries.reduce((s, c) => s + c.previous, 0);
  const salesGrowthPct = prevSum > 0 ? Number((((curSum - prevSum) / prevSum) * 100).toFixed(1)) : 0;

  const repeatCusts = new Set(allInvs.filter((i) => i.customer_id).map((i) => i.customer_id)).size;

  return {
    settings,
    kpis: {
      totalSales: Number(totalSales.toFixed(2)),
      totalCollected: Number(totalCollected.toFixed(2)),
      collectionRate: totalSales > 0 ? Math.round((totalCollected / totalSales) * 100) : 0,
      totalDebts: Number(totalDebts.toFixed(2)),
      debtorCount,
      totalProducts: prods.length,
      availableProducts: prods.filter((p) => p.stock_qty > 0).length,
      lowStockCount: prods.filter((p) => p.stock_qty > 0 && p.stock_qty <= p.min_stock_threshold).length,
      outOfStockCount: prods.filter((p) => p.stock_qty <= 0).length,
      activeCustomers: custs.length,
      retentionRate: custs.length > 0 ? Math.min(100, Math.round((repeatCusts / custs.length) * 100)) : 0,
      monthlyTarget: settings.monthly_sales_target,
      targetProgress: settings.monthly_sales_target > 0 ? Math.min(100, Math.round((totalSales / settings.monthly_sales_target) * 100)) : 0,
      todaySales: Number(todayTotalRevenue.toFixed(2)),
      salesGrowthPct,
    },
    chartSeries,
    peakDaySales,
    criticalStock: prods.filter((p) => p.stock_qty <= p.min_stock_threshold).sort((a, b) => a.stock_qty - b.stock_qty).slice(0, 6),
    latestInvoices: allInvs.slice(0, 5),
    dailyClosure: {
      todayInvoicesCount: todayInvs.length,
      todayCashTotal: Number(todayCashTotal.toFixed(2)),
      todayCardTotal: Number(todayCardTotal.toFixed(2)),
      todayTransferTotal: Number(todayTransferTotal.toFixed(2)),
      todayTotalRevenue: Number(todayTotalRevenue.toFixed(2)),
    },
  };
}

export async function offlineGetReports(range: string, from?: string, to?: string): Promise<ReportsData> {
  const settings = await offlineGetSettings();
  const prods = await offlineGetProducts();
  const allInvs = (await offlineGetInvoices()).filter((i) => i.status !== 'cancelled');
  const moves = await offlineGetStockMovements();

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
  } else if (range === 'custom' && from && to) {
    startDate = new Date(from);
    endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);
  } else {
    startDate.setDate(startDate.getDate() - 30);
  }

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const invoices = allInvs.filter((inv) => {
    const t = new Date(inv.created_at).getTime();
    return !Number.isNaN(t) && t >= startMs && t <= endMs;
  });

  const prodLookup = new Map(prods.map((p) => [p.id, p]));
  let salesRevenue = 0;
  let cogs = 0;
  const catMap = new Map<string, number>();
  const topMap = new Map<string, { id: number; name: string; image_url: string; units: number; revenue: number; cost: number }>();
  let totalItemSales = 0;

  for (const inv of invoices) {
    salesRevenue += Number(inv.total_amount);
    for (const it of inv.items || []) {
      cogs += Number(it.cost_price) * Number(it.quantity);
      const prod = it.product_id ? prodLookup.get(it.product_id) : undefined;
      const cat = prod?.category || 'عام';
      catMap.set(cat, (catMap.get(cat) || 0) + Number(it.line_total));
      totalItemSales += Number(it.line_total);
      const prev = topMap.get(it.product_name) || {
        id: it.product_id || 0,
        name: it.product_name,
        image_url: prod?.image_url || it.image_url || '',
        units: 0,
        revenue: 0,
        cost: 0,
      };
      prev.units += Number(it.quantity);
      prev.revenue += Number(it.line_total);
      prev.cost += Number(it.cost_price) * Number(it.quantity);
      topMap.set(it.product_name, prev);
    }
  }

  const netProfit = Math.max(0, salesRevenue - cogs);
  const totalUnits = prods.reduce((s, p) => s + p.stock_qty, 0);
  const totalValue = prods.reduce((s, p) => s + p.stock_qty * p.cost_price, 0);
  const inboundUnits = moves.filter((m) => m.quantity_change > 0).reduce((s, m) => s + m.quantity_change, 0);
  const outboundUnits = moves.filter((m) => m.quantity_change < 0).reduce((s, m) => s + Math.abs(m.quantity_change), 0);

  const totalBilled = allInvs.reduce((s, i) => s + Number(i.total_amount), 0);
  const collectedAmount = allInvs.reduce((s, i) => s + Number(i.paid_amount), 0);
  const pendingDebt = allInvs.reduce((s, i) => s + Number(i.remaining_amount), 0);
  const debtorCount = new Set(allInvs.filter((i) => i.remaining_amount > 0.01 && i.customer_id).map((i) => i.customer_id)).size;

  const trajectory: { label: string; sales: number; profit: number }[] = [];
  const totalMs = Math.max(1, endMs - startMs);
  const bucketMs = totalMs / 4;
  for (let b = 0; b < 4; b++) {
    const bStart = startMs + b * bucketMs;
    const bEnd = startMs + (b + 1) * bucketMs;
    const bInvs = invoices.filter((inv) => {
      const t = new Date(inv.created_at).getTime();
      return t >= bStart && t <= bEnd;
    });
    const bSales = bInvs.reduce((s, i) => s + Number(i.total_amount), 0);
    const bCogs = bInvs.reduce((s, i) => s + (i.items || []).reduce((x, it) => x + Number(it.cost_price) * Number(it.quantity), 0), 0);
    trajectory.push({
      label: b === 3 ? 'الفترة 4 (الحالية)' : `الفترة ${b + 1}`,
      sales: Number(bSales.toFixed(2)),
      profit: Number(Math.max(0, bSales - bCogs).toFixed(2)),
    });
  }

  return {
    range,
    settings,
    kpis: {
      netProfit: Number(netProfit.toFixed(2)),
      profitChangePct: 0,
      profitDeltaValue: 0,
      quarterlyTarget: settings.quarterly_profit_target,
      targetProgressPct: settings.quarterly_profit_target > 0 ? Number(Math.min(100, (netProfit / settings.quarterly_profit_target) * 100).toFixed(1)) : 0,
      salesRevenue: Number(salesRevenue.toFixed(2)),
      revenueSharePct: 0,
      cogs: Number(cogs.toFixed(2)),
      cogsRatioPct: salesRevenue > 0 ? Number(((cogs / salesRevenue) * 100).toFixed(1)) : 0,
      avgInvoice: invoices.length > 0 ? Math.round(salesRevenue / invoices.length) : 0,
      profitMarginPct: salesRevenue > 0 ? Number(((netProfit / salesRevenue) * 100).toFixed(1)) : 0,
    },
    trajectory,
    categories: Array.from(catMap.entries())
      .map(([category, amount]) => ({
        category,
        amount: Number(amount.toFixed(2)),
        percentage: totalItemSales > 0 ? Math.round((amount / totalItemSales) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4),
    topProducts: Array.from(topMap.values())
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
      .slice(0, 4),
    inventoryStats: {
      totalValue: Number(totalValue.toFixed(2)),
      totalUnits,
      turnoverRate: totalUnits > 0 ? Number(((outboundUnits / Math.max(1, totalUnits)) * 3.2).toFixed(1)) : 0,
      inboundUnits,
      outboundUnits,
      status: totalUnits === 0 ? 'المخزون فارغ حالياً' : totalUnits > 20 ? 'مستوى آمن ومستقر' : 'يحتاج تعزيز مخزون',
    },
    receivablesSummary: {
      totalBilled: Number(totalBilled.toFixed(2)),
      collectedAmount: Number(collectedAmount.toFixed(2)),
      pendingDebt: Number(pendingDebt.toFixed(2)),
      liquidityPct: totalBilled > 0 ? Math.round((collectedAmount / totalBilled) * 100) : 0,
      debtorCount,
    },
  };
}

// ---------- Offline Mutations ----------

export async function offlineCreateProduct(payload: Partial<Product>): Promise<Product> {
  const settings = await offlineGetSettings();
  const prods = await getSnapshotPart('products', []);
  const moves = await getSnapshotPart('stock_movements', []);
  const nowIso = new Date().toISOString();
  const tempId = -Date.now();
  const sku = String(payload.sku || `PRD-${Date.now().toString().slice(-6)}`).trim();
  const qty = Math.max(0, Math.floor(Number(payload.stock_qty ?? 0)));

  const product: Product = {
    id: tempId,
    name: String(payload.name || '').trim(),
    sku,
    barcode: String(payload.barcode || sku).trim(),
    category: String(payload.category || 'عام').trim(),
    currency: normalizeCurrency(payload.currency, settings.currency),
    cost_price: Math.max(0, Number(payload.cost_price ?? 0)),
    sell_price: Math.max(0, Number(payload.sell_price ?? 0)),
    stock_qty: qty,
    min_stock_threshold: Math.max(0, Math.floor(Number(payload.min_stock_threshold ?? settings.low_stock_default_threshold))),
    unit_label: String(payload.unit_label || 'قطعة').trim(),
    image_url: String(payload.image_url || '').trim(),
    total_sold: 0,
    created_at: nowIso,
    updated_at: nowIso,
  };

  await saveSnapshotPart('products', [product, ...prods]);
  if (qty > 0) {
    await saveSnapshotPart('stock_movements', [
      {
        id: -Date.now() - 1,
        product_id: tempId,
        product_name: product.name,
        type: 'in',
        quantity_change: qty,
        previous_qty: 0,
        new_qty: qty,
        reason: 'إضافة منتج جديد (أوفلاين)',
        reference_id: sku,
        created_at: nowIso,
      },
      ...moves,
    ]);
  }
  await enqueueMutation({ type: 'createProduct', tempId, payload, createdAt: nowIso });
  return product;
}

export async function offlineUpdateProduct(id: number, payload: Partial<Product>): Promise<Product> {
  const prods = await getSnapshotPart('products', []);
  const idx = prods.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('المنتج غير موجود');
  const existing = prods[idx];
  const nowIso = new Date().toISOString();
  const newQty = payload.stock_qty !== undefined ? Math.max(0, Math.floor(Number(payload.stock_qty))) : existing.stock_qty;

  const updated: Product = {
    ...existing,
    ...payload,
    stock_qty: newQty,
    currency: normalizeCurrency(payload.currency ?? existing.currency),
    updated_at: nowIso,
  };
  prods[idx] = updated;
  await saveSnapshotPart('products', prods);
  await enqueueMutation({ type: 'updateProduct', targetId: id, payload, createdAt: nowIso });
  return updated;
}

export async function offlineRestockProduct(id: number, quantity: number, reason?: string): Promise<Product> {
  const prods = await getSnapshotPart('products', []);
  const moves = await getSnapshotPart('stock_movements', []);
  const idx = prods.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('المنتج غير موجود');
  const existing = prods[idx];
  const nowIso = new Date().toISOString();
  const newQty = existing.stock_qty + quantity;
  const updated = { ...existing, stock_qty: newQty, updated_at: nowIso };
  prods[idx] = updated;
  await saveSnapshotPart('products', prods);
  await saveSnapshotPart('stock_movements', [
    {
      id: -Date.now(),
      product_id: id,
      product_name: existing.name,
      type: 'in',
      quantity_change: quantity,
      previous_qty: existing.stock_qty,
      new_qty: newQty,
      reason: reason || 'توريد سريع (أوفلاين)',
      reference_id: `SUP-${Date.now().toString().slice(-5)}`,
      created_at: nowIso,
    },
    ...moves,
  ]);
  await enqueueMutation({ type: 'restockProduct', targetId: id, quantity, reason, createdAt: nowIso });
  return updated;
}

export async function offlineDeleteProduct(id: number): Promise<{ deleted: boolean }> {
  const prods = await getSnapshotPart('products', []);
  await saveSnapshotPart('products', prods.filter((p) => p.id !== id));
  await enqueueMutation({ type: 'deleteProduct', targetId: id, createdAt: new Date().toISOString() });
  return { deleted: true };
}

export async function offlineCreateCustomer(payload: Partial<Customer>): Promise<Customer> {
  const settings = await offlineGetSettings();
  const custs = await getSnapshotPart('customers', []);
  const nowIso = new Date().toISOString();
  const tempId = -Date.now();
  const cust: Customer = {
    id: tempId,
    name: String(payload.name || '').trim(),
    company_name: String(payload.company_name || '').trim(),
    phone: String(payload.phone || '').trim(),
    tax_id: String(payload.tax_id || '').trim(),
    customer_type: payload.customer_type === 'individual' ? 'individual' : 'business',
    is_vip: payload.is_vip ? 1 : 0,
    currency: normalizeCurrency(payload.currency, settings.currency),
    credit_limit: Math.max(0, Number(payload.credit_limit ?? 50000)),
    notes: String(payload.notes || '').trim(),
    created_at: nowIso,
    total_purchases: 0,
    total_paid: 0,
    balance_due: 0,
    invoice_count: 0,
    unpaid_invoice_count: 0,
    overdue_days: 0,
    next_due_date: null,
  };
  await saveSnapshotPart('customers', [cust, ...custs]);
  await enqueueMutation({ type: 'createCustomer', tempId, payload, createdAt: nowIso });
  return cust;
}

export async function offlineUpdateCustomer(id: number, payload: Partial<Customer>): Promise<Customer> {
  const custs = await getSnapshotPart('customers', []);
  const idx = custs.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('العميل غير موجود');
  const updated: Customer = {
    ...custs[idx],
    ...payload,
    currency: normalizeCurrency(payload.currency ?? custs[idx].currency),
  };
  custs[idx] = updated;
  await saveSnapshotPart('customers', custs);
  await enqueueMutation({ type: 'updateCustomer', targetId: id, payload, createdAt: new Date().toISOString() });
  return updated;
}

export async function offlineDeleteCustomer(id: number): Promise<{ deleted: boolean }> {
  const custs = await offlineGetCustomers();
  const found = custs.find((c) => c.id === id);
  if (found && found.balance_due > 0.01) {
    throw new Error('لا يمكن حذف عميل لديه مديونية مستحقة غير مسددة');
  }
  await saveSnapshotPart('customers', custs.filter((c) => c.id !== id));
  await enqueueMutation({ type: 'deleteCustomer', targetId: id, createdAt: new Date().toISOString() });
  return { deleted: true };
}

export async function offlineCreateInvoice(payload: {
  customer_id: number | null;
  items: { product_id: number; quantity: number; unit_price?: number }[];
  currency?: string;
  discount_amount: number;
  payment_method: string;
  paid_channel: string;
  paid_amount?: number;
  due_days?: number;
  notes?: string;
}): Promise<Invoice> {
  const settings = await offlineGetSettings();
  const prods = await getSnapshotPart('products', []);
  const custs = await getSnapshotPart('customers', []);
  const invs = await getSnapshotPart('invoices', []);
  const pays = await getSnapshotPart('payments', []);
  const moves = await getSnapshotPart('stock_movements', []);
  const nowIso = new Date().toISOString();
  const tempId = -Date.now();
  const invCurrency = normalizeCurrency(payload.currency, settings.currency);

  const cust = payload.customer_id ? custs.find((c) => c.id === payload.customer_id) : null;
  if (payload.payment_method === 'credit' && !cust) {
    throw new Error('يجب اختيار عميل مسجل لإصدار فاتورة آجلة');
  }

  let subtotal = 0;
  const invItems: InvoiceItem[] = [];
  for (const reqItem of payload.items) {
    const prod = prods.find((p) => p.id === reqItem.product_id);
    if (!prod) throw new Error('أحد المنتجات المختارة غير موجود');
    if (prod.stock_qty < reqItem.quantity) {
      throw new Error(`الكمية المتاحة من "${prod.name}" هي ${prod.stock_qty} فقط`);
    }
    const unitPrice = reqItem.unit_price !== undefined ? reqItem.unit_price : prod.sell_price;
    const lineTotal = Number((unitPrice * reqItem.quantity).toFixed(2));
    subtotal += lineTotal;
    invItems.push({
      product_id: prod.id,
      product_name: prod.name,
      sku: prod.sku,
      quantity: reqItem.quantity,
      unit_price: unitPrice,
      cost_price: prod.cost_price,
      line_total: lineTotal,
      image_url: prod.image_url,
    });
  }

  subtotal = Number(subtotal.toFixed(2));
  const vatAmount = Number(((subtotal * settings.vat_rate) / 100).toFixed(2));
  const discount = Math.max(0, Math.min(subtotal + vatAmount, Number(payload.discount_amount || 0)));
  const totalAmount = Number((subtotal + vatAmount - discount).toFixed(2));

  let paidAmount = totalAmount;
  if (payload.payment_method === 'credit') paidAmount = 0;
  else if (payload.payment_method === 'split') paidAmount = Math.max(0, Math.min(totalAmount, Number(payload.paid_amount ?? 0)));
  paidAmount = Number(paidAmount.toFixed(2));
  const remainingAmount = Number((totalAmount - paidAmount).toFixed(2));

  if (remainingAmount > 0.01 && !cust) {
    throw new Error('لا يمكن ترحيل مبلغ آجل لعميل نقدي عام — يرجى اختيار عميل مسجل');
  }

  const invoiceNumber = `INV-${new Date().getFullYear()}-${1001 + invs.length}`;
  const dueDt = new Date();
  dueDt.setDate(dueDt.getDate() + Math.max(1, Number(payload.due_days || 30)));

  const channel: PaidChannel =
    payload.paid_channel === 'card' || payload.paid_channel === 'transfer' ? payload.paid_channel : 'cash';

  const newInv: Invoice = {
    id: tempId,
    invoice_number: invoiceNumber,
    customer_id: cust ? cust.id : null,
    customer_name_snapshot: cust ? cust.name : 'عميل نقدي عام',
    customer_phone: cust?.phone,
    customer_tax_id: cust?.tax_id,
    currency: invCurrency,
    subtotal,
    vat_rate: settings.vat_rate,
    vat_amount: vatAmount,
    discount_amount: discount,
    total_amount: totalAmount,
    paid_amount: paidAmount,
    remaining_amount: remainingAmount,
    payment_method: payload.payment_method as PaymentMethod,
    paid_channel: channel,
    status: remainingAmount <= 0.01 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
    due_date: dueDt.toISOString().split('T')[0],
    notes: payload.notes || '',
    created_at: nowIso,
    items: invItems,
  };

  // Deduct stock locally
  const updatedProds = prods.map((p) => {
    const line = payload.items.find((it) => it.product_id === p.id);
    if (!line) return p;
    const nextQty = p.stock_qty - line.quantity;
    moves.unshift({
      id: -Date.now() - p.id,
      product_id: p.id,
      product_name: p.name,
      type: 'out',
      quantity_change: -line.quantity,
      previous_qty: p.stock_qty,
      new_qty: nextQty,
      reason: `مبيعات فاتورة ${invoiceNumber} (أوفلاين)`,
      reference_id: invoiceNumber,
      created_at: nowIso,
    });
    return { ...p, stock_qty: nextQty, updated_at: nowIso };
  });

  if (paidAmount > 0) {
    pays.unshift({
      id: -Date.now() - 99,
      receipt_number: `REC-${1000 + pays.length + 1}`,
      customer_id: cust ? cust.id : null,
      customer_name: cust ? cust.name : 'عميل نقدي عام',
      invoice_id: tempId,
      invoice_number: invoiceNumber,
      currency: invCurrency,
      amount: paidAmount,
      method: channel,
      reference_note: `دفعة فورية - فاتورة ${invoiceNumber}`,
      created_at: nowIso,
    });
  }

  await saveSnapshotPart('products', updatedProds);
  await saveSnapshotPart('stock_movements', moves);
  await saveSnapshotPart('invoices', [newInv, ...invs]);
  await saveSnapshotPart('payments', pays);
  await enqueueMutation({ type: 'createInvoice', tempId, payload, createdAt: nowIso });
  return newInv;
}

export async function offlineCancelInvoice(id: number): Promise<{ cancelled: boolean }> {
  const invs = await getSnapshotPart('invoices', []);
  const prods = await getSnapshotPart('products', []);
  const inv = invs.find((i) => i.id === id);
  if (!inv) throw new Error('الفاتورة غير موجودة');

  const updatedProds = prods.map((p) => {
    const it = (inv.items || []).find((x) => x.product_id === p.id);
    return it ? { ...p, stock_qty: p.stock_qty + it.quantity } : p;
  });

  const updatedInvs = invs.map((i) => (i.id === id ? { ...i, status: 'cancelled' as const, remaining_amount: 0 } : i));
  await saveSnapshotPart('products', updatedProds);
  await saveSnapshotPart('invoices', updatedInvs);
  await enqueueMutation({ type: 'cancelInvoice', targetId: id, createdAt: new Date().toISOString() });
  return { cancelled: true };
}

export async function offlineCreatePayment(payload: {
  customer_id: number | null;
  invoice_id?: number | null;
  currency?: string;
  amount: number;
  method: PaidChannel;
  reference_note?: string;
}): Promise<Payment> {
  const settings = await offlineGetSettings();
  const custs = await getSnapshotPart('customers', []);
  const invs = await getSnapshotPart('invoices', []);
  const pays = await getSnapshotPart('payments', []);
  const nowIso = new Date().toISOString();
  const tempId = -Date.now();
  const payCurrency = normalizeCurrency(payload.currency, settings.currency);

  let remainingToAllocate = Number(payload.amount.toFixed(2));
  let targetCustId = payload.customer_id;

  const updatedInvs = invs.map((inv) => {
    if (remainingToAllocate <= 0.01 || inv.status === 'cancelled') return inv;
    const matchDirect = payload.invoice_id && inv.id === payload.invoice_id;
    const matchCust = !payload.invoice_id && targetCustId && inv.customer_id === targetCustId && inv.remaining_amount > 0.01;
    if (matchDirect || matchCust) {
      if (!targetCustId) targetCustId = inv.customer_id;
      const apply = Math.min(remainingToAllocate, inv.remaining_amount);
      const newPaid = Number((inv.paid_amount + apply).toFixed(2));
      const newRem = Number(Math.max(0, inv.total_amount - newPaid).toFixed(2));
      remainingToAllocate = Number((remainingToAllocate - apply).toFixed(2));
      return {
        ...inv,
        paid_amount: newPaid,
        remaining_amount: newRem,
        status: (newRem <= 0.01 ? 'paid' : 'partial') as Invoice['status'],
      };
    }
    return inv;
  });

  const cust = targetCustId ? custs.find((c) => c.id === targetCustId) : null;
  const linkedInv = payload.invoice_id ? updatedInvs.find((i) => i.id === payload.invoice_id) : null;
  const payment: Payment = {
    id: tempId,
    receipt_number: `REC-${1000 + pays.length + 1}`,
    customer_id: targetCustId,
    customer_name: cust?.name || 'عميل نقدي عام',
    invoice_id: payload.invoice_id || null,
    invoice_number: linkedInv?.invoice_number,
    currency: payCurrency,
    amount: Number(payload.amount.toFixed(2)),
    method: payload.method,
    reference_note: payload.reference_note || 'تحصيل دفعة (أوفلاين)',
    created_at: nowIso,
  };

  await saveSnapshotPart('invoices', updatedInvs);
  await saveSnapshotPart('payments', [payment, ...pays]);
  await enqueueMutation({ type: 'createPayment', tempId, payload, createdAt: nowIso });
  return payment;
}

export async function offlineUpdateSettings(payload: Partial<AppSettings>): Promise<AppSettings> {
  const current = await offlineGetSettings();
  const next = { ...current, ...payload };
  await saveSnapshotPart('settings', next);
  await enqueueMutation({ type: 'updateSettings', payload, createdAt: new Date().toISOString() });
  return next;
}

export async function offlineResetAll(): Promise<{ reset: boolean }> {
  await saveSnapshotPart('products', []);
  await saveSnapshotPart('customers', []);
  await saveSnapshotPart('invoices', []);
  await saveSnapshotPart('payments', []);
  await saveSnapshotPart('stock_movements', []);
  await clearQueue();
  await enqueueMutation({ type: 'resetAll', createdAt: new Date().toISOString() });
  return { reset: true };
}

// ---------- Auto Sync Engine (Replays Queue When Online) ----------

let activeSyncPromise: Promise<{ syncedCount: number; failedCount: number }> | null = null;

export async function syncPendingChanges(): Promise<{ syncedCount: number; failedCount: number }> {
  if (activeSyncPromise) return activeSyncPromise;

  activeSyncPromise = (async () => {
    const queue = await getQueue();
    if (queue.length === 0) return { syncedCount: 0, failedCount: 0 };

    const productIdMap = new Map<number, number>();
    const customerIdMap = new Map<number, number>();
    const invoiceIdMap = new Map<number, number>();

    const resolveProdId = (id: number) => productIdMap.get(id) ?? id;
    const resolveCustId = (id: number | null | undefined) => (id ? customerIdMap.get(id) ?? id : null);
    const resolveInvId = (id: number | null | undefined) => (id ? invoiceIdMap.get(id) ?? id : null);

    let syncedCount = 0;
    let failedCount = 0;

    for (const op of queue) {
      try {
        if (op.type === 'resetAll') {
          const res = await fetch('/api/reset-all', { method: 'POST' });
          if (!res.ok) throw new Error('reset failed');
        } else if (op.type === 'updateSettings') {
          const res = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(op.payload),
          });
          if (!res.ok) throw new Error('settings failed');
        } else if (op.type === 'createProduct') {
          const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(op.payload),
          });
          if (!res.ok) throw new Error('createProduct failed');
          const created = (await res.json()) as Product;
          productIdMap.set(op.tempId, created.id);
        } else if (op.type === 'updateProduct') {
          const id = resolveProdId(op.targetId);
          const res = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(op.payload),
          });
          if (!res.ok && res.status !== 404) throw new Error('updateProduct failed');
        } else if (op.type === 'restockProduct') {
          const id = resolveProdId(op.targetId);
          const res = await fetch(`/api/products/${id}/restock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: op.quantity, reason: op.reason }),
          });
          if (!res.ok && res.status !== 404) throw new Error('restockProduct failed');
        } else if (op.type === 'deleteProduct') {
          const id = resolveProdId(op.targetId);
          const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
          if (!res.ok && res.status !== 404) throw new Error('deleteProduct failed');
        } else if (op.type === 'createCustomer') {
          const res = await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(op.payload),
          });
          if (!res.ok) throw new Error('createCustomer failed');
          const created = (await res.json()) as Customer;
          customerIdMap.set(op.tempId, created.id);
        } else if (op.type === 'updateCustomer') {
          const id = resolveCustId(op.targetId);
          if (id) {
            const res = await fetch(`/api/customers/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(op.payload),
            });
            if (!res.ok && res.status !== 404) throw new Error('updateCustomer failed');
          }
        } else if (op.type === 'deleteCustomer') {
          const id = resolveCustId(op.targetId);
          if (id) {
            const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
            if (!res.ok && res.status !== 404) throw new Error('deleteCustomer failed');
          }
        } else if (op.type === 'createInvoice') {
          const mappedPayload = {
            ...op.payload,
            customer_id: resolveCustId(op.payload.customer_id),
            items: op.payload.items.map((it) => ({
              ...it,
              product_id: resolveProdId(it.product_id),
            })),
          };
          const res = await fetch('/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mappedPayload),
          });
          if (!res.ok) throw new Error('createInvoice failed');
          const created = (await res.json()) as Invoice;
          invoiceIdMap.set(op.tempId, created.id);
        } else if (op.type === 'cancelInvoice') {
          const id = resolveInvId(op.targetId);
          if (id) {
            const res = await fetch(`/api/invoices/${id}/cancel`, { method: 'POST' });
            if (!res.ok && res.status !== 404) throw new Error('cancelInvoice failed');
          }
        } else if (op.type === 'createPayment') {
          const mappedPayload = {
            ...op.payload,
            customer_id: resolveCustId(op.payload.customer_id),
            invoice_id: resolveInvId(op.payload.invoice_id),
          };
          const res = await fetch('/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mappedPayload),
          });
          if (!res.ok) throw new Error('createPayment failed');
        }

        if (op.id !== undefined) {
          await removeQueueItem(op.id);
        }
        syncedCount += 1;
      } catch {
        failedCount += 1;
        // Stop replaying further dependent operations if server is unreachable again
        break;
      }
    }

    return { syncedCount, failedCount };
  })();

  try {
    return await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
}

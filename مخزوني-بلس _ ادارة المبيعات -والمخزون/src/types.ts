export type TabKey = 'dashboard' | 'products' | 'invoices' | 'customers' | 'reports';
export type CurrencyCode = 'ر.س' | 'ر.ي';

export interface AppSettings {
  store_name: string;
  manager_name: string;
  tax_number: string;
  vat_rate: number;
  currency: CurrencyCode | string;
  monthly_sales_target: number;
  quarterly_profit_target: number;
  invoice_footer: string;
  low_stock_default_threshold: number;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  currency: CurrencyCode | string;
  cost_price: number;
  sell_price: number;
  stock_qty: number;
  min_stock_threshold: number;
  unit_label: string;
  image_url: string;
  total_sold?: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  name: string;
  company_name: string;
  phone: string;
  tax_id: string;
  customer_type: 'business' | 'individual';
  is_vip: number;
  currency: CurrencyCode | string;
  credit_limit: number;
  notes: string;
  created_at: string;
  total_purchases: number;
  total_paid: number;
  balance_due: number;
  invoice_count: number;
  unpaid_invoice_count: number;
  overdue_days: number;
  next_due_date: string | null;
}

export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  product_id: number | null;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  line_total: number;
  image_url?: string;
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit' | 'split';
export type PaidChannel = 'cash' | 'card' | 'transfer';
export type InvoiceStatus = 'paid' | 'partial' | 'unpaid' | 'cancelled';

export interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number | null;
  customer_name_snapshot: string;
  customer_phone?: string;
  customer_tax_id?: string;
  currency: CurrencyCode | string;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_method: PaymentMethod;
  paid_channel: PaidChannel;
  status: InvoiceStatus;
  due_date: string | null;
  notes: string;
  created_at: string;
  items?: InvoiceItem[];
}

export interface Payment {
  id: number;
  receipt_number: string;
  customer_id: number | null;
  customer_name?: string;
  invoice_id: number | null;
  invoice_number?: string;
  currency: CurrencyCode | string;
  amount: number;
  method: PaidChannel;
  reference_note: string;
  created_at: string;
}

export interface StockMovement {
  id: number;
  product_id: number | null;
  product_name: string;
  type: 'in' | 'out' | 'adjust' | 'return';
  quantity_change: number;
  previous_qty: number;
  new_qty: number;
  reason: string;
  reference_id: string;
  created_at: string;
}

export interface DashboardData {
  settings: AppSettings;
  kpis: {
    totalSales: number;
    totalCollected: number;
    collectionRate: number;
    totalDebts: number;
    debtorCount: number;
    totalProducts: number;
    availableProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    activeCustomers: number;
    retentionRate: number;
    monthlyTarget: number;
    targetProgress: number;
    todaySales: number;
    salesGrowthPct: number;
  };
  chartSeries: {
    label: string;
    current: number;
    previous: number;
  }[];
  peakDaySales: {
    label: string;
    amount: number;
  };
  criticalStock: Product[];
  latestInvoices: Invoice[];
  dailyClosure: {
    todayInvoicesCount: number;
    todayCashTotal: number;
    todayCardTotal: number;
    todayTransferTotal: number;
    todayTotalRevenue: number;
  };
}

export interface ReportsData {
  range: string;
  settings: AppSettings;
  kpis: {
    netProfit: number;
    profitChangePct: number;
    profitDeltaValue: number;
    quarterlyTarget: number;
    targetProgressPct: number;
    salesRevenue: number;
    revenueSharePct: number;
    cogs: number;
    cogsRatioPct: number;
    avgInvoice: number;
    profitMarginPct: number;
  };
  trajectory: {
    label: string;
    sales: number;
    profit: number;
  }[];
  categories: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  topProducts: {
    id: number;
    name: string;
    image_url: string;
    units_sold: number;
    margin_pct: number;
    revenue: number;
    income_share_pct: number;
  }[];
  inventoryStats: {
    totalValue: number;
    totalUnits: number;
    turnoverRate: number;
    inboundUnits: number;
    outboundUnits: number;
    status: string;
  };
  receivablesSummary: {
    totalBilled: number;
    collectedAmount: number;
    pendingDebt: number;
    liquidityPct: number;
    debtorCount: number;
  };
}

export interface CustomerStatement {
  customer: Customer;
  invoices: Invoice[];
  payments: Payment[];
  purchasedItems: {
    product_name: string;
    sku: string;
    total_qty: number;
    total_spent: number;
    last_purchased_at: string;
  }[];
}

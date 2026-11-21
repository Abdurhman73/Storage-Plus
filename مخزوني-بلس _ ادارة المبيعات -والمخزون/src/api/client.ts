import type {
  AppSettings,
  Customer,
  CustomerStatement,
  DashboardData,
  Invoice,
  PaidChannel,
  Payment,
  Product,
  ReportsData,
  StockMovement,
} from '../types';
import {
  getPendingSyncCount,
  offlineCancelInvoice,
  offlineCreateCustomer,
  offlineCreateInvoice,
  offlineCreatePayment,
  offlineCreateProduct,
  offlineDeleteCustomer,
  offlineDeleteProduct,
  offlineGetCustomerStatement,
  offlineGetCustomers,
  offlineGetDashboard,
  offlineGetInvoice,
  offlineGetInvoices,
  offlineGetPayments,
  offlineGetProducts,
  offlineGetReports,
  offlineGetSettings,
  offlineGetStockMovements,
  offlineResetAll,
  offlineRestockProduct,
  offlineUpdateCustomer,
  offlineUpdateProduct,
  offlineUpdateSettings,
  saveSnapshotPart,
  subscribeSyncState,
  syncPendingChanges,
} from '../offline/offlineStore';

class HttpClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchOnline<T>(url: string, options?: RequestInit): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new TypeError('Offline');
  }
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new HttpClientError(data.error || 'حدث خطأ أثناء الاتصال بالخادم', res.status);
  }
  return data as T;
}

function isNetworkFailure(err: unknown): boolean {
  return !(err instanceof HttpClientError);
}

async function withOfflineFallback<T>(
  onlineFn: () => Promise<T>,
  offlineFn: () => Promise<T>
): Promise<T> {
  try {
    // If there are pending offline mutations and we appear online, sync first before fetching
    if (typeof navigator === 'undefined' || navigator.onLine) {
      const pending = await getPendingSyncCount();
      if (pending > 0) {
        await syncPendingChanges();
      }
      return await onlineFn();
    }
    return await offlineFn();
  } catch (err) {
    if (isNetworkFailure(err)) {
      return await offlineFn();
    }
    throw err;
  }
}

export { getPendingSyncCount, subscribeSyncState, syncPendingChanges };

export const api = {
  getDashboard: (period: 'daily' | 'weekly' | 'monthly' = 'daily') =>
    withOfflineFallback<DashboardData>(
      async () => {
        const data = await fetchOnline<DashboardData>(`/api/dashboard?period=${period}`);
        await saveSnapshotPart('settings', data.settings);
        return data;
      },
      () => offlineGetDashboard(period)
    ),

  getProducts: () =>
    withOfflineFallback<Product[]>(
      async () => {
        const data = await fetchOnline<Product[]>('/api/products');
        await saveSnapshotPart('products', data);
        return data;
      },
      () => offlineGetProducts()
    ),

  createProduct: (payload: Partial<Product>) =>
    withOfflineFallback<Product>(
      () => fetchOnline<Product>('/api/products', { method: 'POST', body: JSON.stringify(payload) }),
      () => offlineCreateProduct(payload)
    ),

  updateProduct: (id: number, payload: Partial<Product>) =>
    withOfflineFallback<Product>(
      () => fetchOnline<Product>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
      () => offlineUpdateProduct(id, payload)
    ),

  restockProduct: (id: number, quantity: number, reason?: string) =>
    withOfflineFallback<Product>(
      () =>
        fetchOnline<Product>(`/api/products/${id}/restock`, {
          method: 'POST',
          body: JSON.stringify({ quantity, reason }),
        }),
      () => offlineRestockProduct(id, quantity, reason)
    ),

  deleteProduct: (id: number) =>
    withOfflineFallback<{ deleted: boolean }>(
      () => fetchOnline<{ deleted: boolean }>(`/api/products/${id}`, { method: 'DELETE' }),
      () => offlineDeleteProduct(id)
    ),

  getStockMovements: () =>
    withOfflineFallback<StockMovement[]>(
      async () => {
        const data = await fetchOnline<StockMovement[]>('/api/stock-movements');
        await saveSnapshotPart('stock_movements', data);
        return data;
      },
      () => offlineGetStockMovements()
    ),

  getCustomers: () =>
    withOfflineFallback<Customer[]>(
      async () => {
        const data = await fetchOnline<Customer[]>('/api/customers');
        await saveSnapshotPart('customers', data);
        return data;
      },
      () => offlineGetCustomers()
    ),

  getCustomerStatement: (id: number) =>
    withOfflineFallback<CustomerStatement>(
      () => fetchOnline<CustomerStatement>(`/api/customers/${id}/statement`),
      () => offlineGetCustomerStatement(id)
    ),

  createCustomer: (payload: Partial<Customer>) =>
    withOfflineFallback<Customer>(
      () => fetchOnline<Customer>('/api/customers', { method: 'POST', body: JSON.stringify(payload) }),
      () => offlineCreateCustomer(payload)
    ),

  updateCustomer: (id: number, payload: Partial<Customer>) =>
    withOfflineFallback<Customer>(
      () => fetchOnline<Customer>(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
      () => offlineUpdateCustomer(id, payload)
    ),

  deleteCustomer: (id: number) =>
    withOfflineFallback<{ deleted: boolean }>(
      () => fetchOnline<{ deleted: boolean }>(`/api/customers/${id}`, { method: 'DELETE' }),
      () => offlineDeleteCustomer(id)
    ),

  getInvoices: () =>
    withOfflineFallback<Invoice[]>(
      async () => {
        const data = await fetchOnline<Invoice[]>('/api/invoices');
        await saveSnapshotPart('invoices', data);
        return data;
      },
      () => offlineGetInvoices()
    ),

  getInvoice: (id: number) =>
    withOfflineFallback<Invoice>(
      () => fetchOnline<Invoice>(`/api/invoices/${id}`),
      () => offlineGetInvoice(id)
    ),

  createInvoice: (payload: {
    customer_id: number | null;
    items: { product_id: number; quantity: number; unit_price?: number }[];
    currency?: string;
    discount_amount: number;
    payment_method: string;
    paid_channel: string;
    paid_amount?: number;
    due_days?: number;
    notes?: string;
  }) =>
    withOfflineFallback<Invoice>(
      () => fetchOnline<Invoice>('/api/invoices', { method: 'POST', body: JSON.stringify(payload) }),
      () => offlineCreateInvoice(payload)
    ),

  cancelInvoice: (id: number) =>
    withOfflineFallback<{ cancelled: boolean }>(
      () => fetchOnline<{ cancelled: boolean }>(`/api/invoices/${id}/cancel`, { method: 'POST' }),
      () => offlineCancelInvoice(id)
    ),

  getPayments: () =>
    withOfflineFallback<Payment[]>(
      async () => {
        const data = await fetchOnline<Payment[]>('/api/payments');
        await saveSnapshotPart('payments', data);
        return data;
      },
      () => offlineGetPayments()
    ),

  createPayment: (payload: {
    customer_id: number | null;
    invoice_id?: number | null;
    currency?: string;
    amount: number;
    method: PaidChannel;
    reference_note?: string;
  }) =>
    withOfflineFallback<Payment>(
      () => fetchOnline<Payment>('/api/payments', { method: 'POST', body: JSON.stringify(payload) }),
      () => offlineCreatePayment(payload)
    ),

  getReports: (range: string, from?: string, to?: string) => {
    const params = new URLSearchParams({ range });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return withOfflineFallback<ReportsData>(
      () => fetchOnline<ReportsData>(`/api/reports?${params.toString()}`),
      () => offlineGetReports(range, from, to)
    );
  },

  getSettings: () =>
    withOfflineFallback<AppSettings>(
      async () => {
        const data = await fetchOnline<AppSettings>('/api/settings');
        await saveSnapshotPart('settings', data);
        return data;
      },
      () => offlineGetSettings()
    ),

  updateSettings: (payload: Partial<AppSettings>) =>
    withOfflineFallback<AppSettings>(
      async () => {
        const data = await fetchOnline<AppSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(payload) });
        await saveSnapshotPart('settings', data);
        return data;
      },
      () => offlineUpdateSettings(payload)
    ),

  resetAllData: () =>
    withOfflineFallback<{ reset: boolean }>(
      async () => {
        const res = await fetchOnline<{ reset: boolean }>('/api/reset-all', { method: 'POST' });
        await saveSnapshotPart('products', []);
        await saveSnapshotPart('customers', []);
        await saveSnapshotPart('invoices', []);
        await saveSnapshotPart('payments', []);
        await saveSnapshotPart('stock_movements', []);
        return res;
      },
      () => offlineResetAll()
    ),
};

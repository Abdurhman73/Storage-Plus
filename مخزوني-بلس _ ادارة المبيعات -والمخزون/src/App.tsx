import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, getPendingSyncCount, subscribeSyncState, syncPendingChanges } from './api/client';
import { AppShell } from './components/AppShell';
import { ToastContainer, type ToastItem } from './components/Toast';
import { ConfirmModal } from './components/modals/ConfirmModal';
import { CustomerModal } from './components/modals/CustomerModal';
import { CustomerStatementModal } from './components/modals/CustomerStatementModal';
import { InvoicePreviewModal } from './components/modals/InvoicePreviewModal';
import { PaymentModal } from './components/modals/PaymentModal';
import { ProductModal } from './components/modals/ProductModal';
import { RestockModal } from './components/modals/RestockModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { StockMovementsModal } from './components/modals/StockMovementsModal';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { ProductsPage } from './pages/ProductsPage';
import { ReportsPage } from './pages/ReportsPage';
import type {
  AppSettings,
  Customer,
  DashboardData,
  Invoice,
  PaidChannel,
  Payment,
  PaymentMethod,
  Product,
  ReportsData,
  TabKey,
} from './types';

const DEFAULT_SETTINGS: AppSettings = {
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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [invoicesMode, setInvoicesMode] = useState<'pos' | 'archive'>('pos');

  // Data state
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [dashboardPeriod, setDashboardPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reportsRange, setReportsRange] = useState<string>('month');
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customTo, setCustomTo] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reports, setReports] = useState<ReportsData | null>(null);

  const [loadingCore, setLoadingCore] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const syncingRef = useRef(false);

  // Modal states
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [restockModalState, setRestockModalState] = useState<{ open: boolean; product: Product | null; qty: number }>({
    open: false,
    product: null,
    qty: 10,
  });
  const [stockMovementsOpen, setStockMovementsOpen] = useState(false);

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [statementCustomerId, setStatementCustomerId] = useState<number | null>(null);
  const [preselectedPosCustomerId, setPreselectedPosCustomerId] = useState<number | null>(null);

  const [paymentModalState, setPaymentModalState] = useState<{
    open: boolean;
    customer: Customer | null;
    invoice: Invoice | null;
  }>({ open: false, customer: null, invoice: null });

  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    loading: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [sett, dash, prods, custs, invs, pays, reps] = await Promise.all([
        api.getSettings(),
        api.getDashboard(dashboardPeriod),
        api.getProducts(),
        api.getCustomers(),
        api.getInvoices(),
        api.getPayments(),
        api.getReports(reportsRange, customFrom, customTo),
      ]);
      setSettings(sett);
      setDashboard(dash);
      setProducts(prods);
      setCustomers(custs);
      setInvoices(invs);
      setPayments(pays);
      setReports(reps);
    } catch (err: any) {
      addToast('error', err.message || 'تعذر تحميل بيانات النظام');
    } finally {
      setLoadingCore(false);
    }
  }, [dashboardPeriod, reportsRange, customFrom, customTo, addToast]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleSyncNow = useCallback(async () => {
    if (syncingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addToast('info', 'لا يوجد اتصال بالإنترنت حالياً — سيتم المزامنة تلقائياً عند العودة');
      return;
    }
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await syncPendingChanges();
      const remaining = await getPendingSyncCount();
      setPendingSyncCount(remaining);
      if (result.syncedCount > 0) {
        addToast('success', `تمت مزامنة ${result.syncedCount} عملية محفوظة مع الخادم بنجاح`);
        await refreshAll();
      } else if (result.failedCount > 0) {
        addToast('error', `تعذر مزامنة ${result.failedCount} عملية — يرجى المحاولة مجدداً`);
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [addToast, refreshAll]);

  useEffect(() => {
    let active = true;
    getPendingSyncCount().then((count) => {
      if (active) {
        setPendingSyncCount(count);
        if (count > 0 && (typeof navigator === 'undefined' || navigator.onLine)) {
          handleSyncNow();
        }
      }
    });

    const unsubSync = subscribeSyncState(() => {
      getPendingSyncCount().then((count) => {
        if (active) setPendingSyncCount(count);
      });
    });

    const handleOnline = () => {
      setIsOnline(true);
      addToast('info', 'تم استعادة الاتصال بالإنترنت — جاري مزامنة التغييرات...');
      handleSyncNow();
    };
    const handleOffline = () => {
      setIsOnline(false);
      addToast('info', 'انقطع الاتصال بالإنترنت — سيتم حفظ جميع التعديلات محلياً ومزامنتها لاحقاً');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      active = false;
      unsubSync();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast, handleSyncNow]);

  // Refetch dashboard when period changes
  const handleChangeDashboardPeriod = async (p: 'daily' | 'weekly' | 'monthly') => {
    setDashboardPeriod(p);
    try {
      const dash = await api.getDashboard(p);
      setDashboard(dash);
    } catch {
      // handled gracefully
    }
  };

  // Refetch reports when range changes
  const handleChangeReportsRange = async (r: string) => {
    setReportsRange(r);
    try {
      const rep = await api.getReports(r, customFrom, customTo);
      setReports(rep);
    } catch {
      // handled gracefully
    }
  };

  const handleChangeCustomDates = async (from: string, to: string) => {
    setCustomFrom(from);
    setCustomTo(to);
    try {
      const rep = await api.getReports('custom', from, to);
      setReports(rep);
    } catch {
      // handled gracefully
    }
  };

  // Product Handlers
  const handleSaveProduct = async (payload: Partial<Product>, id?: number) => {
    if (id) {
      await api.updateProduct(id, payload);
      addToast('success', 'تم تحديث بيانات المنتج بنجاح');
    } else {
      await api.createProduct(payload);
      addToast('success', 'تم إضافة المنتج الجديد وإتاحته في نقطة البيع');
    }
    await refreshAll();
  };

  const handleRestockConfirm = async (productId: number, quantity: number, reason: string) => {
    await api.restockProduct(productId, quantity, reason);
    addToast('success', `تم توريد ${quantity} وحدة إلى المخزون بنجاح`);
    await refreshAll();
  };

  const handleDeleteProduct = (product: Product) => {
    setConfirmState({
      open: true,
      title: 'تأكيد حذف المنتج',
      message: `هل أنت متأكد من حذف "${product.name}" من المخزون؟ لا يمكن التراجع عن هذا الإجراء.`,
      confirmLabel: 'حذف المنتج',
      loading: false,
      onConfirm: async () => {
        await api.deleteProduct(product.id);
        addToast('success', 'تم حذف المنتج من المخزون');
        await refreshAll();
      },
    });
  };

  // Customer Handlers
  const handleSaveCustomer = async (payload: Partial<Customer>, id?: number) => {
    if (id) {
      await api.updateCustomer(id, payload);
      addToast('success', 'تم تحديث بيانات العميل بنجاح');
    } else {
      const created = await api.createCustomer(payload);
      addToast('success', `تم فتح حساب العميل "${created.name}" بنجاح`);
    }
    await refreshAll();
  };

  const handleDeleteCustomer = (customer: Customer) => {
    setConfirmState({
      open: true,
      title: 'تأكيد حذف العميل',
      message: `هل أنت متأكد من حذف حساب "${customer.name}"؟ (ملاحظة: لا يمكن حذف عميل لديه مديونية مستحقة).`,
      confirmLabel: 'حذف العميل',
      loading: false,
      onConfirm: async () => {
        await api.deleteCustomer(customer.id);
        setStatementCustomerId(null);
        addToast('success', 'تم حذف حساب العميل');
        await refreshAll();
      },
    });
  };

  // Invoice Handlers
  const handleSubmitInvoice = async (payload: {
    customer_id: number | null;
    items: { product_id: number; quantity: number; unit_price: number }[];
    currency: string;
    discount_amount: number;
    payment_method: PaymentMethod;
    paid_channel: PaidChannel;
    paid_amount: number;
  }) => {
    const created = await api.createInvoice(payload);
    await refreshAll();
    return created;
  };

  const handleCancelInvoice = (invoice: Invoice) => {
    setConfirmState({
      open: true,
      title: 'تأكيد إلغاء الفاتورة',
      message: `هل تريد إلغاء الفاتورة #${invoice.invoice_number}؟ سيتم إرجاع كافة الكميات المباعة إلى المخزون وتصفير المديونية المتبقية.`,
      confirmLabel: 'إلغاء الفاتورة وإرجاع المخزون',
      loading: false,
      onConfirm: async () => {
        await api.cancelInvoice(invoice.id);
        addToast('info', `تم إلغاء الفاتورة #${invoice.invoice_number} وإرجاع الكميات للمخزون`);
        await refreshAll();
      },
    });
  };

  const handlePreviewInvoiceById = async (invoiceId: number) => {
    const existing = invoices.find((i) => i.id === invoiceId);
    if (existing && existing.items) {
      setPreviewInvoice(existing);
      return;
    }
    try {
      const full = await api.getInvoice(invoiceId);
      setPreviewInvoice(full);
    } catch (err: any) {
      addToast('error', err.message || 'تعذر تحميل الفاتورة');
    }
  };

  // Payment Handler
  const handleRecordPayment = async (payload: {
    customer_id: number | null;
    invoice_id?: number | null;
    currency?: string;
    amount: number;
    method: PaidChannel;
    reference_note?: string;
  }) => {
    const receipt = await api.createPayment(payload);
    addToast('success', `تم اعتماد سند القبض #${receipt.receipt_number} وتحديث رصيد العميل`);
    await refreshAll();
  };

  // Settings Handler
  const handleSaveSettings = async (updated: Partial<AppSettings>) => {
    const res = await api.updateSettings(updated);
    setSettings(res);
    addToast('success', 'تم حفظ إعدادات النظام بنجاح');
    await refreshAll();
  };

  const handleResetAllData = () => {
    setConfirmState({
      open: true,
      title: 'تأكيد مسح كافة البيانات',
      message: 'هل أنت متأكد من حذف جميع المنتجات والعملاء والفواتير والمدفوعات والبدء من الصفر؟ لا يمكن التراجع عن هذه العملية.',
      confirmLabel: 'مسح كافة البيانات',
      loading: false,
      onConfirm: async () => {
        await api.resetAllData();
        addToast('success', 'تم مسح كافة البيانات بنجاح والبدء من الصفر');
        await refreshAll();
      },
    });
  };

  const criticalProducts = useMemo(
    () => products.filter((p) => p.stock_qty <= p.min_stock_threshold),
    [products]
  );
  const overdueCustomers = useMemo(
    () => customers.filter((c) => c.balance_due > 0 && c.overdue_days > 0),
    [customers]
  );

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={(tab) => {
        setActiveTab(tab);
        if (tab === 'invoices') setInvoicesMode('pos');
      }}
      onOpenSettings={() => setSettingsOpen(true)}
      onOpenStockMovements={() => setStockMovementsOpen(true)}
      onOpenInvoicesArchive={() => {
        setActiveTab('invoices');
        setInvoicesMode('archive');
      }}
      onQuickNewInvoice={() => {
        setActiveTab('invoices');
        setInvoicesMode('pos');
      }}
      isOnline={isOnline}
      pendingSyncCount={pendingSyncCount}
      isSyncing={isSyncing}
      onSyncNow={handleSyncNow}
      suppressPrintShell={previewInvoice !== null}
      settings={settings}
      criticalProducts={criticalProducts}
      overdueCustomers={overdueCustomers}
    >
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {activeTab === 'dashboard' && (
        <DashboardPage
          data={dashboard}
          loading={loadingCore}
          period={dashboardPeriod}
          onChangePeriod={handleChangeDashboardPeriod}
          onNavigateTab={setActiveTab}
          onOpenNewInvoice={() => {
            setActiveTab('invoices');
            setInvoicesMode('pos');
          }}
          onOpenAddProduct={() => {
            setEditingProduct(null);
            setProductModalOpen(true);
          }}
          onOpenAddCustomer={() => {
            setEditingCustomer(null);
            setCustomerModalOpen(true);
          }}
          onOpenRecordPayment={() =>
            setPaymentModalState({ open: true, customer: null, invoice: null })
          }
          onOpenInvoicesArchive={() => {
            setActiveTab('invoices');
            setInvoicesMode('archive');
          }}
          onRestockProduct={(prod) =>
            setRestockModalState({ open: true, product: prod, qty: 10 })
          }
          onPreviewInvoice={handlePreviewInvoiceById}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {activeTab === 'products' && (
        <ProductsPage
          products={products}
          loading={loadingCore}
          currency={settings.currency}
          onAddProduct={() => {
            setEditingProduct(null);
            setProductModalOpen(true);
          }}
          onEditProduct={(prod) => {
            setEditingProduct(prod);
            setProductModalOpen(true);
          }}
          onDeleteProduct={handleDeleteProduct}
          onRestockProduct={(prod, defaultQty = 10) =>
            setRestockModalState({ open: true, product: prod, qty: defaultQty })
          }
          onOpenStockMovements={() => setStockMovementsOpen(true)}
        />
      )}

      {activeTab === 'invoices' && (
        <InvoicesPage
          mode={invoicesMode}
          onChangeMode={setInvoicesMode}
          products={products}
          customers={customers}
          invoices={invoices}
          settings={settings}
          preselectedCustomerId={preselectedPosCustomerId}
          onClearPreselectedCustomer={() => setPreselectedPosCustomerId(null)}
          onOpenAddCustomer={() => {
            setEditingCustomer(null);
            setCustomerModalOpen(true);
          }}
          onSubmitInvoice={handleSubmitInvoice}
          onPreviewInvoice={(inv) => setPreviewInvoice(inv)}
          onPayInvoice={(inv) =>
            setPaymentModalState({ open: true, customer: null, invoice: inv })
          }
          onCancelInvoice={handleCancelInvoice}
          onToast={addToast}
        />
      )}

      {activeTab === 'customers' && (
        <CustomersPage
          customers={customers}
          payments={payments}
          loading={loadingCore}
          currency={settings.currency}
          onAddCustomer={() => {
            setEditingCustomer(null);
            setCustomerModalOpen(true);
          }}
          onEditCustomer={(cust) => {
            setEditingCustomer(cust);
            setCustomerModalOpen(true);
          }}
          onDeleteCustomer={handleDeleteCustomer}
          onPayDebt={(cust) =>
            setPaymentModalState({ open: true, customer: cust, invoice: null })
          }
          onOpenStatement={(cust) => setStatementCustomerId(cust.id)}
          onNewInvoiceForCustomer={(cust) => {
            setPreselectedPosCustomerId(cust.id);
            setActiveTab('invoices');
            setInvoicesMode('pos');
          }}
        />
      )}

      {activeTab === 'reports' && (
        <ReportsPage
          data={reports}
          loading={loadingCore}
          range={reportsRange}
          customFrom={customFrom}
          customTo={customTo}
          onChangeRange={handleChangeReportsRange}
          onChangeCustomDates={handleChangeCustomDates}
          onOpenStockMovements={() => setStockMovementsOpen(true)}
          onToast={addToast}
        />
      )}

      {/* Modals */}
      <ProductModal
        open={productModalOpen}
        product={editingProduct}
        defaultThreshold={settings.low_stock_default_threshold}
        currency={settings.currency}
        onClose={() => setProductModalOpen(false)}
        onSave={handleSaveProduct}
      />

      <RestockModal
        open={restockModalState.open}
        product={restockModalState.product}
        defaultQty={restockModalState.qty}
        onClose={() => setRestockModalState({ open: false, product: null, qty: 10 })}
        onConfirm={handleRestockConfirm}
      />

      <StockMovementsModal
        open={stockMovementsOpen}
        onClose={() => setStockMovementsOpen(false)}
      />

      <CustomerModal
        open={customerModalOpen}
        customer={editingCustomer}
        currency={settings.currency}
        onClose={() => setCustomerModalOpen(false)}
        onSave={handleSaveCustomer}
      />

      <PaymentModal
        open={paymentModalState.open}
        customers={customers}
        initialCustomer={paymentModalState.customer}
        initialInvoice={paymentModalState.invoice}
        currency={settings.currency}
        onClose={() => setPaymentModalState({ open: false, customer: null, invoice: null })}
        onConfirm={handleRecordPayment}
      />

      <CustomerStatementModal
        open={statementCustomerId !== null}
        customerId={statementCustomerId}
        currency={settings.currency}
        onClose={() => setStatementCustomerId(null)}
        onPayDebt={(cust) => {
          setStatementCustomerId(null);
          setPaymentModalState({ open: true, customer: cust, invoice: null });
        }}
        onEditCustomer={(cust) => {
          setStatementCustomerId(null);
          setEditingCustomer(cust);
          setCustomerModalOpen(true);
        }}
        onDeleteCustomer={handleDeleteCustomer}
        onNewInvoiceForCustomer={(cust) => {
          setStatementCustomerId(null);
          setPreselectedPosCustomerId(cust.id);
          setActiveTab('invoices');
          setInvoicesMode('pos');
        }}
        onPreviewInvoice={(inv) => {
          setStatementCustomerId(null);
          setPreviewInvoice(inv);
        }}
      />

      <InvoicePreviewModal
        open={previewInvoice !== null}
        invoice={previewInvoice}
        settings={settings}
        customers={customers}
        onClose={() => setPreviewInvoice(null)}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        onResetAllData={handleResetAllData}
      />

      {confirmState && (
        <ConfirmModal
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          loading={confirmState.loading}
          onCancel={() => setConfirmState(null)}
          onConfirm={async () => {
            setConfirmState((prev) => (prev ? { ...prev, loading: true } : null));
            try {
              await confirmState.onConfirm();
              setConfirmState(null);
            } catch (err: any) {
              addToast('error', err.message || 'تعذر تنفيذ العملية');
              setConfirmState((prev) => (prev ? { ...prev, loading: false } : null));
            }
          }}
        />
      )}
    </AppShell>
  );
}

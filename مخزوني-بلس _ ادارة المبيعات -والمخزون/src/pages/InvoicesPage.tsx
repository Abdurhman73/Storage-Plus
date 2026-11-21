import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Eye,
  Info,
  Minus,
  PieChart,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  Search,
  Share2,
  ShieldCheck,
  Tag,
  Trash2,
  User,
  UserPlus,
  Wallet,
  XCircle,
} from 'lucide-react';
import type { AppSettings, CurrencyCode, Customer, Invoice, PaidChannel, PaymentMethod, Product } from '../types';
import { exportInvoiceCsv, exportToCsv, formatCurrency, formatDateArabic, formatNumber, formatTimeArabic } from '../utils/format';
import { ProductThumb } from '../components/ProductThumb';
import { CurrencyInlineSelector } from '../components/CurrencyInlineSelector';

interface CartItem {
  product: Product;
  quantity: number;
}

interface InvoicesPageProps {
  mode: 'pos' | 'archive';
  onChangeMode: (m: 'pos' | 'archive') => void;
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  settings: AppSettings;
  preselectedCustomerId?: number | null;
  onClearPreselectedCustomer?: () => void;
  onOpenAddCustomer: () => void;
  onSubmitInvoice: (payload: {
    customer_id: number | null;
    items: { product_id: number; quantity: number; unit_price: number }[];
    currency: string;
    discount_amount: number;
    payment_method: PaymentMethod;
    paid_channel: PaidChannel;
    paid_amount: number;
  }) => Promise<Invoice>;
  onPreviewInvoice: (invoice: Invoice) => void;
  onPayInvoice: (invoice: Invoice) => void;
  onCancelInvoice: (invoice: Invoice) => void;
  onToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export function InvoicesPage({
  mode,
  onChangeMode,
  products,
  customers,
  invoices,
  settings,
  preselectedCustomerId,
  onClearPreselectedCustomer,
  onOpenAddCustomer,
  onSubmitInvoice,
  onPreviewInvoice,
  onPayInvoice,
  onCancelInvoice,
  onToast,
}: InvoicesPageProps) {
  // POS State
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountInput, setDiscountInput] = useState('0');
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidChannel, setPaidChannel] = useState<PaidChannel>('card');
  const [splitPaidInput, setSplitPaidInput] = useState('0');
  const [invoiceCurrency, setInvoiceCurrency] = useState<CurrencyCode>(
    settings.currency === 'ر.ي' ? 'ر.ي' : 'ر.س'
  );
  const [submitting, setSubmitting] = useState(false);

  // Archive State
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveStatus, setArchiveStatus] = useState<'all' | 'paid' | 'partial' | 'unpaid' | 'cancelled'>('all');

  const cur = invoiceCurrency;

  useEffect(() => {
    if (preselectedCustomerId) {
      setSelectedCustomerId(preselectedCustomerId);
      onClearPreselectedCustomer?.();
    } else if (selectedCustomerId === null && customers.length > 0 && cart.length === 0) {
      // keep default walk-in or first selected when user picks
    }
  }, [preselectedCustomerId, customers, onClearPreselectedCustomer]);

  const activeCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const searchableProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products
      .filter((p) => {
        if (!q) return p.stock_qty > 0;
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [products, productSearch]);

  const addToCart = (prod: Product) => {
    if (prod.stock_qty <= 0) {
      onToast('error', `نفدت كمية المنتج "${prod.name}" من المخزون`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((it) => it.product.id === prod.id);
      if (existing) {
        if (existing.quantity >= prod.stock_qty) {
          onToast('error', `الحد الأقصى المتاح في المخزون هو ${prod.stock_qty} ${prod.unit_label}`);
          return prev;
        }
        return prev.map((it) =>
          it.product.id === prod.id ? { ...it, quantity: it.quantity + 1 } : it
        );
      }
      return [...prev, { product: prod, quantity: 1 }];
    });
    setProductSearch('');
  };

  const updateCartQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) => {
          if (it.product.id !== productId) return it;
          const nextQty = it.quantity + delta;
          if (nextQty > it.product.stock_qty) {
            onToast('error', `المتوفر في المخزون ${it.product.stock_qty} فقط`);
            return it;
          }
          return { ...it, quantity: nextQty };
        })
        .filter((it) => it.quantity > 0)
    );
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, it) => sum + it.product.sell_price * it.quantity, 0),
    [cart]
  );
  const vatAmount = Number(((subtotal * settings.vat_rate) / 100).toFixed(2));
  const discount = Math.max(0, Math.min(subtotal + vatAmount, Number(discountInput || 0)));
  const grandTotal = Number(Math.max(0, subtotal + vatAmount - discount).toFixed(2));

  useEffect(() => {
    if (paymentMethod === 'split') {
      const suggested = Number((grandTotal * 0.65).toFixed(2));
      setSplitPaidInput(String(suggested));
    }
  }, [grandTotal, paymentMethod]);

  const currentPaidAmount =
    paymentMethod === 'credit'
      ? 0
      : paymentMethod === 'split'
      ? Math.max(0, Math.min(grandTotal, Number(splitPaidInput || 0)))
      : grandTotal;
  const remainingDebt = Number(Math.max(0, grandTotal - currentPaidAmount).toFixed(2));

  const nextInvoicePreviewNum = `INV-${new Date().getFullYear()}-${1049 + invoices.length}`;
  const todayLabel = new Date().toLocaleDateString('ar-SA-u-nu-latn', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleCheckout = async () => {
    if (cart.length === 0) {
      onToast('error', 'السلة فارغة — أضف منتجاً واحداً على الأقل');
      return;
    }
    if (remainingDebt > 0.01 && !activeCustomer) {
      onToast('error', 'لا يمكن ترحيل مبلغ آجل لعميل نقدي عام — يرجى اختيار عميل مسجل');
      return;
    }

    setSubmitting(true);
    try {
      const channel: PaidChannel =
        paymentMethod === 'cash' || paymentMethod === 'card' || paymentMethod === 'transfer'
          ? paymentMethod
          : paidChannel;

      const created = await onSubmitInvoice({
        customer_id: activeCustomer ? activeCustomer.id : null,
        items: cart.map((c) => ({
          product_id: c.product.id,
          quantity: c.quantity,
          unit_price: c.product.sell_price,
        })),
        currency: invoiceCurrency,
        discount_amount: discount,
        payment_method: paymentMethod,
        paid_channel: channel,
        paid_amount: currentPaidAmount,
      });

      setCart([]);
      setDiscountInput('0');
      setPaymentMethod('cash');
      onToast('success', `تم إصدار الفاتورة #${created.invoice_number} بنجاح وتحديث المخزون`);
      onPreviewInvoice(created);
    } catch (err: any) {
      onToast('error', err.message || 'تعذر إصدار الفاتورة');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCurrentDraft = () => {
    if (cart.length > 0) {
      const draftInv: Invoice = {
        id: 0,
        invoice_number: `${nextInvoicePreviewNum}-مسودة`,
        customer_id: activeCustomer ? activeCustomer.id : null,
        customer_name_snapshot: activeCustomer ? activeCustomer.name : 'عميل نقدي عام',
        customer_phone: activeCustomer?.phone,
        customer_tax_id: activeCustomer?.tax_id,
        currency: invoiceCurrency,
        subtotal,
        vat_rate: settings.vat_rate,
        vat_amount: vatAmount,
        discount_amount: discount,
        total_amount: grandTotal,
        paid_amount: currentPaidAmount,
        remaining_amount: remainingDebt,
        payment_method: paymentMethod,
        paid_channel: paidChannel,
        status: remainingDebt <= 0.01 ? 'paid' : currentPaidAmount > 0 ? 'partial' : 'unpaid',
        due_date: null,
        notes: '',
        created_at: new Date().toISOString(),
        items: cart.map((c) => ({
          product_id: c.product.id,
          product_name: c.product.name,
          sku: c.product.sku,
          quantity: c.quantity,
          unit_price: c.product.sell_price,
          cost_price: c.product.cost_price,
          line_total: c.product.sell_price * c.quantity,
        })),
      };
      exportInvoiceCsv(draftInv, settings);
      onToast('success', 'تم تصدير تفاصيل الفاتورة الحالية (CSV) بنجاح');
      return;
    }

    if (invoices.length > 0) {
      exportInvoiceCsv(invoices[0], settings);
      onToast('success', `تم تصدير آخر فاتورة صادرة #${invoices[0].invoice_number} (CSV) بنجاح`);
      return;
    }

    onToast('info', 'أضف منتجات للسلة أو أصدر فاتورة أولاً لتصديرها');
  };

  const handleExportAllFiltered = () => {
    if (filteredInvoices.length === 0) {
      onToast('info', 'لا توجد فواتير لتصديرها');
      return;
    }
    exportToCsv(
      `invoices-${Date.now()}.csv`,
      ['رقم الفاتورة', 'العميل', 'الهاتف', 'العملة', 'المجموع الفرعي', 'الضريبة', 'الخصم', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة', 'التاريخ'],
      filteredInvoices.map((inv) => [
        inv.invoice_number,
        inv.customer_name_snapshot,
        inv.customer_phone || '-',
        inv.currency || settings.currency,
        inv.subtotal,
        inv.vat_amount,
        inv.discount_amount,
        inv.total_amount,
        inv.paid_amount,
        inv.remaining_amount,
        inv.status === 'paid' ? 'مدفوعة' : inv.status === 'partial' ? 'جزئية' : inv.status === 'cancelled' ? 'ملغاة' : 'آجلة',
        formatDateArabic(inv.created_at),
      ])
    );
    onToast('success', `تم تصدير ${filteredInvoices.length} فاتورة بنجاح`);
  };

  // Filtered Archive Invoices
  const filteredInvoices = useMemo(() => {
    const q = archiveSearch.trim().toLowerCase();
    return invoices.filter((inv) => {
      const matchStatus = archiveStatus === 'all' || inv.status === archiveStatus;
      const matchQuery =
        !q ||
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.customer_name_snapshot.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [invoices, archiveSearch, archiveStatus]);

  return (
    <div className="space-y-4">
      {/* Mode Switcher: POS vs Archive */}
      <div className="flex items-center gap-2 p-1 rounded-2xl bg-[#171923] border border-[#252836]">
        <button
          type="button"
          onClick={() => onChangeMode('pos')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all ${
            mode === 'pos' ? 'bg-[#A799FF] text-[#0D0E12]' : 'text-slate-300 hover:text-white'
          }`}
        >
          إنشاء فاتورة بيع (POS)
        </button>
        <button
          type="button"
          onClick={() => onChangeMode('archive')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all ${
            mode === 'archive' ? 'bg-[#A799FF] text-[#0D0E12]' : 'text-slate-300 hover:text-white'
          }`}
        >
          سجل وإدارة الفواتير ({invoices.length})
        </button>
      </div>

      {mode === 'pos' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Right Column (Items + Customer) */}
          <div className="lg:col-span-7 space-y-4">
            {/* 1. Simplified Tax Invoice Header Card */}
            <section className="rounded-3xl p-4 bg-[#171923] border border-[#252836]">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#24213B] text-[#A799FF] flex items-center justify-center shrink-0">
                    <ReceiptText className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-extrabold text-white">فاتورة ضريبية مبسطة</h2>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#132A22] text-[#2EE59D] text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2EE59D]" />
                  مسودة معتمدة
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span className="font-mono font-bold text-[#A799FF]">#{nextInvoicePreviewNum}</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{todayLabel}</span>
                </span>
              </div>
            </section>

            {/* 2. Beneficiary Customer Card */}
            <section className="rounded-3xl p-4 bg-[#171923] border border-[#252836] space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                  <User className="w-4 h-4 text-[#2EE59D]" />
                  <span>العميل المستفيد</span>
                </span>
                <button
                  type="button"
                  onClick={onOpenAddCustomer}
                  className="flex items-center gap-1 text-xs font-bold text-[#2EE59D] hover:underline"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>عميل جديد</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 relative">
                <button
                  type="button"
                  onClick={() => setShowCustomerDropdown((v) => !v)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-extrabold transition-all border ${
                    activeCustomer
                      ? 'bg-[#D4C9FF] text-[#0D0E12] border-[#D4C9FF]'
                      : 'bg-[#11131B] text-slate-300 border-[#252836] hover:border-[#A799FF]/50'
                  }`}
                >
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">{activeCustomer ? activeCustomer.name : 'اختيار عميل مسجل'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId(null);
                    setShowCustomerDropdown(false);
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-bold transition-all border ${
                    !activeCustomer
                      ? 'bg-[#D4C9FF] text-[#0D0E12] border-[#D4C9FF]'
                      : 'bg-[#11131B] text-slate-300 border-[#252836] hover:border-slate-500'
                  }`}
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span>عميل نقدي عام</span>
                </button>

                {showCustomerDropdown && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowCustomerDropdown(false)} />
                    <div className="absolute top-12 right-0 left-0 z-30 rounded-2xl bg-[#1B1E2B] border border-[#2F3448] shadow-2xl p-2 max-h-60 overflow-y-auto space-y-1">
                      {customers.length === 0 ? (
                        <div className="p-3 text-center space-y-2">
                          <p className="text-xs text-slate-400">لا يوجد عملاء مسجلون بعد</p>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCustomerDropdown(false);
                              onOpenAddCustomer();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#2EE59D]/15 text-[#2EE59D] text-xs font-bold"
                          >
                            + إضافة عميل جديد
                          </button>
                        </div>
                      ) : (
                        customers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomerId(c.id);
                              setInvoiceCurrency(c.currency === 'ر.ي' ? 'ر.ي' : 'ر.س');
                              setShowCustomerDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors ${
                              selectedCustomerId === c.id
                                ? 'bg-[#A799FF]/20 text-white font-bold'
                                : 'text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            <span className="truncate">{c.name}</span>
                            <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                              ذمم: {formatCurrency(c.balance_due, c.currency || cur)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-[#2EE59D]" />
                  <span>
                    {activeCustomer?.tax_id
                      ? `السجل الضريبي: ${activeCustomer.tax_id}`
                      : activeCustomer
                      ? `الجوال: ${activeCustomer.phone || 'غير مسجل'}`
                      : 'مبيعات نقدية فورية'}
                  </span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#132A22] text-[#2EE59D] font-bold">
                  {activeCustomer
                    ? `حد ائتماني متاح: ${formatCurrency(Math.max(0, activeCustomer.credit_limit - activeCustomer.balance_due), cur)}`
                    : 'دفع فوري'}
                </span>
              </div>
            </section>

            {/* 3. Product Search & Quick Add */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center bg-[#171923] border border-[#252836] rounded-2xl px-3.5 py-2.5 focus-within:border-[#A799FF]">
                  <Search className="w-4 h-4 text-slate-400 ml-2.5 shrink-0" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="ابحث بالاسم، الكود، أو الفئة لإضافة منتج..."
                    className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const available = products.filter((p) => p.stock_qty > 0);
                    if (available.length > 0) addToCart(available[0]);
                  }}
                  title="إضافة سريعة لأول صنف متاح"
                  className="p-3 rounded-2xl bg-[#171923] border border-[#252836] text-[#A799FF] hover:border-[#A799FF]"
                >
                  <QrCode className="w-5 h-5" />
                </button>
              </div>

              {/* Search Dropdown / Quick Shelf */}
              {productSearch.trim().length > 0 && (
                <div className="mt-2 rounded-2xl bg-[#1B1E2B] border border-[#2E3347] shadow-2xl p-2 space-y-1 max-h-64 overflow-y-auto">
                  {searchableProducts.length === 0 ? (
                    <p className="p-3 text-center text-xs text-slate-400">لا توجد منتجات مطابقة</p>
                  ) : (
                    searchableProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addToCart(p)}
                        className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-white/5 text-right transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ProductThumb src={p.image_url} alt={p.name} sizeClass="w-10 h-10 rounded-lg" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{p.name}</p>
                            <p className="text-[11px] text-slate-400 tabular-nums">
                              متاح: {p.stock_qty} • #{p.sku}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-extrabold text-[#A799FF] tabular-nums shrink-0">
                          {formatCurrency(p.sell_price, cur)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Quick-add available products chips */}
              <div className="flex items-center gap-2 overflow-x-auto pt-2.5 pb-1 no-scrollbar">
                {products
                  .filter((p) => p.stock_qty > 0)
                  .slice(0, 6)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addToCart(p)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#171923] border border-[#252836] hover:border-[#A799FF]/50 text-xs text-slate-200 whitespace-nowrap shrink-0 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#A799FF]" />
                      <span className="max-w-[140px] truncate">{p.name}</span>
                      <span className="text-[11px] text-[#2EE59D] font-bold tabular-nums">
                        {formatNumber(p.sell_price)}
                      </span>
                    </button>
                  ))}
              </div>
            </div>

            {/* 4. Selected Products Cart */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300">
                  المنتجات المختارة ({cart.length} عناصر)
                </h3>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="flex items-center gap-1 text-xs font-bold text-[#F87171] hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تفريغ السلة</span>
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="rounded-3xl p-8 bg-[#171923] border border-dashed border-[#2A2E3F] text-center space-y-2">
                  <p className="text-sm font-bold text-slate-300">سلة الفاتورة فارغة</p>
                  <p className="text-xs text-slate-500">
                    اختر منتجات من الشريط السريع أعلاه أو ابحث بالاسم / الباركود لإضافتها للفاتورة
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cart.map((item) => {
                    const lineTotal = item.product.sell_price * item.quantity;
                    return (
                      <div
                        key={item.product.id}
                        className="rounded-2xl p-3.5 bg-[#171923] border border-[#252836] space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <ProductThumb src={item.product.image_url} alt={item.product.name} sizeClass="w-12 h-12 rounded-xl" />
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-white truncate">{item.product.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-slate-400 tabular-nums">
                                  {formatNumber(item.product.sell_price)} {cur} / وحدة
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-[#142A22] text-[#2EE59D] text-[10px] font-bold tabular-nums">
                                  متبقي: {item.product.stock_qty}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setCart((prev) => prev.filter((c) => c.product.id !== item.product.id))
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#F87171]"
                            aria-label="حذف الصنف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1.5 bg-[#11131B] border border-[#222533] rounded-xl p-1">
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.product.id, -1)}
                              className="w-8 h-8 rounded-lg bg-[#1C1F2B] text-white flex items-center justify-center hover:bg-[#272B3B]"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-sm font-extrabold text-white tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.product.id, 1)}
                              className="w-8 h-8 rounded-lg bg-[#A799FF] text-[#0D0E12] flex items-center justify-center hover:opacity-90"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                          </div>

                          <span className="text-base font-extrabold text-white tabular-nums">
                            {formatNumber(lineTotal, 2)}{' '}
                            <span className="text-xs font-normal text-slate-400">{cur}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Left Column (Summary + Payment Method + Issue CTA) */}
          <div className="lg:col-span-5 space-y-4">
            {/* 5. Invoice Summary Card */}
            <section className="rounded-3xl p-4 sm:p-5 bg-[#171923] border border-[#252836] space-y-3">
              <div className="flex items-center justify-between gap-2 pb-1">
                <h3 className="text-xs font-bold text-slate-300">ملخص الفاتورة والحسابات</h3>
                <span className="px-2.5 py-1 rounded-full bg-[#132A22] text-[#2EE59D] text-[10px] font-bold">
                  نقطة البيع المعتمدة
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>المجموع الفرعي (غير شامل الضريبة)</span>
                  <span className="font-bold text-white tabular-nums">
                    {formatCurrency(subtotal, cur, 2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span>ضريبة القيمة المضافة</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#24213B] text-[#A799FF] text-[10px] font-bold tabular-nums">
                      {settings.vat_rate}%
                    </span>
                  </span>
                  <span className="font-bold text-white tabular-nums">
                    {formatCurrency(vatAmount, cur, 2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#2EE59D]">
                  <button
                    type="button"
                    onClick={() => setEditingDiscount((v) => !v)}
                    className="flex items-center gap-1.5 font-semibold hover:underline"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>خصم ترويجي خاص (اضغط للتعديل)</span>
                  </button>
                  {editingDiscount ? (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      onBlur={() => setEditingDiscount(false)}
                      autoFocus
                      className="w-24 px-2 py-1 rounded-lg bg-[#11131B] border border-[#2EE59D] text-left text-xs font-bold text-[#2EE59D] tabular-nums focus:outline-none"
                    />
                  ) : (
                    <span
                      onClick={() => setEditingDiscount(true)}
                      className="font-bold tabular-nums cursor-pointer"
                    >
                      -{formatCurrency(discount, cur, 2)}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#11131B] border border-[#222533] flex items-center justify-between gap-2">
                <div>
                  <span className="block text-xs font-bold text-white">الإجمالي المستحق النهائي</span>
                  <span className="text-[10px] text-[#2EE59D]">شامل ضريبة القيمة المضافة</span>
                </div>
                <div className="flex items-center gap-2.5 text-left">
                  <CurrencyInlineSelector value={invoiceCurrency} onChange={setInvoiceCurrency} />
                  <div>
                    <span className="text-2xl font-extrabold text-white tabular-nums">
                      {formatNumber(grandTotal, 2)}
                    </span>{' '}
                    <span className="text-xs text-slate-400">{cur}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 6. Payment Method & Split Payment */}
            <section className="rounded-3xl p-4 sm:p-5 bg-[#171923] border border-[#252836] space-y-3">
              <h3 className="text-xs font-bold text-white">طريقة السداد وتوزيع الدفع</h3>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'cash', label: 'نقدي (كاش)', icon: Banknote },
                    { id: 'card', label: 'مدى / فيزا', icon: CreditCard },
                    { id: 'transfer', label: 'تحويل بنكي', icon: Building2 },
                  ] as const
                ).map((m) => {
                  const Icon = m.icon;
                  const active = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-2xl border text-[11px] font-bold transition-all ${
                        active
                          ? 'bg-[#A799FF] text-[#0D0E12] border-[#A799FF]'
                          : 'bg-[#11131B] text-slate-300 border-[#252836] hover:border-slate-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('credit')}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-2xl border text-[11px] font-bold transition-all ${
                    paymentMethod === 'credit'
                      ? 'bg-[#A799FF] text-[#0D0E12] border-[#A799FF]'
                      : 'bg-[#11131B] text-slate-300 border-[#252836] hover:border-slate-500'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>آجل (ذمم)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('split')}
                  className={`col-span-2 flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border text-xs font-extrabold transition-all ${
                    paymentMethod === 'split'
                      ? 'bg-[#B5A8FF] text-[#0D0E12] border-[#B5A8FF]'
                      : 'bg-[#11131B] text-slate-300 border-[#252836] hover:border-[#A799FF]/50'
                  }`}
                >
                  <PieChart className="w-4 h-4" />
                  <span>دفع مقسم (جزئي + آجل)</span>
                </button>
              </div>

              {(paymentMethod === 'split' || paymentMethod === 'credit') && (
                <div className="p-3.5 rounded-2xl bg-[#11131B] border border-[#222533] space-y-3">
                  {paymentMethod === 'split' && (
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[11px] mb-1.5">
                        <span className="text-slate-300">المبلغ المدفوع حالياً (عربون/جزئي)</span>
                        <div className="flex items-center gap-2">
                          <CurrencyInlineSelector value={invoiceCurrency} onChange={setInvoiceCurrency} />
                          <select
                            value={paidChannel}
                            onChange={(e) => setPaidChannel(e.target.value as PaidChannel)}
                            className="bg-transparent text-[#2EE59D] font-bold focus:outline-none cursor-pointer"
                          >
                            <option value="card" className="bg-[#171923]">بطاقة / شبكة</option>
                            <option value="cash" className="bg-[#171923]">نقدي</option>
                            <option value="transfer" className="bg-[#171923]">تحويل بنكي</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center rounded-xl bg-[#171923] border border-[#252836] focus-within:border-[#2EE59D] px-3.5">
                        <input
                          type="number"
                          min="0"
                          max={grandTotal}
                          step="0.01"
                          value={splitPaidInput}
                          onChange={(e) => setSplitPaidInput(e.target.value)}
                          className="w-full py-2.5 bg-transparent text-lg font-extrabold text-[#2EE59D] tabular-nums focus:outline-none"
                        />
                        <span className="text-xs font-bold text-[#2EE59D] shrink-0">{cur}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="text-slate-300">المبلغ المتبقي (آجل على الحساب)</span>
                      <span className="text-[#F87171] font-semibold">مستحق خلال 30 يوم</span>
                    </div>
                    <div className="px-3.5 py-2.5 rounded-xl bg-[#171923] border border-[#252836] text-lg font-extrabold text-[#FCA5A5] tabular-nums">
                      {formatCurrency(remainingDebt, cur, 2)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#171923] text-[11px] text-slate-400">
                    <Info className="w-4 h-4 text-[#A799FF] shrink-0" />
                    <span>
                      {activeCustomer
                        ? `سيتم ترحيل المتبقي (${formatCurrency(remainingDebt, cur)}) لدفتر ذمم ${activeCustomer.name}`
                        : 'يرجى اختيار عميل مسجل لإتمام الفاتورة الآجلة أو المقسمة'}
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* 7. Issue & Print CTAs */}
            <div className="space-y-2.5">
              <button
                type="button"
                disabled={submitting || cart.length === 0}
                onClick={handleCheckout}
                className="w-full flex items-center justify-center gap-2 py-4 px-5 rounded-2xl bg-gradient-to-l from-[#B5A8FF] to-[#8C7AE6] text-[#0D0E12] text-sm font-extrabold shadow-lg shadow-[#A799FF]/20 hover:opacity-95 transition-opacity disabled:opacity-50"
              >
                <ShieldCheck className="w-5 h-5" />
                <span>{submitting ? 'جاري اعتماد الفاتورة...' : 'حفظ وإصدار الفاتورة المعتمدة'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (cart.length > 0) {
                      const draftInv: Invoice = {
                        id: 0,
                        invoice_number: `${nextInvoicePreviewNum} (مسودة)`,
                        customer_id: activeCustomer ? activeCustomer.id : null,
                        customer_name_snapshot: activeCustomer ? activeCustomer.name : 'عميل نقدي عام',
                        customer_phone: activeCustomer?.phone,
                        customer_tax_id: activeCustomer?.tax_id,
                        currency: invoiceCurrency,
                        subtotal,
                        vat_rate: settings.vat_rate,
                        vat_amount: vatAmount,
                        discount_amount: discount,
                        total_amount: grandTotal,
                        paid_amount: currentPaidAmount,
                        remaining_amount: remainingDebt,
                        payment_method: paymentMethod,
                        paid_channel: paidChannel,
                        status: remainingDebt <= 0.01 ? 'paid' : currentPaidAmount > 0 ? 'partial' : 'unpaid',
                        due_date: null,
                        notes: '',
                        created_at: new Date().toISOString(),
                        items: cart.map((c) => ({
                          product_id: c.product.id,
                          product_name: c.product.name,
                          sku: c.product.sku,
                          quantity: c.quantity,
                          unit_price: c.product.sell_price,
                          cost_price: c.product.cost_price,
                          line_total: c.product.sell_price * c.quantity,
                        })),
                      };
                      onPreviewInvoice(draftInv);
                    } else if (invoices.length > 0) {
                      onPreviewInvoice(invoices[0]);
                    } else {
                      onToast('info', 'أضف منتجات للسلة أو أصدر فاتورة للمعاينة والطباعة');
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-2xl bg-[#171923] border border-[#252836] text-xs font-bold text-slate-200 hover:border-[#2EE59D]/40"
                >
                  <Printer className="w-4 h-4 text-[#2EE59D]" />
                  <span>معاينة / طباعة ومشاركة</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCurrentDraft}
                  className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-2xl bg-[#171923] border border-[#252836] text-xs font-bold text-slate-200 hover:border-[#A799FF]/40"
                >
                  <Share2 className="w-4 h-4 text-[#2EE59D]" />
                  <span>تصدير CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Invoices Management & Archive View */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1 flex items-center bg-[#171923] border border-[#252836] rounded-2xl px-3.5 py-2.5 focus-within:border-[#A799FF]">
              <Search className="w-4 h-4 text-slate-400 ml-2.5" />
              <input
                type="text"
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                placeholder="ابحث برقم الفاتورة أو اسم العميل..."
                className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'all', label: 'الكل' },
                  { id: 'paid', label: 'مدفوعة' },
                  { id: 'partial', label: 'جزئية' },
                  { id: 'unpaid', label: 'آجلة' },
                  { id: 'cancelled', label: 'ملغاة' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setArchiveStatus(f.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors ${
                    archiveStatus === f.id
                      ? 'bg-[#A799FF] text-[#0D0E12] border-[#A799FF]'
                      : 'bg-[#171923] text-slate-300 border-[#252836]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <button
                type="button"
                onClick={handleExportAllFiltered}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#171923] border border-[#252836] hover:border-[#2EE59D]/50 text-xs font-bold text-[#2EE59D] whitespace-nowrap"
                title="تصدير سجل الفواتير"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير الكل</span>
              </button>
            </div>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="rounded-3xl p-10 bg-[#171923] border border-[#252836] text-center text-sm text-slate-400">
              لا توجد فواتير مطابقة للتصفية الحالية
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-2xl p-4 bg-[#171923] border border-[#252836] space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-[#A799FF] font-mono">
                          #{inv.invoice_number}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'paid'
                              ? 'bg-[#132A22] text-[#2EE59D]'
                              : inv.status === 'partial'
                              ? 'bg-[#13292D] text-[#38BDF8]'
                              : inv.status === 'cancelled'
                              ? 'bg-slate-700/40 text-slate-400'
                              : 'bg-[#2D1820] text-[#F87171]'
                          }`}
                        >
                          {inv.status === 'paid'
                            ? 'مدفوعة كلياً'
                            : inv.status === 'partial'
                            ? 'دفعة جزئية'
                            : inv.status === 'cancelled'
                            ? 'ملغاة'
                            : 'آجلة / غير مسددة'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white mt-1">{inv.customer_name_snapshot}</p>
                      <p className="text-[11px] text-slate-400">
                        {formatDateArabic(inv.created_at)} • {formatTimeArabic(inv.created_at)}
                      </p>
                    </div>

                    <div className="text-left">
                      <span className="block text-base font-extrabold text-white tabular-nums">
                        {formatCurrency(inv.total_amount, inv.currency || settings.currency)}
                      </span>
                      {inv.remaining_amount > 0 && inv.status !== 'cancelled' && (
                        <span className="text-[11px] text-[#F87171] font-bold tabular-nums">
                          متبقي: {formatCurrency(inv.remaining_amount, inv.currency || settings.currency)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-[#222533]">
                    <button
                      type="button"
                      onClick={() => onPreviewInvoice(inv)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#11131B] border border-[#252836] text-xs font-bold text-slate-200 hover:border-[#A799FF]/50"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#A799FF]" />
                      <span>عرض وطباعة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        exportInvoiceCsv(inv, settings);
                        onToast('success', `تم تصدير الفاتورة #${inv.invoice_number} بنجاح`);
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#11131B] border border-[#252836] text-xs font-bold text-slate-200 hover:border-[#2EE59D]/50"
                      title="تصدير الفاتورة بصيغة CSV"
                    >
                      <Download className="w-3.5 h-3.5 text-[#2EE59D]" />
                      <span>تصدير</span>
                    </button>

                    {inv.remaining_amount > 0 && inv.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => onPayInvoice(inv)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#142922] border border-[#2EE59D]/30 text-xs font-bold text-[#2EE59D] hover:bg-[#19352C]"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>تحصيل دفعة</span>
                      </button>
                    )}

                    {inv.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => onCancelInvoice(inv)}
                        className="p-2 rounded-xl bg-[#29171B] border border-[#F87171]/25 text-[#F87171] hover:bg-[#F87171]/20"
                        title="إلغاء الفاتورة وإرجاع المخزون"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    {inv.status === 'paid' && (
                      <span className="px-2.5 py-2 rounded-xl bg-[#11131B] text-[#2EE59D] text-[11px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        مسددة
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Edit3, FileText, Package, PlusCircle, Trash2, Wallet, X } from 'lucide-react';
import { api } from '../../api/client';
import type { Customer, CustomerStatement, Invoice } from '../../types';
import { formatCurrency, formatDateArabic, formatTimeArabic } from '../../utils/format';

interface CustomerStatementModalProps {
  open: boolean;
  customerId: number | null;
  currency?: string;
  onClose: () => void;
  onPayDebt: (customer: Customer) => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customer: Customer) => void;
  onNewInvoiceForCustomer: (customer: Customer) => void;
  onPreviewInvoice: (invoice: Invoice) => void;
}

export function CustomerStatementModal({
  open,
  customerId,
  currency = 'ر.س',
  onClose,
  onPayDebt,
  onEditCustomer,
  onDeleteCustomer,
  onNewInvoiceForCustomer,
  onPreviewInvoice,
}: CustomerStatementModalProps) {
  const [data, setData] = useState<CustomerStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState<'invoices' | 'items' | 'payments'>('invoices');

  useEffect(() => {
    if (!open || !customerId) return;
    setLoading(true);
    api
      .getCustomerStatement(customerId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, customerId]);

  if (!open || !customerId) return null;

  const methodLabel = (m: string) =>
    m === 'cash' ? 'نقدي' : m === 'card' ? 'مدى / فيزا' : m === 'transfer' ? 'تحويل بنكي' : m;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm no-print">
      <div className="w-full max-w-2xl rounded-3xl bg-[#171923] border border-[#252836] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252836]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#A799FF]/15 text-[#A799FF] flex items-center justify-center font-bold text-lg shrink-0">
              {data?.customer.name.charAt(0) || 'ع'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white truncate">
                  {data?.customer.name || 'ملف العميل وكشف الحساب'}
                </h3>
                {data?.customer.is_vip ? (
                  <span className="px-2 py-0.5 rounded-md bg-[#2A2640] text-[#A799FF] text-[10px] font-bold">
                    VIP
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-400 truncate">
                {data?.customer.company_name || 'حساب عميل'} • {data?.customer.phone || 'بدون هاتف'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {data && (
              <>
                <button
                  type="button"
                  onClick={() => onEditCustomer(data.customer)}
                  className="p-2 rounded-xl bg-[#11131B] border border-[#252836] text-slate-300 hover:text-white"
                  title="تعديل العميل"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteCustomer(data.customer)}
                  className="p-2 rounded-xl bg-[#11131B] border border-[#252836] text-[#F87171] hover:bg-[#F87171]/10"
                  title="حذف العميل"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading || !data ? (
          <div className="p-12 text-center text-sm text-slate-400">جاري تحميل كشف الحساب...</div>
        ) : (
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {/* Financial Summary Strip */}
            <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-[#11131B] border border-[#222533]">
              <div>
                <span className="block text-[11px] text-slate-400">إجمالي المشتريات</span>
                <span className="text-sm sm:text-base font-bold text-white tabular-nums">
                  {formatCurrency(data.customer.total_purchases, data.customer.currency || currency)}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400">تم سداده</span>
                <span className="text-sm sm:text-base font-bold text-[#2EE59D] tabular-nums">
                  {formatCurrency(data.customer.total_paid, data.customer.currency || currency)}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400">الرصيد المتبقي</span>
                <span
                  className={`text-sm sm:text-base font-bold tabular-nums ${
                    data.customer.balance_due > 0 ? 'text-[#F87171]' : 'text-[#2EE59D]'
                  }`}
                >
                  {formatCurrency(data.customer.balance_due, data.customer.currency || currency)}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2.5">
              {data.customer.balance_due > 0 && (
                <button
                  type="button"
                  onClick={() => onPayDebt(data.customer)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#2EE59D] text-[#0D0E12] text-xs font-bold hover:opacity-95"
                >
                  <Wallet className="w-4 h-4" />
                  <span>تسجيل دفعة سداد</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onNewInvoiceForCustomer(data.customer)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#A799FF] text-[#0D0E12] text-xs font-bold hover:opacity-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>إنشاء فاتورة جديدة للعميل</span>
              </button>
            </div>

            {/* Sub Tabs */}
            <div className="flex gap-1.5 p-1 rounded-2xl bg-[#11131B] border border-[#222533]">
              <button
                type="button"
                onClick={() => setSubTab('invoices')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                  subTab === 'invoices' ? 'bg-[#A799FF] text-[#0D0E12]' : 'text-slate-400 hover:text-white'
                }`}
              >
                الفواتير ({data.invoices.length})
              </button>
              <button
                type="button"
                onClick={() => setSubTab('items')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                  subTab === 'items' ? 'bg-[#A799FF] text-[#0D0E12]' : 'text-slate-400 hover:text-white'
                }`}
              >
                سجل المشتريات ({data.purchasedItems.length})
              </button>
              <button
                type="button"
                onClick={() => setSubTab('payments')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                  subTab === 'payments' ? 'bg-[#A799FF] text-[#0D0E12]' : 'text-slate-400 hover:text-white'
                }`}
              >
                المدفوعات ({data.payments.length})
              </button>
            </div>

            {/* Content */}
            {subTab === 'invoices' && (
              <div className="space-y-2.5">
                {data.invoices.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">لا توجد فواتير مسجلة لهذا العميل</p>
                ) : (
                  data.invoices.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => onPreviewInvoice(inv)}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-[#11131B] border border-[#222533] hover:border-[#A799FF]/40 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-[#A799FF]" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white font-mono">#{inv.invoice_number}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                inv.status === 'paid'
                                  ? 'bg-[#2EE59D]/15 text-[#2EE59D]'
                                  : inv.status === 'partial'
                                  ? 'bg-[#38BDF8]/15 text-[#38BDF8]'
                                  : inv.status === 'cancelled'
                                  ? 'bg-slate-700/40 text-slate-400'
                                  : 'bg-[#F87171]/15 text-[#F87171]'
                              }`}
                            >
                              {inv.status === 'paid'
                                ? 'مدفوعة'
                                : inv.status === 'partial'
                                ? 'جزئية'
                                : inv.status === 'cancelled'
                                ? 'ملغاة'
                                : 'آجلة'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">{formatDateArabic(inv.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <span className="block text-sm font-bold text-white tabular-nums">
                          {formatCurrency(inv.total_amount, inv.currency || currency)}
                        </span>
                        {inv.remaining_amount > 0 && inv.status !== 'cancelled' && (
                          <span className="text-[11px] text-[#F87171] tabular-nums">
                            متبقي: {formatCurrency(inv.remaining_amount, inv.currency || currency)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {subTab === 'items' && (
              <div className="space-y-2.5">
                {data.purchasedItems.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">لا توجد مشتريات مسجلة بعد</p>
                ) : (
                  data.purchasedItems.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-[#11131B] border border-[#222533]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Package className="w-4 h-4 text-[#2EE59D] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{it.product_name}</p>
                          <p className="text-[11px] text-slate-400">
                            الكمية الإجمالية: {it.total_qty} • آخر شراء: {formatDateArabic(it.last_purchased_at)}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-[#A799FF] tabular-nums shrink-0">
                        {formatCurrency(it.total_spent, data.customer.currency || currency)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {subTab === 'payments' && (
              <div className="space-y-2.5">
                {data.payments.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">لا توجد سندات قبض مسجلة</p>
                ) : (
                  data.payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-[#11131B] border border-[#222533]"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">
                          سند #{p.receipt_number}
                          {p.invoice_number ? ` — ${p.invoice_number}` : ''}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {methodLabel(p.method)} • {formatDateArabic(p.created_at)} ({formatTimeArabic(p.created_at)})
                        </p>
                      </div>
                      <span className="text-sm font-bold text-[#2EE59D] tabular-nums">
                        +{formatCurrency(p.amount, p.currency || currency)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

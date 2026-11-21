import { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  Edit3,
  FileText,
  MoreVertical,
  Phone,
  ReceiptText,
  Search,
  Star,
  Trash2,
  UserPlus,
  UserX,
  Wallet,
} from 'lucide-react';
import type { Customer, Payment } from '../types';
import { formatCurrency, formatDateArabic, formatNumber, formatTimeArabic } from '../utils/format';

interface CustomersPageProps {
  customers: Customer[];
  payments: Payment[];
  loading: boolean;
  currency: string;
  onAddCustomer: () => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customer: Customer) => void;
  onPayDebt: (customer: Customer) => void;
  onOpenStatement: (customer: Customer) => void;
  onNewInvoiceForCustomer: (customer: Customer) => void;
}

type FilterKey = 'all' | 'overdue' | 'settled' | 'vip';

export function CustomersPage({
  customers,
  payments,
  loading,
  currency,
  onAddCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onPayDebt,
  onOpenStatement,
  onNewInvoiceForCustomer,
}: CustomersPageProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const stats = useMemo(() => {
    const totalDebt = customers.reduce((s, c) => s + c.balance_due, 0);
    const totalCollected = customers.reduce((s, c) => s + c.total_paid, 0);
    const unpaidInvoices = customers.reduce((s, c) => s + c.unpaid_invoice_count, 0);
    const debtors = customers.filter((c) => c.balance_due > 0);
    const topDebtor = [...debtors].sort((a, b) => b.balance_due - a.balance_due)[0] || null;
    const overdueCount = customers.filter((c) => c.balance_due > 0 && c.overdue_days > 0).length;
    const settledCount = customers.filter((c) => c.balance_due <= 0).length;
    const vipCount = customers.filter((c) => Boolean(c.is_vip)).length;
    return {
      totalDebt,
      totalCollected,
      unpaidInvoices,
      debtorCount: debtors.length,
      topDebtor,
      overdueCount,
      settledCount,
      vipCount,
    };
  }, [customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.company_name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.tax_id || '').toLowerCase().includes(q);
      if (!matchSearch) return false;

      if (filter === 'overdue') return c.balance_due > 0 && c.overdue_days > 0;
      if (filter === 'settled') return c.balance_due <= 0;
      if (filter === 'vip') return Boolean(c.is_vip);
      return true;
    });
  }, [customers, search, filter]);

  const displayedPayments = showAllPayments ? payments : payments.slice(0, 4);

  return (
    <div className="space-y-4">
      {/* 1. Top 2x2 KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4 bg-[#171923] border border-[#252836]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">الديون المستحقة</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-amber-400 tabular-nums">
            {formatNumber(stats.totalDebt)}{' '}
            <span className="text-xs font-normal text-slate-400">{currency}</span>
          </p>
          <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-bold tabular-nums">
            {stats.unpaidInvoices} فاتورة آجلة
          </span>
        </div>

        <div className="rounded-2xl p-4 bg-[#171923] border border-[#252836]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">إجمالي التحصيل</span>
            <div className="w-7 h-7 rounded-lg bg-[#142922] text-[#2EE59D] flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-[#2EE59D] tabular-nums">
            {formatNumber(stats.totalCollected)}{' '}
            <span className="text-xs font-normal text-slate-400">{currency}</span>
          </p>
          <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full bg-[#142922] text-[#2EE59D] text-[10px] font-bold">
            ↗ تدفق تحصيل منتظم
          </span>
        </div>

        <div className="rounded-2xl p-4 bg-[#171923] border border-[#252836]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">عملاء مدينون</span>
            <div className="w-7 h-7 rounded-lg bg-[#24213B] text-[#A799FF] flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-white tabular-nums">
            {stats.debtorCount} <span className="text-xs font-normal text-slate-400">عميل نشط</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
            من أصل {customers.length} عميل مسجل
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-[#171923] border border-[#252836]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">أعلى مديونية</span>
            <div className="w-7 h-7 rounded-lg bg-[#2D1820] text-[#FCA5A5] flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-[#FCA5A5] tabular-nums">
            {formatNumber(stats.topDebtor?.balance_due || 0)}{' '}
            <span className="text-xs font-normal text-slate-400">{currency}</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            {stats.topDebtor ? stats.topDebtor.name : 'لا توجد ديون قائمة'}
          </p>
        </div>
      </section>

      {/* 2. Search + New Customer CTA */}
      <section className="flex items-center gap-2.5">
        <div className="flex-1 flex items-center bg-[#171923] border border-[#252836] rounded-2xl px-3.5 py-2.5 focus-within:border-[#A799FF]">
          <Search className="w-4 h-4 text-slate-400 ml-2.5 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم، السجل، أو رقم الجوال..."
            className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={onAddCustomer}
          className="flex items-center gap-1.5 px-5 py-3 rounded-2xl bg-gradient-to-l from-[#5EEAD4] to-[#A799FF] text-[#0D0E12] text-sm font-extrabold hover:opacity-95 whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-4 h-4 stroke-[2.5]" />
          <span>جديد</span>
        </button>
      </section>

      {/* 3. Filter Pills */}
      <section className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${
            filter === 'all'
              ? 'bg-[#D4C9FF] text-[#0D0E12] border-[#D4C9FF]'
              : 'bg-[#171923] text-slate-300 border-[#252836]'
          }`}
        >
          الكل ({customers.length})
        </button>

        <button
          type="button"
          onClick={() => setFilter('overdue')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${
            filter === 'overdue'
              ? 'bg-[#D4C9FF] text-[#0D0E12] border-[#D4C9FF]'
              : 'bg-[#171923] text-slate-300 border-[#252836]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-[#F87171]" />
          <span>ديون متأخرة ({stats.overdueCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('settled')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${
            filter === 'settled'
              ? 'bg-[#D4C9FF] text-[#0D0E12] border-[#D4C9FF]'
              : 'bg-[#171923] text-slate-300 border-[#252836]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-[#2EE59D]" />
          <span>مسدد بالكامل ({stats.settledCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('vip')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${
            filter === 'vip'
              ? 'bg-[#D4C9FF] text-[#0D0E12] border-[#D4C9FF]'
              : 'bg-[#171923] text-slate-300 border-[#252836]'
          }`}
        >
          <Star className="w-3.5 h-3.5 text-[#2EE59D]" />
          <span>عملاء VIP ({stats.vipCount})</span>
        </button>
      </section>

      {/* 4. Customers & Debts Ledger */}
      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <h3 className="font-bold text-slate-300">سجل العملاء والذمم</h3>
          <span className="text-slate-400">مرتب حسب أعلى مديونية</span>
        </div>

        {loading && customers.length === 0 ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-3xl bg-[#171923]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl p-8 bg-[#171923] border border-[#252836] text-center space-y-3">
            <p className="text-sm font-bold text-white">
              {customers.length === 0 ? 'لا يوجد عملاء مسجلون بعد' : 'لا يوجد عملاء مطابقون'}
            </p>
            <p className="text-xs text-slate-400">
              {customers.length === 0
                ? 'أضف عملاءك لإدارة الفواتير الآجلة والمدفوعات وكشوفات الحساب'
                : 'أضف عميلاً جديداً أو غيّر خيارات التصفية'}
            </p>
            {customers.length === 0 && (
              <button
                type="button"
                onClick={onAddCustomer}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-l from-[#5EEAD4] to-[#A799FF] text-[#0D0E12] text-xs font-extrabold"
              >
                <UserPlus className="w-4 h-4" />
                <span>إضافة عميل جديد</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filtered.map((c) => {
              const isOverdue = c.balance_due > 0 && c.overdue_days > 0;
              const isActiveDebt = c.balance_due > 0 && c.overdue_days <= 0;
              const paidPct =
                c.total_purchases > 0
                  ? Math.min(100, Math.round((c.total_paid / c.total_purchases) * 100))
                  : 100;

              return (
                <div
                  key={c.id}
                  className="rounded-3xl p-4 bg-[#171923] border border-[#252836] flex flex-col justify-between gap-3.5"
                >
                  {/* Top Info */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="relative w-12 h-12 rounded-2xl bg-[#11131B] border border-[#252836] flex items-center justify-center text-base font-extrabold text-[#2EE59D] shrink-0">
                        {c.name.charAt(0)}
                        {isOverdue && (
                          <span className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#171923]">
                            !
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4
                            onClick={() => onOpenStatement(c)}
                            className="text-sm sm:text-base font-extrabold text-white truncate cursor-pointer hover:text-[#A799FF]"
                          >
                            {c.name}
                          </h4>
                          {c.is_vip ? (
                            <span className="px-2 py-0.5 rounded-md bg-[#2A2640] text-[#A799FF] text-[10px] font-bold">
                              VIP
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {c.company_name || (c.customer_type === 'business' ? 'حساب شركات' : 'عميل فردي')}
                        </p>
                        {c.phone && (
                          <p className="text-[11px] text-slate-300 mt-1 flex items-center gap-1 tabular-nums">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span dir="ltr">{c.phone}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div className="shrink-0">
                      {isOverdue ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2D1820] text-[#FCA5A5] text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F87171]" />
                          دين متأخر ({c.overdue_days} يوم)
                        </span>
                      ) : isActiveDebt ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#15282B] text-[#2DD4BF] text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF]" />
                          دين نشط (غير متأخر)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#132A22] text-[#2EE59D] text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          مسدد بالكامل
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Inset 3-column metrics strip */}
                  <div className="rounded-2xl p-3 bg-[#11131B] border border-[#222533] space-y-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="block text-[10px] text-slate-400">إجمالي المشتريات</span>
                        <span className="text-xs sm:text-sm font-bold text-white tabular-nums">
                          {formatCurrency(c.total_purchases, c.currency || currency)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400">تم سداده</span>
                        <span className="text-xs sm:text-sm font-bold text-[#2EE59D] tabular-nums">
                          {formatCurrency(c.total_paid, c.currency || currency)}
                        </span>
                      </div>
                      <div className="text-left">
                        <span className="block text-[10px] text-slate-400">المبلغ المتبقي</span>
                        <span
                          className={`text-xs sm:text-sm font-extrabold tabular-nums ${
                            c.balance_due > 0 ? 'text-[#FCA5A5]' : 'text-[#2EE59D]'
                          }`}
                        >
                          {formatCurrency(c.balance_due, c.currency || currency, c.balance_due === 0 ? 2 : 0)}
                        </span>
                      </div>
                    </div>

                    {c.total_purchases > 0 && (
                      <div className="h-1.5 w-full rounded-full bg-[#242838] overflow-hidden flex">
                        <div className="h-full bg-[#2EE59D]" style={{ width: `${paidPct}%` }} />
                        {c.balance_due > 0 && (
                          <div className="h-full bg-[#FCA5A5]/70" style={{ width: `${100 - paidPct}%` }} />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 relative">
                    {c.balance_due > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onPayDebt(c)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#11131B] border border-[#252836] hover:border-[#2EE59D]/50 text-xs font-bold text-slate-100"
                        >
                          <Wallet className="w-3.5 h-3.5 text-[#2EE59D]" />
                          <span>{isOverdue ? 'تسجيل دفعة سداد' : 'تحصيل دفعة'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenStatement(c)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#11131B] border border-[#252836] hover:border-[#A799FF]/50 text-xs font-bold text-slate-100"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#A799FF]" />
                          <span>كشف الحساب</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onNewInvoiceForCustomer(c)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#11131B] border border-[#252836] hover:border-[#A799FF]/50 text-xs font-bold text-slate-100"
                      >
                        <ReceiptText className="w-3.5 h-3.5 text-[#A799FF]" />
                        <span>إنشاء فاتورة بيع جديدة</span>
                      </button>
                    )}

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                        className="p-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-slate-300 hover:text-white"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuId === c.id && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute left-0 bottom-12 z-30 w-44 rounded-2xl bg-[#1C1F2B] border border-[#2F3448] shadow-xl p-1.5 space-y-1">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onOpenStatement(c);
                              }}
                              className="w-full text-right px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-white/5 flex items-center gap-2"
                            >
                              <FileText className="w-3.5 h-3.5 text-[#A799FF]" />
                              <span>ملف العميل والمشتريات</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onEditCustomer(c);
                              }}
                              className="w-full text-right px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-white/5 flex items-center gap-2"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#2EE59D]" />
                              <span>تعديل البيانات</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onDeleteCustomer(c);
                              }}
                              className="w-full text-right px-3 py-2 rounded-xl text-xs font-semibold text-[#F87171] hover:bg-[#F87171]/10 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف العميل</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Recent Collections Log (سجل التحصيلات الأخيرة) */}
      <section className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#2EE59D]" />
            <h3 className="text-sm font-bold text-white">سجل التحصيلات الأخيرة</h3>
          </div>
          {payments.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAllPayments((v) => !v)}
              className="text-xs font-bold text-[#A799FF] hover:underline"
            >
              {showAllPayments ? 'عرض أقل' : 'عرض الكل'}
            </button>
          )}
        </div>

        <div className="space-y-2">
          {displayedPayments.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#171923] border border-[#252836] text-center text-xs text-slate-400">
              لا توجد تحصيلات مسجلة بعد
            </div>
          ) : (
            displayedPayments.map((pay) => {
              const Icon =
                pay.method === 'transfer' ? Building2 : pay.method === 'card' ? CreditCard : Banknote;
              const methodText =
                pay.method === 'transfer' ? 'تحويل بنكي' : pay.method === 'card' ? 'مدى (شبكة)' : 'نقدي في الصندوق';

              return (
                <div
                  key={pay.id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#171923] border border-[#252836]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#142922] text-[#2EE59D] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-white truncate">
                          {pay.customer_name || 'عميل نقدي عام'}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#11131B] text-[10px] font-mono text-slate-400">
                          #{pay.receipt_number}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {methodText} • {formatDateArabic(pay.created_at)} ({formatTimeArabic(pay.created_at)})
                      </p>
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    <span className="block text-sm font-extrabold text-[#2EE59D] tabular-nums">
                      +{formatCurrency(pay.amount, pay.currency || currency)}
                    </span>
                    <span className="inline-block px-2 py-0.5 rounded bg-[#142922] text-[#2EE59D] text-[10px] font-bold">
                      مكتمل
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

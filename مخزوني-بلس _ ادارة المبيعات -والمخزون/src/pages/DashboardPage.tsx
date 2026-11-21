import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  Clock,
  Package,
  PlusSquare,
  Receipt,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import type { DashboardData, Invoice, Product, TabKey } from '../types';
import { formatCurrency, formatDateArabic, formatNumber, formatRelativeArabic, formatTimeArabic } from '../utils/format';
import { ProductThumb } from '../components/ProductThumb';

interface DashboardPageProps {
  data: DashboardData | null;
  loading: boolean;
  period: 'daily' | 'weekly' | 'monthly';
  onChangePeriod: (p: 'daily' | 'weekly' | 'monthly') => void;
  onNavigateTab: (tab: TabKey) => void;
  onOpenNewInvoice: () => void;
  onOpenAddProduct: () => void;
  onOpenAddCustomer: () => void;
  onOpenRecordPayment: () => void;
  onOpenInvoicesArchive: () => void;
  onRestockProduct: (product: Product) => void;
  onPreviewInvoice: (invoiceId: number) => void;
  onOpenSettings: () => void;
}

export function DashboardPage({
  data,
  loading,
  period,
  onChangePeriod,
  onOpenNewInvoice,
  onOpenAddProduct,
  onOpenAddCustomer,
  onOpenRecordPayment,
  onOpenInvoicesArchive,
  onRestockProduct,
  onPreviewInvoice,
  onOpenSettings,
}: DashboardPageProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [showClosureDetail, setShowClosureDetail] = useState(false);

  if (loading && !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-36 rounded-3xl bg-[#171923]" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-[#171923]" />
          ))}
        </div>
        <div className="h-44 rounded-3xl bg-[#171923]" />
      </div>
    );
  }

  if (!data) return null;

  const { settings, kpis, chartSeries, peakDaySales, criticalStock, latestInvoices, dailyClosure } = data;
  const cur = settings.currency;

  const todayArabic = new Date().toLocaleDateString('ar-SA-u-nu-latn', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Build SVG smooth polyline coordinates
  const width = 340;
  const height = 115;
  const padX = 14;
  const padY = 16;
  const maxVal = Math.max(1000, ...chartSeries.map((c) => Math.max(c.current, c.previous)));
  const pts = chartSeries.map((pt, i) => {
    const x =
      chartSeries.length === 1
        ? width / 2
        : padX + (i * (width - padX * 2)) / (chartSeries.length - 1);
    const y = height - padY - (pt.current / maxVal) * (height - padY * 2);
    const prevY = height - padY - (pt.previous / maxVal) * (height - padY * 2);
    return { ...pt, x, y, prevY };
  });

  const buildSmoothPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const mainPath = buildSmoothPath(pts);
  const prevPath = buildSmoothPath(pts.map((p) => ({ x: p.x, y: p.prevY })));
  const areaPath = pts.length > 0 ? `${mainPath} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z` : '';

  const renderInvoiceStatusPill = (inv: Invoice) => {
    if (inv.status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#132A22] text-[#2EE59D] text-[11px] font-bold whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2EE59D]" />
          مدفوعة كلياً
        </span>
      );
    }
    if (inv.status === 'partial') {
      const pct = inv.total_amount > 0 ? Math.round((inv.paid_amount / inv.total_amount) * 100) : 0;
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#13292D] text-[#38BDF8] text-[11px] font-bold whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />
          دفعة جزئية ({pct}%)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2D1820] text-[#F87171] text-[11px] font-bold whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F87171]" />
        آجلة / غير مسددة
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* 1. Hero Welcome Card (Exact Stitch Match) */}
      <section className="rounded-3xl p-5 bg-gradient-to-br from-[#1C1A2E] via-[#171925] to-[#131520] border border-[#2A2842] shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#142822] border border-[#1E3B31] text-xs font-bold text-[#2EE59D]">
            <span className="w-2 h-2 rounded-full bg-[#2EE59D]" />
            {kpis.todaySales > 0 ? 'المتجر نشط اليوم' : 'جاهز لإضافة البيانات والمبيعات'}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1E2030] border border-[#2B2E42] text-xs text-slate-300 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{todayArabic}</span>
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-1.5">
          مرحباً بك، {settings.manager_name} 👋
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          {kpis.totalSales === 0 && kpis.totalProducts === 0 ? (
            'ابدأ بإضافة منتجاتك وعملائك أو إصدار أول فاتورة — كافة التغييرات تحفظ تلقائياً حتى بدون إنترنت.'
          ) : (
            <>
              مبيعات اليوم بلغت{' '}
              <span className="text-[#2EE59D] font-bold tabular-nums">{formatCurrency(kpis.todaySales, cur)}</span> بنسبة
              تحصيل إجمالية{' '}
              <span className="text-[#A799FF] font-bold tabular-nums">{kpis.collectionRate}%</span> وتدفق نقدي منتظم.
            </>
          )}
        </p>
      </section>

      {/* 2. Quick Actions (الإجراءات السريعة) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">الإجراءات السريعة</h3>
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-xs font-semibold text-slate-400 hover:text-[#A799FF] transition-colors"
          >
            تخصيص الوصول
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2.5 sm:gap-3.5">
          <button
            type="button"
            onClick={onOpenNewInvoice}
            className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-[#171923] border border-[#252836] hover:border-[#A799FF]/50 transition-all group"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#25213D] text-[#A799FF] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Receipt className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white text-center leading-tight">فاتورة جديدة</span>
            <span className="text-[10px] text-slate-400 mt-0.5">نقطة بيع</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddProduct}
            className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-[#171923] border border-[#252836] hover:border-[#38BDF8]/50 transition-all group"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#16292F] text-[#38BDF8] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <PlusSquare className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white text-center leading-tight">إضافة منتج</span>
            <span className="text-[10px] text-slate-400 mt-0.5">تحديث الجرد</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddCustomer}
            className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-[#171923] border border-[#252836] hover:border-[#2EE59D]/50 transition-all group"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#142922] text-[#2EE59D] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <UserPlus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white text-center leading-tight">عميل جديد</span>
            <span className="text-[10px] text-slate-400 mt-0.5">فتح حساب</span>
          </button>

          <button
            type="button"
            onClick={onOpenRecordPayment}
            className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-[#171923] border border-[#252836] hover:border-slate-500 transition-all group"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#202434] text-slate-200 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white text-center leading-tight">تسجيل سداد</span>
            <span className="text-[10px] text-slate-400 mt-0.5">قبض مالي</span>
          </button>
        </div>
      </section>

      {/* 3. Financial Performance KPIs (مؤشرات الأداء المالية) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">مؤشرات الأداء المالية</h3>
          <span className="text-xs text-slate-400">تحديث فوري • اليوم</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Primary Total Sales Card */}
          <div className="lg:col-span-6 rounded-3xl p-4 sm:p-5 bg-[#171923] border border-[#252836] flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                  <TrendingUp className="w-4 h-4 text-[#A799FF]" />
                  <span>إجمالي المبيعات المكتملة</span>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                  {formatNumber(kpis.totalSales)}{' '}
                  <span className="text-sm font-semibold text-slate-400">{cur}</span>
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#132A22] text-[#2EE59D] text-xs font-bold tabular-nums">
                {kpis.salesGrowthPct >= 0 ? `+${kpis.salesGrowthPct}%` : `${kpis.salesGrowthPct}%`} ↗
              </span>
            </div>

            <div className="mt-4 p-3 rounded-2xl bg-[#11131B] border border-[#222533]">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-[#A799FF]" />
                  المستهدف الشهري ({kpis.targetProgress}%)
                </span>
                <span className="font-bold text-white tabular-nums">
                  {formatCurrency(kpis.monthlyTarget, cur)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#242838] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-[#A799FF] to-[#7C6AF2] transition-all duration-500"
                  style={{ width: `${kpis.targetProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Secondary 2x2 KPI Grid */}
          <div className="lg:col-span-6 grid grid-cols-2 gap-3">
            {/* Collected */}
            <div className="rounded-2xl p-4 bg-[#171923] border border-[#252836] flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-[#142922] text-[#2EE59D] flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#142922] text-[#2EE59D] text-[10px] font-bold tabular-nums">
                  {kpis.collectionRate}% محصل
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">المبالغ المحصلة</p>
                <p className="text-lg sm:text-xl font-extrabold text-white tabular-nums">
                  {formatNumber(kpis.totalCollected)}{' '}
                  <span className="text-xs font-normal text-slate-400">{cur}</span>
                </p>
                <div className="h-1 w-full rounded-full bg-[#242838] mt-2.5 overflow-hidden">
                  <div className="h-full bg-[#2EE59D]" style={{ width: `${kpis.collectionRate}%` }} />
                </div>
              </div>
            </div>

            {/* Debts */}
            <div className="rounded-2xl p-4 bg-[#171923] border border-[#252836] flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-[#18292F] text-[#38BDF8] flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#222638] text-slate-300 text-[10px] font-bold tabular-nums">
                  {kpis.debtorCount} عميل مدين
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">الديون المستحقة</p>
                <p className="text-lg sm:text-xl font-extrabold text-white tabular-nums">
                  {formatNumber(kpis.totalDebts)}{' '}
                  <span className="text-xs font-normal text-slate-400">{cur}</span>
                </p>
                <div className="h-1 w-full rounded-full bg-[#242838] mt-2.5 overflow-hidden">
                  <div
                    className="h-full bg-[#2EE59D]"
                    style={{ width: `${Math.max(12, 100 - kpis.collectionRate)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Inventory Products */}
            <div className="rounded-2xl p-4 bg-[#171923] border border-[#252836] flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-[#16292B] text-[#2DD4BF] flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#132A22] text-[#2EE59D] text-[10px] font-bold">
                  {kpis.lowStockCount + kpis.outOfStockCount > 3 ? 'يحتاج متابعة' : 'مستقر'}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">المنتجات بالمخزن</p>
                <p className="text-lg sm:text-xl font-extrabold text-white tabular-nums">
                  {kpis.totalProducts}{' '}
                  <span className="text-xs font-normal text-slate-400">صنف مسجل</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  منها {kpis.lowStockCount + kpis.outOfStockCount} أصناف بحاجة للطلب
                </p>
              </div>
            </div>

            {/* Active Customers */}
            <div className="rounded-2xl p-4 bg-[#171923] border border-[#252836] flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-[#24213B] text-[#A799FF] flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#222638] text-slate-300 text-[10px] font-bold">
                  نشط الآن
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">العملاء النشطون</p>
                <p className="text-lg sm:text-xl font-extrabold text-white tabular-nums">
                  {kpis.activeCustomers}{' '}
                  <span className="text-xs font-normal text-slate-400">عميل</span>
                </p>
                <p className="text-[11px] text-[#2EE59D] font-semibold mt-1 tabular-nums">
                  معدل التفاعل {kpis.retentionRate}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Weekly Sales Chart + Critical Stock Alerts (2-col on Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Weekly Sales Chart Card */}
        <section className="lg:col-span-7 rounded-3xl p-5 bg-[#171923] border border-[#252836] flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">حركة المبيعات الأسبوعية</h3>
              <p className="text-xs text-slate-400 mt-0.5">مقارنة بالفترة السابقة</p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#11131B] border border-[#222533]">
              {(
                [
                  { id: 'daily', label: 'يومي' },
                  { id: 'weekly', label: 'أسبوعي' },
                  { id: 'monthly', label: 'شهري' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChangePeriod(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    period === tab.id
                      ? 'bg-[#A799FF] text-[#0D0E12]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 overflow-visible">
              <defs>
                <linearGradient id="dashAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8C7AE6" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#8C7AE6" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((r, idx) => (
                <line
                  key={idx}
                  x1={padX}
                  x2={width - padX}
                  y1={height * r}
                  y2={height * r}
                  stroke="#252836"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
              ))}
              {prevPath && (
                <path d={prevPath} fill="none" stroke="#363B52" strokeWidth="1.75" strokeDasharray="4 4" />
              )}
              {areaPath && <path d={areaPath} fill="url(#dashAreaGrad)" />}
              {mainPath && <path d={mainPath} fill="none" stroke="#A799FF" strokeWidth="2.75" strokeLinecap="round" />}
              {pts.map((pt, i) => {
                const isLast = i === pts.length - 1;
                const isHover = hoveredIdx === i;
                return (
                  <g
                    key={i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <circle cx={pt.x} cy={pt.y} r="10" fill="transparent" />
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHover || isLast ? 4.5 : 3}
                      fill={isLast ? '#2EE59D' : '#A799FF'}
                      stroke="#171923"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
            </svg>

            {hoveredIdx !== null && pts[hoveredIdx] && (
              <div className="absolute top-1 left-2 px-3 py-1.5 rounded-xl bg-[#11131B] border border-[#2F3447] text-xs shadow-lg">
                <span className="text-slate-400">{pts[hoveredIdx].label}: </span>
                <span className="font-bold text-[#2EE59D] tabular-nums">
                  {formatCurrency(pts[hoveredIdx].current, cur)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between px-1 mt-1 text-[10px] sm:text-[11px] text-slate-400">
              {pts.map((pt, i) => (
                <span
                  key={i}
                  className={i === pts.length - 1 ? 'text-[#2EE59D] font-bold' : ''}
                >
                  {pt.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#11131B] border border-[#222533]">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Zap className="w-4 h-4 text-[#2EE59D]" />
              <span>أعلى مبيعات سُجلت ({peakDaySales.label}):</span>
            </div>
            <span className="text-xs sm:text-sm font-extrabold text-[#2EE59D] tabular-nums">
              {formatCurrency(peakDaySales.amount, cur)}
            </span>
          </div>
        </section>

        {/* Critical Stock Alerts */}
        <section className="lg:col-span-5 rounded-3xl p-5 bg-[#171923] border border-[#252836] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F87171]" />
              <h3 className="text-sm font-bold text-white">تنبيهات المخزون الحرج</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#2D1820] text-[#F87171] text-[11px] font-bold tabular-nums">
              {criticalStock.length} بحاجة للمتابعة
            </span>
          </div>

          <div className="space-y-2.5 flex-1">
            {criticalStock.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                جميع الأصناف فوق حد التنبيه الآمن
              </div>
            ) : (
              criticalStock.slice(0, 4).map((prod) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#11131B] border border-[#222533]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ProductThumb src={prod.image_url} alt={prod.name} sizeClass="w-11 h-11 rounded-xl" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{prod.name}</p>
                      <p className="text-[11px] text-[#F87171] mt-0.5 tabular-nums">
                        ● {prod.stock_qty === 0 ? 'نفدت الكمية' : `متبقي ${prod.stock_qty} ${prod.unit_label} فقط`} • حد الطلب: {prod.min_stock_threshold}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRestockProduct(prod)}
                    className="px-3 py-1.5 rounded-xl bg-[#A799FF]/20 hover:bg-[#A799FF] text-[#A799FF] hover:text-[#0D0E12] text-xs font-bold whitespace-nowrap transition-colors shrink-0"
                  >
                    طلب توريد
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* 5. Latest Registered Invoices (أحدث الفواتير المسجلة) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#A799FF]" />
            <h3 className="text-sm font-bold text-white">أحدث الفواتير المسجلة</h3>
          </div>
          <button
            type="button"
            onClick={onOpenInvoicesArchive}
            className="flex items-center gap-1 text-xs font-bold text-[#A799FF] hover:underline"
          >
            <span>عرض السجل الكامل</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {latestInvoices.length === 0 ? (
            <div className="col-span-full p-6 rounded-2xl bg-[#171923] border border-[#252836] text-center text-xs text-slate-400">
              لا توجد فواتير مسجلة حتى الآن
            </div>
          ) : (
            latestInvoices.map((inv) => (
              <div
                key={inv.id}
                onClick={() => onPreviewInvoice(inv.id)}
                className="p-4 rounded-2xl bg-[#171923] border border-[#252836] hover:border-[#A799FF]/40 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-extrabold text-[#A799FF] font-mono shrink-0">
                      #{inv.invoice_number}
                    </span>
                    <span className="text-xs text-slate-300 truncate">• {inv.customer_name_snapshot}</span>
                  </div>
                  {renderInvoiceStatusPill(inv)}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {formatRelativeArabic(inv.created_at)} ({formatTimeArabic(inv.created_at)})
                    </span>
                  </span>
                  <span className="text-sm font-extrabold text-white tabular-nums">
                    {formatCurrency(inv.total_amount, inv.currency || cur)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 6. Daily Financial Closure Card (إغلاق الصندوق المالي اليومي) */}
      <section
        onClick={() => setShowClosureDetail((v) => !v)}
        className="rounded-2xl p-4 bg-[#171923] border border-[#252836] hover:border-[#A799FF]/40 cursor-pointer transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#24213B] text-[#A799FF] flex items-center justify-center shrink-0">
              <BadgeCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">إغلاق الصندوق المالي اليومي</h4>
              <p className="text-xs text-slate-400">
                جميع السجلات متطابقة ومطابقة للجرد الآلي ({dailyClosure.todayInvoicesCount} فواتير اليوم)
              </p>
            </div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-[#2EE59D] shrink-0" />
        </div>

        {showClosureDetail && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-[#252836]">
            <div className="p-2.5 rounded-xl bg-[#11131B]">
              <span className="block text-[10px] text-slate-400">مبيعات اليوم</span>
              <span className="text-xs font-bold text-white tabular-nums">
                {formatCurrency(dailyClosure.todayTotalRevenue, cur)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#11131B]">
              <span className="block text-[10px] text-slate-400">التحصيل النقدي</span>
              <span className="text-xs font-bold text-[#2EE59D] tabular-nums">
                {formatCurrency(dailyClosure.todayCashTotal, cur)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#11131B]">
              <span className="block text-[10px] text-slate-400">مدى / الشبكة</span>
              <span className="text-xs font-bold text-[#38BDF8] tabular-nums">
                {formatCurrency(dailyClosure.todayCardTotal, cur)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#11131B]">
              <span className="block text-[10px] text-slate-400">التحويلات البنكية</span>
              <span className="text-xs font-bold text-[#A799FF] tabular-nums">
                {formatCurrency(dailyClosure.todayTransferTotal, cur)}
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

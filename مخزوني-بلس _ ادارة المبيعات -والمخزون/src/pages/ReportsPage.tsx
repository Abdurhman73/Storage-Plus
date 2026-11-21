import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Layers,
  Percent,
  Printer,
  Receipt,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { ReportsData } from '../types';
import { exportToCsv, formatCurrency, formatNumber } from '../utils/format';
import { ProductThumb } from '../components/ProductThumb';

interface ReportsPageProps {
  data: ReportsData | null;
  loading: boolean;
  range: string;
  customFrom: string;
  customTo: string;
  onChangeRange: (r: string) => void;
  onChangeCustomDates: (from: string, to: string) => void;
  onOpenStockMovements: () => void;
  onToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export function ReportsPage({
  data,
  loading,
  range,
  customFrom,
  customTo,
  onChangeRange,
  onChangeCustomDates,
  onOpenStockMovements,
  onToast,
}: ReportsPageProps) {
  if (loading && !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-44 rounded-3xl bg-[#171923]" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 rounded-2xl bg-[#171923]" />
          <div className="h-28 rounded-2xl bg-[#171923]" />
        </div>
        <div className="h-52 rounded-3xl bg-[#171923]" />
      </div>
    );
  }

  if (!data) return null;

  const { settings, kpis, trajectory, categories, topProducts, inventoryStats, receivablesSummary } = data;
  const cur = settings.currency;

  const handleExportExcel = () => {
    const rows: (string | number)[][] = [
      ['صافي الأرباح المحققة', kpis.netProfit, cur],
      ['إيرادات المبيعات', kpis.salesRevenue, cur],
      ['تكلفة البضاعة (COGS)', kpis.cogs, cur],
      ['نسبة هامش الربح', `${kpis.profitMarginPct}%`, ''],
      ['متوسط الفاتورة', kpis.avgInvoice, cur],
      ['قيمة المخزون الحالي', inventoryStats.totalValue, cur],
      ['إجمالي الديون المستحقة', receivablesSummary.pendingDebt, cur],
      ['---', '---', '---'],
      ['أعلى المنتجات مبيعاً', 'الكمية المباعة', 'الإيراد'],
      ...topProducts.map((p) => [p.name, p.units_sold, p.revenue]),
    ];
    exportToCsv(`financial-report-${range}-${Date.now()}.csv`, ['البند', 'القيمة', 'الوحدة / ملاحظة'], rows);
    onToast('success', 'تم تصدير التقرير المالي بصيغة Excel (CSV) بنجاح');
  };

  // Dual line chart SVG coordinates
  const width = 340;
  const height = 130;
  const padX = 16;
  const padY = 18;
  const maxVal = Math.max(1000, ...trajectory.map((t) => Math.max(t.sales, t.profit)));
  const pts = trajectory.map((t, i) => {
    const x =
      trajectory.length === 1
        ? width / 2
        : padX + (i * (width - padX * 2)) / (trajectory.length - 1);
    const salesY = height - padY - (t.sales / maxVal) * (height - padY * 2);
    const profitY = height - padY - (t.profit / maxVal) * (height - padY * 2);
    return { ...t, x, salesY, profitY };
  });

  const buildCurve = (coords: { x: number; y: number }[]) => {
    if (coords.length === 0) return '';
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i];
      const p1 = coords[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const salesPath = buildCurve(pts.map((p) => ({ x: p.x, y: p.salesY })));
  const profitPath = buildCurve(pts.map((p) => ({ x: p.x, y: p.profitY })));

  const catColors = ['#A799FF', '#38BDF8', '#2EE59D', '#F59E0B'];

  return (
    <div className="space-y-4">
      {/* 1. Live Status + Export + Period Filter Bar */}
      <div className="flex items-center justify-between gap-2 no-print">
        <span className="inline-flex items-center gap-2 text-xs font-bold text-[#2EE59D]">
          <span className="w-2 h-2 rounded-full bg-[#2EE59D]" />
          محدّث مباشرة الآن
        </span>

        <button
          type="button"
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#171923] border border-[#252836] text-xs font-bold text-slate-200 hover:border-[#A799FF]"
        >
          <Download className="w-3.5 h-3.5 text-[#A799FF]" />
          <span>تصدير التقرير</span>
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar no-print">
        {[
          { id: 'today', label: 'اليوم' },
          { id: 'week', label: 'هذا الأسبوع' },
          { id: 'month', label: 'هذا الشهر' },
          { id: 'quarter', label: 'هذا الربع' },
          { id: 'custom', label: 'مخصص' },
        ].map((p) => {
          const active = range === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChangeRange(p.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${
                active
                  ? 'bg-[#A799FF] text-[#0D0E12] border-[#A799FF]'
                  : 'bg-[#171923] text-slate-300 border-[#252836] hover:border-slate-500'
              }`}
            >
              {p.id === 'custom' && <Calendar className="w-3.5 h-3.5" />}
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {range === 'custom' && (
        <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-[#171923] border border-[#252836] no-print">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">من تاريخ</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => onChangeCustomDates(e.target.value, customTo)}
              className="w-full px-3 py-2 rounded-xl bg-[#11131B] border border-[#252836] text-xs text-white focus:outline-none focus:border-[#A799FF]"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => onChangeCustomDates(customFrom, e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#11131B] border border-[#252836] text-xs text-white focus:outline-none focus:border-[#A799FF]"
            />
          </div>
        </div>
      )}

      {/* 2. Hero Net Profit Card */}
      <section className="rounded-3xl p-5 bg-gradient-to-br from-[#1C1A2E] via-[#171925] to-[#131520] border border-[#2A2842] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <div className="w-8 h-8 rounded-xl bg-[#142922] text-[#2EE59D] flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <span>صافي الأرباح المحققة</span>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#132A22] text-[#2EE59D] text-xs font-bold tabular-nums">
            +{kpis.profitChangePct}% ↗
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="text-3xl font-extrabold text-white tabular-nums">
            {formatNumber(kpis.netProfit)} <span className="text-sm font-normal text-slate-400">{cur}</span>
          </span>
          <span className="text-xs text-[#2EE59D] font-semibold">
            هامش ربح فعلي {kpis.profitMarginPct}% عن الفترة المحددة
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              المستهدف الفصلي ({formatCurrency(kpis.quarterlyTarget, cur)})
            </span>
            <span className="font-bold text-[#2EE59D] tabular-nums">{kpis.targetProgressPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#242838] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-l from-[#2EE59D] to-[#10B981]"
              style={{ width: `${Math.min(100, kpis.targetProgressPct)}%` }}
            />
          </div>
        </div>
      </section>

      {/* 3. 2x2 Revenue / COGS / Avg Invoice / Margin Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4 bg-[#171923] border border-[#252836]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">إيرادات المبيعات</span>
            <Wallet className="w-4 h-4 text-[#2EE59D]" />
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-white tabular-nums">
            {formatNumber(kpis.salesRevenue)}{' '}
            <span className="text-[11px] font-normal text-slate-400">{cur}</span>
          </p>
          <p className="text-[11px] text-[#2EE59D] mt-1 font-semibold">↗ إجمالي التدفق البيعي</p>
        </div>

        <div className="rounded-2xl p-4 bg-[#171923] border border-[#252836]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">تكلفة البضاعة (COGS)</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-white tabular-nums">
            {formatNumber(kpis.cogs)}{' '}
            <span className="text-[11px] font-normal text-slate-400">{cur}</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1 tabular-nums">{kpis.cogsRatioPct}% من الإيراد</p>
        </div>

        <div className="rounded-2xl p-4 bg-[#171923] border border-[#252836]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">متوسط الفاتورة</span>
            <Receipt className="w-4 h-4 text-[#A799FF]" />
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-white tabular-nums">
            {formatNumber(kpis.avgInvoice)}{' '}
            <span className="text-[11px] font-normal text-slate-400">{cur}</span>
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-[#171923] border border-[#252836]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">نسبة هامش الربح</span>
            <Percent className="w-4 h-4 text-[#2EE59D]" />
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-[#2EE59D] tabular-nums">
            {kpis.profitMarginPct}%
          </p>
        </div>
      </section>

      {/* 4. Revenue vs Profit Trajectory + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-7 rounded-3xl p-5 bg-[#171923] border border-[#252836] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">مسار الإيرادات والأرباح</h3>
              <p className="text-xs text-slate-400">مقارنة أداء الفترات المتتالية</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
                مبيعات
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-[#2EE59D]" />
                أرباح
              </span>
            </div>
          </div>

          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 overflow-visible">
            {[0.25, 0.5, 0.75].map((r, i) => (
              <line
                key={i}
                x1={padX}
                x2={width - padX}
                y1={height * r}
                y2={height * r}
                stroke="#252836"
                strokeDasharray="3 3"
              />
            ))}
            {salesPath && <path d={salesPath} fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />}
            {profitPath && <path d={profitPath} fill="none" stroke="#2EE59D" strokeWidth="2.5" strokeLinecap="round" />}
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.salesY} r="3.5" fill="#38BDF8" stroke="#171923" strokeWidth="1.5" />
                <circle cx={p.x} cy={p.profitY} r="3.5" fill="#2EE59D" stroke="#171923" strokeWidth="1.5" />
              </g>
            ))}
          </svg>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            {pts.map((p, i) => (
              <span key={i}>{p.label}</span>
            ))}
          </div>
        </section>

        {/* Sales by Category */}
        <section className="lg:col-span-5 rounded-3xl p-5 bg-[#171923] border border-[#252836] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#A799FF]" />
              <h3 className="text-sm font-bold text-white">توزيع المبيعات بالتصنيف</h3>
            </div>
            <span className="text-xs font-bold text-[#2EE59D]">{categories.length} تصنيفات نشطة</span>
          </div>

          <div className="h-2.5 w-full rounded-full bg-[#11131B] overflow-hidden flex gap-0.5">
            {categories.length === 0 ? (
              <div className="h-full w-full bg-[#242838]" />
            ) : (
              categories.map((cat, idx) => (
                <div
                  key={cat.category}
                  className="h-full transition-all"
                  style={{
                    width: `${Math.max(8, cat.percentage)}%`,
                    backgroundColor: catColors[idx % catColors.length],
                  }}
                />
              ))
            )}
          </div>

          {categories.length === 0 ? (
            <p className="text-center py-4 text-xs text-slate-400">لا توجد مبيعات مصنفة في هذه الفترة</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {categories.slice(0, 3).map((cat, idx) => (
                <div key={cat.category} className="p-3 rounded-2xl bg-[#11131B] border border-[#222533]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: catColors[idx % catColors.length] }}
                    />
                    <span className="text-[11px] text-slate-300 truncate">{cat.category}</span>
                  </div>
                  <p className="text-base font-extrabold text-white tabular-nums">{cat.percentage}%</p>
                  <p className="text-[10px] text-slate-400 tabular-nums mt-0.5">
                    {formatCurrency(cat.amount, cur)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 5. Top Selling & Most Profitable Products */}
      <section className="rounded-3xl p-5 bg-[#171923] border border-[#252836] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">المنتجات الأكثر مبيعاً والأعلى ربحاً</h3>
          <span className="text-xs font-bold text-[#A799FF]">أعلى {topProducts.length} سلع</span>
        </div>

        {topProducts.length === 0 ? (
          <p className="text-center py-6 text-xs text-slate-400">لا توجد مبيعات في هذه الفترة</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {topProducts.map((prod) => (
              <div
                key={prod.name}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#11131B] border border-[#222533]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ProductThumb src={prod.image_url} alt={prod.name} sizeClass="w-11 h-11 rounded-xl" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{prod.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                      مباع: {prod.units_sold} قطعة •{' '}
                      <span className="text-[#2EE59D] font-semibold">ربح: {prod.margin_pct}%</span>
                    </p>
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <span className="block text-sm font-extrabold text-white tabular-nums">
                    {formatCurrency(prod.revenue, cur)}
                  </span>
                  <span className="text-[10px] text-[#2EE59D] font-bold tabular-nums">
                    {prod.income_share_pct}% من الدخل
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 6. Inventory Movement + Receivables Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inventory Turnover */}
        <section className="rounded-3xl p-5 bg-[#171923] border border-[#252836] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#A799FF]" />
              <h3 className="text-sm font-bold text-white">حركة المخزون ومعدل الدوران</h3>
            </div>
            <span className="text-xs font-bold text-[#2EE59D] tabular-nums">
              معدل دوران: {inventoryStats.turnoverRate}x
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#11131B] border border-[#222533] flex items-center justify-between gap-2">
            <div>
              <span className="block text-[11px] text-slate-400">القيمة الإجمالية للمخزون الحالي</span>
              <span className="text-lg font-extrabold text-white tabular-nums">
                {formatCurrency(inventoryStats.totalValue, cur)}
              </span>
            </div>
            <div className="text-left">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2EE59D]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {inventoryStats.status}
              </span>
              <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                {formatNumber(inventoryStats.totalUnits)} وحدة إجمالية
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-[#11131B] border border-[#222533] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#142922] text-[#2EE59D] flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400">الوارد للمستودع</span>
                <span className="text-sm font-extrabold text-white tabular-nums">
                  {formatNumber(inventoryStats.inboundUnits)} قطعة
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-[#11131B] border border-[#222533] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#18292F] text-[#38BDF8] flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400">الصادر (مبيعات)</span>
                <span className="text-sm font-extrabold text-white tabular-nums">
                  {formatNumber(inventoryStats.outboundUnits)} قطعة
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenStockMovements}
            className="w-full py-2.5 rounded-xl bg-[#11131B] border border-[#252836] hover:border-[#A799FF]/50 text-xs font-bold text-slate-200 flex items-center justify-center gap-2 no-print"
          >
            <History className="w-3.5 h-3.5 text-[#A799FF]" />
            <span>استعراض سجل حركات المخزون التفصيلي</span>
          </button>
        </section>

        {/* Receivables & Cash Summary */}
        <section className="rounded-3xl p-5 bg-[#171923] border border-[#252836] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">ملخص الذمم والتحصيلات النقدية</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-[#132A22] text-[#2EE59D] text-xs font-bold tabular-nums">
              السيولة: {receivablesSummary.liquidityPct}%
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">نسبة المبالغ المحصلة مقابل الذمم القائمة</span>
              <span className="font-bold text-[#2EE59D] tabular-nums">
                {formatNumber(receivablesSummary.collectedAmount)} / {formatNumber(receivablesSummary.totalBilled)} {cur}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-[#242838] overflow-hidden flex">
              <div
                className="h-full bg-[#FCA5A5]"
                style={{ width: `${Math.max(0, 100 - receivablesSummary.liquidityPct)}%` }}
              />
              <div
                className="h-full bg-[#2EE59D]"
                style={{ width: `${receivablesSummary.liquidityPct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-[#11131B] border border-[#222533]">
              <span className="flex items-center gap-1.5 text-[11px] text-[#2EE59D] font-bold">
                <span className="w-2 h-2 rounded-full bg-[#2EE59D]" />
                المبالغ المحصلة
              </span>
              <p className="text-base font-extrabold text-white mt-1 tabular-nums">
                {formatCurrency(receivablesSummary.collectedAmount, cur)}
              </p>
              <p className="text-[10px] text-[#2EE59D] mt-0.5">نقداً ومدى وسداد</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#11131B] border border-[#222533]">
              <span className="flex items-center gap-1.5 text-[11px] text-[#FCA5A5] font-bold">
                <span className="w-2 h-2 rounded-full bg-[#FCA5A5]" />
                الديون والذمم الآجلة
              </span>
              <p className="text-base font-extrabold text-[#FCA5A5] mt-1 tabular-nums">
                {formatCurrency(receivablesSummary.pendingDebt, cur)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                مستحقة لـ {receivablesSummary.debtorCount} عميل
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* 7. Official Reports Export */}
      <section className="rounded-3xl p-5 bg-[#171923] border border-[#252836] space-y-3 no-print">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#24213B] text-[#A799FF] flex items-center justify-center">
            <Printer className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">استخراج التقارير الرسمية</h3>
            <p className="text-[11px] text-slate-400">
              تقارير مالية ومحاسبية معتمدة للمراجعة والأرشفة
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-2xl bg-[#11131B] border border-[#252836] hover:border-[#2EE59D]/50 text-xs font-bold text-white"
          >
            <FileSpreadsheet className="w-5 h-5 text-[#2EE59D]" />
            <span>ملف Excel</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-2xl bg-[#11131B] border border-[#252836] hover:border-[#F87171]/50 text-xs font-bold text-white"
          >
            <FileText className="w-5 h-5 text-[#F87171]" />
            <span>تقرير PDF</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-2xl bg-[#A799FF] text-[#0D0E12] text-xs font-extrabold hover:opacity-95"
          >
            <Receipt className="w-5 h-5" />
            <span>طباعة التقرير</span>
          </button>
        </div>
      </section>
    </div>
  );
}

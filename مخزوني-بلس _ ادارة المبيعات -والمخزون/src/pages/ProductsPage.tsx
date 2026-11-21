import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Flame,
  History,
  MoreVertical,
  PackagePlus,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import type { Product } from '../types';
import { formatCurrency, formatNumber } from '../utils/format';
import { ProductThumb } from '../components/ProductThumb';

interface ProductsPageProps {
  products: Product[];
  loading: boolean;
  currency: string;
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onRestockProduct: (product: Product, defaultQty?: number) => void;
  onOpenStockMovements: () => void;
}

type SortKey = 'newest' | 'low_stock' | 'high_price' | 'high_margin';

export function ProductsPage({
  products,
  loading,
  currency,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onRestockProduct,
  onOpenStockMovements,
}: ProductsPageProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [visibleCount, setVisibleCount] = useState(12);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [barcodeModalProd, setBarcodeModalProd] = useState<Product | null>(null);

  const stats = useMemo(() => {
    const total = products.length;
    const available = products.filter((p) => p.stock_qty > 0).length;
    const lowStock = products.filter((p) => p.stock_qty > 0 && p.stock_qty <= p.min_stock_threshold).length;
    const outOfStock = products.filter((p) => p.stock_qty <= 0).length;
    return { total, available, lowStock, outOfStock };
  }, [products]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    return ['الكل', ...unique, 'الأكثر مبيعاً'];
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (selectedCategory === 'الكل') return true;
      if (selectedCategory === 'الأكثر مبيعاً') return (p.total_sold || 0) > 0;
      return p.category === selectedCategory;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'low_stock') return a.stock_qty - b.stock_qty;
      if (sortBy === 'high_price') return b.sell_price - a.sell_price;
      if (sortBy === 'high_margin') {
        const ma = a.sell_price > 0 ? (a.sell_price - a.cost_price) / a.sell_price : 0;
        const mb = b.sell_price > 0 ? (b.sell_price - b.cost_price) / b.sell_price : 0;
        return mb - ma;
      }
      return b.id - a.id;
    });

    return list;
  }, [products, search, selectedCategory, sortBy]);

  const displayed = filtered.slice(0, visibleCount);

  const cycleSort = () => {
    const order: SortKey[] = ['newest', 'low_stock', 'high_price', 'high_margin'];
    const next = order[(order.indexOf(sortBy) + 1) % order.length];
    setSortBy(next);
  };

  const sortLabel =
    sortBy === 'newest'
      ? 'الأحدث إضافة'
      : sortBy === 'low_stock'
      ? 'الأقل مخزوناً'
      : sortBy === 'high_price'
      ? 'الأعلى سعراً'
      : 'الأعلى ربحاً';

  return (
    <div className="space-y-4">
      <div className={barcodeModalProd ? 'space-y-4 print:hidden' : 'space-y-4'}>
      {/* 1. Top 2x2 KPI Cards (4-col on Desktop) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4 bg-[#171923] border border-[#252836]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">إجمالي المنتجات</span>
            <ClipboardList className="w-4 h-4 text-[#A799FF]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white tabular-nums">{stats.total}</span>
            <span className="text-xs font-bold text-[#2EE59D]">صنف مسجل</span>
          </div>
        </div>

        <div className="rounded-2xl p-4 bg-[#171923] border border-[#252836]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">منتجات متوفرة</span>
            <CheckCircle2 className="w-4 h-4 text-[#2EE59D]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#2EE59D] tabular-nums">{stats.available}</span>
            <span className="text-xs text-slate-400">صنف جاهز</span>
          </div>
        </div>

        <div className="rounded-2xl p-4 bg-[#171923] border border-[#252836]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">مخزون منخفض</span>
            <AlertTriangle className="w-4 h-4 text-[#2DD4BF]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#2DD4BF] tabular-nums">{stats.lowStock}</span>
            <span className="text-xs text-slate-400">يتطلب إعادة طلب</span>
          </div>
        </div>

        <div className="rounded-2xl p-4 bg-[#171923] border border-[#252836]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">نفدت الكمية</span>
            <ShoppingCart className="w-4 h-4 text-[#F87171]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#F87171] tabular-nums">{stats.outOfStock}</span>
            <span className="text-xs text-slate-400">غير معروضة للبيع</span>
          </div>
        </div>
      </section>

      {/* 2. Search + Add Product CTA */}
      <section className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1 flex items-center bg-[#171923] border border-[#252836] rounded-2xl px-3.5 py-2.5 focus-within:border-[#A799FF]">
          <Search className="w-4 h-4 text-slate-400 ml-2.5 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم، الفئة أو الباركود..."
            className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <QrCode className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenStockMovements}
            className="px-3.5 py-3 rounded-2xl bg-[#171923] border border-[#252836] text-xs font-bold text-slate-300 hover:text-white hover:border-[#A799FF]/40 flex items-center gap-1.5 whitespace-nowrap"
          >
            <History className="w-4 h-4 text-[#2EE59D]" />
            <span>حركة المخزون</span>
          </button>

          <button
            type="button"
            onClick={onAddProduct}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#A799FF] hover:bg-[#9585F8] text-[#0D0E12] text-sm font-extrabold transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>إضافة منتج</span>
          </button>
        </div>
      </section>

      {/* 3. Category Filter Pills */}
      <section className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          const count =
            cat === 'الكل'
              ? products.length
              : cat === 'الأكثر مبيعاً'
              ? products.filter((p) => (p.total_sold || 0) > 0).length
              : products.filter((p) => p.category === cat).length;

          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                isActive
                  ? 'bg-[#A799FF] text-[#0D0E12] border-[#A799FF]'
                  : 'bg-[#171923] text-slate-300 border-[#252836] hover:border-slate-500'
              }`}
            >
              {cat === 'الأكثر مبيعاً' && <Flame className="w-3.5 h-3.5 text-[#2EE59D]" />}
              <span>{cat}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] tabular-nums ${
                  isActive ? 'bg-[#0D0E12]/15 text-[#0D0E12]' : 'bg-[#11131B] text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </section>

      {/* 4. Count & Sort Row */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          عرض <strong className="text-white tabular-nums">{displayed.length}</strong> من أصل{' '}
          <strong className="text-white tabular-nums">{filtered.length}</strong> عنصر
        </span>
        <button
          type="button"
          onClick={cycleSort}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#171923] border border-[#252836] text-slate-200 hover:border-[#A799FF]/40 font-semibold"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-[#A799FF]" />
          <span>{sortLabel}</span>
        </button>
      </div>

      {/* 5. Products Cards Grid */}
      {loading && products.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-56 rounded-3xl bg-[#171923]" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="rounded-3xl p-10 bg-[#171923] border border-[#252836] text-center space-y-3">
          <p className="text-sm font-bold text-white">
            {products.length === 0 ? 'المخزون فارغ حالياً' : 'لا توجد منتجات مطابقة للبحث'}
          </p>
          <p className="text-xs text-slate-400">
            {products.length === 0
              ? 'ابدأ بإضافة منتجاتك وتحديد أسعارها وعملتها (ر.س أو ر.ي) لتتاح فوراً في الفواتير'
              : 'جرب تغيير كلمات البحث أو أضف منتجاً جديداً للمخزون'}
          </p>
          <button
            type="button"
            onClick={onAddProduct}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#A799FF] text-[#0D0E12] text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة منتج جديد</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {displayed.map((p) => {
            const isOut = p.stock_qty <= 0;
            const isLow = p.stock_qty > 0 && p.stock_qty <= p.min_stock_threshold;
            const isTop = !isOut && !isLow && (p.total_sold || 0) >= 5;
            const marginPct = p.sell_price > 0 ? (((p.sell_price - p.cost_price) / p.sell_price) * 100).toFixed(1) : '0.0';
            const barPct = isOut ? 0 : Math.min(100, Math.max(12, Math.round((p.stock_qty / Math.max(1, p.min_stock_threshold * 3)) * 100)));

            return (
              <div
                key={p.id}
                className="rounded-3xl p-4 bg-[#171923] border border-[#252836] flex flex-col justify-between gap-3.5 relative"
              >
                {/* Top Header */}
                <div className="flex items-start gap-3">
                  <ProductThumb
                    src={p.image_url}
                    alt={p.name}
                    sizeClass="w-16 h-16 rounded-2xl"
                    dimmed={isOut}
                    onAddImage={!p.image_url ? () => onEditProduct(p) : undefined}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#15282C] text-[#2DD4BF] text-[10px] font-bold">
                        {p.category}
                      </span>

                      {isOut ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#2C1B20] text-[#FCA5A5] text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F87171]" />
                          نفدت الكمية
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#17282A] text-[#2DD4BF] text-[10px] font-bold">
                          مخزون حرج
                        </span>
                      ) : isTop ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#142A22] text-[#2EE59D] text-[10px] font-bold">
                          ↗ الأعلى طلباً
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#142A22] text-[#2EE59D] text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2EE59D]" />
                          متوفر بالمستودع
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm sm:text-base font-extrabold text-white truncate">{p.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                      <span className="font-mono">#{p.sku}</span>
                      <span>•</span>
                      <span
                        className={`font-bold tabular-nums ${
                          isOut ? 'text-[#F87171]' : isLow ? 'text-[#2DD4BF]' : 'text-slate-200'
                        }`}
                      >
                        الكمية: {p.stock_qty} {p.unit_label}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Inset Metrics Strip */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[#11131B] border border-[#222533]">
                  <div>
                    <span className="block text-[10px] text-slate-400">سعر البيع</span>
                    <span className="text-sm font-extrabold text-white tabular-nums">
                      {formatNumber(p.sell_price)} <span className="text-[10px] font-normal text-slate-400">{p.currency || currency}</span>
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">سعر الشراء</span>
                    <span className="text-sm font-bold text-slate-300 tabular-nums">
                      {formatNumber(p.cost_price)} <span className="text-[10px] font-normal text-slate-400">{p.currency || currency}</span>
                    </span>
                  </div>
                  <div className="text-left">
                    <span className="block text-[10px] text-slate-400">هامش الربح</span>
                    <span className="text-sm font-extrabold text-[#2EE59D] tabular-nums">+{marginPct}%</span>
                  </div>
                </div>

                {/* Stock Bar */}
                <div className="h-1.5 w-full rounded-full bg-[#232635] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOut ? 'bg-slate-600' : isLow ? 'bg-[#2DD4BF]' : 'bg-[#2EE59D]'
                    }`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>

                {/* Action Row */}
                <div className="flex items-center gap-2">
                  {isOut ? (
                    <button
                      type="button"
                      onClick={() => onRestockProduct(p, 15)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#A799FF] text-[#0D0E12] text-xs font-extrabold hover:opacity-95"
                    >
                      <PackagePlus className="w-4 h-4" />
                      <span>إعادة طلب توريد</span>
                    </button>
                  ) : isLow ? (
                    <button
                      type="button"
                      onClick={() => onRestockProduct(p, 5)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#152B28] border border-[#2EE59D]/25 text-[#2EE59D] text-xs font-bold hover:bg-[#1A3531]"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>طلب دفعة (+5)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRestockProduct(p, 10)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#11131B] border border-[#252836] text-slate-200 hover:border-[#2EE59D]/40 text-xs font-bold"
                    >
                      <Plus className="w-4 h-4 text-[#2EE59D]" />
                      <span>توريد سريع</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onEditProduct(p)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-[#11131B] border border-[#252836] text-slate-200 hover:border-[#A799FF]/50 text-xs font-bold"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>

                  {isOut ? (
                    <button
                      type="button"
                      onClick={() => onDeleteProduct(p)}
                      className="p-2.5 rounded-xl bg-[#29171B] border border-[#F87171]/25 text-[#F87171] hover:bg-[#F87171]/20"
                      title="حذف المنتج"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBarcodeModalProd(p)}
                      className="p-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-slate-300 hover:text-white"
                      title="بطاقة الباركود"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  )}

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                      className="p-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-slate-300 hover:text-white"
                      aria-label="خيارات إضافية"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openMenuId === p.id && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute left-0 bottom-12 z-30 w-40 rounded-2xl bg-[#1C1F2B] border border-[#2F3448] shadow-xl p-1.5 space-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setBarcodeModalProd(p);
                            }}
                            className="w-full text-right px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-white/5 flex items-center gap-2"
                          >
                            <QrCode className="w-3.5 h-3.5 text-[#A799FF]" />
                            <span>عرض الباركود</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onDeleteProduct(p);
                            }}
                            className="w-full text-right px-3 py-2 rounded-xl text-xs font-semibold text-[#F87171] hover:bg-[#F87171]/10 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف المنتج</span>
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

      {/* Load More + Auto Sync Footer */}
      {filtered.length > visibleCount && (
        <div className="pt-2 space-y-2 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + 12)}
            className="w-full py-3 rounded-2xl bg-[#171923] border border-[#252836] text-xs font-bold text-slate-200 hover:border-[#A799FF]/50 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4 text-[#A799FF]" />
            <span>تحميل منتجات إضافية ({filtered.length - visibleCount} متبقي)</span>
          </button>
        </div>
      )}
      <p className="text-center text-[11px] text-slate-500 py-1">
        يتم حفظ التغييرات محلياً تلقائياً عند انقطاع الإنترنت ومزامنتها فور الاتصال
      </p>
      </div>

      {/* Quick Barcode Sticker Preview */}
      {barcodeModalProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm print:static print:bg-white print:p-0">
          <div className="w-full max-w-xs rounded-3xl bg-[#171923] border border-[#252836] p-5 text-center space-y-3 print:border-none print:bg-white">
            <h4 className="text-sm font-bold text-white no-print">{barcodeModalProd.name}</h4>
            <div className="p-4 rounded-2xl bg-white text-[#0D0E12] space-y-1">
              <p className="text-xs font-bold">{barcodeModalProd.name}</p>
              <div className="flex justify-center gap-0.5 h-12 items-end py-1">
                {Array.from({ length: 24 }).map((_, i) => (
                  <span
                    key={i}
                    className="bg-black inline-block"
                    style={{ width: i % 3 === 0 ? '3px' : '1.5px', height: `${70 + (i % 4) * 8}%` }}
                  />
                ))}
              </div>
              <p className="font-mono text-xs font-bold tracking-widest">{barcodeModalProd.barcode || barcodeModalProd.sku}</p>
              <p className="text-sm font-extrabold">{formatCurrency(barcodeModalProd.sell_price, barcodeModalProd.currency || currency)}</p>
            </div>
            <div className="flex gap-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-[#A799FF] text-[#0D0E12] text-xs font-bold"
              >
                طباعة الملصق
              </button>
              <button
                type="button"
                onClick={() => setBarcodeModalProd(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#1E2130] text-slate-200 text-xs font-semibold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

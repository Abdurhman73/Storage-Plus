import React, { useEffect, useRef, useState } from 'react';
import { ImageOff, Package, PackagePlus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import type { CurrencyCode, Product } from '../../types';
import { GENERAL_CATEGORIES } from '../../utils/format';
import { CurrencyInlineSelector } from '../CurrencyInlineSelector';

interface ProductModalProps {
  open: boolean;
  product?: Product | null;
  defaultThreshold?: number;
  currency?: string;
  onClose: () => void;
  onSave: (payload: Partial<Product>, id?: number) => Promise<void>;
}

function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('تنسيق الصورة غير مدعوم'));
      img.onload = () => {
        const maxDim = 360;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('تعذر معالجة الصورة'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ProductModal({
  open,
  product,
  defaultThreshold = 5,
  currency = 'ر.س',
  onClose,
  onSave,
}: ProductModalProps) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('عام');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [prodCurrency, setProdCurrency] = useState<CurrencyCode>('ر.س');
  const [costPrice, setCostPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [minThreshold, setMinThreshold] = useState(String(defaultThreshold));
  const [unitLabel, setUnitLabel] = useState('قطعة');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setName(product.name);
      setSku(product.sku);
      setBarcode(product.barcode);
      const inDefaults = GENERAL_CATEGORIES.includes(product.category);
      if (inDefaults) {
        setCategory(product.category);
        setIsCustomCategory(false);
        setCustomCategory('');
      } else {
        setCategory('custom');
        setIsCustomCategory(true);
        setCustomCategory(product.category || '');
      }
      setProdCurrency(product.currency === 'ر.ي' ? 'ر.ي' : 'ر.س');
      setCostPrice(String(product.cost_price));
      setSellPrice(String(product.sell_price));
      setStockQty(String(product.stock_qty));
      setMinThreshold(String(product.min_stock_threshold));
      setUnitLabel(product.unit_label || 'قطعة');
      setImageUrl(product.image_url || '');
    } else {
      const randSku = String(Math.floor(100000 + Math.random() * 899999));
      setName('');
      setSku(randSku);
      setBarcode(`628100${randSku}`);
      setCategory('عام');
      setIsCustomCategory(false);
      setCustomCategory('');
      setProdCurrency(currency === 'ر.ي' ? 'ر.ي' : 'ر.س');
      setCostPrice('');
      setSellPrice('');
      setStockQty('1');
      setMinThreshold(String(defaultThreshold));
      setUnitLabel('قطعة');
      setImageUrl('');
    }
    setError('');
  }, [open, product, defaultThreshold, currency]);

  if (!open) return null;

  const cost = Number(costPrice || 0);
  const sell = Number(sellPrice || 0);
  const marginPct = sell > 0 ? (((sell - cost) / sell) * 100).toFixed(1) : '0.0';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setImageUrl(dataUrl);
      setError('');
    } catch (err: any) {
      setError(err.message || 'تعذر تحميل الصورة');
    }
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('يرجى إدخال اسم المنتج');
      return;
    }
    if (!sku.trim()) {
      setError('يرجى إدخال رمز SKU');
      return;
    }
    if (sell <= 0) {
      setError('يجب أن يكون سعر البيع أكبر من صفر');
      return;
    }
    const finalCategory = isCustomCategory ? customCategory.trim() || 'عام' : category;

    setSaving(true);
    setError('');
    try {
      await onSave(
        {
          name: name.trim(),
          sku: sku.trim(),
          barcode: barcode.trim() || sku.trim(),
          category: finalCategory,
          currency: prodCurrency,
          cost_price: Math.max(0, Number(costPrice || 0)),
          sell_price: Math.max(0, Number(sellPrice || 0)),
          stock_qty: Math.max(0, Math.floor(Number(stockQty || 0))),
          min_stock_threshold: Math.max(0, Math.floor(Number(minThreshold || 0))),
          unit_label: unitLabel.trim() || 'قطعة',
          image_url: imageUrl.trim(),
        },
        product?.id
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto no-print">
      <div className="w-full max-w-lg rounded-3xl bg-[#171923] border border-[#252836] shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252836]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#A799FF]/15 text-[#A799FF] flex items-center justify-center">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {product ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد للمخزون'}
              </h3>
              <p className="text-xs text-slate-400">سيصبح متاحاً فوراً في نقطة البيع والفواتير</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-[#F87171]/10 border border-[#F87171]/30 text-xs text-[#FCA5A5] font-medium">
              {error}
            </div>
          )}

          {/* Optional Image Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                صورة المنتج <span className="text-slate-500 font-normal">(اختياري)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#A799FF]/15 text-[#A799FF] hover:bg-[#A799FF]/25 text-[11px] font-bold"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{imageUrl ? 'تغيير الصورة' : 'رفع صورة من الجهاز'}</span>
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#F87171]/15 text-[#F87171] hover:bg-[#F87171]/25 text-[11px] font-bold"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>إزالة</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#11131B] border border-[#222533]">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="صورة المنتج"
                  className="w-14 h-14 rounded-xl object-cover border border-[#A799FF]/40 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-[#171923] border border-dashed border-[#34394E] flex items-center justify-center text-slate-400 shrink-0">
                  <ImageOff className="w-5 h-5" />
                </div>
              )}
              <div className="text-[11px] text-slate-400 leading-relaxed">
                {imageUrl ? (
                  <span className="text-[#2EE59D] font-semibold">تم إرفاق صورة للمنتج بنجاح.</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 shrink-0" />
                    <span>صورة المنتج اختيارية تماماً، يمكنك الحفظ بدونها وإضافتها لاحقاً.</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">اسم المنتج *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: اسم الصنف أو المنتج"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white focus:outline-none focus:border-[#A799FF]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">رمز المنتج (SKU) *</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white font-mono focus:outline-none focus:border-[#A799FF]"
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    const r = String(Math.floor(100000 + Math.random() * 899999));
                    setSku(r);
                    setBarcode(`628100${r}`);
                  }}
                  title="توليد رمز"
                  className="px-2.5 rounded-xl bg-[#1E2130] text-slate-300 hover:text-white"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">التصنيف</label>
              <select
                value={isCustomCategory ? 'custom' : category}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setIsCustomCategory(true);
                  } else {
                    setIsCustomCategory(false);
                    setCategory(e.target.value);
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white focus:outline-none focus:border-[#A799FF]"
              >
                {GENERAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="custom">+ كتابة تصنيف مخصص</option>
              </select>
            </div>
          </div>

          {isCustomCategory && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">اسم التصنيف المخصص</label>
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="أدخل التصنيف المناسب لنشاطك..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#A799FF]/50 text-sm text-white focus:outline-none focus:border-[#A799FF]"
              />
            </div>
          )}

          {/* Prices with Currency Selection directly next to the amounts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">الأسعار وعملة التسعير</span>
              <CurrencyInlineSelector value={prodCurrency} onChange={setProdCurrency} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  سعر الشراء ({prodCurrency})
                </label>
                <div className="flex items-center rounded-xl bg-[#11131B] border border-[#252836] focus-within:border-[#A799FF] px-3">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="0"
                    className="w-full py-2.5 bg-transparent text-sm text-white tabular-nums focus:outline-none"
                  />
                  <span className="text-[11px] font-bold text-slate-400 shrink-0">{prodCurrency}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  سعر البيع ({prodCurrency}) *
                </label>
                <div className="flex items-center rounded-xl bg-[#11131B] border border-[#252836] focus-within:border-[#A799FF] px-3">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    placeholder="0"
                    className="w-full py-2.5 bg-transparent text-sm text-white tabular-nums focus:outline-none"
                    required
                  />
                  <span className="text-[11px] font-bold text-[#A799FF] shrink-0">{prodCurrency}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#222533]">
            <span className="text-xs text-slate-400">هامش الربح المتوقع</span>
            <span className={`text-sm font-bold tabular-nums ${Number(marginPct) >= 0 ? 'text-[#2EE59D]' : 'text-[#F87171]'}`}>
              {Number(marginPct) >= 0 ? '+' : ''}{marginPct}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">الكمية الحالية</label>
              <input
                type="number"
                min="0"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white tabular-nums focus:outline-none focus:border-[#A799FF]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">حد التنبيه</label>
              <input
                type="number"
                min="0"
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white tabular-nums focus:outline-none focus:border-[#A799FF]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">الوحدة</label>
              <input
                type="text"
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder="قطعة / كرتون / كجم"
                className="w-full px-3 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white focus:outline-none focus:border-[#A799FF]"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-l from-[#A799FF] to-[#8C7AE6] text-[#0D0E12] font-bold text-sm hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ...' : product ? 'حفظ التعديلات' : 'إضافة المنتج'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-5 rounded-xl bg-[#1E2130] text-slate-200 font-semibold text-sm hover:bg-[#272B3D]"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

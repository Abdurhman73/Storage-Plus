import React, { useEffect, useState } from 'react';
import { PackageCheck, X } from 'lucide-react';
import type { Product } from '../../types';

interface RestockModalProps {
  open: boolean;
  product: Product | null;
  defaultQty?: number;
  onClose: () => void;
  onConfirm: (productId: number, quantity: number, reason: string) => Promise<void>;
}

export function RestockModal({ open, product, defaultQty = 10, onClose, onConfirm }: RestockModalProps) {
  const [quantity, setQuantity] = useState(String(defaultQty));
  const [reason, setReason] = useState('طلب توريد سريع للمستودع');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setQuantity(String(defaultQty));
      setReason('طلب توريد سريع للمستودع');
      setError('');
    }
  }, [open, defaultQty]);

  if (!open || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.floor(Number(quantity));
    if (qty <= 0) {
      setError('يجب إدخال كمية أكبر من صفر');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onConfirm(product.id, qty, reason.trim() || 'توريد مخزون');
      onClose();
    } catch (err: any) {
      setError(err.message || 'تعذر تحديث المخزون');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm no-print">
      <div className="w-full max-w-md rounded-3xl bg-[#171923] border border-[#252836] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252836]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2EE59D]/15 text-[#2EE59D] flex items-center justify-center">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">توريد مخزون إضافي</h3>
              <p className="text-xs text-slate-400 truncate max-w-[230px]">{product.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-[#F87171]/10 border border-[#F87171]/30 text-xs text-[#FCA5A5]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#11131B] border border-[#222533]">
            <div>
              <span className="block text-[11px] text-slate-400">الرصيد الحالي</span>
              <span className="text-lg font-bold text-white tabular-nums">{product.stock_qty} {product.unit_label}</span>
            </div>
            <div>
              <span className="block text-[11px] text-slate-400">الرصيد بعد التوريد</span>
              <span className="text-lg font-bold text-[#2EE59D] tabular-nums">
                {product.stock_qty + Math.max(0, Math.floor(Number(quantity || 0)))} {product.unit_label}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">الكمية الموردة</label>
            <div className="flex gap-2 mb-2">
              {[5, 10, 20, 50].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQuantity(String(preset))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    Number(quantity) === preset
                      ? 'bg-[#A799FF] text-[#0D0E12] border-[#A799FF]'
                      : 'bg-[#11131B] text-slate-300 border-[#252836] hover:border-[#A799FF]/50'
                  }`}
                >
                  +{preset}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white tabular-nums focus:outline-none focus:border-[#A799FF]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">ملاحظة / رقم أمر التوريد</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#11131B] border border-[#252836] text-sm text-white focus:outline-none focus:border-[#A799FF]"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#A799FF] text-[#0D0E12] font-bold text-sm hover:bg-[#9585F8] disabled:opacity-50"
            >
              {loading ? 'جاري التوريد...' : 'تأكيد إضافة الكمية'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-5 rounded-xl bg-[#1E2130] text-slate-200 font-semibold text-sm"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

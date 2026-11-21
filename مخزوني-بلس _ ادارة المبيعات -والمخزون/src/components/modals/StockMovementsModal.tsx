import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, History, RefreshCw, X } from 'lucide-react';
import { api } from '../../api/client';
import type { StockMovement } from '../../types';
import { formatDateArabic, formatTimeArabic } from '../../utils/format';

interface StockMovementsModalProps {
  open: boolean;
  onClose: () => void;
}

export function StockMovementsModal({ open, onClose }: StockMovementsModalProps) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .getStockMovements()
      .then(setMovements)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm no-print">
      <div className="w-full max-w-2xl rounded-3xl bg-[#171923] border border-[#252836] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252836]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#A799FF]/15 text-[#A799FF] flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">سجل حركات المخزون والجرد</h3>
              <p className="text-xs text-slate-400">توثيق آلي لكافة عمليات التوريد والبيع والمرتجعات</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">جاري تحميل سجل الحركات...</div>
          ) : movements.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">لا توجد حركات مخزنية مسجلة بعد</div>
          ) : (
            movements.map((m) => {
              const isIn = m.quantity_change > 0;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#11131B] border border-[#222533]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        m.type === 'adjust'
                          ? 'bg-[#A799FF]/15 text-[#A799FF]'
                          : isIn
                          ? 'bg-[#2EE59D]/15 text-[#2EE59D]'
                          : 'bg-[#F87171]/15 text-[#F87171]'
                      }`}
                    >
                      {m.type === 'adjust' ? (
                        <RefreshCw className="w-4 h-4" />
                      ) : isIn ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{m.product_name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {m.reason} • {formatDateArabic(m.created_at)} ({formatTimeArabic(m.created_at)})
                      </p>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <span
                      className={`text-sm font-bold tabular-nums block ${
                        isIn ? 'text-[#2EE59D]' : 'text-[#F87171]'
                      }`}
                    >
                      {isIn ? `+${m.quantity_change}` : m.quantity_change}
                    </span>
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      الرصيد: {m.new_qty}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

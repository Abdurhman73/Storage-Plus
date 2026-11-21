import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'تأكيد التنفيذ',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm no-print">
      <div className="w-full max-w-md rounded-2xl bg-[#171923] border border-[#252836] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252836]">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${danger ? 'bg-[#F87171]/15 text-[#F87171]' : 'bg-[#A799FF]/15 text-[#A799FF]'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
        </div>

        <div className="flex items-center gap-3 px-5 py-4 bg-[#11131B] border-t border-[#252836]">
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${
              danger
                ? 'bg-[#EF4444] hover:bg-[#DC2626] text-white'
                : 'bg-[#A799FF] hover:bg-[#9585F8] text-[#0D0E12]'
            }`}
          >
            {loading ? 'جاري التنفيذ...' : confirmLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold bg-[#1E2130] hover:bg-[#272B3D] text-slate-200 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

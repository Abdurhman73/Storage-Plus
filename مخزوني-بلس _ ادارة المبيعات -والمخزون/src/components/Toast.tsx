import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-6 sm:right-auto sm:w-96 z-50 flex flex-col gap-2 pointer-events-none no-print">
      {toasts.map((t) => {
        const styles =
          t.type === 'success'
            ? 'bg-[#132620]/95 border-[#2EE59D]/30 text-[#D1FAE5]'
            : t.type === 'error'
            ? 'bg-[#29151A]/95 border-[#F87171]/35 text-[#FEE2E2]'
            : 'bg-[#1D1B31]/95 border-[#A799FF]/35 text-[#EDE9FE]';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-xl transition-all ${styles}`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#2EE59D] shrink-0" />}
            {t.type === 'error' && <AlertCircle className="w-5 h-5 text-[#F87171] shrink-0" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-[#A799FF] shrink-0" />}
            <span className="text-sm font-medium flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="p-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
              aria-label="إغلاق التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  if (isInstalled) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;

  if (!isInstallable && !isIOS) return null;

  const handleClick = async () => {
    if (isIOS) {
      setShowIOSPrompt(true);
    } else {
      await promptInstall();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#A799FF]/15 border border-[#A799FF]/35 text-[#A799FF] hover:bg-[#A799FF]/25 text-[11px] font-bold transition-colors'
            : 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-[#171923] border border-[#A799FF]/30 text-[#A799FF] hover:bg-[#A799FF]/15 transition-colors'
        }
        title="تثبيت التطبيق للعمل بدون إنترنت"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>تثبيت التطبيق</span>
      </button>

      {showIOSPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm no-print">
          <div className="w-full max-w-sm rounded-3xl bg-[#171923] border border-[#252836] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-white">تثبيت التطبيق على iOS</h3>
              <button
                type="button"
                onClick={() => setShowIOSPrompt(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              لتثبيت التطبيق والعمل بدون إنترنت على جهازك:
            </p>
            <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside">
              <li className="flex items-center gap-1.5">
                <span>اضغط على أيقونة المشاركة</span>
                <Share className="w-4 h-4 text-[#A799FF] inline" />
                <span>في شريط المتصفح</span>
              </li>
              <li>اختر &quot;إضافة إلى الشاشة الرئيسية&quot; (Add to Home Screen)</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSPrompt(false)}
              className="w-full py-2.5 rounded-xl bg-[#A799FF] text-[#0D0E12] text-xs font-extrabold"
            >
              فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
}

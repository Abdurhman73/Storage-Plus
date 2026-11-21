import type { CurrencyCode } from '../types';

interface CurrencyInlineSelectorProps {
  value: string;
  onChange: (currency: CurrencyCode) => void;
  size?: 'sm' | 'md';
}

export function CurrencyInlineSelector({
  value,
  onChange,
  size = 'sm',
}: CurrencyInlineSelectorProps) {
  const cur: CurrencyCode = value === 'ر.ي' ? 'ر.ي' : 'ر.س';
  const btnPadding = size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs';

  return (
    <div
      className="inline-flex items-center p-0.5 rounded-lg bg-[#181A24] border border-[#2A2E3F] shrink-0"
      role="group"
      aria-label="اختيار العملة"
    >
      <button
        type="button"
        onClick={() => onChange('ر.س')}
        className={`${btnPadding} rounded-md font-extrabold transition-colors ${
          cur === 'ر.س'
            ? 'bg-[#A799FF] text-[#0D0E12]'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        ر.س
      </button>
      <button
        type="button"
        onClick={() => onChange('ر.ي')}
        className={`${btnPadding} rounded-md font-extrabold transition-colors ${
          cur === 'ر.ي'
            ? 'bg-[#2EE59D] text-[#0D0E12]'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        ر.ي
      </button>
    </div>
  );
}

import { ImagePlus, Package } from 'lucide-react';

interface ProductThumbProps {
  src?: string | null;
  alt: string;
  sizeClass?: string;
  dimmed?: boolean;
  onAddImage?: () => void;
}

export function ProductThumb({
  src,
  alt,
  sizeClass = 'w-11 h-11 rounded-xl',
  dimmed = false,
  onAddImage,
}: ProductThumbProps) {
  const hasImage = Boolean(src && src.trim().length > 0);

  if (hasImage) {
    return (
      <div className={`relative overflow-hidden bg-[#11131B] border border-[#252836] shrink-0 ${sizeClass}`}>
        <img
          src={src!}
          alt={alt}
          className={`w-full h-full object-cover ${dimmed ? 'opacity-35 grayscale' : ''}`}
          referrerPolicy="no-referrer"
        />
        {dimmed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35">
            <span className="w-6 h-6 rounded-full border-2 border-[#F87171] text-[#F87171] flex items-center justify-center text-[10px] font-bold">
              ✕
            </span>
          </div>
        )}
      </div>
    );
  }

  if (onAddImage) {
    return (
      <button
        type="button"
        onClick={onAddImage}
        title="إضافة صورة للمنتج"
        className={`relative flex flex-col items-center justify-center gap-0.5 bg-[#11131B] border border-dashed border-[#34394E] hover:border-[#A799FF] text-slate-400 hover:text-[#A799FF] transition-colors shrink-0 ${sizeClass}`}
      >
        <ImagePlus className="w-4 h-4" />
        <span className="text-[9px] font-bold leading-none">إضافة صورة</span>
      </button>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center bg-[#11131B] border border-[#252836] text-slate-500 shrink-0 ${sizeClass}`}
    >
      <Package className={`w-5 h-5 ${dimmed ? 'opacity-40' : ''}`} />
      {dimmed && (
        <span className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-[#F87171] text-white text-[9px] font-bold flex items-center justify-center">
          ✕
        </span>
      )}
    </div>
  );
}

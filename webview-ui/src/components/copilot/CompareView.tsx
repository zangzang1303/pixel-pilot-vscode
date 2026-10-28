import React, { useState } from 'react';
import { Check, X, SplitSquareVertical, Eye, ArrowLeftRight } from 'lucide-react';

interface CompareViewProps {
  originalUrl: string;
  previewUrl: string;
  operationLabel?: string;
  onApply: () => void;
  onDiscard: () => void;
}

export const CompareView: React.FC<CompareViewProps> = ({
  originalUrl,
  previewUrl,
  operationLabel = 'Kết quả chỉnh sửa',
  onApply,
  onDiscard
}) => {
  const [sliderPos, setSliderPos] = useState<number>(50); // 0 to 100%
  const [mode, setMode] = useState<'slider' | 'toggle'>('slider');
  const [showOriginal, setShowOriginal] = useState<boolean>(false);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-slate-950">
      {/* Top action header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-violet-500/10 px-2 py-0.5 text-xs font-semibold text-violet-300 border border-violet-500/20">
            Xem trước (Preview)
          </span>
          <span className="text-xs text-slate-300 font-medium">{operationLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode switch */}
          <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 p-0.5 text-xs text-slate-300">
            <button
              type="button"
              onClick={() => setMode('slider')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 transition ${
                mode === 'slider' ? 'bg-violet-600 text-white' : 'hover:text-white'
              }`}
              title="So sánh thanh trượt"
            >
              <SplitSquareVertical className="h-3.5 w-3.5" />
              <span>Thanh trượt</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('toggle')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 transition ${
                mode === 'toggle' ? 'bg-violet-600 text-white' : 'hover:text-white'
              }`}
              title="Chuyển đổi ảnh gốc / kết quả"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>Chuyển đổi</span>
            </button>
          </div>

          {/* Action buttons */}
          <button
            type="button"
            onClick={onDiscard}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <X className="h-3.5 w-3.5 text-rose-400" />
            <span>Hủy bỏ</span>
          </button>
          <button
            type="button"
            onClick={onApply}
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-900/30 hover:bg-emerald-500 transition"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Áp dụng vào Canvas</span>
          </button>
        </div>
      </div>

      {/* Comparison canvas container */}
      <div className="relative flex-1 overflow-hidden select-none flex items-center justify-center p-4">
        {mode === 'slider' ? (
          <div className="relative max-h-full max-w-full overflow-hidden rounded-xl border border-slate-800 shadow-2xl">
            {/* Background: Original Image */}
            <img
              src={originalUrl}
              alt="Ảnh gốc"
              className="max-h-[70vh] max-w-full object-contain pointer-events-none"
            />

            {/* Foreground: Preview Image clipped by slider position */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
            >
              <img
                src={previewUrl}
                alt="Bản xem trước"
                className="max-h-[70vh] max-w-full object-contain pointer-events-none"
              />
            </div>

            {/* Divider line & handle */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)] pointer-events-none"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg">
                <ArrowLeftRight className="h-4 w-4" />
              </div>
            </div>

            {/* Invisible range input for dragging */}
            <input
              type="range"
              min={0}
              max={100}
              value={sliderPos}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              aria-label="Thanh trượt so sánh trước sau"
              className="absolute inset-0 h-full w-full opacity-0 cursor-ew-resize"
            />

            {/* Badges */}
            <span className="absolute bottom-3 left-3 rounded-md bg-slate-950/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300 backdrop-blur">
              Ảnh gốc
            </span>
            <span className="absolute bottom-3 right-3 rounded-md bg-violet-600/90 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
              Sau chỉnh sửa
            </span>
          </div>
        ) : (
          <div className="relative max-h-full max-w-full overflow-hidden rounded-xl border border-slate-800 shadow-2xl">
            <img
              src={showOriginal ? originalUrl : previewUrl}
              alt={showOriginal ? 'Ảnh gốc' : 'Bản xem trước'}
              className="max-h-[70vh] max-w-full object-contain"
            />
            <button
              type="button"
              onMouseDown={() => setShowOriginal(true)}
              onMouseUp={() => setShowOriginal(false)}
              onTouchStart={() => setShowOriginal(true)}
              onTouchEnd={() => setShowOriginal(false)}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-slate-200 backdrop-blur hover:bg-slate-900"
            >
              <Eye className="h-3.5 w-3.5 text-cyan-400" />
              <span>Giữ chuột để xem ảnh gốc</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

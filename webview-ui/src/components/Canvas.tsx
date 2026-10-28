import React, { useRef, useState, useEffect } from 'react';
import {
  Paintbrush,
  Eraser,
  RotateCcw,
  Download,
  Copy,
  Code,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize,
  Sparkles,
  Loader2,
  FolderOpen,
  Save
} from 'lucide-react';

interface CanvasProps {
  imageUrl: string | null;
  isGenerating: boolean;
  progressStatus: string;
  progressPercentage?: number;
  savedPath?: string;
  onInsertSnippet: () => void;
  snippetInserted: boolean;
  onOpenImage?: () => void;
  onSaveImage?: () => void;
  onApplyAction?: (action: string, options?: any) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  imageUrl,
  isGenerating,
  progressStatus,
  progressPercentage,
  savedPath,
  onInsertSnippet,
  snippetInserted,
  onOpenImage,
  onSaveImage,
  onApplyAction
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);

  // Brush / Mask Tool state
  const [brushMode, setBrushMode] = useState<'none' | 'brush' | 'eraser'>('none');
  const [brushSize, setBrushSize] = useState<number>(24);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasMask, setHasMask] = useState<boolean>(false);

  // Zoom / View state
  const [zoom, setZoom] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);

  // Render image to main canvas when imageUrl changes
  useEffect(() => {
    if (!imageUrl || !canvasRef.current || !maskCanvasRef.current) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current!;
      const maskCanvas = maskCanvasRef.current!;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      maskCanvas.width = img.naturalWidth;
      maskCanvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }

      // Clear mask
      const maskCtx = maskCanvas.getContext('2d');
      if (maskCtx) {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      }
      setHasMask(false);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Drawing helpers for Mask/Inpaint
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return { x: 0, y: 0 };

    const rect = maskCanvas.getBoundingClientRect();
    const scaleX = maskCanvas.width / rect.width;
    const scaleY = maskCanvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (brushMode === 'none' || !imageUrl) return;
    setIsDrawing(true);

    const { x, y } = getCanvasCoordinates(e);
    drawMask(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || brushMode === 'none' || !imageUrl) return;
    const { x, y } = getCanvasCoordinates(e);
    drawMask(x, y);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const drawMask = (x: number, y: number) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    if (brushMode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(239, 68, 68, 0.65)'; // Semi-transparent Red mask
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      setHasMask(true);
    }
    ctx.restore();
  };

  const handleInpaint = () => {
    if (!maskCanvasRef.current || !onApplyAction) return;
    const maskDataUrl = maskCanvasRef.current.toDataURL('image/png');
    onApplyAction('inpaint', { maskDataUrl });
    clearMask();
  };

  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      setHasMask(false);
    }
  };

  const copyImage = async () => {
    if (!imageUrl) return;
    try {
      if (canvasRef.current) {
        canvasRef.current.toBlob(async (blob) => {
          if (blob && navigator.clipboard) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        });
      }
    } catch (e) {
      console.warn('Copy failed', e);
    }
  };

  const downloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `pixel_pilot_${Date.now()}.png`;
    a.click();
  };

  const handleCanvasKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'b' || event.key === 'B') {
      event.preventDefault();
      setBrushMode((mode) => mode === 'brush' ? 'none' : 'brush');
    } else if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
      setBrushMode((mode) => mode === 'eraser' ? 'none' : 'eraser');
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setBrushMode('none');
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      setZoom((value) => Math.min(3, value + 0.25));
    } else if (event.key === '-') {
      event.preventDefault();
      setZoom((value) => Math.max(0.25, value - 0.25));
    } else if (event.key === '0') {
      event.preventDefault();
      setZoom(1);
    }
  };

  return (
    <div
      role="region"
      aria-label="Khung vẽ chỉnh sửa ảnh"
      tabIndex={0}
      onKeyDown={handleCanvasKeyDown}
      className="flex-1 flex flex-col h-full bg-slate-950 relative overflow-hidden select-none outline-none focus:ring-1 focus:ring-violet-500/20"
    >
      {/* Top Toolbar */}
      <div className="h-12 px-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur flex items-center justify-between z-10">
        {/* Brush Tools */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium mr-1">Inpaint Mask:</span>
          <button
            onClick={() => setBrushMode(brushMode === 'brush' ? 'none' : 'brush')}
            aria-pressed={brushMode === 'brush'}
            disabled={!imageUrl}
            className={`p-1.5 rounded-lg flex items-center gap-1 text-xs font-medium transition-all ${
              brushMode === 'brush'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40'
            }`}
            title="Brush Tool (Draw inpaint mask)"
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Brush</span>
          </button>

          <button
            onClick={() => setBrushMode(brushMode === 'eraser' ? 'none' : 'eraser')}
            aria-pressed={brushMode === 'eraser'}
            disabled={!imageUrl}
            className={`p-1.5 rounded-lg flex items-center gap-1 text-xs font-medium transition-all ${
              brushMode === 'eraser'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40'
            }`}
            title="Eraser Tool"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Eraser</span>
          </button>

          {brushMode !== 'none' && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-800">
              <span className="text-[10px] text-slate-400">Size:</span>
              <input
                type="range"
                min={6}
                max={80}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-16 accent-rose-500 cursor-pointer h-1 bg-slate-700 rounded"
              />
              <span className="text-[10px] font-mono text-slate-300 w-6">{brushSize}px</span>
            </div>
          )}

          {hasMask && (
            <>
              <button
                onClick={handleInpaint}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1 shadow-md shadow-rose-600/30 transition-all"
                title="Tẩy/Xóa đối tượng theo vùng mask đã vẽ"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Inpaint (Xóa đối tượng)</span>
              </button>
              <button
                onClick={clearMask}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 text-xs flex items-center gap-1 transition-colors"
                title="Clear Mask"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>

        {/* View & Export Tools */}
        <div className="flex items-center gap-2">
          <span className="hidden 2xl:inline text-[10px] text-slate-500 font-mono mr-1 whitespace-nowrap shrink-0">
            B: Brush · E: Eraser · Esc: Thoát · +/-: Zoom · 0: 100%
          </span>
          {/* Open Image Button */}
          {onOpenImage && (
            <button
              onClick={onOpenImage}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 transition-colors border border-slate-700"
              title="Mở ảnh từ máy tính"
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Mở ảnh</span>
            </button>
          )}

          {/* Save Image Button */}
          {onSaveImage && imageUrl && (
            <button
              onClick={onSaveImage}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 transition-colors border border-slate-700"
              title="Lưu ảnh ra đĩa cứng"
            >
              <Save className="w-3.5 h-3.5 text-emerald-400" />
              <span>Lưu</span>
            </button>
          )}
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/60">
            <button
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="px-2 text-[10px] font-mono text-slate-300 hover:text-white"
              title="Reset Zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Copy Button */}
          <button
            onClick={copyImage}
            disabled={!imageUrl}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-xs flex items-center gap-1 transition-colors disabled:opacity-40"
            title="Copy Image to Clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Download Button */}
          <button
            onClick={downloadImage}
            disabled={!imageUrl}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-xs flex items-center gap-1 transition-colors disabled:opacity-40"
            title="Download Image"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Insert Snippet Button */}
          {savedPath && (
            <button
              onClick={onInsertSnippet}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                snippetInserted
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/80'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
              }`}
            >
              {snippetInserted ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Snippet Inserted</span>
                </>
              ) : (
                <>
                  <Code className="w-3.5 h-3.5" />
                  <span>Insert to Code</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleCanvasKeyDown}
        aria-label="Image canvas. Press B for brush, E for eraser, Escape to stop drawing, and plus or minus to zoom."
        className="flex-1 flex items-center justify-center p-6 overflow-auto relative canvas-checkerboard"
      >
        {imageUrl ? (
          <div
            className="relative transition-transform duration-100 ease-out shadow-2xl rounded-lg overflow-hidden border border-slate-700/50"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            {/* Base Image Canvas */}
            <canvas ref={canvasRef} className="block max-w-full max-h-[70vh] object-contain" />

            {/* Inpaint Mask Canvas */}
            <canvas
              ref={maskCanvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              className={`absolute inset-0 w-full h-full ${
                brushMode !== 'none' ? 'cursor-crosshair' : 'pointer-events-none'
              }`}
            />
          </div>
        ) : (
          !isGenerating && (
            <div className="flex flex-col items-center justify-center text-center p-8 max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-center mb-4 shadow-xl text-indigo-400">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-200 mb-1">InvokeAI Studio Canvas</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Enter your prompt and click <span className="text-indigo-400 font-semibold">Generate Image</span>.
                The rendered image will be automatically saved to your workspace <code className="text-indigo-300 bg-slate-800 px-1 py-0.5 rounded">assets/</code> folder and can be auto-inserted into code.
              </p>
            </div>
          )
        )}

        {/* Loading Overlay with Progress Bar */}
        {isGenerating && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center z-20 transition-all animate-fadeIn">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 flex flex-col items-center shadow-2xl max-w-sm w-full mx-4">
              <div className="relative mb-4">
                <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <Sparkles className="w-5 h-5 text-indigo-400 absolute inset-0 m-auto" />
              </div>

              <h4 className="text-sm font-bold text-slate-100 mb-1">Generating with InvokeAI</h4>
              <p className="text-xs text-slate-400 text-center mb-4 min-h-[1.5rem]">
                {progressStatus || 'Executing generation graph...'}
              </p>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-2">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage || 25}%` }}
                />
              </div>

              <span className="text-[11px] font-mono text-indigo-400 font-medium">
                {progressPercentage ? `${progressPercentage}%` : 'Polling session...'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Pill */}
      {savedPath && (
        <div className="absolute bottom-3 left-4 z-10 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-400 backdrop-blur flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Saved to:</span>
          <code className="text-slate-200 font-mono text-[11px] bg-slate-800 px-1 py-0.5 rounded">
            {savedPath}
          </code>
        </div>
      )}
    </div>
  );
};

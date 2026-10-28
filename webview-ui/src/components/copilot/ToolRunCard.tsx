import React from 'react';
import {
  Sparkles,
  Scissors,
  Palette,
  Wand2,
  Maximize2,
  BarChart2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  X
} from 'lucide-react';
import type { RunState } from '../../state/runReducer';

interface ToolRunCardProps {
  runState: RunState;
  onCancel?: (requestId: string) => void;
}

export const ToolRunCard: React.FC<ToolRunCardProps> = ({ runState, onCancel }) => {
  if (runState.phase === 'idle') return null;

  const getToolIcon = (toolName?: string) => {
    switch (toolName) {
      case 'image.remove_background':
      case 'remove_background':
        return <Scissors className="h-4 w-4 text-cyan-400" />;
      case 'image.recolor':
      case 'recolor':
      case 'recolor_subject':
        return <Palette className="h-4 w-4 text-pink-400" />;
      case 'image.inpaint':
      case 'inpaint':
        return <Wand2 className="h-4 w-4 text-violet-400" />;
      case 'image.upscale':
      case 'upscale':
      case 'upscale_image':
        return <Maximize2 className="h-4 w-4 text-emerald-400" />;
      case 'image.analyze':
        return <BarChart2 className="h-4 w-4 text-amber-400" />;
      default:
        return <Sparkles className="h-4 w-4 text-indigo-400" />;
    }
  };

  const isRunning = runState.phase === 'executing' || runState.phase === 'processing';
  const percentage =
    runState.fraction !== undefined ? Math.round(runState.fraction * 100) : undefined;

  return (
    <div
      role="status"
      aria-live="polite"
      className="my-3 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/90 shadow-lg shadow-black/20 backdrop-blur-sm"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800">
            {getToolIcon(runState.toolName)}
          </div>
          <span className="text-xs font-semibold text-slate-200">
            {runState.label || runState.toolName || 'Tác vụ AI'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {runState.provider && (
            <span className="rounded-md border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
              {runState.provider}
            </span>
          )}

          {isRunning && onCancel && runState.requestId && (
            <button
              type="button"
              onClick={() => onCancel(runState.requestId!)}
              className="flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300 transition hover:bg-rose-500/20"
              title="Hủy tiến trình đang chạy"
            >
              <X className="h-3 w-3" />
              <span>Hủy</span>
            </button>
          )}
        </div>
      </div>

      {/* Body content */}
      <div className="px-3.5 py-3">
        {isRunning && (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                <span>{runState.stage || 'Đang xử lý...'}</span>
              </div>
              {percentage !== undefined && (
                <span className="font-mono text-[11px] text-cyan-300">{percentage}%</span>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              {percentage !== undefined ? (
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                />
              ) : (
                <div className="h-full w-2/5 animate-[pulse_1.5s_ease-in-out_infinite] bg-gradient-to-r from-violet-500 to-cyan-400" />
              )}
            </div>
          </div>
        )}

        {runState.phase === 'succeeded' && (
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{runState.stage || 'Hoàn thành thành công.'}</span>
            {runState.metrics?.latencyMs !== undefined && (
              <span className="ml-auto font-mono text-[10px] text-slate-400">
                {runState.metrics.latencyMs}ms
              </span>
            )}
          </div>
        )}

        {runState.phase === 'failed' && (
          <div className="flex items-start gap-2 text-xs text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <div className="min-w-0 flex-1">
              <span className="font-medium">Lỗi thực thi: </span>
              <span className="text-slate-300">{runState.error || 'Tác vụ không hoàn thành.'}</span>
            </div>
          </div>
        )}

        {runState.phase === 'cancelled' && (
          <div className="flex items-center gap-2 text-xs text-amber-300">
            <XCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{runState.stage || 'Tác vụ đã được hủy theo yêu cầu.'}</span>
          </div>
        )}
      </div>
    </div>
  );
};

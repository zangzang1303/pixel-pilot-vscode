import React, { useEffect, useState, useRef } from 'react';
import { ShieldAlert, Cloud, Lock, Clock, Check, X } from 'lucide-react';

export interface ConfirmationDetails {
  token: string;
  provider: string;
  purpose: string;
  costEstimate?: string;
  isCloud?: boolean;
}

interface ConfirmationDialogProps {
  details: ConfirmationDetails;
  onRespond: (approved: boolean) => void;
  timeoutSeconds?: number;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  details,
  onRespond,
  timeoutSeconds = 30
}) => {
  const [remaining, setRemaining] = useState<number>(timeoutSeconds);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmBtnRef.current?.focus();

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onRespond(false); // Default to deny on expiry (B19 policy)
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onRespond(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onRespond]);

  const isCloud = details.isCloud ?? /cloud|runware|openai|gemini/i.test(details.provider);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-dialog-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-violet-500/30 bg-slate-900 shadow-2xl shadow-violet-950/40">
        {/* Banner */}
        <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-950/60 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
            {isCloud ? <Cloud className="h-5 w-5 text-cyan-400" /> : <ShieldAlert className="h-5 w-5 text-amber-400" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirmation-dialog-title" className="text-sm font-semibold text-white">
              Xác nhận quyền thực thi {isCloud ? 'Cloud AI' : 'Tác vụ'}
            </h2>
            <p className="text-[11px] text-slate-400">
              Yêu cầu xác nhận trước khi chia sẻ dữ liệu hoặc phát sinh phí
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950 px-2 py-0.5 text-[11px] font-mono text-slate-400">
            <Clock className="h-3 w-3 text-amber-400" />
            <span>{remaining}s</span>
          </div>
        </div>

        {/* Content details */}
        <div className="p-5 space-y-3.5">
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Mục đích:</span>
              <span className="font-semibold text-slate-200">{details.purpose}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Nhà cung cấp:</span>
              <span className="font-semibold text-cyan-300">{details.provider}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Ước tính chi phí:</span>
              <span className="font-semibold text-emerald-400">
                {details.costEstimate || (isCloud ? 'Theo hạn mức tài khoản' : 'Miễn phí (Local GPU)')}
              </span>
            </div>
          </div>

          {/* Privacy disclosure notice */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.08] p-3 text-xs text-amber-200/90 leading-relaxed">
            <div className="flex items-center gap-1.5 font-medium mb-1 text-amber-300">
              <Lock className="h-3.5 w-3.5" />
              <span>Chính sách bảo mật dữ liệu</span>
            </div>
            {isCloud
              ? 'Dữ liệu ảnh/prompt sẽ được gửi tới nhà cung cấp Cloud để xử lý. Từ chối sẽ giữ nguyên vẹn dữ liệu trong máy cục bộ.'
              : 'Tác vụ chạy hoàn toàn trên máy tính của bạn, không gửi dữ liệu ra bên ngoài internet.'}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 bg-slate-950/40 px-5 py-3.5">
          <button
            type="button"
            onClick={() => onRespond(false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            <span>Từ chối (Cancel)</span>
          </button>
          <button
            type="button"
            ref={confirmBtnRef}
            onClick={() => onRespond(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-violet-900/30 transition hover:from-violet-500 hover:to-indigo-500"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Cho phép thực hiện</span>
          </button>
        </div>
      </div>
    </div>
  );
};

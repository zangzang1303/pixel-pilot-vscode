import React, { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, Cloud, CloudOff, Code2, ImagePlus, Loader2, MessageSquarePlus, MoreHorizontal, Send, Sparkles, Wand2 } from 'lucide-react';
import type { StudioTab } from './SettingsSidebar';

export interface CopilotMessage {
  id?: string;
  role: 'user' | 'assistant';
  text: string;
  operation?: string;
  outputImageUri?: string;
  suggestions?: Array<{ label: string; reason: string }>;
}

interface SessionSummary { sessionId: string; title: string; updatedAt: number; messageCount: number; }
interface CopilotChatProps {
  messages: CopilotMessage[]; isThinking: boolean; hasImage: boolean; currentImageUrl?: string | null;
  sessions: SessionSummary[]; activeSessionId: string;
  onSend: (text: string) => void; onOpenImage: () => void; onNewSession: () => void; onSwitchSession: (sessionId: string) => void;
  onNavigate: (tab: StudioTab) => void;
  hasApiKey: boolean; onConfigureApiKey: () => void;
}

const QUICK_PROMPTS = [
  'Phân tích ảnh và đề xuất 3 chỉnh sửa tốt nhất',
  'Tách nền, giữ lại chi tiết chủ thể',
  'Làm ảnh sắc nét và tăng chất lượng',
  'Tạo caption và alt text cho ảnh này'
];

function formatMessage(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith('**') && part.endsWith('**')
    ? <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>
    : <React.Fragment key={index}>{part}</React.Fragment>);
}

export const CopilotChat: React.FC<CopilotChatProps> = ({ messages, isThinking, hasImage, currentImageUrl, sessions, activeSessionId, onSend, onOpenImage, onNewSession, onSwitchSession, onNavigate, hasApiKey, onConfigureApiKey }) => {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeSession = sessions.find((session) => session.sessionId === activeSessionId);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages.length, isThinking]);

  const send = () => {
    const text = draft.trim();
    if (!text || isThinking) return;
    onSend(text);
    setDraft('');
  };

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0b1020]" aria-label="Pixel Pilot image editing agent">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800/90 bg-slate-950/50 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-500/20"><Bot className="h-5 w-5 text-white" /></div>
          <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-sm font-semibold text-white">Pixel Pilot Agent</h2><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-300">Image editing</span></div><p className="truncate text-[11px] text-slate-400">{hasImage ? 'Đang hiểu ngữ cảnh của ảnh hiện tại' : 'Sẵn sàng nhận ảnh và yêu cầu chỉnh sửa'}</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onConfigureApiKey} title={hasApiKey ? 'Runware Cloud sẵn sàng' : 'Thiết lập Runware API key'} className={`hidden h-8 items-center gap-1.5 rounded-lg border px-2 text-[10px] font-medium transition lg:inline-flex ${hasApiKey ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15' : 'border-amber-400/25 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15'}`}>
            {hasApiKey ? <Cloud className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
            {hasApiKey ? 'Cloud AI' : 'Thiết lập AI'}
          </button>
          <div className="hidden items-center rounded-lg border border-slate-800 bg-slate-900/70 p-0.5 md:flex">
            <button type="button" onClick={() => onNavigate('generate')} title="Sinh ảnh" className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"><Sparkles className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => onNavigate('edit')} title="Chỉnh sửa" className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"><Wand2 className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => onNavigate('dev')} title="Dev tools" className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"><Code2 className="h-3.5 w-3.5" /></button>
          </div>
          <label className="relative hidden max-w-56 sm:block"><span className="sr-only">Phiên trò chuyện</span><select value={activeSessionId} onChange={(event) => onSwitchSession(event.target.value)} className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-2.5 pr-7 text-xs text-slate-200 outline-none hover:border-slate-600 focus:border-violet-500">{sessions.length === 0 && <option value="">Phiên mới</option>}{sessions.map((session) => <option key={session.sessionId} value={session.sessionId}>{session.title}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-slate-400" /></label>
          <button type="button" onClick={onNewSession} title="Tạo phiên mới" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-slate-300 transition hover:border-violet-500/60 hover:bg-violet-500/10 hover:text-white"><MessageSquarePlus className="h-4 w-4" /><span className="hidden sm:inline">Phiên mới</span></button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-8">
        {hasImage && currentImageUrl && <div className="flex items-center gap-3 rounded-2xl border border-cyan-400/15 bg-gradient-to-r from-cyan-500/[0.08] to-violet-500/[0.06] p-3"><img src={currentImageUrl} alt="Ảnh đang chỉnh sửa" className="h-14 w-14 rounded-lg border border-white/10 object-cover" /><div className="min-w-0 flex-1"><p className="text-xs font-medium text-slate-100">Ảnh hiện tại đã được thêm vào ngữ cảnh</p><p className="mt-0.5 text-[11px] text-slate-400">Agent có thể đề xuất và thực hiện thao tác chỉnh ảnh trong cuộc trò chuyện này.</p></div><span className="hidden rounded-lg bg-cyan-400/10 px-2 py-1 text-[10px] font-medium text-cyan-300 sm:block">Context active</span></div>}
        {messages.length === 0 && <div className="py-8 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10"><Wand2 className="h-6 w-6 text-violet-300" /></div><h3 className="text-base font-semibold text-white">Bạn muốn chỉnh ảnh như thế nào?</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">Hãy nói tự nhiên như đang làm việc với một designer. Agent sẽ phân tích ảnh, chọn công cụ phù hợp và trả kết quả trên canvas.</p><div className="mx-auto mt-5 flex max-w-xl flex-wrap justify-center gap-2">{QUICK_PROMPTS.map((prompt) => <button key={prompt} type="button" disabled={isThinking} onClick={() => !isThinking && onSend(prompt)} className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-300 transition hover:border-violet-400/50 hover:bg-violet-500/10 hover:text-violet-100 disabled:opacity-40">{prompt}</button>)}</div></div>}
        {messages.map((item, index) => <article key={item.id || index} className={`flex gap-3 ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {item.role === 'assistant' && <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/90 to-cyan-500/90"><Bot className="h-4 w-4 text-white" /></div>}
          <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${item.role === 'user' ? 'rounded-tr-md bg-violet-600 text-white shadow-violet-950/30' : 'rounded-tl-md border border-slate-800 bg-slate-900/90 text-slate-200'}`}>
            {item.operation && <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300"><Sparkles className="h-3 w-3" />{item.operation.replace(/_/g, ' ')}</div>}<div className="whitespace-pre-wrap break-words">{formatMessage(item.text)}</div>
            {item.outputImageUri && item.operation !== 'original' && <div className="mt-3 overflow-hidden rounded-xl border border-slate-700 bg-slate-950"><div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5 text-[10px] font-medium text-slate-400"><span>Kết quả chỉnh sửa</span><span className="text-emerald-300">Sẵn sàng</span></div><div className="canvas-checkerboard flex max-h-64 min-h-36 items-center justify-center overflow-hidden"><img src={item.outputImageUri} alt={`Kết quả ${(item.operation || 'ảnh').replace(/_/g, ' ')}`} className="max-h-64 max-w-full object-contain" /></div></div>}
            {item.suggestions && item.suggestions.length > 0 && index === messages.length - 1 && <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-700/70 pt-3">{item.suggestions.map((suggestion, suggestionIndex) => <button key={suggestionIndex} type="button" disabled={isThinking} title={suggestion.reason} onClick={() => onSend(`/apply ${suggestionIndex + 1}`)} className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-400/20 disabled:opacity-40">{suggestion.label}</button>)}</div>}
          </div>
        </article>)}
        {isThinking && <div className="flex items-center gap-3 self-start rounded-2xl rounded-tl-md border border-violet-400/20 bg-violet-500/[0.08] px-4 py-3 text-sm text-violet-200"><Loader2 className="h-4 w-4 animate-spin" /> Agent đang phân tích và chuẩn bị thao tác...</div>}<div ref={bottomRef} />
      </div></div>

      <div className="shrink-0 border-t border-slate-800/90 bg-slate-950/40 px-4 py-4 sm:px-8"><div className="mx-auto max-w-4xl">
        {!hasImage && <button type="button" onClick={onOpenImage} className="mb-3 inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/20"><ImagePlus className="h-4 w-4" /> Thêm ảnh để bắt đầu</button>}
        <form onSubmit={(event) => { event.preventDefault(); send(); }} className="rounded-2xl border border-slate-700 bg-slate-900 p-2 shadow-xl shadow-black/10 transition focus-within:border-violet-400/70 focus-within:ring-2 focus-within:ring-violet-500/10"><div className="flex items-end gap-2"><button type="button" onClick={onOpenImage} title="Đổi hoặc thêm ảnh" className="mb-0.5 rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-cyan-300"><ImagePlus className="h-5 w-5" /></button><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} rows={1} placeholder={hasImage ? 'Ví dụ: làm sáng khuôn mặt, đổi nền thành studio trắng...' : 'Mô tả ảnh hoặc yêu cầu bạn muốn thực hiện...'} className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-slate-500" /><button type="button" title="Thêm tuỳ chọn" className="mb-0.5 rounded-xl p-2 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"><MoreHorizontal className="h-5 w-5" /></button><button type="submit" disabled={!draft.trim() || isThinking} aria-label="Gửi yêu cầu" className="mb-0.5 rounded-xl bg-violet-600 p-2.5 text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /></button></div></form>
        <p className="mt-2 text-center text-[10px] text-slate-500">Enter để gửi · Shift + Enter để xuống dòng · {activeSession?.messageCount || 0} tin nhắn trong phiên này</p>
      </div></div>
    </section>
  );
};

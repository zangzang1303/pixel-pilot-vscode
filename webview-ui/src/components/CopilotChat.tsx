import React, { useEffect, useRef, useState } from 'react';
import { Bot, ImagePlus, Send, Sparkles } from 'lucide-react';

export interface CopilotMessage {
  id?: string;
  role: 'user' | 'assistant';
  text: string;
  operation?: string;
  suggestions?: Array<{ label: string; reason: string }>;
}

interface CopilotChatProps {
  messages: CopilotMessage[];
  isThinking: boolean;
  hasImage: boolean;
  onSend: (text: string) => void;
  onOpenImage: () => void;
}

export const CopilotChat: React.FC<CopilotChatProps> = ({ messages, isThinking, hasImage, onSend, onOpenImage }) => {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, isThinking]);

  const send = () => {
    if (!draft.trim() || isThinking) return;
    onSend(draft.trim());
    setDraft('');
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-slate-950" aria-label="Pixel Pilot Copilot">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Bot className="h-5 w-5 text-emerald-400" /> Pixel Pilot Copilot</div>
        <span className="text-xs text-slate-400">{hasImage ? 'Đang làm việc với ảnh trên canvas' : 'Chưa có ảnh'}</span>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {messages.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300">Hỏi về ảnh hoặc yêu cầu chỉnh sửa bằng tiếng Việt. Mỗi cuộc trò chuyện được lưu thành một phiên riêng.</div>}
          {messages.map((item, index) => (
            <article key={item.id || index} className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 ${item.role === 'user' ? 'self-end bg-indigo-600 text-white' : 'self-start border border-slate-800 bg-slate-900 text-slate-100'}`}>
              {item.operation && <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">{item.operation}</div>}
              <div className="whitespace-pre-wrap break-words">{item.text}</div>
              {item.suggestions && item.suggestions.length > 0 && index === messages.length - 1 && <div className="mt-3 flex flex-wrap gap-2">
                {item.suggestions.map((suggestion, suggestionIndex) => <button key={suggestionIndex} type="button" disabled={isThinking} title={suggestion.reason} onClick={() => onSend(`/apply ${suggestionIndex + 1}`)} className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40">{suggestion.label}</button>)}
              </div>}
            </article>
          ))}
          {isThinking && <div className="flex items-center gap-2 self-start rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-indigo-300"><Sparkles className="h-4 w-4 animate-pulse" /> Đang trả lời hoặc xử lý ảnh...</div>}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="border-t border-slate-800 px-4 py-4 sm:px-8">
        <div className="mx-auto max-w-3xl">
          {!hasImage && <button type="button" onClick={onOpenImage} className="mb-3 flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200 hover:bg-indigo-500/20"><ImagePlus className="h-4 w-4" /> Mở ảnh để bắt đầu chỉnh sửa</button>}
          {hasImage && <button type="button" disabled={isThinking} onClick={() => onSend('Phân tích ảnh này và đề xuất chỉnh sửa')} className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"><Sparkles className="h-4 w-4" /> Phân tích ảnh và gợi ý sửa</button>}
          <form onSubmit={(event) => { event.preventDefault(); send(); }} className="flex items-end gap-2 rounded-2xl border border-slate-700 bg-slate-900 p-2 focus-within:border-indigo-500">
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} rows={2} placeholder="Hỏi về ảnh hoặc mô tả điều bạn muốn chỉnh sửa..." className="max-h-40 min-h-12 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-slate-500" />
            <button type="submit" disabled={!draft.trim() || isThinking} aria-label="Gửi tin nhắn" className="rounded-xl bg-indigo-600 p-2.5 text-white hover:bg-indigo-500 disabled:opacity-40"><Send className="h-4 w-4" /></button>
          </form>
          <p className="mt-2 text-center text-[11px] text-slate-500">Enter để gửi · Shift+Enter để xuống dòng · Ảnh và chat được lưu theo phiên</p>
        </div>
      </div>
    </section>
  );
};

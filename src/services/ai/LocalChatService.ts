import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { ChatMessage } from '../session/types';

/** Optional, free local chat model. Image edits stay in the dedicated image tools. */
export class LocalChatService {
  private static readonly baseUrl = 'http://127.0.0.1:11434';
  private static readonly model = 'qwen2.5:1.5b';
  private static startAttempt: Promise<boolean> | undefined;

  private static async isReady(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(1500) });
      if (!response.ok) return false;
      const data = await response.json() as any;
      return Array.isArray(data.models) && data.models.some((model: any) => model.name === this.model || model.name?.startsWith(`${this.model}-`));
    } catch { return false; }
  }

  public static async ensureRunning(): Promise<boolean> {
    if (await this.isReady()) return true;
    if (!this.startAttempt) {
      this.startAttempt = (async () => {
        const candidates = [
          'D:\\Ollama_PixelPilot\\ollama.exe',
          path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe')
        ];
        const executable = candidates.find(candidate => fs.existsSync(candidate));
        if (!executable) return false;
        const child = spawn(executable, ['serve'], {
          detached: true, windowsHide: true, stdio: 'ignore',
          env: { ...process.env, OLLAMA_MODELS: path.join(path.dirname(executable), 'models'), OLLAMA_HOST: '127.0.0.1:11434' }
        });
        child.unref();
        for (let attempt = 0; attempt < 15; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 700));
          if (await this.isReady()) return true;
        }
        return false;
      })().finally(() => { this.startAttempt = undefined; });
    }
    return this.startAttempt;
  }

  public static async reply(prompt: string, history: ChatMessage[], imageContext?: string): Promise<string | null> {
    if (!await this.ensureRunning()) return null;
    const messages = [
      { role: 'system', content: 'Bạn là Pixel Pilot Copilot, trợ lý phân tích và chỉnh sửa ảnh trong VS Code. Trả lời bằng tiếng Việt, ngắn gọn và thực tế. Khi có dữ liệu ảnh, chỉ nêu chi tiết có trong mô tả thị giác hoặc số đo. Số đo toàn ảnh không chứng minh vị trí của vật thể hay lỗi cục bộ. Nếu thiếu dữ liệu để kết luận, hãy nói rõ. Đề xuất thao tác Pixel Pilot có thể làm: tách nền, phóng to, tăng độ rõ, đổi màu, inpaint, mở rộng, Canny, Lineart, Depth, SVG. Khi người dùng muốn thực hiện thao tác, hướng dẫn lệnh tương ứng. Không nhận là đã chỉnh ảnh khi chưa có kết quả công cụ.' },
      ...history.filter(item => item.sender === 'user' || item.sender === 'assistant').slice(-10).map(item => ({ role: item.sender, content: item.text })),
      { role: 'user', content: imageContext ? `Dữ liệu về ảnh hiện tại (ưu tiên hơn suy đoán từ lịch sử):\n${imageContext}\n\nCâu hỏi: ${prompt}` : prompt }
    ];
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages, stream: false, options: { num_gpu: 0, num_ctx: 4096, temperature: 0.2 } }),
      signal: AbortSignal.timeout(120000)
    });
    if (!response.ok) throw new Error(`Local chat HTTP ${response.status}`);
    const result = await response.json() as any;
    return typeof result.message?.content === 'string' ? result.message.content.trim() : null;
  }
}

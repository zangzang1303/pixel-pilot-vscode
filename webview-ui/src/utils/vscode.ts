/**
 * Type declarations for the VS Code Webview API.
 */
import { analyzeBrowserImage, runBrowserImageAction, type BrowserActionResult } from './browserImageTools';
interface VsCodeApi {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

class VSCodeWrapper {
  private vscode: VsCodeApi | undefined;
  private readonly browserDemo: boolean;
  private image: string | null = null;
  private sessions = new Map<string, { sessionId: string; title: string; currentNodeId: string; messages: any[]; history: any[]; currentImage: string | null }>();
  private activeSessionId = 'browser-demo';
  private cancelledRequests = new Set<string>();

  constructor() {
    if (typeof acquireVsCodeApi === 'function') {
      this.vscode = acquireVsCodeApi();
    }
    this.browserDemo = !this.vscode && typeof window !== 'undefined';
    if (this.browserDemo) this.newSession('browser-demo');
  }

  public postMessage(message: any) {
    if (this.vscode) {
      this.vscode.postMessage(message);
    } else if (this.browserDemo) {
      this.handleBrowserDemoMessage(message);
    } else {
      console.log('[Pixel Pilot] postMessage outside a webview:', message);
    }
  }

  public isBrowserDemo() {
    return this.browserDemo;
  }

  public getState() {
    return this.vscode ? this.vscode.getState() : null;
  }

  public setState(state: any) {
    if (this.vscode) {
      this.vscode.setState(state);
    }
  }

  private emit(data: any, delay = 0) {
    window.setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data })), delay);
  }

  private async api(path: string, payload?: any): Promise<any> {
    const response = await fetch(path, payload === undefined ? undefined : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(path === '/api/generate' ? 200_000 : 90_000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  private async health() {
    try {
      const status = await this.api('/api/health');
      this.emit({ command: 'pingResult', isOnline: false, comfyOnline: Boolean(status.comfyOnline), serverUrl: 'ComfyUI local' });
    } catch {
      this.emit({ command: 'pingResult', isOnline: false, comfyOnline: false, serverUrl: 'Canvas cục bộ' });
    }
  }

  private async imageAction(action: string, image: string, options: Record<string, any>): Promise<BrowserActionResult> {
    if (['removeBackground', 'recolor', 'vectorize'].includes(action)) {
      let result;
      try {
        result = await this.api('/api/action', { action, image, options });
      } catch (error) {
        if (error instanceof TypeError) throw new Error('Không kết nối được web API. Hãy chạy npm run web:start.');
        throw error;
      }
      if (result.svg) {
        const blob = new Blob([result.svg], { type: 'image/svg+xml' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'pixel-pilot-vector.svg';
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }
      return { image: result.image, text: result.text, fileName: result.image ? `${action}.png` : undefined };
    }
    return runBrowserImageAction(action, image, options);
  }

  private newSession(id = `browser-${Date.now()}`) {
    this.sessions.set(id, {
      sessionId: id, title: 'Phiên web mới', currentNodeId: `${id}-root`, messages: [],
      history: [{ nodeId: `${id}-root`, operation: 'original', operationLabel: 'Ảnh gốc', timestamp: Date.now() }], currentImage: null
    });
    this.activeSessionId = id;
    this.image = null;
    this.publishSession();
  }

  private publishSession() {
    const session = this.sessions.get(this.activeSessionId)!;
    this.emit({ command: 'sessionUpdated',
      sessionsList: [...this.sessions.values()].map(item => ({ sessionId: item.sessionId, title: item.title, updatedAt: Date.now(), messageCount: item.messages.length })),
      session, history: session.history, currentImage: session.currentImage });
  }

  private saveImage(image: string, operation: string, sourceSessionId = this.activeSessionId) {
    const session = this.sessions.get(sourceSessionId);
    if (!session) return;
    const previous = session.currentNodeId;
    const nodeId = `${sourceSessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    session.history.push({ nodeId, parentId: previous, operation, operationLabel: operation, timestamp: Date.now(), outputImageUri: image });
    session.currentNodeId = nodeId;
    session.currentImage = image;
    if (sourceSessionId === this.activeSessionId) {
      this.image = image;
      this.publishSession();
    }
  }

  private async applyAction(message: any) {
    const action = String(message.action || '');
    const sessionId = message.sessionId || this.activeSessionId;
    this.emit({ command: 'actionStarted', label: `Đang xử lý ${action} trên trình duyệt…` });
    try {
      const result = await this.imageAction(action, message.dataUrl || this.image || '', message.options || {});
      if (result.download && result.image) this.downloadImage(result.image, result.fileName || 'pixel-pilot.png');
      if (result.image && !result.download) this.saveImage(result.image, action, sessionId);
      if (result.text) {
        const session = this.sessions.get(sessionId)!;
        session.messages.push({ id: `reply-${Date.now()}`, sender: 'assistant', text: result.text, nodeId: session.currentNodeId });
        this.publishSession();
      }
      this.emit({ command: 'actionComplete', dataUrl: result.download ? undefined : result.image,
        sessionId, nodeId: this.sessions.get(sessionId)?.currentNodeId,
        message: result.text || `${action} hoàn tất bằng xử lý pixel cục bộ.`, savedPath: result.fileName });
    } catch (error) {
      this.emit({ command: 'actionError', message: error instanceof Error ? error.message : String(error) });
    }
  }

  private async chat(request: any) {
    const text = String(request.text || '').trim();
    const session = this.sessions.get(request.sessionId) || this.sessions.get(this.activeSessionId)!;
    session.messages.push({ id: `user-${Date.now()}`, sender: 'user', text, nodeId: session.currentNodeId });
    if (session.title === 'Phiên web mới') session.title = text.slice(0, 42);
    this.publishSession();
    try {
      const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
      const isQuestion = /\?\s*$/.test(text) || /^(what|why|how|co nen|tai sao|lam sao|huong dan)/.test(normalized);
      let reply: string;
      if (/phan tich|analyze|danh gia|nhan xet/.test(normalized)) {
        reply = await analyzeBrowserImage(session.currentImage || '');
      } else if (isQuestion) {
        reply = 'Bản web xử lý pixel cục bộ. Bạn có thể mở ảnh, tăng nét, phóng to, dò biên, tạo mask, mở rộng canvas, nén và tải kết quả. Phân tích nội dung hoặc chỉnh tóc/áo cần model AI.';
      } else {
        const action = /tach nen|xoa nen|remove background/.test(normalized) ? 'removeBackground'
          : /phong to|upscale/.test(normalized) ? 'upscale'
          : /tang net|lam net|enhance/.test(normalized) ? 'enhance'
          : /canny|do bien|edge/.test(normalized) ? 'canny'
          : /lineart|net ve/.test(normalized) ? 'lineart'
          : /mask|mat na/.test(normalized) ? 'mask'
          : /depth|do sau/.test(normalized) ? 'depth'
          : /mo rong|extend/.test(normalized) ? 'extend'
          : /caption|mo ta/.test(normalized) ? 'caption'
          : /doi mau|recolor/.test(normalized) ? 'recolor' : '';
        if (!action) throw new Error('Mình chưa có công cụ web phù hợp cho yêu cầu này. Hãy chọn công cụ trong thanh bên hoặc mô tả thao tác rõ hơn.');
        const result = await this.imageAction(action, session.currentImage || '', {});
        if (this.cancelledRequests.has(request.requestId)) return;
        if (result.image) this.saveImage(result.image, action, session.sessionId);
        reply = result.text || (['removeBackground', 'recolor', 'vectorize'].includes(action)
          ? `Đã xử lý ${action} bằng engine local. Xem kết quả bên phải và dùng nút Tải ảnh để lưu.`
          : `Đã xử lý ${action} bằng Canvas cục bộ. Xem kết quả bên phải và dùng nút Tải ảnh để lưu.`);
      }
      if (this.cancelledRequests.has(request.requestId)) return;
      session.messages.push({ id: `reply-${Date.now()}`, sender: 'assistant', text: reply, nodeId: session.currentNodeId });
      this.publishSession();
      this.emit({ type: 'copilotCompleted', requestId: request.requestId });
    } catch (error) {
      if (this.cancelledRequests.has(request.requestId)) return;
      const detail = error instanceof Error ? error.message : String(error);
      session.messages.push({ id: `reply-${Date.now()}`, sender: 'assistant', text: detail, nodeId: session.currentNodeId });
      this.publishSession();
      this.emit({ type: 'copilotError', requestId: request.requestId, error: { message: detail } });
    }
  }

  private handleBrowserDemoMessage(message: any) {
    const session = this.sessions.get(this.activeSessionId)!;
    switch (message?.command) {
      case 'ping':
        void this.health();
        break;
      case 'getModels':
        this.emit({ command: 'modelsLoaded', models: [] });
        break;
      case 'getApiKeyStatus':
        this.emit({ command: 'apiKeyStatus', hasApiKey: false, apiKeyMasked: '' });
        break;
      case 'webviewReady':
        this.publishSession();
        break;
      case 'browseImage':
        this.pickImage();
        break;
      case 'generate': {
        this.emit({ command: 'generationStarted' });
        void this.api('/api/generate', { prompt: message.prompt, negativePrompt: message.options?.negativePrompt,
          width: message.options?.width, height: message.options?.height })
          .then(result => {
            this.saveImage(result.image, 'generate', message.sessionId || this.activeSessionId);
            this.emit({ command: 'generationComplete', dataUrl: result.image,
              sessionId: message.sessionId || this.activeSessionId,
              nodeId: this.sessions.get(message.sessionId || this.activeSessionId)?.currentNodeId });
          })
          .catch(error => this.emit({ command: 'generationError', message: error instanceof Error ? error.message : String(error) }));
        break;
      }
      case 'upscale':
        this.emit({ command: 'upscaleStarted' });
        void runBrowserImageAction('upscale', message.dataUrl || this.image || '', { factor: message.factor || 2 })
          .then(result => {
            if (!result.image) throw new Error('Phóng to không tạo ảnh.');
            this.saveImage(result.image, 'upscale', message.sessionId || this.activeSessionId);
            this.emit({ command: 'upscaleComplete', dataUrl: result.image, savedPath: result.fileName,
              sessionId: message.sessionId || this.activeSessionId,
              nodeId: this.sessions.get(message.sessionId || this.activeSessionId)?.currentNodeId });
          })
          .catch(error => this.emit({ command: 'upscaleError', message: error instanceof Error ? error.message : String(error) }));
        break;
      case 'applyAction':
        void this.applyAction(message);
        break;
      case 'copilotRequest': {
        if (message.request?.command === 'cancel') {
          const targetRequestId = String(message.request.targetRequestId || '');
          this.cancelledRequests.add(targetRequestId);
          this.emit({ type: 'copilotCancelled', requestId: targetRequestId });
          break;
        }
        void this.chat(message.request || {});
        break;
      }
      case 'newSession':
        this.newSession();
        break;
      case 'switchSession':
        if (this.sessions.has(message.sessionId)) {
          this.activeSessionId = message.sessionId;
          this.image = this.sessions.get(message.sessionId)!.currentImage;
          this.publishSession();
        }
        break;
      case 'renameSession':
        if (this.sessions.has(message.sessionId)) this.sessions.get(message.sessionId)!.title = String(message.title || 'Phiên web');
        this.publishSession();
        break;
      case 'deleteSession':
        if (this.sessions.has(message.sessionId)) this.sessions.delete(message.sessionId);
        if (this.sessions.size === 0) this.newSession();
        else {
          if (this.activeSessionId === message.sessionId) this.activeSessionId = this.sessions.keys().next().value!;
          this.image = this.sessions.get(this.activeSessionId)!.currentImage;
          this.publishSession();
        }
        break;
      case 'rollbackNode': {
        const node = session.history.find(item => item.nodeId === message.targetNodeId);
        if (node) {
          session.currentNodeId = node.nodeId;
          session.currentImage = node.outputImageUri || null;
          this.image = session.currentImage;
          this.publishSession();
        }
        break;
      }
      case 'openApiKeyPrompt':
        this.emit({ command: 'actionError', message: 'API key được cấu hình trong VS Code extension. Bản web hiện chạy Canvas cục bộ.' });
        break;
      case 'insertSnippet':
        this.emit({ command: 'actionError', message: 'Chèn mã cần editor VS Code; hãy dùng nút tải ảnh trong trình duyệt.' });
        break;
      case 'exportImage':
        this.downloadImage(message.dataUrl, message.savedPath || 'pixel-pilot-browser-demo.png');
        break;
    }
  }

  private pickImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') return;
        this.saveImage(reader.result, 'original');
        this.emit({ command: 'setImage', dataUrl: reader.result, filePath: file.name });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  private downloadImage(dataUrl: string | undefined, name: string) {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = name;
    link.click();
  }

}

export const vscode = new VSCodeWrapper();

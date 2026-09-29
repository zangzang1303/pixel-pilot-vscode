// PixelPilotViewProvider.ts - Real Production View Provider connecting Webview to Runware SOTA Cloud Vision API
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SessionManager } from '../services/session/SessionManager';
import { RunwareAdapter } from '../services/ai/RunwareAdapter';
import { IntentRouter } from '../services/ai/IntentRouter';
import { OperationType, AIResult } from '../services/session/types';
import { SecretManager } from '../services/security/SecretManager';
import { AssetStorageService } from '../services/storage/AssetStorageService';
import { EnterpriseConfigManager } from '../services/config/EnterpriseConfigManager';

export class PixelPilotViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'pixelPilot.sidebarView';
  private _view?: vscode.WebviewView;
  private sessionManager: SessionManager;
  private runwareAdapter: RunwareAdapter;
  private secretManager: SecretManager;
  private assetStorage: AssetStorageService;
  private configManager: EnterpriseConfigManager;
  private context: vscode.ExtensionContext;
  private uriToPathMap: Map<string, string> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.sessionManager = new SessionManager(workspaceRoot || context.globalStorageUri.fsPath);
    this.secretManager = new SecretManager(context);
    this.assetStorage = new AssetStorageService(context);
    this.configManager = new EnterpriseConfigManager(workspaceRoot);
    this.runwareAdapter = new RunwareAdapter('');

    // Preload API Key from SecretStorage asynchronously
    this.secretManager.getApiKey().then((key) => {
      if (key) this.runwareAdapter.setApiKey(key);
    });
  }

  public getRunwareAdapter(): RunwareAdapter { return this.runwareAdapter; }
  public getSecretManager(): SecretManager { return this.secretManager; }
  public getAssetStorage(): AssetStorageService { return this.assetStorage; }
  public getConfigManager(): EnterpriseConfigManager { return this.configManager; }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'webview')),
        vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
        this.context.globalStorageUri
      ]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle incoming messages from Webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      await this.handleMessage(message);
    });
  }

  private async handleMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'webviewReady': {
        let activeSession = this.sessionManager.getActiveSession();
        if (!activeSession) {
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          const defaultTestImg = workspaceRoot
            ? path.join(workspaceRoot, 'pixel-pilot-vscode', 'test_images', '01_original', 'TC1.jpg')
            : '';

          if (fs.existsSync(defaultTestImg)) {
            const cachedPath = await this.assetStorage.saveToCache(defaultTestImg);
            const webviewUri = this._view ? this.assetStorage.getWebviewUri(cachedPath, this._view.webview) : defaultTestImg;
            this.uriToPathMap.set(webviewUri, cachedPath);
            activeSession = this.sessionManager.createSession(webviewUri, 'TC1 - Tóc bay ngược sáng');
          } else {
            activeSession = this.sessionManager.createSession('', 'Phiên làm việc mới');
          }
        }

        const apiKey = await this.secretManager.getApiKey();
        if (apiKey) {
          this.runwareAdapter.setApiKey(apiKey);
        }
        const masked = await this.secretManager.getMaskedApiKey();
        this.postToWebview({
          type: 'apiKeyStatus',
          hasApiKey: !!apiKey,
          apiKeyMasked: masked
        });

        this.broadcastSessionState();
        break;
      }

      case 'saveApiKey': {
        const key = (message.apiKey || '').trim();
        if (key) {
          await this.secretManager.setApiKey(key);
          this.runwareAdapter.setApiKey(key);
          const masked = await this.secretManager.getMaskedApiKey();
          vscode.window.showInformationMessage('🔒 Pixel Pilot Enterprise: Đã lưu API Key vào SecretStorage an toàn!');
          this.postToWebview({
            type: 'apiKeyStatus',
            hasApiKey: true,
            apiKeyMasked: masked
          });
        }
        break;
      }

      case 'clearApiKey': {
        await this.secretManager.deleteApiKey();
        this.runwareAdapter.setApiKey('');
        this.postToWebview({
          type: 'apiKeyStatus',
          hasApiKey: false,
          apiKeyMasked: ''
        });
        vscode.window.showInformationMessage('🔒 Pixel Pilot: Đã xóa API Key khỏi SecretStorage.');
        break;
      }

      case 'selectWorkspaceFile': {
        const fileUris = await vscode.window.showOpenDialog({
          canSelectMany: false,
          openLabel: 'Chọn ảnh nạp vào Pixel Pilot',
          filters: {
            'Images': ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'svg']
          }
        });

        if (fileUris && fileUris[0]) {
          const filePath = fileUris[0].fsPath;
          const cachedPath = await this.assetStorage.saveToCache(filePath);
          const webviewUri = this._view ? this.assetStorage.getWebviewUri(cachedPath, this._view.webview) : filePath;
          this.uriToPathMap.set(webviewUri, cachedPath);

          const session = this.sessionManager.createSession(webviewUri, path.basename(filePath));
          this.broadcastSessionState();
        }
        break;
      }

      case 'imageLoaded': {
        this.sessionManager.createSession(message.imageUri, message.fileName || 'New Session');
        this.broadcastSessionState();
        break;
      }

      case 'newSession': {
        this.sessionManager.createSession('', 'Phiên làm việc mới');
        this.broadcastSessionState();
        break;
      }

      case 'switchSession': {
        this.sessionManager.setActiveSession(message.sessionId);
        this.broadcastSessionState();
        break;
      }

      case 'renameSession': {
        if (message.sessionId && message.title) {
          this.sessionManager.renameSession(message.sessionId, message.title);
          this.broadcastSessionState();
        }
        break;
      }

      case 'deleteSession': {
        if (message.sessionId) {
          this.sessionManager.deleteSession(message.sessionId);
          if (!this.sessionManager.getActiveSession()) {
            this.sessionManager.createSession('', 'Phiên làm việc mới');
          }
          this.broadcastSessionState();
        }
        break;
      }

      case 'moveToRightSide': {
        await vscode.commands.executeCommand('pixelPilot.moveToRightSide');
        break;
      }

      case 'rollbackNode': {
        const activeSession = this.sessionManager.getActiveSession();
        if (activeSession) {
          this.sessionManager.rollbackToNode(activeSession.sessionId, message.targetNodeId);
          this.broadcastSessionState();
        }
        break;
      }

      case 'submitPrompt': {
        await this.handleCodexPrompt(message);
        break;
      }

      case 'runOperation': {
        await this.executeOperation(message);
        break;
      }

      case 'saveOutputImage': {
        await this.saveCurrentImage();
        break;
      }

      case 'exportSvg': {
        await this.exportCurrentSvg();
        break;
      }

      case 'exportDAG': {
        const activeSession = this.sessionManager.getActiveSession();
        if (activeSession) {
          const jsonStr = this.sessionManager.exportDAG(activeSession.sessionId);
          const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`session_dag_${activeSession.sessionId}.json`),
            filters: { 'JSON': ['json'] }
          });
          if (saveUri) {
            await vscode.workspace.fs.writeFile(saveUri, Buffer.from(jsonStr, 'utf-8'));
            vscode.window.showInformationMessage('Đã xuất toàn bộ đồ thị DAG ra file JSON!');
          }
        }
        break;
      }
    }
  }

  /**
   * Natural Language & Slash Command Handler (Codex-style)
   */
  private async handleCodexPrompt(message: any): Promise<void> {
    const session = this.sessionManager.getActiveSession();
    if (!session) return;

    const promptText = (message.promptText || '').trim();
    if (!promptText) return;

    // 1. Record user message in session
    this.sessionManager.addMessage(session.sessionId, {
      sender: 'user',
      text: promptText,
      nodeId: session.currentNodeId
    });
    this.broadcastSessionState();

    // 2. Parse intent
    const intent = IntentRouter.parsePrompt(promptText);

    // 3. Dispatch operation to REAL Runware API
    await this.executeOperation({
      nodeId: session.currentNodeId,
      operation: intent.operation,
      operationLabel: intent.label,
      factor: intent.factor,
      prompt: intent.promptText || promptText,
      mask: message.mask || '',
      preprocessor: intent.preprocessor
    });
  }

  /**
   * Executes REAL Runware API Call
   */
  private async executeOperation(message: any): Promise<void> {
    const session = this.sessionManager.getActiveSession();
    if (!session) return;

    const parentNode = session.nodes[message.nodeId] || session.nodes[session.currentNodeId];
    if (!parentNode) return;

    const inputImg = parentNode.outputImageUri || parentNode.inputImageUri;
    if (!inputImg) {
      vscode.window.showWarningMessage('Vui lòng nạp ảnh vào phiên làm việc trước khi thực hiện tác vụ!');
      this.postToWebview({ type: 'operationFailed', error: 'Chưa có ảnh trong phiên làm việc. Hãy nạp ảnh trước!' });
      return;
    }

    // Resolve real input file path or data URI
    const realInput = this.uriToPathMap.get(inputImg) || inputImg;

    // Check Runware API key
    if (!this.runwareAdapter.getApiKey()) {
      this.postToWebview({ type: 'apiKeyMissing' });
      return;
    }

    const op = message.operation as OperationType;
    let res: AIResult;

    try {
      switch (op) {
        case 'remove_background':
          res = await this.runwareAdapter.removeBackground(realInput);
          break;
        case 'upscale':
          res = await this.runwareAdapter.upscale(realInput, message.factor || 2);
          break;
        case 'vectorize':
          res = await this.runwareAdapter.vectorize(realInput);
          break;
        case 'inpaint':
          res = await this.runwareAdapter.inpaint(realInput, message.mask || '', message.prompt || 'high quality restoration');
          break;
        case 'mask':
          res = await this.runwareAdapter.extractMask(realInput);
          break;
        case 'canny':
          res = await this.runwareAdapter.detectEdges(realInput, 'canny');
          break;
        case 'lineart':
          res = await this.runwareAdapter.detectEdges(realInput, 'lineart');
          break;
        case 'caption':
          res = await this.runwareAdapter.generateCaption(realInput);
          break;
        case 'extend':
          res = await this.runwareAdapter.extendCanvas(realInput, 'all', message.prompt);
          break;
        default:
          res = {
            success: false,
            metrics: { model: 'Unknown', latencyMs: 0, costUsd: 0 },
            error: `Tác vụ không xác định: ${op}`
          };
      }

      if (res.success) {
        let displayUri = res.outputImageUri || inputImg;
        if (res.outputImageUri && this._view) {
          const cachedPath = await this.assetStorage.saveToCache(
            res.outputImageUri,
            op === 'vectorize' ? 'svg' : 'png'
          );
          displayUri = this.assetStorage.getWebviewUri(cachedPath, this._view.webview);
          this.uriToPathMap.set(displayUri, cachedPath);
        }

        this.sessionManager.addOperationNode(
          session.sessionId,
          parentNode.nodeId,
          op,
          message.operationLabel || op,
          inputImg,
          displayUri,
          res.metrics,
          {
            maskUri: res.maskUri,
            prompt: message.prompt,
            textResult: res.textResult
          }
        );

        this.broadcastSessionState();
        this.postToWebview({ type: 'operationCompleted', operation: op });
      } else {
        vscode.window.showErrorMessage(`Runware API: ${res.error}`);
        this.postToWebview({ type: 'operationFailed', error: res.error });
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`Lỗi thực thi: ${err.message || String(err)}`);
      this.postToWebview({ type: 'operationFailed', error: err.message || String(err) });
    }
  }

  private broadcastSessionState(): void {
    const activeSession = this.sessionManager.getActiveSession();
    const allSessions = this.sessionManager.getAllSessions().map((s) => ({
      sessionId: s.sessionId,
      title: s.title,
      updatedAt: s.updatedAt,
      nodeCount: Object.keys(s.nodes).length,
      messageCount: s.messages.length
    }));

    this.postToWebview({
      type: 'sessionUpdated',
      session: activeSession,
      sessionsList: allSessions
    });
  }

  private async saveCurrentImage(): Promise<void> {
    const session = this.sessionManager.getActiveSession();
    if (!session) return;
    const node = session.nodes[session.currentNodeId];
    if (!node || !node.outputImageUri) return;

    const defaultName = `${node.operation}_output.png`;
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultName),
      filters: { 'Images': ['png'] }
    });

    if (saveUri) {
      let buffer: Buffer;
      const realPath = this.uriToPathMap.get(node.outputImageUri) || node.outputImageUri;
      if (fs.existsSync(realPath)) {
        buffer = await fs.promises.readFile(realPath);
      } else if (node.outputImageUri.startsWith('data:image')) {
        const b64 = node.outputImageUri.split(',')[1];
        buffer = Buffer.from(b64, 'base64');
      } else {
        buffer = Buffer.from(node.outputImageUri);
      }
      await vscode.workspace.fs.writeFile(saveUri, buffer);
      vscode.window.showInformationMessage(`Đã lưu ảnh kết quả vào: ${saveUri.fsPath}`);
    }
  }

  private async exportCurrentSvg(): Promise<void> {
    const session = this.sessionManager.getActiveSession();
    if (!session) return;
    const node = session.nodes[session.currentNodeId];
    if (!node) return;

    let svgContent = node.textResult;
    if (!svgContent && node.outputImageUri.startsWith('data:image/svg+xml;base64,')) {
      svgContent = Buffer.from(node.outputImageUri.split(',')[1], 'base64').toString('utf-8');
    }

    if (!svgContent) {
      vscode.window.showWarningMessage('Nút hiện tại không chứa dữ liệu SVG. Hãy chạy tác vụ "Vectorize sang SVG" trước!');
      return;
    }

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file('asset_vector.svg'),
      filters: { 'SVG Files': ['svg'] }
    });

    if (saveUri) {
      await vscode.workspace.fs.writeFile(saveUri, Buffer.from(svgContent, 'utf-8'));
      vscode.window.showInformationMessage(`Đã xuất file vector SVG vào: ${saveUri.fsPath}`);
    }
  }

  private postToWebview(message: any): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const webviewPath = path.join(this.context.extensionPath, 'src', 'webview');
    const htmlPath = path.join(webviewPath, 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf-8');

    const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewPath, 'main.css')));
    const jsUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewPath, 'app.js')));

    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data: blob:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource};">`;

    html = html.replace('<!-- CSP_PLACEHOLDER -->', csp);
    html = html.replace('href="main.css"', `href="${cssUri}"`);
    html = html.replace('src="app.js"', `src="${jsUri}"`);

    return html;
  }
}

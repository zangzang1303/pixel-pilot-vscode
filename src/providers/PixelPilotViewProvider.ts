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

    const localRoots: vscode.Uri[] = [
      vscode.Uri.file(this.context.extensionPath),
      this.context.globalStorageUri
    ];
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        localRoots.push(folder.uri);
      }
    }

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: localRoots
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
          const candidates = [
            path.join(workspaceRoot || '', 'test_images', '01_original', 'TC1.jpg'),
            path.join(workspaceRoot || '', 'pixel-pilot-vscode', 'test_images', '01_original', 'TC1.jpg'),
            path.join(this.context.extensionPath, 'test_images', '01_original', 'TC1.jpg'),
            'd:/CODE/DAKH/pixel-pilot-vscode/test_images/01_original/TC1.jpg'
          ];
          let defaultTestImg = '';
          for (const cand of candidates) {
            if (fs.existsSync(cand)) {
              defaultTestImg = cand;
              break;
            }
          }

          if (defaultTestImg) {
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
            'Images': ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'svg', 'gif', 'tiff', 'ico'],
            'All Files': ['*']
          }
        });

        if (fileUris && fileUris[0]) {
          const filePath = fileUris[0].fsPath;
          const cachedPath = await this.assetStorage.saveToCache(filePath);
          const webviewUri = this._view ? this.assetStorage.getWebviewUri(cachedPath, this._view.webview) : filePath;
          this.uriToPathMap.set(webviewUri, cachedPath);

          const session = this.sessionManager.createSession(webviewUri, path.basename(filePath));
          this.broadcastSessionState();
          vscode.window.showInformationMessage(`✨ Pixel Pilot: Đã nạp ảnh "${path.basename(filePath)}"`);
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
        await this.saveCurrentImage(message.nodeId);
        break;
      }

      case 'exportSvg': {
        await this.exportCurrentSvg();
        break;
      }

      case 'copyToClipboard': {
        if (message.text) {
          await vscode.env.clipboard.writeText(message.text);
          vscode.window.showInformationMessage(message.notice || 'Đã sao chép vào Clipboard!');
        }
        break;
      }

      case 'openBatchDialog': {
        await vscode.commands.executeCommand('pixelPilot.batchProcessFolder');
        break;
      }

      case 'openInEditor': {
        const session = this.sessionManager.getActiveSession();
        if (session) {
          const targetNodeId = message.nodeId || session.currentNodeId;
          const node = session.nodes[targetNodeId];
          if (node) {
            const uri = node.outputImageUri || node.inputImageUri;
            let realPath = this.uriToPathMap.get(uri);
            if (!realPath && uri.startsWith('data:')) {
              realPath = await this.assetStorage.saveToCache(uri, 'png');
            }
            if (realPath && fs.existsSync(realPath)) {
              await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(realPath));
            }
          }
        }
        break;
      }

      case 'openEnterpriseConfig': {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
          const configPath = path.join(workspaceRoot, '.pixelpilotrc.json');
          if (!fs.existsSync(configPath)) {
            await this.configManager.initConfigFile();
          }
          const doc = await vscode.workspace.openTextDocument(configPath);
          await vscode.window.showTextDocument(doc);
        } else {
          vscode.window.showInformationMessage('Vui lòng mở một Workspace để chỉnh sửa cấu hình .pixelpilotrc.json');
        }
        break;
      }

      case 'savePastedImage': {
        if (message.dataUri) {
          const cachedPath = await this.assetStorage.saveToCache(message.dataUri, 'png');
          const webviewUri = this._view ? this.assetStorage.getWebviewUri(cachedPath, this._view.webview) : cachedPath;
          this.uriToPathMap.set(webviewUri, cachedPath);
          const title = message.title || `Ảnh dán (${new Date().toLocaleTimeString()})`;
          this.sessionManager.createSession(webviewUri, title);
          this.broadcastSessionState();
          vscode.window.showInformationMessage(`✨ Pixel Pilot: Đã nạp ảnh mới từ Clipboard/Kéo thả!`);
        }
        break;
      }

      case 'saveClientNode': {
        const session = this.sessionManager.getActiveSession();
        if (session && message.dataUri) {
          const parentNode = session.nodes[message.nodeId] || session.nodes[session.currentNodeId];
          if (parentNode) {
            const cachedPath = await this.assetStorage.saveToCache(message.dataUri, message.ext || 'png');
            const displayUri = this._view ? this.assetStorage.getWebviewUri(cachedPath, this._view.webview) : cachedPath;
            this.uriToPathMap.set(displayUri, cachedPath);

            this.sessionManager.addOperationNode(
              session.sessionId,
              parentNode.nodeId,
              message.operation || 'preprocess',
              message.operationLabel || 'Canvas Operation',
              parentNode.outputImageUri || parentNode.inputImageUri,
              displayUri,
              {
                model: message.model || 'Client GPU Canvas 2D Engine',
                latencyMs: message.latencyMs || 12,
                costUsd: 0
              },
              {
                prompt: message.prompt,
                textResult: message.textResult
              }
            );
            this.broadcastSessionState();
            this.postToWebview({ type: 'operationCompleted', operation: message.operation });
          }
        }
        break;
      }

      case 'exportIconBundle': {
        const session = this.sessionManager.getActiveSession();
        if (session && message.icons && Array.isArray(message.icons)) {
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          const targetDir = workspaceRoot
            ? path.join(workspaceRoot, 'assets', 'icons')
            : path.join(this.context.globalStorageUri.fsPath, 'icons');
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          for (const icon of message.icons) {
            if (icon.size && icon.dataUri) {
              const b64 = icon.dataUri.split(',')[1];
              const filePath = path.join(targetDir, `icon_${icon.size}x${icon.size}.png`);
              await fs.promises.writeFile(filePath, Buffer.from(b64, 'base64'));
            }
          }

          const openFolderAction = await vscode.window.showInformationMessage(
            `✅ Pixel Pilot Enterprise: Đã xuất bộ ${message.icons.length} icon chuẩn Web/PWA vào: ${targetDir}`,
            'Mở thư mục'
          );
          if (openFolderAction === 'Mở thư mục') {
            await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(targetDir));
          }
        }
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
      preprocessor: intent.preprocessor,
      style: intent.style,
      enhanceType: intent.enhanceType
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

    const op = message.operation as OperationType;
    const realInput = this.uriToPathMap.get(inputImg) || inputImg;

    // Check if client-side GPU canvas operation (zero cloud cost, instant execution)
    if (op === 'white_bg' || op === 'avatar' || op === 'icons' || op === 'export_webp') {
      this.postToWebview({
        type: 'requestClientOperation',
        operation: op,
        operationLabel: message.operationLabel || op,
        nodeId: parentNode.nodeId,
        inputImageUri: inputImg,
        factor: message.factor,
        prompt: message.prompt
      });
      return;
    }

    // Check Runware API key
    if (!this.runwareAdapter.getApiKey()) {
      this.postToWebview({ type: 'apiKeyMissing' });
      return;
    }

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
        case 'replace_bg':
          res = await this.runwareAdapter.replaceBackground(realInput, message.prompt || 'luxury modern studio');
          break;
        case 'style_transfer':
          res = await this.runwareAdapter.styleTransfer(realInput, message.style || 'anime', message.prompt);
          break;
        case 'enhance':
          res = await this.runwareAdapter.enhanceImage(realInput, message.enhanceType || 'clarity');
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

  private async saveCurrentImage(targetNodeId?: string): Promise<void> {
    const session = this.sessionManager.getActiveSession();
    if (!session) return;
    const nodeId = targetNodeId || session.currentNodeId;
    const node = session.nodes[nodeId];
    if (!node) return;
    const imageUri = node.outputImageUri || node.inputImageUri;
    if (!imageUri) return;

    const isSvg = imageUri.startsWith('data:image/svg') || node.operation === 'vectorize';
    const ext = isSvg ? 'svg' : 'png';
    const defaultName = `${node.operation}_${Date.now()}.${ext}`;
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultName),
      filters: isSvg ? { 'Vector SVG': ['svg'] } : { 'Images': ['png', 'jpg', 'webp'] }
    });

    if (saveUri) {
      let buffer: Buffer;
      const realPath = this.uriToPathMap.get(imageUri) || imageUri;
      if (fs.existsSync(realPath)) {
        buffer = await fs.promises.readFile(realPath);
      } else if (imageUri.startsWith('data:')) {
        const b64 = imageUri.split(',')[1];
        buffer = Buffer.from(b64, 'base64');
      } else {
        buffer = Buffer.from(imageUri);
      }
      await vscode.workspace.fs.writeFile(saveUri, buffer);
      vscode.window.showInformationMessage(`✨ Pixel Pilot: Đã tải và lưu ảnh về máy: ${saveUri.fsPath}`);
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

  /**
   * Loads an image file from path into a new session and immediately triggers an AI operation
   */
  public async loadFileAndExecute(filePath: string, operation?: OperationType, operationLabel?: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      vscode.window.showErrorMessage(`Không tìm thấy file ảnh: ${filePath}`);
      return;
    }

    const cachedPath = await this.assetStorage.saveToCache(filePath);
    const webviewUri = this._view ? this.assetStorage.getWebviewUri(cachedPath, this._view.webview) : filePath;
    this.uriToPathMap.set(webviewUri, cachedPath);

    const title = path.basename(filePath);
    const session = this.sessionManager.createSession(webviewUri, title);
    this.broadcastSessionState();

    if (operation) {
      await this.executeOperation({
        nodeId: session.rootNodeId,
        operation,
        operationLabel: operationLabel || operation,
        factor: operation === 'upscale' ? 2 : undefined
      });
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

// ImageStudioPanel.ts - Dedicated Full-Screen Canvas Webview Panel (Editor Tab)
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { VisionService } from '../services/ai/VisionService';
import { CodeGenService } from '../services/ai/CodeGenService';
import { OCRService } from '../services/ai/OCRService';
import { ImageProcessor } from '../services/image/ImageProcessor';
import { SnippetService } from '../services/editor/SnippetService';
import { SecretManager } from '../services/security/SecretManager';
import { ConfigManager } from '../services/security/ConfigManager';
import { WorkspaceFSService } from '../services/storage/WorkspaceFSService';
import { WebviewToHostMessage, HostToWebviewMessage } from './WebviewMessageProtocol';
import { decodeImageInput } from '../utils/imageData';

export class ImageStudioPanel {
  public static currentPanel: ImageStudioPanel | undefined;
  public static readonly viewType = 'pixelPilot.imageStudioCanvas';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private visionService: VisionService;
  private codeGenService: CodeGenService;
  private ocrService: OCRService;
  private imageProcessor: ImageProcessor;
  private snippetService: SnippetService;
  private secretManager: SecretManager;
  private configManager: ConfigManager;
  private fsService: WorkspaceFSService;

  public static createOrShow(extensionUri: vscode.Uri, initialImageUri?: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If panel already exists, reveal it
    if (ImageStudioPanel.currentPanel) {
      ImageStudioPanel.currentPanel._panel.reveal(column);
      if (initialImageUri) {
        ImageStudioPanel.currentPanel.loadImage(initialImageUri);
      }
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      ImageStudioPanel.viewType,
      'AI Image Studio - Canvas',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          extensionUri,
          vscode.Uri.joinPath(extensionUri, 'src', 'webview'),
          vscode.Uri.joinPath(extensionUri, 'media'),
          ...(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map(f => f.uri) : [])
        ]
      }
    );

    ImageStudioPanel.currentPanel = new ImageStudioPanel(panel, extensionUri, initialImageUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, initialImageUri?: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this.visionService = VisionService.getInstance();
    this.codeGenService = CodeGenService.getInstance();
    this.ocrService = OCRService.getInstance();
    this.imageProcessor = ImageProcessor.getInstance();
    this.snippetService = SnippetService.getInstance();
    this.secretManager = SecretManager.getInstance();
    this.configManager = ConfigManager.getInstance();
    this.fsService = WorkspaceFSService.getInstance();

    // Set Webview HTML
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    // Listen to panel disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Setup bidirectional message passing
    this._setupMessageListener();

    if (initialImageUri) {
      setTimeout(() => this.loadImage(initialImageUri), 600);
    }
  }

  public async loadImage(imageUri: vscode.Uri) {
    try {
      const buffer = await this.fsService.readFile(imageUri);
      const ext = path.extname(imageUri.fsPath).replace('.', '') || 'png';
      const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;

      this.postMessage({
        command: 'SET_CURRENT_IMAGE',
        payload: {
          imageUri: dataUri,
          fileName: path.basename(imageUri.fsPath),
          filePath: imageUri.fsPath
        }
      });

      this._panel.webview.postMessage({
        type: 'sessionUpdated',
        session: {
          sessionId: 'canvas_session',
          title: path.basename(imageUri.fsPath),
          currentNodeId: 'root',
          nodes: {
            root: {
              nodeId: 'root',
              outputImageUri: dataUri,
              operation: 'original',
              operationLabel: 'Ảnh gốc'
            }
          },
          messages: []
        }
      });
    } catch (err: any) {
      vscode.window.showErrorMessage(`Không thể tải ảnh: ${err.message}`);
    }
  }

  private _setupMessageListener() {
    this._panel.webview.onDidReceiveMessage(
      async (message: WebviewToHostMessage) => {
        try {
          switch (message.command) {
            case 'STUDIO_READY':
            case 'webviewReady' as any: {
              const runwareKey = await this.secretManager.getApiKey();
              const llmKey = await this.secretManager.getLLMKey();
              const masked = await this.secretManager.getMaskedApiKey();
              this._panel.webview.postMessage({
                type: 'apiKeyStatus',
                hasApiKey: !!runwareKey,
                apiKeyMasked: masked
              });
              this._panel.webview.postMessage({
                type: 'llmKeyStatus',
                hasLlmKey: !!llmKey,
                provider: await this.secretManager.getLlmProvider(),
                llmKeyMasked: await this.secretManager.getMaskedLlmKey()
              });
              this.postMessage({
                command: 'INITIALIZE_STUDIO',
                payload: {
                  hasRunwareKey: !!runwareKey,
                  hasLLMKey: !!llmKey,
                  config: {
                    compressionFormat: this.configManager.getCompressionFormat(),
                    snippetFormat: this.configManager.getSnippetFormat(),
                    offlineMode: this.configManager.isOfflineMode()
                  }
                }
              });
              break;
            }

            case 'INPAINT_REQUEST': {
              const { imageUri, maskBase64, prompt } = message.payload;
              this.postMessage({ command: 'UPDATE_AI_PROGRESS', payload: { status: 'Đang thực hiện Inpaint diffusion...' } });
              
              const res = await this.visionService.inpaintImage(vscode.Uri.file(imageUri), maskBase64, prompt);
              this.postMessage({
                command: 'AI_ACTION_SUCCESS',
                payload: {
                  outputUri: res.outputUri.fsPath,
                  latencyMs: res.latencyMs,
                  model: res.model
                }
              });
              vscode.window.showInformationMessage(`✨ AI Inpaint hoàn tất! Đã lưu: ${path.basename(res.outputUri.fsPath)}`);
              break;
            }

            case 'IMAGE_TO_CODE_REQUEST': {
              const { imageUri, framework } = message.payload;
              this.postMessage({ command: 'UPDATE_AI_PROGRESS', payload: { status: 'Đang phân tích mockup và sinh code...' } });

              const decoded = decodeImageInput(imageUri);

              const result = await this.codeGenService.generateCodeFromImage({
                imageBuffer: decoded.buffer,
                imageMimeType: decoded.mimeType,
                framework: framework || this.configManager.getImageToCodeFramework()
              });

              await this.codeGenService.openInEditor(result.code, result.suggestedFileName);
              this.postMessage({ command: 'AI_ACTION_SUCCESS', payload: { code: result.code, framework: result.framework } });
              vscode.window.showInformationMessage(`✅ Đã sinh mã ${result.framework} từ ảnh và mở trong editor!`);
              break;
            }

            case 'OCR_REQUEST': {
              const { imageUri } = message.payload;
              this.postMessage({ command: 'UPDATE_AI_PROGRESS', payload: { status: 'Đang trích xuất chữ OCR...' } });

              const decoded = decodeImageInput(imageUri);

              const result = await this.ocrService.extractAndCopy(decoded.buffer, decoded.mimeType);
              this.postMessage({ command: 'AI_ACTION_SUCCESS', payload: { text: result.fullText } });
              break;
            }

            case 'INSERT_SNIPPET_REQUEST': {
              const { imageUri, format, altText } = message.payload;
              const success = await this.snippetService.insertIntoActiveEditor({
                imagePath: imageUri,
                altText,
                format
              });
              if (success) {
                this.postMessage({ command: 'INSERT_SNIPPET_SUCCESS' });
              }
              break;
            }

            case 'COMPRESS_IMAGE_REQUEST': {
              const { imageUri, format, quality } = message.payload;
              const inputUri = vscode.Uri.file(imageUri);
              const buffer = await this.fsService.readFile(inputUri);
              const compressed = await this.imageProcessor.processImage(buffer, { format, quality });
              const outUri = await this.fsService.getAvailableFileUri(inputUri, 'compressed', `.${format}`);
              await this.fsService.writeFile(outUri, compressed);

              vscode.window.showInformationMessage(`💾 Đã nén thành công (${(compressed.byteLength / 1024).toFixed(1)} KB): ${path.basename(outUri.fsPath)}`);
              break;
            }

            case 'APPLY_AI_ACTION': {
              const { action, imageUri, factor } = message.payload;
              this.postMessage({ command: 'UPDATE_AI_PROGRESS', payload: { status: `Đang thực hiện ${action}...` } });

              if (action === 'removeBackground') {
                const res = await this.visionService.removeBackground(vscode.Uri.file(imageUri));
                await this.loadImage(res.outputUri);
                this.postMessage({
                  command: 'AI_ACTION_SUCCESS',
                  payload: { outputUri: res.outputUri.fsPath, latencyMs: res.latencyMs, model: res.model }
                });
                vscode.window.showInformationMessage(`✨ Đã tách nền thành công! Đã lưu: ${path.basename(res.outputUri.fsPath)}`);
              } else if (action === 'upscale') {
                const res = await this.visionService.upscaleImage(vscode.Uri.file(imageUri), factor || 2);
                await this.loadImage(res.outputUri);
                this.postMessage({
                  command: 'AI_ACTION_SUCCESS',
                  payload: { outputUri: res.outputUri.fsPath, latencyMs: res.latencyMs, model: res.model }
                });
                vscode.window.showInformationMessage(`✨ Đã nâng độ phân giải ${factor || 2}x thành công!`);
              }
              break;
            }

            case 'TEXT_TO_IMAGE_REQUEST': {
              const { prompt, dimension } = message.payload;
              this.postMessage({ command: 'UPDATE_AI_PROGRESS', payload: { status: 'Đang sinh ảnh từ prompt...' } });
              const res = await this.visionService.textToImage(prompt, undefined, dimension);
              await this.loadImage(res.outputUri);
              this.postMessage({
                command: 'AI_ACTION_SUCCESS',
                payload: { outputUri: res.outputUri.fsPath, latencyMs: res.latencyMs, model: res.model }
              });
              vscode.window.showInformationMessage(`✨ Sinh ảnh thành công: ${path.basename(res.outputUri.fsPath)}`);
              break;
            }

            case 'REQUEST_IMAGE_LOAD': {
              const fileUris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: { 'Images': ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'avif'] },
                openLabel: 'Mở trong Canvas'
              });
              if (fileUris && fileUris[0]) {
                await this.loadImage(fileUris[0]);
              }
              break;
            }

            case 'EXPORT_IMAGE': {
              const { imageUri, defaultFileName } = message.payload;
              const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(defaultFileName || 'exported_image.png'),
                filters: { 'Images': ['png', 'webp', 'jpg', 'avif'] }
              });
              if (saveUri) {
                const buf = await this.fsService.readFile(vscode.Uri.file(imageUri));
                await this.fsService.writeFile(saveUri, buf);
                vscode.window.showInformationMessage(`💾 Đã xuất ảnh thành công: ${path.basename(saveUri.fsPath)}`);
              }
              break;
            }

            case 'OPEN_SETTINGS': {
              vscode.commands.executeCommand('workbench.action.openSettings', 'aiImageStudio');
              break;
            }

            case 'SHOW_TOAST': {
              vscode.window.showInformationMessage(message.payload?.text || '');
              break;
            }
          }
        } catch (err: any) {
          this.postMessage({ command: 'AI_ACTION_ERROR', payload: { error: err.message } });
          vscode.window.showErrorMessage(`Lỗi xử lý AI: ${err.message}`);
        }
      },
      null,
      this._disposables
    );
  }

  public postMessage(message: HostToWebviewMessage) {
    this._panel.webview.postMessage(message);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const webviewPath = path.join(this._extensionUri.fsPath, 'src', 'webview');
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

  public dispose() {
    ImageStudioPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }
}

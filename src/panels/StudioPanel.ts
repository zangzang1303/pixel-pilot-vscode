import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { InvokeApiService, GenerationOptions } from '../services/InvokeApiService';
import { FileSystemUtils } from '../utils/fileSystem';
import { SecretManager } from '../services/security/SecretManager';
import { ComfyUIAdapter } from '../services/ai/ComfyUIAdapter';
import { PixelPilotViewProvider } from '../providers/PixelPilotViewProvider';

/**
 * Manages the AI Image Studio Webview panel.
 */
export class StudioPanel {
  public static currentPanel: StudioPanel | undefined;
  public static readonly viewType = 'pixelPilot.studioPanel';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _invokeApi: InvokeApiService;
  private readonly _copilot: PixelPilotViewProvider;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, copilot: PixelPilotViewProvider, initialImageUri?: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If panel already exists, reveal it
    if (StudioPanel.currentPanel) {
      StudioPanel.currentPanel._panel.reveal(column);
      if (initialImageUri) {
        StudioPanel.currentPanel.sendInitialImage(initialImageUri);
      }
      return;
    }

    // Otherwise, create a new webview panel
    const panel = vscode.window.createWebviewPanel(
      StudioPanel.viewType,
      'Pixel Pilot - AI Studio',
      column || vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist'),
          vscode.Uri.joinPath(extensionUri, 'webview-ui', 'build'),
          vscode.Uri.joinPath(extensionUri, 'out'),
          vscode.Uri.joinPath(extensionUri, 'media')
        ]
      }
    );

    StudioPanel.currentPanel = new StudioPanel(panel, extensionUri, copilot);

    if (initialImageUri) {
      StudioPanel.currentPanel.sendInitialImage(initialImageUri);
    }
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, copilot: PixelPilotViewProvider) {
    StudioPanel.currentPanel = new StudioPanel(panel, extensionUri, copilot);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, copilot: PixelPilotViewProvider) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._invokeApi = new InvokeApiService();
    this._copilot = copilot;
    this._disposables.push(copilot.onDidUpdateSession(update => this.sendMessage(update)));
    this._disposables.push(copilot.onDidPostMessage(msg => this.sendMessage(msg)));

    // Set panel icon
    this._panel.iconPath = {
      light: vscode.Uri.joinPath(this._extensionUri, 'media', 'icon.svg'),
      dark: vscode.Uri.joinPath(this._extensionUri, 'media', 'icon.svg')
    };

    // Set webview HTML content
    this._update();

    // Listen to panel disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages sent from the React Webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        await this._handleMessage(message);
      },
      null,
      this._disposables
    );

    // Initial check and model load
    this._initBackendConnection();
  }

  private async _initBackendConnection() {
    try {
      const isOnline = await this._invokeApi.ping();
      this.sendMessage({
        command: 'pingResult',
        isOnline,
        serverUrl: this._invokeApi.getBaseUrl()
      });

      if (isOnline) {
        const models = await this._invokeApi.getModels();
        this.sendMessage({
          command: 'modelsLoaded',
          models
        });
      }

      // Broadcast API Key Status
      const apiKey = await SecretManager.getInstance().getApiKey();
      const masked = await SecretManager.getInstance().getMaskedApiKey();
      this.sendMessage({
        command: 'apiKeyStatus',
        type: 'apiKeyStatus',
        hasApiKey: !!apiKey,
        apiKeyMasked: masked
      });
    } catch (err: any) {
      this.sendMessage({
        command: 'pingResult',
        isOnline: false,
        serverUrl: this._invokeApi.getBaseUrl(),
        error: err.message
      });
    }
  }

  public sendMessage(message: any) {
    this._panel.webview.postMessage(message);
  }

  public async sendInitialImage(imageUri: vscode.Uri) {
    try {
      const fileData = await vscode.workspace.fs.readFile(imageUri);
      const base64 = Buffer.from(fileData).toString('base64');
      const ext = path.extname(imageUri.fsPath).replace('.', '').toLowerCase();
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
      const dataUrl = `data:${mime};base64,${base64}`;

      const cachedPath = await this._copilot.getAssetStorage().saveToCache(dataUrl);
      await this._copilot.handleStudioMessage({ command: 'imageLoaded', imageUri: cachedPath, fileName: path.basename(imageUri.fsPath) });

      this.sendMessage({
        command: 'setImage',
        dataUrl,
        filePath: imageUri.fsPath,
        fileName: path.basename(imageUri.fsPath)
      });
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to load image into studio: ${err.message}`);
    }
  }

  /**
   * Handle incoming messages from React Webview.
   */
  private async _handleMessage(message: any) {
    switch (message.command) {
      case 'ping': {
        const isOnline = await this._invokeApi.ping();
        const comfyOnline = await new ComfyUIAdapter().ping();
        this.sendMessage({
          command: 'pingResult',
          isOnline: isOnline || comfyOnline,
          isInvokeOnline: isOnline,
          isComfyOnline: comfyOnline,
          serverUrl: isOnline ? this._invokeApi.getBaseUrl() : (comfyOnline ? 'http://127.0.0.1:8188' : this._invokeApi.getBaseUrl())
        });

        const apiKey = await SecretManager.getInstance().getApiKey();
        const masked = await SecretManager.getInstance().getMaskedApiKey();
        this.sendMessage({
          command: 'apiKeyStatus',
          type: 'apiKeyStatus',
          hasApiKey: !!apiKey,
          apiKeyMasked: masked
        });
        break;
      }

      case 'getApiKeyStatus': {
        const apiKey = await SecretManager.getInstance().getApiKey();
        const masked = await SecretManager.getInstance().getMaskedApiKey();
        this.sendMessage({
          command: 'apiKeyStatus',
          type: 'apiKeyStatus',
          hasApiKey: !!apiKey,
          apiKeyMasked: masked
        });
        break;
      }

      case 'getModels': {
        try {
          const isOnline = await this._invokeApi.ping();
          if (!isOnline) {
            this.sendMessage({ command: 'modelsLoaded', models: [] });
            break;
          }
          const models = await this._invokeApi.getModels();
          this.sendMessage({ command: 'modelsLoaded', models });
        } catch {
          // InvokeAI is optional. Keep the Runware Copilot usable without a
          // disruptive toast when the local InvokeAI service is not running.
          this.sendMessage({ command: 'modelsLoaded', models: [] });
        }
        break;
      }

      case 'generate': {
        const { prompt, model, options } = message;
        if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4096) {
          vscode.window.showWarningMessage('Please provide a prompt for image generation.');
          return;
        }

        try {
          const target = this._copilot.captureGenerationTarget({ sessionId: message.sessionId, nodeId: message.nodeId });
          await this._copilot.requireCanvasWorkspaceTrust();
          this.sendMessage({ command: 'generationStarted' });

          const generated = await this._copilot.executeCanvasGeneration(
            prompt,
            model,
            options as GenerationOptions,
            (statusText, percentage) => {
              this.sendMessage({
                command: 'generationProgress',
                status: statusText,
                percentage
              });
            }
          );

          const completed = await this._copilot.finishCanvasGeneration(
            target, prompt, generated.result, generated.imageName, options
          );

          this.sendMessage({
            command: 'generationComplete',
            ...completed
          });

          const notificationMsg = completed.savedPath
            ? `Generated image saved to ${completed.savedPath}!`
            : 'Image generated in Pixel Pilot history.';
          vscode.window.showInformationMessage(notificationMsg);
        } catch (error: any) {
          this.sendMessage({
            command: 'generationError',
            message: error.message || 'Generation failed'
          });
          vscode.window.showErrorMessage(`Pixel Pilot: ${error.message || 'Image generation failed'}`);
        }
        break;
      }

      case 'upscale': {
        await this._copilot.handleStudioMessage(message);
        break;
      }

      case 'insertSnippet': {
        const { relativePath, altText } = message;
        if (relativePath) {
          await FileSystemUtils.autoInsertImageSnippet(relativePath, altText || 'Pixel Pilot Image');
        }
        break;
      }

      case 'openApiKeyPrompt': {
        await vscode.commands.executeCommand('pixelPilot.setApiKey');
        const apiKey = await SecretManager.getInstance().getApiKey();
        const masked = await SecretManager.getInstance().getMaskedApiKey();
        this.sendMessage({
          command: 'apiKeyStatus',
          type: 'apiKeyStatus',
          hasApiKey: !!apiKey,
          apiKeyMasked: masked
        });
        break;
      }

      case 'browseImage': {
        const fileUris = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { 'Images': ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'svg'] },
          openLabel: 'Mở ảnh vào Studio'
        });
        if (fileUris && fileUris[0]) {
          await this.sendInitialImage(fileUris[0]);
        }
        break;
      }

      case 'exportImage': {
        const { dataUrl } = message;
        if (!dataUrl) break;
        const saveUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(`pixel_pilot_export_${Date.now()}.png`),
          filters: { 'Images': ['png', 'jpg', 'webp'] }
        });
        if (saveUri) {
          const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          await vscode.workspace.fs.writeFile(saveUri, buffer);
          vscode.window.showInformationMessage(`💾 Đã lưu ảnh: ${path.basename(saveUri.fsPath)}`);
        }
        break;
      }

      // Keep the old message name as an alias, but execute through the shared host.
      case 'applyAction':
      case '__legacyApplyAction': {
        await this._copilot.handleStudioMessage({ ...message, command: 'applyAction' });
        break;
      }

      case 'chatMessage':
      case 'newSession':
      case 'switchSession':
      case 'renameSession':
      case 'deleteSession':
      case 'copilotRequest':
      case 'cancelRun':
      case 'confirmationResponse':
      case 'openApiKeyPrompt':
      case 'rollbackNode':
      case 'insertSnippet': {
        await this._copilot.handleStudioMessage(message);
        break;
      }

      case 'webviewReady': {
        this._copilot.publishSessionState();
        break;
      }

      case 'showError': {
        vscode.window.showErrorMessage(message.message || 'Unknown error');
        break;
      }

      case 'showInfo': {
        vscode.window.showInformationMessage(message.message || '');
        break;
      }

      default: {
        await this._copilot.handleStudioMessage(message);
        break;
      }
    }
  }

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist');
    const indexPath = path.join(distPath.fsPath, 'index.html');

    // If Vite singlefile or dist bundle exists, load it directly
    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf-8');

      // Replace asset references with webview URIs if any external files exist
      html = html.replace(/(src|href)="(\/|.\/)?assets\/([^"]+)"/g, (match, attr, slash, filename) => {
        const assetUri = webview.asWebviewUri(
          vscode.Uri.joinPath(distPath, 'assets', filename)
        );
        return `${attr}="${assetUri}"`;
      });

      const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: blob: https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; connect-src 'none';">`;
      html = html.replace('</head>', `${csp}</head>`);

      return html;
    }

    // Fallback development HTML if webview-ui has not been built yet
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pixel Pilot - AI Studio</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      padding: 30px;
      color: #cbd5e1;
      background: #0f172a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
      text-align: center;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 32px;
      max-width: 500px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    }
    h2 { color: #38bdf8; margin-top: 0; }
    p { line-height: 1.6; color: #94a3b8; }
    .btn {
      background: #38bdf8;
      color: #0f172a;
      font-weight: 600;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>Pixel Pilot - AI Studio</h2>
    <p>Loading React Studio UI... Please run <code>npm run build:webview</code> to generate the optimized frontend bundle.</p>
  </div>
</body>
</html>`;
  }

  public dispose() {
    StudioPanel.currentPanel = undefined;
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}

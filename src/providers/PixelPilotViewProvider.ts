// PixelPilotViewProvider.ts - Real Production View Provider connecting Webview to Runware SOTA Cloud Vision API
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SessionManager } from '../services/session/SessionManager';
import { SessionCommitService } from '../services/session/SessionCommitService';
import { CanvasActionCommitService, CanvasActionTarget } from '../services/session/CanvasActionCommitService';
import { GenerationCommitService, GenerationTarget } from '../services/session/GenerationCommitService';
import { CanvasGenerationExecutor } from '../services/copilot/CanvasGenerationExecutor';
import { ContextBuilder } from '../services/copilot/ContextBuilder';
import { CopilotOrchestrator } from '../services/copilot/CopilotOrchestrator';
import { RunLifecycleService } from '../services/copilot/RunLifecycleService';
import { WebviewBridge } from '../services/copilot/WebviewBridge';
import { splitSequentialPrompt } from '../services/copilot/SequentialPlan';
import { SafeTelemetry } from '../services/copilot/SafeTelemetry';
import { ConfirmationBroker } from '../services/copilot/ConfirmationBroker';
import { RunwareAdapter } from '../services/ai/RunwareAdapter';
import { IntentRouter } from '../services/ai/IntentRouter';
import { VisionAgentOrchestrator } from '../services/ai/VisionAgentOrchestrator';
import { OperationType, AIResult } from '../services/session/types';
import { SecretManager } from '../services/security/SecretManager';
import { PolicyService } from '../services/security/PolicyService';
import { AssetStorageService } from '../services/storage/AssetStorageService';
import { EnterpriseConfigManager } from '../services/config/EnterpriseConfigManager';
import { GenerationOptions, InvokeApiService, InvokeModel } from '../services/InvokeApiService';
import { ImageProcessor } from '../services/image/ImageProcessor';
import { CodeGenService } from '../services/ai/CodeGenService';
import { OCRService } from '../services/ai/OCRService';
import { FileSystemUtils } from '../utils/fileSystem';
import { ComfyUIAdapter } from '../services/ai/ComfyUIAdapter';
import { LocalChatService } from '../services/ai/LocalChatService';
import { ImageAnalysisService } from '../services/ai/ImageAnalysisService';
import sharp from 'sharp';
import { decodeImageInput, imageMimeType, validateImageBuffer } from '../utils/imageData';
import { parseRunRequest } from '../shared/protocol';

const VALID_UI_ACTIONS = new Set([
  'removeBackground', 'upscale', 'enhance', 'mask', 'canny', 'edgeDetection',
  'lineart', 'lineExtraction', 'depth', 'extend', 'caption', 'recolor',
  'styleTransfer', 'vectorize', 'inpaint', 'imageToCode', 'ocr', 'compress', 'exportIcons'
]);

export class PixelPilotViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'pixelPilot.sidebarView';
  private _view?: vscode.WebviewView;
  private sessionManager: SessionManager;
  private commitService: SessionCommitService;
  private canvasCommit: CanvasActionCommitService;
  private generationCommit: GenerationCommitService;
  private generationExecutor: CanvasGenerationExecutor;
  private contextBuilder = new ContextBuilder();
  private copilotOrchestrator = new CopilotOrchestrator();
  private runLifecycle = new RunLifecycleService();
  private readonly telemetry = new SafeTelemetry();
  private webviewBridge = new WebviewBridge();
  private runwareAdapter: RunwareAdapter;
  private secretManager: SecretManager;
  private readonly confirmationBroker = new ConfirmationBroker();
  private policy: PolicyService;
  private assetStorage: AssetStorageService;
  private configManager: EnterpriseConfigManager;
  private invokeApi: InvokeApiService;
  private context: vscode.ExtensionContext;
  private uriToPathMap: Map<string, string> = new Map();
  private readonly sessionStateEmitter = new vscode.EventEmitter<any>();
  public readonly onDidUpdateSession = this.sessionStateEmitter.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.policy = new PolicyService((provider, purpose) => this.requestWebviewConfirmation(provider, purpose));
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.sessionManager = new SessionManager(context.globalStorageUri.fsPath);
    this.secretManager = new SecretManager(context);
    this.assetStorage = new AssetStorageService(context);
    this.commitService = new SessionCommitService(this.sessionManager, this.assetStorage);
    this.canvasCommit = new CanvasActionCommitService(this.sessionManager, this.commitService);
    this.generationCommit = new GenerationCommitService(this.sessionManager, this.assetStorage);
    this.configManager = new EnterpriseConfigManager(workspaceRoot);
    this.runwareAdapter = new RunwareAdapter('', () => this.secretManager.getApiKey());
    this.invokeApi = new InvokeApiService();
    this.generationExecutor = new CanvasGenerationExecutor(this.invokeApi);

    // Warm the adapter, but never rely on this asynchronous preload alone.
    // A command can arrive before SecretStorage/.env has finished resolving.
    void this.refreshRunwareApiKey();
  }

  public getRunwareAdapter(): RunwareAdapter { return this.runwareAdapter; }
  public getSecretManager(): SecretManager { return this.secretManager; }
  public getAssetStorage(): AssetStorageService { return this.assetStorage; }
  public getReferencedArtifactPaths(): Set<string> { return this.sessionManager.getReferencedArtifactPaths(); }
  public getConfigManager(): EnterpriseConfigManager { return this.configManager; }
  /** Content-free run diagnostics for local troubleshooting; never sent to a webview. */
  public getRunTelemetry() { return this.telemetry.recent(); }

  public captureCanvasAction(expected?: Partial<CanvasActionTarget>): CanvasActionTarget {
    return this.canvasCommit.capture(expected);
  }

  public isCanvasTargetCurrent(target: CanvasActionTarget): boolean {
    const active = this.sessionManager.getActiveSession();
    return active?.sessionId === target.sessionId && active.currentNodeId === target.parentId;
  }

  public captureGenerationTarget(expected?: Partial<GenerationTarget>): GenerationTarget {
    return this.generationCommit.capture(expected);
  }

  public async executeCanvasGeneration(
    prompt: string,
    model?: string | InvokeModel,
    options?: GenerationOptions,
    onProgress?: (status: string, percentage?: number) => void
  ) {
    return this.generationExecutor.execute(prompt, model, options, onProgress);
  }

  public async finishCanvasGeneration(
    target: GenerationTarget,
    prompt: string,
    result: AIResult,
    imageName: string,
    params?: Record<string, unknown>
  ) {
    const session = await this.generationCommit.commit(target, prompt, result, params);
    const nodeId = session.rootNodeId;
    let savedPath: string | undefined;
    let snippetInserted = false;
    try {
      const source = decodeImageInput(result.outputImageUri!);
      const png = await sharp(source.buffer).png().toBuffer();
      const saved = await FileSystemUtils.saveImageToWorkspace(png, `pixel_pilot_${Date.now()}.png`);
      savedPath = saved.relativePath;
      this.sessionManager.setNodeExportPath(session.sessionId, nodeId, savedPath);
    } catch (error) {
      console.warn('[PixelPilot] Generated image was cached but workspace export failed:', error);
    }
    this.broadcastSessionState();
    if (savedPath && this.sessionManager.getActiveSession()?.sessionId === session.sessionId) {
      try {
        snippetInserted = await FileSystemUtils.autoInsertImageSnippet(savedPath, prompt.substring(0, 30));
      } catch (error) {
        console.warn('[PixelPilot] Generated image snippet insertion failed:', error);
      }
    }
    return {
      sessionId: session.sessionId, nodeId, imageName, savedPath, snippetInserted,
      dataUrl: this.assetStorage.getWebviewUri(session.nodes[nodeId].outputImageUri)
    };
  }

  public async requireCanvasWorkspaceTrust(): Promise<void> {
    await this.policy.requireTrustedWorkspace('Image editing');
  }

  public async requireCanvasCloudConsent(provider: string, purpose: string): Promise<void> {
    await this.policy.requireCloudConsent(provider, purpose);
  }

  public recordCanvasCaption(target: CanvasActionTarget, caption: string): void {
    this.canvasCommit.recordCaption(target, caption);
    this.broadcastSessionState();
  }

  /** Save the requested workspace export, then commit its validated preview to the pinned DAG parent. */
  public async saveCanvasAction(
    target: CanvasActionTarget,
    action: string,
    output: Buffer,
    fileName: string,
    options?: Record<string, unknown>,
    preview?: Buffer
  ) {
    const png = await sharp(preview || output).png().toBuffer();
    const exportBuffer = fileName.endsWith('.svg') ? output : png;
    if (fileName.endsWith('.svg')) validateImageBuffer(exportBuffer, 'image/svg+xml');
    const maskUri = typeof options?.maskDataUrl === 'string'
      ? await this.assetStorage.saveToCache(options.maskDataUrl)
      : undefined;
    const saved = await FileSystemUtils.saveImageToWorkspace(exportBuffer, fileName);
    const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
    const node = await this.canvasCommit.commit(target, action, dataUrl, {
      ...options,
      exportPath: saved.relativePath
    }, maskUri);
    this.broadcastSessionState();
    return { ...saved, dataUrl, sessionId: target.sessionId, nodeId: node.nodeId };
  }

  private requestWebviewConfirmation(provider: string, purpose: string): Promise<boolean | undefined> {
    if (!this._view) return Promise.resolve(undefined);
    return this.confirmationBroker.request(provider, purpose, (request) => {
      this.postToWebview({ type: 'confirmationRequested', confirmation: request });
    });
  }

  private async refreshRunwareApiKey(): Promise<boolean> {
    try {
      const key = await this.secretManager.getApiKey();
      if (key) {
        this.runwareAdapter.setApiKey(key);
      } else {
        // Re-read process/.env sources in case configuration changed after activation.
        this.runwareAdapter.updateApiKey();
      }
    } catch (error) {
      console.warn('[PixelPilot] Unable to refresh the Runware API key:', error);
      this.runwareAdapter.updateApiKey();
    }
    return Boolean(this.runwareAdapter.getApiKey());
  }

  /** The Studio panel and sidebar share one conversation, image history, and tool dispatcher. */
  public async handleStudioMessage(message: any): Promise<void> {
    await this.handleMessage(message);
  }

  public publishSessionState(): void {
    this.broadcastSessionState();
  }

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
    const cmd = message.command || message.type;
    switch (cmd) {
      case 'ping': {
        const [isOnline, comfyOnline] = await Promise.all([this.invokeApi.ping(), new ComfyUIAdapter().ping()]);
        this.postToWebview({
          command: 'pingResult',
          isOnline,
          comfyOnline,
          serverUrl: this.invokeApi.getServerUrl()
        });

        const apiKey = await this.secretManager.getApiKey();
        const masked = await this.secretManager.getMaskedApiKey();
        this.postToWebview({
          command: 'apiKeyStatus',
          type: 'apiKeyStatus',
          hasApiKey: !!apiKey,
          apiKeyMasked: masked
        });
        break;
      }

      case 'getApiKeyStatus': {
        const apiKey = await this.secretManager.getApiKey();
        const masked = await this.secretManager.getMaskedApiKey();
        this.postToWebview({
          command: 'apiKeyStatus',
          type: 'apiKeyStatus',
          hasApiKey: !!apiKey,
          apiKeyMasked: masked
        });
        break;
      }

      case 'getModels': {
        try {
          const models = await this.invokeApi.getModels();
          this.postToWebview({
            command: 'modelsLoaded',
            models
          });
        } catch {
          this.postToWebview({
            command: 'modelsLoaded',
            models: []
          });
        }
        break;
      }

      case 'generate': {
        const { prompt, model, options } = message;
        if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4096) {
          vscode.window.showWarningMessage('Vui lòng nhập prompt để sinh ảnh.');
          this.postToWebview({ command: 'generationError', message: 'Prompt rỗng' });
          break;
        }

        try {
          const target = this.captureGenerationTarget({ sessionId: message.sessionId, nodeId: message.nodeId });
          await this.requireCanvasWorkspaceTrust();
          this.postToWebview({ command: 'generationStarted' });
          const generated = await this.executeCanvasGeneration(prompt, model, options, (status, percentage) => {
            this.postToWebview({ command: 'generationProgress', status, percentage });
          });
          const completed = await this.finishCanvasGeneration(target, prompt, generated.result, generated.imageName, options);
          this.postToWebview({
            command: 'generationComplete',
            ...completed
          });

          vscode.window.showInformationMessage(`✨ Sinh ảnh thành công: ${completed.savedPath || 'Pixel Pilot history'}`);
        } catch (err: any) {
          this.postToWebview({ command: 'generationError', message: err.message });
          vscode.window.showErrorMessage(`Lỗi sinh ảnh: ${err.message}`);
        }
        break;
      }

      case 'upscale': {
        try {
          const { dataUrl, factor } = message;
          if (!dataUrl) {
            vscode.window.showWarningMessage('Chưa có ảnh để phóng to.');
            break;
          }

          const target = this.captureCanvasAction({ sessionId: message.sessionId, parentId: message.nodeId });
          await this.requireCanvasWorkspaceTrust();

          this.postToWebview({ command: 'upscaleStarted' });
          const buffer = decodeImageInput(dataUrl).buffer;
          const targetFactor = factor === 4 ? 4 : 2;
          const imageProc = ImageProcessor.getInstance();

          this.postToWebview({
            command: 'upscaleProgress',
            status: `Đang phóng to ${targetFactor}x (Lanczos3 Super-Resolution)...`,
            percentage: 50
          });

          const upscaledBuf = await imageProc.upscale(buffer, targetFactor);

          const savedResult = await this.saveCanvasAction(target, 'upscale',
            upscaledBuf,
            `pixel_pilot_upscaled_${targetFactor}x_${Date.now()}.png`,
            { factor: targetFactor }
          );

          if (this.isCanvasTargetCurrent({ sessionId: target.sessionId, parentId: savedResult.nodeId })) {
            await FileSystemUtils.autoInsertImageSnippet(savedResult.relativePath, `Upscaled ${targetFactor}x Image`);
          }

          this.postToWebview({
            command: 'upscaleComplete',
            dataUrl: savedResult.dataUrl,
            sessionId: savedResult.sessionId,
            nodeId: savedResult.nodeId,
            savedPath: savedResult.relativePath
          });

          vscode.window.showInformationMessage(`✨ Phóng to ${targetFactor}x thành công: ${savedResult.relativePath}`);
        } catch (err: any) {
          this.postToWebview({ command: 'upscaleError', message: err.message });
          vscode.window.showErrorMessage(`Upscale error: ${err.message}`);
        }
        break;
      }

      case 'applyAction': {
        const { action, dataUrl, options } = message;
        if (!dataUrl) {
          vscode.window.showWarningMessage('Chưa có ảnh trên Canvas để xử lý.');
          this.postToWebview({ command: 'actionError', message: 'No image' });
          break;
        }

        if (typeof action !== 'string' || !VALID_UI_ACTIONS.has(action)) {
          this.postToWebview({ command: 'actionError', message: 'Unsupported image action.' });
          break;
        }

        try {
          const target = this.captureCanvasAction({ sessionId: message.sessionId, parentId: message.nodeId });
          await this.policy.requireTrustedWorkspace('Image editing');
          this.postToWebview({ command: 'actionStarted', label: `Đang thực hiện ${action}...` });
          const decodedInput = decodeImageInput(dataUrl);
          const buffer = decodedInput.buffer;
          const imageProc = ImageProcessor.getInstance();

          if (action === 'removeBackground') {
            let outBuf: Buffer;
            const comfy = new ComfyUIAdapter();
            const comfyOnline = await comfy.ping();
            if (comfyOnline) {
              try {
                const res = await comfy.removeBackground(dataUrl);
                if (res.outputImageUri) {
                  const b64 = res.outputImageUri.replace(/^data:image\/\w+;base64,/, '');
                  outBuf = Buffer.from(b64, 'base64');
                } else {
                  outBuf = await imageProc.removeBackground(buffer);
                }
              } catch {
                outBuf = await imageProc.removeBackground(buffer);
              }
            } else {
              const runwareKey = await this.secretManager.getApiKey();
              if (runwareKey && runwareKey.trim().length > 10) {
                await this.policy.requireCloudConsent('Runware', 'Background removal');
                try {
                  const adapter = new RunwareAdapter(runwareKey, () => this.secretManager.getApiKey());
                  const res = await adapter.removeBackground(dataUrl);
                  if (res.outputImageUri) {
                    const b64 = res.outputImageUri.replace(/^data:image\/\w+;base64,/, '');
                    outBuf = Buffer.from(b64, 'base64');
                  } else {
                    outBuf = await imageProc.removeBackground(buffer);
                  }
                } catch {
                  outBuf = await imageProc.removeBackground(buffer);
                }
              } else {
                outBuf = await imageProc.removeBackground(buffer);
              }
            }

            const savedResult = await this.saveCanvasAction(target, action, outBuf, `pixel_pilot_cutout_${Date.now()}.png`, options);
            this.postToWebview({
              command: 'actionComplete',
              dataUrl: savedResult.dataUrl,
              sessionId: savedResult.sessionId,
              nodeId: savedResult.nodeId,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Tách nền thành công: ${savedResult.relativePath}`);
          } else if (action === 'upscale') {
            const factor = (options?.factor as 2 | 4) || 2;
            let outBuf: Buffer;
            const comfy = new ComfyUIAdapter();
            const comfyOnline = await comfy.ping();
            if (comfyOnline) {
              try {
                const res = await comfy.upscale(dataUrl, factor);
                if (res.outputImageUri) {
                  const b64 = res.outputImageUri.replace(/^data:image\/\w+;base64,/, '');
                  outBuf = Buffer.from(b64, 'base64');
                } else {
                  outBuf = await imageProc.upscale(buffer, factor);
                }
              } catch {
                outBuf = await imageProc.upscale(buffer, factor);
              }
            } else {
              const runwareKey = await this.secretManager.getApiKey();
              if (runwareKey && runwareKey.trim().length > 10) {
                await this.policy.requireCloudConsent('Runware', `Upscale ${factor}x`);
                try {
                  const adapter = new RunwareAdapter(runwareKey, () => this.secretManager.getApiKey());
                  const res = await adapter.upscale(dataUrl, factor);
                  if (res.outputImageUri) {
                    const b64 = res.outputImageUri.replace(/^data:image\/\w+;base64,/, '');
                    outBuf = Buffer.from(b64, 'base64');
                  } else {
                    outBuf = await imageProc.upscale(buffer, factor);
                  }
                } catch {
                  outBuf = await imageProc.upscale(buffer, factor);
                }
              } else {
                outBuf = await imageProc.upscale(buffer, factor);
              }
            }
            const savedResult = await this.saveCanvasAction(target, action, outBuf, `pixel_pilot_upscale_${factor}x_${Date.now()}.png`, options);
            this.postToWebview({
              command: 'actionComplete',
              dataUrl: savedResult.dataUrl,
              sessionId: savedResult.sessionId,
              nodeId: savedResult.nodeId,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Phóng to ${factor}x thành công: ${savedResult.relativePath}`);
          } else if (action === 'enhance') {
            const type = options?.type || 'clarity';
            let outBuf: Buffer;
            const runwareKey = await this.secretManager.getApiKey();
            if (runwareKey && runwareKey.trim().length > 10) {
              await this.policy.requireCloudConsent('Runware', `Enhance ${type}`);
              try {
                const adapter = new RunwareAdapter(runwareKey, () => this.secretManager.getApiKey());
                const res = await adapter.enhanceImage(dataUrl, type);
                if (res.outputImageUri) {
                  const b64 = res.outputImageUri.replace(/^data:image\/\w+;base64,/, '');
                  outBuf = Buffer.from(b64, 'base64');
                } else {
                  outBuf = await imageProc.enhance(buffer, type);
                }
              } catch {
                outBuf = await imageProc.enhance(buffer, type);
              }
            } else {
              outBuf = await imageProc.enhance(buffer, type);
            }
            const savedResult = await this.saveCanvasAction(target, action, outBuf, `pixel_pilot_enhanced_${Date.now()}.png`, options);
            this.postToWebview({
              command: 'actionComplete',
              dataUrl: savedResult.dataUrl,
              sessionId: savedResult.sessionId,
              nodeId: savedResult.nodeId,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Khử mờ & Làm nét HDR thành công: ${savedResult.relativePath}`);
          } else if (action === 'mask') {
            const maskResult = await new ComfyUIAdapter().extractMask(dataUrl);
            const outBuf = maskResult.outputImageUri
              ? Buffer.from(maskResult.outputImageUri.replace(/^data:image\/\w+;base64,/, ''), 'base64')
              : await imageProc.extractMask(buffer);
            const savedResult = await this.saveCanvasAction(target, action, outBuf, `pixel_pilot_mask_${Date.now()}.png`, options);
            this.postToWebview({
              command: 'actionComplete',
              dataUrl: savedResult.dataUrl,
              sessionId: savedResult.sessionId,
              nodeId: savedResult.nodeId,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Trích xuất Mask thành công: ${savedResult.relativePath}`);
          } else if (action === 'canny' || action === 'edgeDetection') {
            const cannyResult = await new ComfyUIAdapter().detectEdges(dataUrl, 'canny');
            const outBuf = cannyResult.outputImageUri
              ? Buffer.from(cannyResult.outputImageUri.replace(/^data:image\/\w+;base64,/, ''), 'base64')
              : await imageProc.detectEdges(buffer, 'canny');
            const savedResult = await this.saveCanvasAction(target, action, outBuf, `pixel_pilot_canny_${Date.now()}.png`, options);
            this.postToWebview({
              command: 'actionComplete',
              dataUrl: savedResult.dataUrl,
              sessionId: savedResult.sessionId,
              nodeId: savedResult.nodeId,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Dò biên Canny thành công: ${savedResult.relativePath}`);
          } else if (action === 'lineart' || action === 'lineExtraction') {
            const outBuf = await imageProc.detectEdges(buffer, 'lineart');
            const savedResult = await this.saveCanvasAction(target, action, outBuf, `pixel_pilot_lineart_${Date.now()}.png`, options);
            this.postToWebview({
              command: 'actionComplete',
              dataUrl: savedResult.dataUrl,
              sessionId: savedResult.sessionId,
              nodeId: savedResult.nodeId,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Trích xuất Lineart thành công: ${savedResult.relativePath}`);
          } else if (action === 'depth') {
            const depthResult = await new ComfyUIAdapter().detectEdges(dataUrl, 'depth');
            const outBuf = depthResult.outputImageUri
              ? Buffer.from(depthResult.outputImageUri.replace(/^data:image\/\w+;base64,/, ''), 'base64')
              : await imageProc.detectEdges(buffer, 'depth');
            const savedResult = await this.saveCanvasAction(target, action, outBuf, `pixel_pilot_depth_${Date.now()}.png`, options);
            this.postToWebview({
              command: 'actionComplete',
              dataUrl: savedResult.dataUrl,
              sessionId: savedResult.sessionId,
              nodeId: savedResult.nodeId,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Tạo bản đồ độ sâu 3D thành công: ${savedResult.relativePath}`);
          } else if (action === 'extend') {
            const direction = options?.direction || 'all';
            const extendResult = await new ComfyUIAdapter().extendCanvas(dataUrl, direction);
            const outBuf = extendResult.outputImageUri
              ? Buffer.from(extendResult.outputImageUri.replace(/^data:image\/\w+;base64,/, ''), 'base64')
              : await imageProc.extendCanvas(buffer, direction);
            const savedResult = await this.saveCanvasAction(target, action, outBuf, `pixel_pilot_extended_${Date.now()}.png`, options);
            this.postToWebview({
              command: 'actionComplete',
              dataUrl: savedResult.dataUrl,
              sessionId: savedResult.sessionId,
              nodeId: savedResult.nodeId,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Mở rộng khung hình thành công: ${savedResult.relativePath}`);
          } else if (action === 'caption') {
            const captionResult = await new ComfyUIAdapter().generateCaption(dataUrl);
            const captionText = captionResult.textResult || await imageProc.generateCaption(buffer);
            vscode.window.showInformationMessage(`📝 AI Caption: ${captionText}`);
            this.recordCanvasCaption(target, captionText);
            this.postToWebview({ command: 'actionComplete', sessionId: target.sessionId, nodeId: target.parentId });
          } else if (action === 'recolor') {
            const subject = options?.subject || 'hair';
            const color = options?.color || 'cyan';
            const outBuf = await imageProc.recolor(buffer, subject, color);
            const savedResult = await this.saveCanvasAction(target, action, outBuf, `pixel_pilot_recolor_${Date.now()}.png`, options);
            this.postToWebview({
              command: 'actionComplete',
              dataUrl: savedResult.dataUrl,
              sessionId: savedResult.sessionId,
              nodeId: savedResult.nodeId,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Đổi màu ${subject} (${color}) thành công: ${savedResult.relativePath}`);
          } else if (action === 'styleTransfer') {
            const style = options?.style || 'anime';
            const styleResult = await new ComfyUIAdapter().styleTransfer(dataUrl, style);
            const outBuf = styleResult.outputImageUri
              ? Buffer.from(styleResult.outputImageUri.replace(/^data:image\/\w+;base64,/, ''), 'base64')
              : await imageProc.styleTransfer(buffer, style);
            const savedResult = await this.saveCanvasAction(target, action, outBuf, `pixel_pilot_style_${style}_${Date.now()}.png`, options);
            this.postToWebview({
              command: 'actionComplete',
              dataUrl: savedResult.dataUrl,
              sessionId: savedResult.sessionId,
              nodeId: savedResult.nodeId,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Chuyển phong cách ${style} thành công: ${savedResult.relativePath}`);
          } else if (action === 'vectorize') {
            const { svgString, previewBuffer } = await imageProc.vectorize(buffer);
            const savedResult = await this.saveCanvasAction(target, action, Buffer.from(svgString, 'utf-8'), `pixel_pilot_vector_${Date.now()}.svg`, options, previewBuffer);
            this.postToWebview({
              command: 'actionComplete',
              dataUrl: savedResult.dataUrl,
              sessionId: savedResult.sessionId,
              nodeId: savedResult.nodeId,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Vector hóa SVG thành công: ${savedResult.relativePath}`);
          } else if (action === 'inpaint') {
            let maskBuffer: Buffer | undefined;
            if (options?.maskDataUrl) {
              const maskB64 = options.maskDataUrl.replace(/^data:image\/\w+;base64,/, '');
              maskBuffer = Buffer.from(maskB64, 'base64');
            }
            const inpaintResult = maskBuffer
              ? await new ComfyUIAdapter().inpaint(dataUrl, options.maskDataUrl, options?.prompt || 'natural detailed restoration matching the surrounding image')
              : undefined;
            const outBuf = inpaintResult?.outputImageUri
              ? Buffer.from(inpaintResult.outputImageUri.replace(/^data:image\/\w+;base64,/, ''), 'base64')
              : await imageProc.inpaint(buffer, maskBuffer);
            const savedResult = await this.saveCanvasAction(target, action, outBuf, `pixel_pilot_inpaint_${Date.now()}.png`, options);
            this.postToWebview({
              command: 'actionComplete',
              dataUrl: savedResult.dataUrl,
              sessionId: savedResult.sessionId,
              nodeId: savedResult.nodeId,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Inpaint & Tẩy vật thể hoàn tất: ${savedResult.relativePath}`);
          } else if (action === 'imageToCode') {
            const codeGen = CodeGenService.getInstance();
            const codeRes = await codeGen.generateCodeFromImage({
              imageBuffer: buffer,
              imageMimeType: decodedInput.mimeType,
              framework: options?.framework || 'react-tailwind'
            });
            await codeGen.openInEditor(codeRes.code, codeRes.suggestedFileName);
            this.postToWebview({ command: 'actionComplete' });
            vscode.window.showInformationMessage(`✅ Đã sinh mã ${codeRes.framework} và mở trong editor!`);
          } else if (action === 'ocr') {
            const ocrService = OCRService.getInstance();
            const ocrRes = await ocrService.extractText(buffer, decodedInput.mimeType);
            if (ocrRes.fullText) {
              await vscode.env.clipboard.writeText(ocrRes.fullText);
            }
            this.postToWebview({ command: 'actionComplete' });
            if (ocrRes.fullText) vscode.window.showInformationMessage(`📋 OCR: Đã copy ${ocrRes.fullText.length} ký tự vào Clipboard.`);
            else vscode.window.showInformationMessage('OCR không phát hiện văn bản trong ảnh.');
          } else if (action === 'compress') {
            const comp = await imageProc.processImage(buffer, { format: options?.format || 'webp', quality: options?.quality || 85 });
            const savedResult = await FileSystemUtils.saveImageToWorkspace(comp, `pixel_pilot_compressed_${Date.now()}.${options?.format || 'webp'}`);
            this.postToWebview({ command: 'actionComplete', savedPath: savedResult.relativePath, sessionId: target.sessionId, nodeId: target.parentId });
            vscode.window.showInformationMessage(`💾 Đã nén thành công (${(comp.byteLength / 1024).toFixed(1)} KB): ${savedResult.relativePath}`);
          } else if (action === 'exportIcons') {
            const icons = await imageProc.exportIcons(buffer);
            const bundle = await FileSystemUtils.saveIconBundle(icons, `pixel_pilot_icons_${Date.now()}`);
            this.postToWebview({ command: 'actionComplete', savedPath: bundle.relativeDirectory, sessionId: target.sessionId, nodeId: target.parentId });
            const choice = await vscode.window.showInformationMessage(
              `✅ Đã xuất ${bundle.files.length} icon PNG vào ${bundle.relativeDirectory}`,
              'Mở thư mục'
            );
            if (choice === 'Mở thư mục') {
              await vscode.commands.executeCommand('revealFileInOS', bundle.directory);
            }
          } else {
            throw new Error(`Unsupported image action: ${action}`);
          }
        } catch (err: any) {
          this.postToWebview({ command: 'actionError', message: err.message });
          vscode.window.showErrorMessage(`Lỗi ${action}: ${err.message}`);
        }
        break;
      }

      case 'openApiKeyPrompt': {
        await vscode.commands.executeCommand('pixelPilot.setApiKey');
        const apiKey = await this.secretManager.getApiKey();
        const masked = await this.secretManager.getMaskedApiKey();
        this.postToWebview({
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
          const filePath = fileUris[0].fsPath;
          const buf = await fs.promises.readFile(filePath);
          const ext = path.extname(filePath).slice(1) || 'png';
          const mime = imageMimeType(ext);
          const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
          const cachedPath = await this.assetStorage.saveToCache(buf, ext);
          this.sessionManager.createSession(cachedPath, path.basename(filePath));
          this.broadcastSessionState();
          this.postToWebview({
            command: 'setImage',
            dataUrl,
            filePath: path.basename(filePath)
          });
        }
        break;
      }

      case 'exportImage': {
        const { dataUrl } = message;
        if (!dataUrl) break;
        let decoded;
        try {
          decoded = decodeImageInput(dataUrl);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.postToWebview({ command: 'actionError', message: errorMessage });
          vscode.window.showErrorMessage(errorMessage);
          break;
        }
        const saveUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(`pixel_pilot_export_${Date.now()}.${decoded.extension}`),
          filters: { 'Images': ['png', 'jpg', 'jpeg', 'webp', 'avif', 'svg'] }
        });
        if (saveUri) {
          const requestedExt = path.extname(saveUri.fsPath).slice(1).toLowerCase();
          let output = decoded.buffer;
          if (requestedExt === 'svg' && decoded.extension !== 'svg') {
            const errorMessage = 'Không thể đổi ảnh raster thành SVG chỉ bằng cách đổi đuôi tệp. Hãy dùng công cụ Vectorize trước.';
            this.postToWebview({ command: 'actionError', message: errorMessage });
            vscode.window.showErrorMessage(errorMessage);
            break;
          }
          if (requestedExt && requestedExt !== decoded.extension && requestedExt !== 'svg') {
            const pipeline = sharp(decoded.buffer);
            if (requestedExt === 'jpg' || requestedExt === 'jpeg') output = await pipeline.jpeg({ quality: 92 }).toBuffer();
            else if (requestedExt === 'webp') output = await pipeline.webp({ quality: 90 }).toBuffer();
            else if (requestedExt === 'avif') output = await pipeline.avif({ quality: 70 }).toBuffer();
            else if (requestedExt === 'png') output = await pipeline.png().toBuffer();
          }
          await vscode.workspace.fs.writeFile(saveUri, output);
          vscode.window.showInformationMessage(`💾 Đã lưu ảnh: ${path.basename(saveUri.fsPath)}`);
          this.postToWebview({ command: 'AI_ACTION_SUCCESS', message: `Đã lưu ${path.basename(saveUri.fsPath)}` });
        }
        break;
      }

      case 'insertSnippet': {
        const { relativePath, altText } = message;
        if (relativePath) {
          await FileSystemUtils.autoInsertImageSnippet(relativePath, altText || 'Pixel Pilot Image');
        }
        break;
      }

      case 'chatMessage': {
        await this.handleCopilotChat(message);
        break;
      }

      case 'confirmationResponse': {
        const token = typeof message.token === 'string' ? message.token : '';
        this.confirmationBroker.settle(token, message.approved === true);
        break;
      }

      case 'copilotRequest': {
        const parsed = parseRunRequest(message.request);
        if (!parsed.ok) {
          this.postToWebview({ type: 'copilotError', requestId: parsed.error.requestId, error: parsed.error });
          break;
        }
        const request = parsed.value;
          const startedAt = Date.now();
          this.telemetry.record({ requestId: request.requestId, command: request.command, outcome: 'started', toolName: request.toolName });
        try {
          if (request.command === 'chat' || request.command === 'analyze') {
            await this.webviewBridge.dispatch(request.requestId, async () => {
              this.runLifecycle.start(request.requestId);
              try {
                await this.handleCopilotChat({ text: request.text, sessionId: request.sessionId });
              } finally {
                this.runLifecycle.finish(request.requestId);
              }
            });
            this.postToWebview({ type: 'copilotCompleted', requestId: request.requestId });
            this.telemetry.record({ requestId: request.requestId, command: request.command, outcome: 'succeeded', latencyMs: Date.now() - startedAt });
            break;
          }
          if (request.command === 'tool') {
            const call = this.copilotOrchestrator.validateTool(request.toolName, request.args || {});
            const session = request.sessionId ? this.sessionManager.getSession(request.sessionId) : this.sessionManager.getActiveSession();
            if (!session) throw new Error('No active image session.');
            const nodeId = request.nodeId || session.currentNodeId;
            const node = session.nodes[nodeId];
            if (!node) throw new Error('Pinned context node no longer exists.');
            const image = node.outputImageUri || node.inputImageUri;
            if (!image && call.intent.operation !== 'generate') throw new Error('An image is required for this tool.');
            const completedNodeId = await this.webviewBridge.dispatch(request.requestId, async () => {
              this.runLifecycle.start(request.requestId);
              try {
                return await this.runCopilotOperation(session.sessionId, image, call.intent.operation, call.intent, call.intent.promptText || '', request.requestId, nodeId);
              } finally {
                this.runLifecycle.finish(request.requestId);
              }
            });
            this.postToWebview({ type: 'copilotCompleted', requestId: request.requestId, nodeId: completedNodeId });
            this.telemetry.record({ requestId: request.requestId, command: request.command, outcome: 'succeeded', toolName: request.toolName, latencyMs: Date.now() - startedAt });
            break;
          }
          if (this.runLifecycle.cancel(request.targetRequestId!)) {
            this.postToWebview({ type: 'copilotCancelled', requestId: request.targetRequestId });
            this.telemetry.record({ requestId: request.targetRequestId!, command: 'cancel', outcome: 'cancelled', latencyMs: Date.now() - startedAt });
          } else {
            this.postToWebview({ type: 'copilotError', requestId: request.requestId, error: { code: 'cancelled', message: 'No cancellable run is active for this request.' } });
          }
        } catch (error: any) {
          if (/^Operation cancelled\.?$/i.test(error?.message || '')) {
            this.postToWebview({ type: 'copilotCancelled', requestId: request.requestId });
            this.telemetry.record({ requestId: request.requestId, command: request.command, outcome: 'cancelled', toolName: request.toolName, latencyMs: Date.now() - startedAt });
          } else {
            this.postToWebview({ type: 'copilotError', requestId: request.requestId, error: { code: 'invalid_message', message: error?.message || String(error) } });
            this.telemetry.record({ requestId: request.requestId, command: request.command, outcome: 'failed', toolName: request.toolName, latencyMs: Date.now() - startedAt });
          }
        }
        break;
      }

      case 'webviewReady': {
        let activeSession = this.sessionManager.getActiveSession();
        if (!activeSession) {
          activeSession = this.sessionManager.createSession('', 'Cuộc trò chuyện mới');
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

        const llmKey = await this.secretManager.getLlmApiKey();
        const llmProvider = await this.secretManager.getLlmProvider();
        const llmMasked = await this.secretManager.getMaskedLlmKey();
        this.postToWebview({
          type: 'llmKeyStatus',
          hasLlmKey: !!llmKey,
          provider: llmProvider,
          llmKeyMasked: llmMasked
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

      case 'saveLlmApiKey': {
        const key = (message.apiKey || '').trim();
        const provider = message.provider || 'gemini';
        if (key) {
          await this.secretManager.setLlmProvider(provider);
          await this.secretManager.setLlmApiKey(key);
          const masked = await this.secretManager.getMaskedLlmKey();
          vscode.window.showInformationMessage(`🧠 Pixel Pilot: Đã kết nối Bộ Não AI LLM (${provider.toUpperCase()}) thành công!`);
          this.postToWebview({
            type: 'llmKeyStatus',
            hasLlmKey: true,
            provider,
            llmKeyMasked: masked
          });
        }
        break;
      }

      case 'clearLlmApiKey': {
        await this.secretManager.deleteLlmApiKey();
        await this.secretManager.setLlmProvider('local');
        this.postToWebview({
          type: 'llmKeyStatus',
          hasLlmKey: false,
          provider: 'local',
          llmKeyMasked: ''
        });
        vscode.window.showInformationMessage('🧠 Pixel Pilot: Đã chuyển sang Bộ Não AI Local Cognitive Reasoner.');
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

          this.sessionManager.createSession(cachedPath, path.basename(filePath));
          this.broadcastSessionState();
          vscode.window.showInformationMessage(`✨ Pixel Pilot: Đã nạp ảnh "${path.basename(filePath)}"`);
        }
        break;
      }

      case 'imageLoaded': {
        if (!this.assetStorage.isStoredArtifact(message.imageUri)) {
          this.postToWebview({ command: 'actionError', message: 'Image artifact is not owned by Pixel Pilot.' });
          break;
        }
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

      case 'TEXT_TO_IMAGE_REQUEST': {
        const { prompt, dimension } = message.payload || {};
        if (!prompt || !prompt.trim()) {
          vscode.window.showWarningMessage('Vui lòng nhập mô tả ảnh cần tạo!');
          this.postToWebview({ command: 'AI_ACTION_ERROR', payload: { error: 'Chưa có prompt' } });
          break;
        }

        try {
          this.postToWebview({
            command: 'UPDATE_AI_PROGRESS',
            payload: { status: 'Đang kết nối InvokeAI cục bộ để sinh ảnh...' }
          });

          let width = 512;
          let height = 512;
          if (dimension) {
            const parts = dimension.split('x');
            if (parts.length === 2) {
              width = parseInt(parts[0], 10) || 512;
              height = parseInt(parts[1], 10) || 512;
            }
          }

          const result = await this.invokeApi.generateTextToImage(
            prompt.trim(),
            'Dreamshaper 8',
            { width, height },
            (statusText) => {
              this.postToWebview({
                command: 'UPDATE_AI_PROGRESS',
                payload: { status: statusText }
              });
            }
          );

          const cachedPath = await this.assetStorage.saveToCache(result.dataUrl, 'png');
          const webviewUri = this._view ? this.assetStorage.getWebviewUri(cachedPath, this._view.webview) : cachedPath;
          this.uriToPathMap.set(webviewUri, cachedPath);

          const title = `Gen: ${prompt.trim().substring(0, 24)}`;
          this.sessionManager.createSession(cachedPath, title);
          this.broadcastSessionState();

          this.postToWebview({
            command: 'AI_ACTION_SUCCESS',
            payload: {
              outputUri: webviewUri,
              model: 'InvokeAI (Dreamshaper 8)',
              latencyMs: 7200
            }
          });
          vscode.window.showInformationMessage(`✨ Sinh ảnh thành công: ${path.basename(cachedPath)}`);
        } catch (err: any) {
          this.postToWebview({
            command: 'AI_ACTION_ERROR',
            payload: { error: err.message || 'Lỗi sinh ảnh InvokeAI' }
          });
          vscode.window.showErrorMessage(`Lỗi sinh ảnh InvokeAI: ${err.message}`);
        }
        break;
      }

      case 'INPAINT_REQUEST': {
        const { imageUri, maskBase64, prompt } = message.payload || {};
        try {
          if (!this.runwareAdapter.getApiKey()) {
            this.postToWebview({
              command: 'AI_ACTION_ERROR',
              payload: {
                error: 'Chức năng Inpaint yêu cầu Runware API Key. Vui lòng bấm bánh răng ⚙️ ở góc phải để nhập Runware Key, hoặc dùng nút "Sinh ảnh mới" để tạo ảnh bằng InvokeAI.'
              }
            });
            vscode.window.showWarningMessage('Chức năng Inpaint yêu cầu Runware API Key (bấm ⚙️ để nhập key). Để tạo ảnh từ prompt, hãy bấm nút "Sinh ảnh mới"!');
            break;
          }

          this.postToWebview({
            command: 'UPDATE_AI_PROGRESS',
            payload: { status: 'Đang thực hiện AI Inpaint & Generative Fill...' }
          });
          const realInput = this.uriToPathMap.get(imageUri) || imageUri;
          await this.policy.requireCloudConsent('Runware', 'Generative inpaint');
          const res = await this.runwareAdapter.inpaint(realInput, maskBase64 || '', prompt || 'high quality restoration');
          if (res.success && res.outputImageUri) {
            const cachedPath = await this.assetStorage.saveToCache(res.outputImageUri, 'png');
            const displayUri = this._view ? this.assetStorage.getWebviewUri(cachedPath, this._view.webview) : cachedPath;
            this.uriToPathMap.set(displayUri, cachedPath);
            this.postToWebview({
              command: 'AI_ACTION_SUCCESS',
              payload: { outputUri: displayUri, model: res.metrics.model, latencyMs: res.metrics.latencyMs }
            });
          } else {
            this.postToWebview({
              command: 'AI_ACTION_ERROR',
              payload: { error: res.error || 'Inpaint không thành công' }
            });
          }
        } catch (err: any) {
          this.postToWebview({
            command: 'AI_ACTION_ERROR',
            payload: { error: err.message || 'Lỗi Inpaint' }
          });
        }
        break;
      }

      case 'REQUEST_IMAGE_LOAD': {
        const fileUris = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { Images: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'avif'] },
          openLabel: 'Mở ảnh'
        });
        if (fileUris && fileUris[0]) {
          const cachedPath = await this.assetStorage.saveToCache(fileUris[0].fsPath);
          const webviewUri = this._view ? this.assetStorage.getWebviewUri(cachedPath, this._view.webview) : cachedPath;
          this.uriToPathMap.set(webviewUri, cachedPath);
          this.sessionManager.createSession(cachedPath, path.basename(fileUris[0].fsPath));
          this.broadcastSessionState();
          this.postToWebview({
            command: 'SET_CURRENT_IMAGE',
            payload: { imageUri: webviewUri, fileName: path.basename(fileUris[0].fsPath) }
          });
        }
        break;
      }

      case 'EXPORT_IMAGE': {
        const { imageUri, defaultFileName } = message.payload || {};
        const realPath = this.uriToPathMap.get(imageUri) || imageUri;
        const saveUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(defaultFileName || 'exported_image.png')
        });
        if (saveUri && fs.existsSync(realPath)) {
          await fs.promises.copyFile(realPath, saveUri.fsPath);
          vscode.window.showInformationMessage(`💾 Đã lưu ảnh: ${path.basename(saveUri.fsPath)}`);
        }
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
  private async handleCopilotChat(message: any): Promise<void> {
    const text = String(message.text || '').trim();
    if (!text) return;
    let session = typeof message.sessionId === 'string'
      ? this.sessionManager.getSession(message.sessionId)
      : this.sessionManager.getActiveSession();
    if (typeof message.sessionId === 'string' && !session) {
      throw new Error('The requested chat session no longer exists.');
    }
    if (!session) session = this.sessionManager.createSession('', 'Cuộc trò chuyện mới');
    const sessionId = session.sessionId;
    const suppliedImage = typeof message.currentImage === 'string' && message.currentImage.startsWith('data:image/') ? message.currentImage : '';
    if (suppliedImage) {
      const cachedImage = await this.assetStorage.saveToCache(suppliedImage);
      this.sessionManager.attachImage(sessionId, cachedImage);
    }
    const nodeId = session.currentNodeId;
    this.sessionManager.addMessage(sessionId, { sender: 'user', text, nodeId });
    if (session.title === 'Cuộc trò chuyện mới' || session.title === 'Phiên làm việc mới') {
      this.sessionManager.renameSession(sessionId, text.slice(0, 48));
    }
    this.broadcastSessionState();

    const reply = (answer: string) => {
      this.sessionManager.addMessage(sessionId, { sender: 'assistant', text: answer, nodeId: this.sessionManager.getSession(sessionId)?.currentNodeId || nodeId, replyType: 'chat' });
      this.broadcastSessionState();
    };

    try {
      const current = this.sessionManager.getSession(sessionId)!;
      const storedImage = current.nodes[current.currentNodeId]?.outputImageUri || '';
      const image = suppliedImage || (storedImage ? this.assetStorage.getWebviewUri(storedImage) : '');
      const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
      const suggestionMatch = normalized.match(/^(?:\/apply\s+|ap dung (?:goi y )?|lam (?:goi y )?|chon (?:goi y )?)([1-3])\s*$/);
      const lastAdvice = [...current.messages].reverse().find(item => item.suggestions?.length && item.nodeId === current.currentNodeId);
      const chosen = suggestionMatch ? lastAdvice?.suggestions?.[Number(suggestionMatch[1]) - 1] : undefined;
      if (suggestionMatch && !chosen) {
        reply('Gợi ý này không còn áp dụng cho ảnh hiện tại. Hãy phân tích lại ảnh rồi chọn gợi ý.');
        return;
      }
      if (chosen) {
        await this.runCopilotOperation(sessionId, image, chosen.intent.operation, chosen.intent, text, undefined, nodeId);
        return;
      }
      if (/^(?:\/analyze|\/analyse)\b|phan tich|danh gia|nhan xet|nen (?:chinh|sua|lam) gi|can (?:chinh|sua) gi|goi y (?:chinh|sua)|tu van (?:chinh|sua)|anh nay (?:the nao|dep khong)|analy[sz]e (?:this |the )?image|what should i (?:edit|fix)/.test(normalized)) {
        if (!image) {
          reply('Hãy mở một ảnh bằng nút “Mở ảnh”, rồi mình sẽ phân tích và đề xuất cách chỉnh sửa.');
          return;
        }
        const analysis = await ImageAnalysisService.analyze(image);
        this.sessionManager.addMessage(sessionId, {
          sender: 'assistant', text: ImageAnalysisService.format(analysis),
          nodeId: current.currentNodeId, replyType: 'chat', suggestions: analysis.suggestions
        });
        this.broadcastSessionState();
        return;
      }
      const intent = this.getCopilotIntent(text, normalized);
      const sequentialSteps = splitSequentialPrompt(text);
      if (sequentialSteps.length > 1) {
        const intents = sequentialSteps.map((step) => this.getCopilotIntent(step, step.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')));
        if (intents.some((candidate) => !candidate)) {
          reply('Mình chỉ có thể chạy nhiều bước khi mỗi bước là một lệnh chỉnh ảnh rõ ràng. Hãy tách rõ từng thao tác.');
          return;
        }
        if (intents.some((candidate) => candidate.operation === 'caption' || candidate.operation === 'inpaint')) {
          reply('Caption và Inpaint cần kết quả hoặc mask riêng, nên không thể nằm trong chuỗi tự động này. Hãy chạy chúng thành yêu cầu riêng.');
          return;
        }
        if (!image && intents.some((candidate) => candidate.operation !== 'generate')) {
          reply('Hãy mở một ảnh trước khi chạy chuỗi chỉnh sửa này.');
          return;
        }
        await this.runSequentialCopilotPlan(sessionId, image, nodeId, intents as any[], text);
        return;
      }
      if (!intent) {
        if (/ban (la ai|lam duoc gi)|co the (lam|giup) gi|huong dan|cach dung|^help\??$/.test(normalized)) {
          reply('Mình là Pixel Pilot Copilot. Bạn có thể hỏi về ảnh đang mở hoặc ra lệnh: “tạo ảnh a cat in a garden”, “tách nền”, “phóng to 2x”, “đổi áo sang xanh”, “tạo Depth”, “mở rộng ảnh”, “chuyển sang anime”, “xuất SVG”. Mỗi kết quả ảnh được lưu trong phiên chat để mở lại hoặc tiếp tục chỉnh sửa.');
          return;
        }
        const aboutImage = Boolean(image) && /anh (nay|do|hien tai)|trong anh|nhin thay|what.*(image|picture)|mau sac|bo cuc|do sang/.test(normalized);
        if (aboutImage) {
          const visualContext = ImageAnalysisService.context(await ImageAnalysisService.analyze(image));
          let answer: string | null = null;
          try { answer = await LocalChatService.reply(text, current.messages.slice(0, -1), visualContext); } catch (error) {
            console.warn('[PixelPilot] Local image chat unavailable:', error);
          }
          reply(answer || visualContext);
          return;
        }
        const llmKey = await this.secretManager.getLlmApiKey();
        if (llmKey) {
          const provider = await this.secretManager.getLlmProvider();
          if (provider !== 'local' && provider !== 'ollama') {
            await this.policy.requireCloudConsent(provider, 'Cloud planning');
          }
          const context = this.contextBuilder.build(current, current.currentNodeId);
          const decision = await this.copilotOrchestrator.plan(text, context, { apiKey: llmKey, provider });
          if (decision.type === 'chat' || !decision.intent) {
            reply(decision.replyText || 'Bạn có thể mô tả cụ thể điều muốn chỉnh trên ảnh.');
            return;
          }
          if (!image && decision.intent.operation !== 'generate') {
            reply('Hãy mở một ảnh bằng nút “Mở ảnh”, rồi gửi lại yêu cầu chỉnh sửa.');
            return;
          }
          await this.runCopilotOperation(sessionId, image, decision.intent.operation, decision.intent, text, undefined, nodeId);
          return;
        }
        let localAnswer: string | null = null;
        try { localAnswer = await LocalChatService.reply(text, current.messages.slice(0, -1)); } catch (error) {
          console.warn('[PixelPilot] Local chat unavailable:', error);
        }
        reply(localAnswer || 'Mình có thể phân tích ảnh và đề xuất chỉnh sửa, hoặc thực hiện tách nền, phóng to, đổi màu, tạo Canny, Lineart, Depth, Mask, mở rộng ảnh và xuất SVG.');
        return;
      }

      if (!image && intent.operation !== 'generate') {
        reply('Hãy mở một ảnh bằng nút “Mở ảnh”, rồi gửi lại yêu cầu chỉnh sửa.');
        return;
      }
      await this.runCopilotOperation(sessionId, image, intent.operation, intent, text, undefined, nodeId);
    } catch (error: any) {
      reply(`Không thực hiện được yêu cầu: ${error?.message || String(error)}`);
    }
  }

  /** Execute an explicit, bounded plan as a pinned DAG branch. */
  private async runSequentialCopilotPlan(
    sessionId: string,
    initialImage: string,
    initialNodeId: string,
    intents: any[],
    originalPrompt: string
  ): Promise<void> {
    let image = initialImage;
    let parentId = initialNodeId;
    for (const intent of intents) {
      const committedNodeId = await this.runCopilotOperation(
        sessionId,
        image,
        intent.operation,
        intent,
        intent.promptText || originalPrompt,
        undefined,
        parentId
      );
      if (!committedNodeId) throw new Error(`Step “${intent.label || intent.operation}” did not produce an image.`);
      const session = this.sessionManager.getSession(sessionId);
      const node = session?.nodes[committedNodeId];
      if (!node?.outputImageUri) throw new Error('A plan step completed without a durable image artifact.');
      parentId = committedNodeId;
      image = node.outputImageUri;
    }
  }

  private getCopilotIntent(text: string, normalized: string): any | null {
    if (/\?$/.test(normalized) && /la gi|nhu the nao|tai sao|cach |lam sao|co nen|how|why|should/.test(normalized)) return null;
    if (/^\/generate\b|^\/imagine\b|tao (mot )?anh|ve (mot )?buc anh|sinh anh|generate (an? )?image/.test(normalized)) return { operation: 'generate', label: 'Sinh ảnh mới', promptText: text.replace(/^\/(generate|imagine)\s*/i, '').trim() };
    if (/^\/(remove-bg|nobg|tach-nen|replace-bg|bg|doi-nen|upscale|upscale-4x|canny|lineart|mask|caption|alt|extend|outpaint|anime|pixar|pixel|cyberpunk|sketch|style|vectorize|svg|hdr|enhance|vintage|inpaint)/.test(normalized)) {
      return IntentRouter.parsePrompt(text);
    }
    if (/doi nen|thay nen|ghep nen|doi phong nen|thay phong nen|replace (the )?background/.test(normalized)) {
      return { operation: 'replace_bg', label: 'Đổi nền', promptText: text.replace(/^.*?(?:nen|background)\s*(?:thanh|sang|bang|to)?\s*/i, '').trim() || text };
    }
    if (/tach nen|xoa nen|remove (the )?(background|bg)/.test(normalized)) return { operation: 'remove_background', label: 'Tách nền' };
    if (/phong to|upscale|tang do phan giai/.test(normalized)) return { operation: 'upscale', factor: /4x|4k/.test(normalized) ? 4 : 2, label: 'Phóng to ảnh' };
    if (/doi mau|nhuom|chuyen mau/.test(normalized) && /toc|ao|quan|vay|trang phuc|hair|shirt|clothes/.test(normalized)) {
      const color = /cyan|xanh da troi/.test(normalized) ? 'cyan' : /xanh la|green/.test(normalized) ? 'green' : /xanh|blue/.test(normalized) ? 'blue' : /do|red/.test(normalized) ? 'red' : /vang|yellow/.test(normalized) ? 'yellow' : /tim|purple/.test(normalized) ? 'purple' : /hong|pink/.test(normalized) ? 'pink' : /trang|white/.test(normalized) ? 'white' : /den|black/.test(normalized) ? 'black' : 'cyan';
      return { operation: 'recolor', label: 'Đổi màu chọn lọc', colorTarget: /toc|hair/.test(normalized) ? 'hair' : 'clothes', targetColor: color };
    }
    if (/canny|do bien|duong vien|edge detection/.test(normalized)) return { operation: 'canny', label: 'Dò biên Canny' };
    if (/lineart|line art|net ve/.test(normalized)) return { operation: 'lineart', label: 'Nét vẽ Lineart' };
    if (/do sau|depth|^\/depth/.test(normalized)) return { operation: 'preprocess', preprocessor: 'depth', label: 'Độ sâu 3D' };
    if (/tao mask|tach mask|mat na|segmentation/.test(normalized)) return { operation: 'mask', label: 'Mặt nạ AI' };
    if (/caption|alt.text|mo ta anh|anh nay co gi/.test(normalized)) return { operation: 'caption', label: 'Mô tả ảnh' };
    if (/mo rong|noi rong|outpaint|extend/.test(normalized)) return { operation: 'extend', label: 'Mở rộng khung', direction: /ngang|hai ben|horizontal/.test(normalized) ? 'horizontal' : /doc|tren duoi|vertical/.test(normalized) ? 'vertical' : 'all', promptText: text };
    if (/phong cach|anime|cyberpunk|pixel art|sketch|hoat hinh/.test(normalized)) return { operation: 'style_transfer', label: 'Chuyển phong cách', style: /cyberpunk/.test(normalized) ? 'cyberpunk' : /pixel/.test(normalized) ? 'pixel' : /sketch|but chi/.test(normalized) ? 'sketch' : /3d|pixar/.test(normalized) ? 'pixar' : 'anime' };
    if (/vector|svg/.test(normalized)) return { operation: 'vectorize', label: 'Xuất SVG' };
    if (/lam net|khu mo|tang sang|hdr|vintage/.test(normalized)) return { operation: 'enhance', label: 'Cải thiện ảnh', enhanceType: /hdr|tang sang/.test(normalized) ? 'hdr' : /vintage/.test(normalized) ? 'vintage' : 'clarity' };
    if (/inpaint|xoa vat|xoa doi tuong|to lai vung/.test(normalized)) return { operation: 'inpaint', label: 'Inpaint' };
    return null;
  }

  private async runCopilotOperation(sessionId: string, image: string, operation: OperationType, intent: any, prompt: string, requestId?: string, pinnedNodeId?: string): Promise<string | undefined> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) throw new Error('The target session no longer exists.');
    const parentId = pinnedNodeId || session.currentNodeId;
    if (!session.nodes[parentId]) throw new Error('Pinned context node no longer exists.');
    const adapter = new ComfyUIAdapter();
    const input = operation === 'generate' ? Buffer.alloc(0) : decodeImageInput(this.uriToPathMap.get(image) || image).buffer;
    let result: AIResult;
    const localResult = (buffer: Buffer, model: string): AIResult => ({ success: true, outputImageUri: `data:image/png;base64,${buffer.toString('base64')}`, metrics: { model, latencyMs: 0, costUsd: 0 } });
    switch (operation) {
      case 'generate': result = await adapter.generateImage(intent.promptText || prompt); break;
      case 'remove_background': result = await adapter.removeBackground(image); break;
      case 'replace_bg': result = await adapter.replaceBackground(image, intent.promptText || prompt); break;
      case 'upscale': result = await adapter.upscale(image, intent.factor === 4 ? 4 : 2); break;
      case 'mask': result = await adapter.extractMask(image); break;
      case 'canny': result = await adapter.detectEdges(image, 'canny'); break;
      case 'lineart': result = await adapter.detectEdges(image, 'lineart'); break;
      case 'preprocess': result = await adapter.detectEdges(image, 'depth'); break;
      case 'caption': result = await adapter.generateCaption(image); break;
      case 'extend': result = await adapter.extendCanvas(image, intent.direction || 'all', intent.promptText); break;
      case 'style_transfer': result = await adapter.styleTransfer(image, intent.style || 'anime'); break;
      case 'recolor': result = localResult(await ImageProcessor.getInstance().recolor(input, intent.colorTarget || 'hair', intent.targetColor || 'cyan'), 'Local recolor'); break;
      case 'enhance': result = localResult(await ImageProcessor.getInstance().enhance(input, intent.enhanceType || 'clarity'), 'Local enhance'); break;
      case 'vectorize': result = await adapter.vectorize(image); break;
      case 'inpaint':
        if (requestId) throw new Error('Inpaint requires a painted mask in the Canvas.');
        this.sessionManager.addMessage(sessionId, { sender: 'assistant', text: 'Để Inpaint, chọn Brush trên canvas, tô vùng cần sửa rồi nhấn Inpaint. Vùng tô là phần sẽ được tạo lại.', nodeId: parentId });
        this.broadcastSessionState();
        return;
      default:
        if (requestId) throw new Error(`The ${operation} tool is not available in Copilot.`);
        this.sessionManager.addMessage(sessionId, { sender: 'assistant', text: `Thao tác “${intent.label || operation}” hiện chưa được nối vào Copilot.`, nodeId: parentId });
        this.broadcastSessionState();
        return;
    }
    if (!result.success) throw new Error(result.error || 'Công cụ xử lý ảnh thất bại');
    if (requestId) this.runLifecycle.throwIfCancelled(requestId);
    if (operation === 'caption') {
      this.sessionManager.addMessage(sessionId, { sender: 'assistant', text: result.textResult || 'Chưa tạo được mô tả ảnh.', nodeId: parentId });
      this.broadcastSessionState();
      return;
    }
    if (!result.outputImageUri) throw new Error('Công cụ không trả về ảnh');
    const committedNode = await this.commitService.commitImageResult({
      sessionId,
      parentId,
      operation,
      intent,
      prompt,
      result
    });
    if (operation === 'vectorize' && result.textResult) {
      const svgPath = await this.assetStorage.saveToCache(Buffer.from(result.textResult), 'svg');
      this.sessionManager.addMessage(sessionId, { sender: 'assistant', text: `Đã lưu SVG: ${svgPath}`, nodeId: committedNode.nodeId });
    }
    this.broadcastSessionState();
    return committedNode.nodeId;
  }

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

    // 2. Vision Agent Orchestrator (Powered by LLM Brain):
    const parentNode = session.nodes[session.currentNodeId];
    const inputImg = parentNode?.outputImageUri || parentNode?.inputImageUri;

    const llmApiKey = await this.secretManager.getLlmApiKey();
    const llmProvider = await this.secretManager.getLlmProvider();

    if (llmApiKey && llmProvider !== 'local' && llmProvider !== 'ollama') {
      await this.policy.requireCloudConsent(llmProvider, 'Cloud planning');
    }

    const decision = await this.copilotOrchestrator.plan(
      promptText,
      this.contextBuilder.build(session, session.currentNodeId),
      {
        apiKey: llmApiKey,
        provider: llmProvider
      }
    );

    // If decision is conversational chat (greetings, answers, inquiries, advice):
    if (decision.type === 'chat' || !decision.intent) {
      this.sessionManager.addMessage(session.sessionId, {
        sender: 'assistant',
        text: decision.replyText || decision.thought,
        thought: decision.thought,
        replyType: 'chat',
        nodeId: session.currentNodeId
      });
      this.broadcastSessionState();
      this.postToWebview({ type: 'operationCompleted', operation: 'chat' });
      return;
    }

    const intent = decision.intent;

    // Send AI Agent Thinking into session chat stream so the user sees the reasoning
    this.sessionManager.addMessage(session.sessionId, {
      sender: 'assistant',
      text: `🧠 **[Bộ Não AI Agent - ${decision.llmModelUsed || 'Cognitive Brain'}]**\n${decision.thought}\n\n*Công cụ thực thi:* \`${decision.toolName}\``,
      thought: decision.thought,
      replyType: 'tool_call',
      toolName: decision.toolName,
      nodeId: session.currentNodeId
    });
    this.broadcastSessionState();

    // 3. Dispatch operation to REAL Runware API or Smart Client GPU
    await this.executeOperation({
      nodeId: session.currentNodeId,
      operation: intent.operation,
      operationLabel: intent.label,
      factor: intent.factor,
      prompt: intent.promptText || promptText,
      mask: message.mask || '',
      preprocessor: intent.preprocessor,
      style: intent.style,
      enhanceType: intent.enhanceType,
      colorTarget: intent.colorTarget,
      targetColor: intent.targetColor
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

    // Resolve credentials at dispatch time. This prevents an early chat command
    // from being permanently routed to the limited offline processor.
    await this.refreshRunwareApiKey();

    const forwardToClient = (cutoutUri?: string, isCutout?: boolean) => {
      this.postToWebview({
        type: 'requestClientOperation',
        operation: op,
        operationLabel: message.operationLabel || op,
        nodeId: parentNode.nodeId,
        inputImageUri: inputImg,
        cutoutUri,
        isCutout: !!isCutout,
        factor: message.factor,
        prompt: message.prompt,
        colorTarget: message.colorTarget,
        targetColor: message.targetColor,
        style: message.style,
        enhanceType: message.enhanceType,
        mask: message.mask
      });
    };

    // Client-side GPU Canvas Operations (instant execution & zero cloud cost)
    if (op === 'white_bg' || op === 'avatar' || op === 'icons' || op === 'export_webp' || op === 'recolor') {
      forwardToClient();
      return;
    }

    // Change background color: try SOTA BiRefNet cutout first if cloud key exists, else smart client segmentation
    if (op === 'change_bg_color') {
      if (this.runwareAdapter.getApiKey()) {
        try {
          await this.policy.requireCloudConsent('Runware', 'Background removal');
          const bgRes = await this.runwareAdapter.removeBackground(realInput);
          if (bgRes.success && bgRes.outputImageUri) {
            forwardToClient(bgRes.outputImageUri, true);
            return;
          }
        } catch (e) {
          console.warn('[PixelPilot] Cloud removeBackground failed, using smart local segmentation:', e);
        }
      }
      forwardToClient();
      return;
    }

    // If Cloud API Key is missing, automatically execute via Local ImageProcessor Engine
    if (!this.runwareAdapter.getApiKey()) {
      try {
        let inputBuffer: Buffer;
        if (realInput.startsWith('data:image')) {
          const b64 = realInput.replace(/^data:image\/\w+;base64,/, '');
          inputBuffer = Buffer.from(b64, 'base64');
        } else if (fs.existsSync(realInput)) {
          inputBuffer = await fs.promises.readFile(realInput);
        } else {
          forwardToClient();
          return;
        }

        const imageProc = ImageProcessor.getInstance();
        let outBuffer: Buffer | null = null;
        let ext = 'png';
        let textResult: string | undefined;

        const opStr = String(message.operation || '');
        if (opStr === 'remove_background') {
          outBuffer = await imageProc.removeBackground(inputBuffer);
        } else if (opStr === 'upscale') {
          outBuffer = await imageProc.upscale(inputBuffer, message.factor || 2);
        } else if (opStr === 'enhance') {
          outBuffer = await imageProc.enhance(inputBuffer, message.enhanceType || 'clarity');
        } else if (opStr === 'recolor' || opStr === 'color_grade') {
          outBuffer = await imageProc.recolor(inputBuffer, message.colorTarget || 'hair', message.targetColor || 'cyan');
        } else if (opStr === 'style_transfer') {
          outBuffer = await imageProc.styleTransfer(inputBuffer, message.style || 'anime');
        } else if (opStr === 'vectorize') {
          const vRes = await imageProc.vectorize(inputBuffer);
          outBuffer = vRes.previewBuffer;
          textResult = vRes.svgString;
          ext = 'svg';
        } else if (opStr === 'inpaint') {
          let maskBuf: Buffer | undefined;
          if (message.mask) {
            const mB64 = message.mask.replace(/^data:image\/\w+;base64,/, '');
            maskBuf = Buffer.from(mB64, 'base64');
          }
          outBuffer = await imageProc.inpaint(inputBuffer, maskBuf);
        }

        if (outBuffer) {
          const cachedPath = await this.assetStorage.saveToCache(
            ext === 'svg' && textResult ? Buffer.from(textResult, 'utf-8') : outBuffer,
            ext
          );
          const displayUri = this._view ? this.assetStorage.getWebviewUri(cachedPath, this._view.webview) : cachedPath;
          this.uriToPathMap.set(displayUri, cachedPath);

          await this.commitService.commitImageResult({
            sessionId: session.sessionId, parentId: parentNode.nodeId, operation: op,
            intent: { label: message.operationLabel || op },
            result: {
              success: true, outputImageUri: cachedPath, textResult,
              metrics: { model: 'Local Sharp / ImageProcessor Engine', latencyMs: 35, costUsd: 0 }
            }
          });
          this.broadcastSessionState();

          this.postToWebview({
            command: 'actionComplete',
            dataUrl: `data:image/${ext === 'svg' ? 'svg+xml' : 'png'};base64,${outBuffer.toString('base64')}`,
            savedPath: path.basename(cachedPath)
          });
          this.postToWebview({
            command: 'AI_ACTION_SUCCESS',
            payload: { outputUri: displayUri, model: 'Local Engine', latencyMs: 35 }
          });
          return;
        }
      } catch (err: any) {
        console.warn('[PixelPilot] Local execution fallback failed:', err);
        this.sessionManager.addMessage(session.sessionId, {
          sender: 'assistant',
          text: `⚠️ Không thể hoàn tất "${message.operationLabel || op}" bằng engine offline. ${err.message || String(err)}`,
          nodeId: parentNode.nodeId,
          operation: op,
          replyType: 'tool_call',
          toolName: op
        });
        this.broadcastSessionState();
        this.postToWebview({ command: 'actionError', message: err.message || String(err) });
        return;
      }
      // The operation is not implemented by the local engine; let the legacy
      // canvas dispatcher handle only those explicitly supported client tools.
      forwardToClient();
      return;
    }

    let res: AIResult;

    try {
      await this.policy.requireCloudConsent('Runware', message.operationLabel || op);
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

      // If cloud removal is unavailable, only accept ComfyUI when a real RMBG
      // node handled the request. The adapter's color fallback is intentionally
      // not treated as an AI cutout for complex images.
      if (!res.success && op === 'remove_background') {
        try {
          const comfyResult = await new ComfyUIAdapter().removeBackground(realInput);
          if (comfyResult.success && comfyResult.outputImageUri && /^ComfyUI\b/.test(comfyResult.metrics.model)) {
            res = comfyResult;
          }
        } catch {}
      }

      if (res.success) {
        if (op === 'caption') {
          if (!res.textResult) throw new Error('Caption provider returned no text.');
          this.sessionManager.addMessage(session.sessionId, { sender: 'assistant', text: res.textResult, nodeId: parentNode.nodeId });
          this.broadcastSessionState();
          this.postToWebview({ type: 'operationCompleted', operation: op });
          return;
        }
        if (!res.outputImageUri) throw new Error('Provider returned no image artifact.');
        const committed = await this.commitService.commitImageResult({
          sessionId: session.sessionId, parentId: parentNode.nodeId, operation: op,
          intent: { label: message.operationLabel || op }, prompt: message.prompt,
          maskUri: res.maskUri, result: res
        });
        if (this._view) {
          const displayUri = this.assetStorage.getWebviewUri(committed.outputImageUri, this._view.webview);
          this.uriToPathMap.set(displayUri, committed.outputImageUri);
        }
        this.broadcastSessionState();
        this.postToWebview({ type: 'operationCompleted', operation: op });
      } else {
        const errorText = res.error || 'Không có engine AI phù hợp đang hoạt động.';
        console.warn(`[PixelPilot] AI operation unavailable: ${errorText}`);
        this.sessionManager.addMessage(session.sessionId, {
          sender: 'assistant',
          text: `⚠️ Chưa thể hoàn tất "${message.operationLabel || op}". ${errorText}\n\nHãy kiểm tra API key/credit hoặc khởi động ComfyUI với node BiRefNet/RMBG rồi thử lại.`,
          nodeId: parentNode.nodeId,
          operation: op,
          replyType: 'tool_call',
          toolName: op
        });
        this.broadcastSessionState();
        this.postToWebview({ command: 'actionError', message: errorText });
      }
    } catch (err: any) {
      const errorText = err?.message || String(err);
      console.warn(`[PixelPilot] AI operation failed: ${errorText}`);
      this.postToWebview({ command: 'actionError', message: errorText });
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

    // Session files live outside the webview sandbox. Convert operation outputs
    // to data URIs before broadcasting so every chat result can be rendered in
    // both the sidebar and the full Studio panel.
    const webviewSession = activeSession ? {
      sessionId: activeSession.sessionId,
      title: activeSession.title,
      createdAt: activeSession.createdAt,
      updatedAt: activeSession.updatedAt,
      rootNodeId: activeSession.rootNodeId,
      currentNodeId: activeSession.currentNodeId,
      messages: activeSession.messages.map((message) => ({
        ...message,
        outputImageUri: message.outputImageUri
          ? this.assetStorage.getWebviewUri(message.outputImageUri)
          : undefined
      }))
    } : null;
    const history = activeSession ? Object.values(activeSession.nodes).map((node) => ({
      nodeId: node.nodeId,
      parentId: node.parentId,
      operation: node.operation,
      operationLabel: node.operationLabel,
      timestamp: node.timestamp,
      outputImageUri: this.assetStorage.getWebviewUri(node.outputImageUri || node.inputImageUri || '')
    })) : [];

    const update = {
      type: 'sessionUpdated',
      session: webviewSession,
      sessionsList: allSessions,
      history,
      savedPath: activeSession?.nodes[activeSession.currentNodeId]?.params?.exportPath || undefined,
      currentImage: activeSession ? this.assetStorage.getWebviewUri(activeSession.nodes[activeSession.currentNodeId]?.outputImageUri || '') : ''
    };
    this.postToWebview(update);
    this.sessionStateEmitter.fire(update);
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

  public postToWebview(message: any): void {
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

  /**
   * Creates a brand new empty session and broadcasts to webview
   */
  public createNewSession(title: string = 'Phiên làm việc mới'): void {
    this.sessionManager.createSession('', title);
    this.broadcastSessionState();
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'dist');
    const indexPath = path.join(distPath.fsPath, 'index.html');

    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf-8');
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

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { InvokeApiService, GenerationOptions } from '../services/InvokeApiService';
import { FileSystemUtils } from '../utils/fileSystem';
import { VisionService } from '../services/ai/VisionService';
import { CodeGenService } from '../services/ai/CodeGenService';
import { OCRService } from '../services/ai/OCRService';
import { ImageProcessor } from '../services/image/ImageProcessor';
import { SecretManager } from '../services/security/SecretManager';
import { RunwareAdapter } from '../services/ai/RunwareAdapter';
import { ComfyUIAdapter } from '../services/ai/ComfyUIAdapter';
import { PixelPilotViewProvider } from '../providers/PixelPilotViewProvider';
import { decodeImageInput } from '../utils/imageData';

const VALID_UI_ACTIONS = new Set([
  'removeBackground', 'upscale', 'enhance', 'mask', 'canny', 'edgeDetection',
  'lineart', 'lineExtraction', 'depth', 'extend', 'caption', 'recolor',
  'styleTransfer', 'vectorize', 'inpaint', 'imageToCode', 'ocr', 'compress', 'exportIcons'
]);

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
        if (!prompt || !prompt.trim()) {
          vscode.window.showWarningMessage('Please provide a prompt for image generation.');
          return;
        }

        try {
          this.sendMessage({ command: 'generationStarted' });

          const result = await this._invokeApi.generateTextToImage(
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

          // Save image to workspace assets/ directory
          let savedResult;
          try {
            savedResult = await FileSystemUtils.saveImageToWorkspace(
              result.imageBuffer,
              `pixel_pilot_${Date.now()}.png`
            );
          } catch (fsErr: any) {
            console.warn('Workspace save warning:', fsErr.message);
          }

          // Auto-insert snippet into active editor if available
          let snippetInserted = false;
          if (savedResult) {
            snippetInserted = await FileSystemUtils.autoInsertImageSnippet(
              savedResult.relativePath,
              prompt.substring(0, 30)
            );
          }

          this.sendMessage({
            command: 'generationComplete',
            dataUrl: result.dataUrl,
            imageName: result.imageName,
            savedPath: savedResult?.relativePath,
            snippetInserted
          });

          const notificationMsg = savedResult
            ? `Generated image saved to ${savedResult.relativePath}!`
            : 'Image generated successfully!';
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
        try {
          const { dataUrl, factor } = message;
          if (!dataUrl) {
            vscode.window.showWarningMessage('No image data provided for upscaling.');
            return;
          }

          this.sendMessage({ command: 'upscaleStarted' });

          const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const targetFactor = factor || 2;
          const imageProc = ImageProcessor.getInstance();

          this.sendMessage({
            command: 'upscaleProgress',
            status: `Đang phóng to ${targetFactor}x (Lanczos3 Super-Resolution)...`,
            percentage: 50
          });

          const upscaledBuf = await imageProc.upscale(buffer, targetFactor);

          const savedResult = await FileSystemUtils.saveImageToWorkspace(
            upscaledBuf,
            `pixel_pilot_upscaled_${targetFactor}x_${Date.now()}.png`
          );

          await FileSystemUtils.autoInsertImageSnippet(savedResult.relativePath, `Upscaled ${targetFactor}x Image`);

          const outDataUrl = `data:image/png;base64,${upscaledBuf.toString('base64')}`;

          this.sendMessage({
            command: 'upscaleComplete',
            dataUrl: outDataUrl,
            savedPath: savedResult.relativePath
          });

          vscode.window.showInformationMessage(`✨ Phóng to ${targetFactor}x thành công: ${savedResult.relativePath}`);
        } catch (err: any) {
          this.sendMessage({ command: 'upscaleError', message: err.message });
          vscode.window.showErrorMessage(`Upscale error: ${err.message}`);
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

      case 'applyAction': {
        const { action, dataUrl, options } = message;
        if (!dataUrl) {
          vscode.window.showWarningMessage('Chưa có ảnh trên Canvas để xử lý.');
          this.sendMessage({ command: 'actionError', message: 'No image' });
          break;
        }

        if (typeof action !== 'string' || !VALID_UI_ACTIONS.has(action)) {
          this.sendMessage({ command: 'actionError', message: 'Unsupported image action.' });
          break;
        }

        try {
          this.sendMessage({ command: 'actionStarted', label: `Đang thực hiện ${action}...` });
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
              const runwareKey = await SecretManager.getInstance().getApiKey();
              if (runwareKey && runwareKey.trim().length > 10) {
                try {
                  const adapter = new RunwareAdapter(runwareKey);
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

            const savedResult = await FileSystemUtils.saveImageToWorkspace(outBuf, `pixel_pilot_cutout_${Date.now()}.png`);
            this.sendMessage({
              command: 'actionComplete',
              dataUrl: `data:image/png;base64,${outBuf.toString('base64')}`,
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
              const runwareKey = await SecretManager.getInstance().getApiKey();
              if (runwareKey && runwareKey.trim().length > 10) {
                try {
                  const adapter = new RunwareAdapter(runwareKey);
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
            const savedResult = await FileSystemUtils.saveImageToWorkspace(outBuf, `pixel_pilot_upscale_${factor}x_${Date.now()}.png`);
            this.sendMessage({
              command: 'actionComplete',
              dataUrl: `data:image/png;base64,${outBuf.toString('base64')}`,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Phóng to ${factor}x thành công: ${savedResult.relativePath}`);
          } else if (action === 'enhance') {
            const type = options?.type || 'clarity';
            let outBuf: Buffer;
            const runwareKey = await SecretManager.getInstance().getApiKey();
            if (runwareKey && runwareKey.trim().length > 10) {
              try {
                const adapter = new RunwareAdapter(runwareKey);
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
            const savedResult = await FileSystemUtils.saveImageToWorkspace(outBuf, `pixel_pilot_enhanced_${Date.now()}.png`);
            this.sendMessage({
              command: 'actionComplete',
              dataUrl: `data:image/png;base64,${outBuf.toString('base64')}`,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Khử mờ & Làm nét HDR thành công: ${savedResult.relativePath}`);
          } else if (action === 'mask') {
            const outBuf = await imageProc.extractMask(buffer);
            const savedResult = await FileSystemUtils.saveImageToWorkspace(outBuf, `pixel_pilot_mask_${Date.now()}.png`);
            this.sendMessage({
              command: 'actionComplete',
              dataUrl: `data:image/png;base64,${outBuf.toString('base64')}`,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Trích xuất Mask thành công: ${savedResult.relativePath}`);
          } else if (action === 'canny' || action === 'edgeDetection') {
            const outBuf = await imageProc.detectEdges(buffer, 'canny');
            const savedResult = await FileSystemUtils.saveImageToWorkspace(outBuf, `pixel_pilot_canny_${Date.now()}.png`);
            this.sendMessage({
              command: 'actionComplete',
              dataUrl: `data:image/png;base64,${outBuf.toString('base64')}`,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Dò biên Canny thành công: ${savedResult.relativePath}`);
          } else if (action === 'lineart' || action === 'lineExtraction') {
            const outBuf = await imageProc.detectEdges(buffer, 'lineart');
            const savedResult = await FileSystemUtils.saveImageToWorkspace(outBuf, `pixel_pilot_lineart_${Date.now()}.png`);
            this.sendMessage({
              command: 'actionComplete',
              dataUrl: `data:image/png;base64,${outBuf.toString('base64')}`,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Trích xuất Lineart thành công: ${savedResult.relativePath}`);
          } else if (action === 'depth') {
            const outBuf = await imageProc.detectEdges(buffer, 'depth');
            const savedResult = await FileSystemUtils.saveImageToWorkspace(outBuf, `pixel_pilot_depth_${Date.now()}.png`);
            this.sendMessage({
              command: 'actionComplete',
              dataUrl: `data:image/png;base64,${outBuf.toString('base64')}`,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Tạo bản đồ độ sâu 3D thành công: ${savedResult.relativePath}`);
          } else if (action === 'extend') {
            const direction = options?.direction || 'all';
            const outBuf = await imageProc.extendCanvas(buffer, direction);
            const savedResult = await FileSystemUtils.saveImageToWorkspace(outBuf, `pixel_pilot_extended_${Date.now()}.png`);
            this.sendMessage({
              command: 'actionComplete',
              dataUrl: `data:image/png;base64,${outBuf.toString('base64')}`,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Mở rộng khung hình thành công: ${savedResult.relativePath}`);
          } else if (action === 'caption') {
            const captionText = await imageProc.generateCaption(buffer);
            vscode.window.showInformationMessage(`📝 AI Caption: ${captionText}`);
            this.sendMessage({
              command: 'chatReply',
              text: `📝 **Mô tả ảnh AI (Alt Text):**\n\n${captionText}`
            });
            this.sendMessage({ command: 'actionComplete' });
          } else if (action === 'recolor') {
            const subject = options?.subject || 'hair';
            const color = options?.color || 'cyan';
            const outBuf = await imageProc.recolor(buffer, subject, color);
            const savedResult = await FileSystemUtils.saveImageToWorkspace(outBuf, `pixel_pilot_recolor_${Date.now()}.png`);
            this.sendMessage({
              command: 'actionComplete',
              dataUrl: `data:image/png;base64,${outBuf.toString('base64')}`,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Đổi màu ${subject} (${color}) thành công (bảo vệ 100% da mặt): ${savedResult.relativePath}`);
          } else if (action === 'styleTransfer') {
            const style = options?.style || 'anime';
            const outBuf = await imageProc.styleTransfer(buffer, style);
            const savedResult = await FileSystemUtils.saveImageToWorkspace(outBuf, `pixel_pilot_style_${style}_${Date.now()}.png`);
            this.sendMessage({
              command: 'actionComplete',
              dataUrl: `data:image/png;base64,${outBuf.toString('base64')}`,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Chuyển phong cách ${style} thành công: ${savedResult.relativePath}`);
          } else if (action === 'vectorize') {
            const { svgString, previewBuffer } = await imageProc.vectorize(buffer);
            const savedResult = await FileSystemUtils.saveImageToWorkspace(Buffer.from(svgString, 'utf-8'), `pixel_pilot_vector_${Date.now()}.svg`);
            this.sendMessage({
              command: 'actionComplete',
              dataUrl: `data:image/png;base64,${previewBuffer.toString('base64')}`,
              savedPath: savedResult.relativePath
            });
            vscode.window.showInformationMessage(`✨ Vector hóa SVG thành công: ${savedResult.relativePath}`);
          } else if (action === 'inpaint') {
            let maskBuffer: Buffer | undefined;
            if (options?.maskDataUrl) {
              const maskB64 = options.maskDataUrl.replace(/^data:image\/\w+;base64,/, '');
              maskBuffer = Buffer.from(maskB64, 'base64');
            }
            const outBuf = await imageProc.inpaint(buffer, maskBuffer);
            const savedResult = await FileSystemUtils.saveImageToWorkspace(outBuf, `pixel_pilot_inpaint_${Date.now()}.png`);
            this.sendMessage({
              command: 'actionComplete',
              dataUrl: `data:image/png;base64,${outBuf.toString('base64')}`,
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
            this.sendMessage({ command: 'actionComplete' });
            vscode.window.showInformationMessage(`✅ Đã sinh mã ${codeRes.framework} và mở trong editor!`);
          } else if (action === 'ocr') {
            const ocrService = OCRService.getInstance();
            const ocrRes = await ocrService.extractText(buffer, decodedInput.mimeType);
            if (ocrRes.fullText) {
              await vscode.env.clipboard.writeText(ocrRes.fullText);
            }
            this.sendMessage({ command: 'actionComplete' });
            if (ocrRes.fullText) vscode.window.showInformationMessage(`📋 OCR: Đã copy ${ocrRes.fullText.length} ký tự vào Clipboard.`);
            else vscode.window.showInformationMessage('OCR không phát hiện văn bản trong ảnh.');
          } else if (action === 'compress') {
            const comp = await imageProc.processImage(buffer, { format: options?.format || 'webp', quality: options?.quality || 85 });
            const savedResult = await FileSystemUtils.saveImageToWorkspace(comp, `pixel_pilot_compressed_${Date.now()}.${options?.format || 'webp'}`);
            this.sendMessage({ command: 'actionComplete', savedPath: savedResult.relativePath });
            vscode.window.showInformationMessage(`💾 Đã nén thành công (${(comp.byteLength / 1024).toFixed(1)} KB): ${savedResult.relativePath}`);
          } else if (action === 'exportIcons') {
            const icons = await imageProc.exportIcons(buffer);
            const bundle = await FileSystemUtils.saveIconBundle(icons, `pixel_pilot_icons_${Date.now()}`);
            this.sendMessage({ command: 'actionComplete', savedPath: bundle.relativeDirectory });
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
          this.sendMessage({ command: 'actionError', message: err.message });
          vscode.window.showErrorMessage(`Lỗi ${action}: ${err.message}`);
        }
        break;
      }

      case 'chatMessage':
      case 'newSession':
      case 'switchSession':
      case 'renameSession':
      case 'deleteSession': {
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

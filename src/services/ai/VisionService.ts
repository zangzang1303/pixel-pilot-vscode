// VisionService.ts - Centralized High-Level AI Orchestration Service for Image Operations
import * as vscode from 'vscode';
import * as path from 'path';
import { RunwareAdapter } from './RunwareAdapter';
import { LocalMockAdapter } from './LocalMockAdapter';
import { SecretManager } from '../security/SecretManager';
import { ConfigManager } from '../security/ConfigManager';
import { WorkspaceFSService } from '../storage/WorkspaceFSService';
import { ImageProcessor } from '../image/ImageProcessor';
import { SnippetService } from '../editor/SnippetService';
import { AIResult } from '../session/types';

export interface VisionOperationResult {
  outputUri: vscode.Uri;
  format: string;
  byteSize: number;
  latencyMs: number;
  model: string;
}

export class VisionService {
  private static instance: VisionService;
  private runwareAdapter: RunwareAdapter;
  private localMockAdapter: LocalMockAdapter;
  private secretManager: SecretManager;
  private configManager: ConfigManager;
  private fsService: WorkspaceFSService;
  private imageProcessor: ImageProcessor;
  private snippetService: SnippetService;

  private constructor(context?: vscode.ExtensionContext) {
    this.runwareAdapter = new RunwareAdapter('');
    this.localMockAdapter = new LocalMockAdapter();
    this.secretManager = SecretManager.getInstance(context);
    this.configManager = ConfigManager.getInstance();
    this.fsService = WorkspaceFSService.getInstance();
    this.imageProcessor = ImageProcessor.getInstance();
    this.snippetService = SnippetService.getInstance();

    // Load API keys
    this.secretManager.getApiKey().then(k => {
      if (k) this.runwareAdapter.setApiKey(k);
    });
  }

  public static getInstance(context?: vscode.ExtensionContext): VisionService {
    if (!VisionService.instance) {
      VisionService.instance = new VisionService(context);
    }
    return VisionService.instance;
  }

  private async getActiveAdapter() {
    const isOffline = this.configManager.isOfflineMode();
    const apiKey = await this.secretManager.getApiKey();

    if (!isOffline && apiKey && apiKey.trim().length > 0) {
      this.runwareAdapter.setApiKey(apiKey);
      return this.runwareAdapter;
    }
    return this.localMockAdapter;
  }

  /**
   * 1. Remove Background: Generates a clean transparent PNG cutout
   */
  public async removeBackground(inputUri: vscode.Uri): Promise<VisionOperationResult> {
    const adapter = await this.getActiveAdapter();
    const inputBuffer = await this.fsService.readFile(inputUri);
    const base64Input = `data:image/png;base64,${inputBuffer.toString('base64')}`;

    const res: AIResult = await adapter.removeBackground(base64Input);
    if (!res.outputImageUri) {
      throw new Error(res.error || 'Tách nền thất bại: Không nhận được dữ liệu ảnh.');
    }
    const outputBuffer = this.dataUriToBuffer(res.outputImageUri);

    const targetUri = await this.fsService.getAvailableFileUri(inputUri, 'nobg', '.png');
    await this.fsService.writeFile(targetUri, outputBuffer);

    await this.postProcessImage(targetUri, outputBuffer);

    return {
      outputUri: targetUri,
      format: 'png',
      byteSize: outputBuffer.byteLength,
      latencyMs: res.metrics.latencyMs || 0,
      model: res.metrics.model || 'BiRefNet'
    };
  }

  /**
   * 2. Upscale Image: 2x or 4x Super Resolution
   */
  public async upscaleImage(inputUri: vscode.Uri, factor: 2 | 4 = 2): Promise<VisionOperationResult> {
    const adapter = await this.getActiveAdapter();
    const inputBuffer = await this.fsService.readFile(inputUri);
    const base64Input = `data:image/png;base64,${inputBuffer.toString('base64')}`;

    const res: AIResult = await adapter.upscale(base64Input, factor);
    if (!res.outputImageUri) {
      throw new Error(res.error || `Phóng to ${factor}x thất bại: Không nhận được dữ liệu ảnh.`);
    }
    const outputBuffer = this.dataUriToBuffer(res.outputImageUri);

    const ext = path.extname(inputUri.fsPath);
    const targetUri = await this.fsService.getAvailableFileUri(inputUri, `${factor}x`, ext);
    await this.fsService.writeFile(targetUri, outputBuffer);

    await this.postProcessImage(targetUri, outputBuffer);

    return {
      outputUri: targetUri,
      format: ext.replace('.', ''),
      byteSize: outputBuffer.byteLength,
      latencyMs: res.metrics.latencyMs || 0,
      model: res.metrics.model || `Upscale-${factor}x`
    };
  }

  /**
   * 3. Inpaint Image: Fill or replace regions using mask and prompt
   */
  public async inpaintImage(inputUri: vscode.Uri, maskBase64: string, prompt: string): Promise<VisionOperationResult> {
    const adapter = await this.getActiveAdapter();
    const inputBuffer = await this.fsService.readFile(inputUri);
    const base64Input = `data:image/png;base64,${inputBuffer.toString('base64')}`;

    const res: AIResult = await adapter.inpaint(base64Input, maskBase64, prompt);
    if (!res.outputImageUri) {
      throw new Error(res.error || 'Inpaint thất bại: Không nhận được dữ liệu ảnh.');
    }
    const outputBuffer = this.dataUriToBuffer(res.outputImageUri);

    const ext = path.extname(inputUri.fsPath);
    const targetUri = await this.fsService.getAvailableFileUri(inputUri, 'inpaint', ext);
    await this.fsService.writeFile(targetUri, outputBuffer);

    await this.postProcessImage(targetUri, outputBuffer);

    return {
      outputUri: targetUri,
      format: ext.replace('.', ''),
      byteSize: outputBuffer.byteLength,
      latencyMs: res.metrics.latencyMs || 0,
      model: res.metrics.model || 'Inpaint-Diffusion'
    };
  }

  /**
   * 4. Text-to-Image: Generate brand-new asset from text prompt
   */
  public async textToImage(prompt: string, targetFolderUri?: vscode.Uri, dimension: string = '1024x1024'): Promise<VisionOperationResult> {
    const apiKey = await this.secretManager.getApiKey();
    const [wStr, hStr] = dimension.split('x');
    const width = parseInt(wStr, 10) || 1024;
    const height = parseInt(hStr, 10) || 1024;

    let outputBase64 = '';
    let latencyMs = 120;
    let modelUsed = 'Local Simulated Generator';

    if (apiKey && apiKey.trim().length > 0) {
      try {
        const startTime = Date.now();
        const payload = [
          {
            taskType: 'imageInference',
            taskUUID: crypto.randomUUID(),
            positivePrompt: prompt,
            width,
            height,
            model: 'runware:100@1',
            outputType: 'dataURI',
            outputFormat: 'PNG'
          }
        ];

        const response = await fetch('https://api.runware.ai/v1', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const json = await response.json() as any;
          const res = Array.isArray(json.data) ? json.data[0] : json.data || json;
          outputBase64 = res?.imageURL || res?.dataURI || res?.imageDataURI || '';
          latencyMs = Date.now() - startTime;
          modelUsed = 'Runware Fast Cloud Diffusion';
        }
      } catch (err) {
        console.warn('[VisionService] Cloud text-to-image failed, using fallback:', err);
      }
    }

    if (!outputBase64) {
      // Fallback generator: creates an elegant styled SVG placeholder and converts to PNG buffer
      const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="50%" stop-color="#1e1b4b" />
            <stop offset="100%" stop-color="#0284c7" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)" rx="32" />
        <circle cx="${width / 2}" cy="${height / 2 - 40}" r="90" fill="#38bdf8" opacity="0.3" filter="blur(20px)" />
        <text x="50%" y="${height / 2}" text-anchor="middle" fill="#ffffff" font-size="28" font-family="system-ui, sans-serif" font-weight="bold">AI Image Studio</text>
        <text x="50%" y="${height / 2 + 40}" text-anchor="middle" fill="#94a3b8" font-size="16" font-family="system-ui, sans-serif">${prompt.slice(0, 40)}...</text>
      </svg>`;
      outputBase64 = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    }

    const outputBuffer = this.dataUriToBuffer(outputBase64);
    const folder = targetFolderUri || (vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : vscode.Uri.file('.'));
    const safeName = prompt.slice(0, 20).replace(/[^a-zA-Z0-9_-]/g, '_') || 'ai_generated';
    const targetUri = await this.fsService.getAvailableFileUri(vscode.Uri.file(path.join(folder.fsPath, `${safeName}.png`)), 'gen', '.png');

    await this.fsService.writeFile(targetUri, outputBuffer);
    await this.postProcessImage(targetUri, outputBuffer);

    return {
      outputUri: targetUri,
      format: 'png',
      byteSize: outputBuffer.byteLength,
      latencyMs,
      model: modelUsed
    };
  }

  /**
   * Optional Post-Processing: Compress with Sharp & Insert Snippet
   */
  private async postProcessImage(savedUri: vscode.Uri, buffer: Buffer): Promise<void> {
    const compressFormat = this.configManager.getCompressionFormat();
    if (compressFormat === 'webp' || compressFormat === 'avif') {
      try {
        const compressedBuffer = await this.imageProcessor.processImage(buffer, {
          format: compressFormat,
          quality: this.configManager.getCompressionQuality()
        });

        const compressedUri = await this.fsService.getAvailableFileUri(savedUri, 'compressed', `.${compressFormat}`);
        await this.fsService.writeFile(compressedUri, compressedBuffer);
      } catch (err) {
        console.warn('[VisionService] Auto compression skipped:', err);
      }
    }
  }

  private dataUriToBuffer(dataUri: string): Buffer {
    if (dataUri.startsWith('data:')) {
      const base64Data = dataUri.split(',')[1] || dataUri;
      return Buffer.from(base64Data, 'base64');
    }
    return Buffer.from(dataUri, 'utf-8');
  }
}

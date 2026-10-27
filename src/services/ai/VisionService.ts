// VisionService.ts - Centralized High-Level AI Orchestration Service for Image Operations
import * as vscode from 'vscode';
import * as path from 'path';
import { RunwareAdapter } from './RunwareAdapter';
import { SecretManager } from '../security/SecretManager';
import { ConfigManager } from '../security/ConfigManager';
import { WorkspaceFSService } from '../storage/WorkspaceFSService';
import { ImageProcessor } from '../image/ImageProcessor';
import { SnippetService } from '../editor/SnippetService';
import { AIResult } from '../session/types';
import { PolicyService } from '../security/PolicyService';
import { decodeImageInput, imageMimeType, validateImageBuffer } from '../../utils/imageData';

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
  private readonly policy = new PolicyService();
  private secretManager: SecretManager;
  private configManager: ConfigManager;
  private fsService: WorkspaceFSService;
  private imageProcessor: ImageProcessor;
  private snippetService: SnippetService;

  private constructor(context?: vscode.ExtensionContext) {
    this.runwareAdapter = new RunwareAdapter('');
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

  private async getActiveAdapter(operation: string): Promise<RunwareAdapter | null> {
    const isOffline = this.configManager.isOfflineMode();
    const apiKey = await this.secretManager.getApiKey();

    if (!isOffline && apiKey && apiKey.trim().length > 0) {
      await this.policy.requireCloudConsent('Runware', operation);
      this.runwareAdapter.setApiKey(apiKey);
      return this.runwareAdapter;
    }
    return null;
  }

  private async readImage(inputUri: vscode.Uri): Promise<{ buffer: Buffer; dataUri: string }> {
    const buffer = await this.fsService.readFile(inputUri);
    const mime = imageMimeType(path.extname(inputUri.fsPath));
    validateImageBuffer(buffer, mime);
    return { buffer, dataUri: `data:${mime};base64,${buffer.toString('base64')}` };
  }

  private localResult(buffer: Buffer, operation: string): AIResult {
    return {
      success: true,
      outputImageUri: `data:image/png;base64,${buffer.toString('base64')}`,
      metrics: { model: `Local ImageProcessor (${operation})`, latencyMs: 0, costUsd: 0 }
    };
  }

  /**
   * 1. Remove Background: Generates a clean transparent PNG cutout
   */
  public async removeBackground(inputUri: vscode.Uri): Promise<VisionOperationResult> {
    await this.policy.requireTrustedWorkspace('Remove background');
    const { buffer: inputBuffer, dataUri: base64Input } = await this.readImage(inputUri);
    const adapter = await this.getActiveAdapter('Background removal');

    const res: AIResult = adapter
      ? await adapter.removeBackground(base64Input)
      : this.localResult(await this.imageProcessor.removeBackground(inputBuffer), 'background removal');
    if (!res.success || !res.outputImageUri) {
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
    await this.policy.requireTrustedWorkspace('Upscale image');
    const { buffer: inputBuffer, dataUri: base64Input } = await this.readImage(inputUri);
    const adapter = await this.getActiveAdapter(`Upscale ${factor}x`);

    const res: AIResult = adapter
      ? await adapter.upscale(base64Input, factor)
      : this.localResult(await this.imageProcessor.upscale(inputBuffer, factor), `upscale ${factor}x`);
    if (!res.success || !res.outputImageUri) {
      throw new Error(res.error || `Phóng to ${factor}x thất bại: Không nhận được dữ liệu ảnh.`);
    }
    const outputBuffer = this.dataUriToBuffer(res.outputImageUri);

    const targetUri = await this.fsService.getAvailableFileUri(inputUri, `${factor}x`, '.png');
    await this.fsService.writeFile(targetUri, outputBuffer);

    await this.postProcessImage(targetUri, outputBuffer);

    return {
      outputUri: targetUri,
      format: 'png',
      byteSize: outputBuffer.byteLength,
      latencyMs: res.metrics.latencyMs || 0,
      model: res.metrics.model || `Upscale-${factor}x`
    };
  }

  /**
   * 3. Inpaint Image: Fill or replace regions using mask and prompt
   */
  public async inpaintImage(inputUri: vscode.Uri, maskBase64: string, prompt: string): Promise<VisionOperationResult> {
    await this.policy.requireTrustedWorkspace('Inpaint image');
    const { buffer: inputBuffer, dataUri: base64Input } = await this.readImage(inputUri);
    const maskBuffer = decodeImageInput(maskBase64).buffer;
    const adapter = await this.getActiveAdapter('Generative inpaint');

    const res: AIResult = adapter
      ? await adapter.inpaint(base64Input, maskBase64, prompt)
      : this.localResult(await this.imageProcessor.inpaint(inputBuffer, maskBuffer), 'inpaint');
    if (!res.success || !res.outputImageUri) {
      throw new Error(res.error || 'Inpaint thất bại: Không nhận được dữ liệu ảnh.');
    }
    const outputBuffer = this.dataUriToBuffer(res.outputImageUri);

    const targetUri = await this.fsService.getAvailableFileUri(inputUri, 'inpaint', '.png');
    await this.fsService.writeFile(targetUri, outputBuffer);

    await this.postProcessImage(targetUri, outputBuffer);

    return {
      outputUri: targetUri,
      format: 'png',
      byteSize: outputBuffer.byteLength,
      latencyMs: res.metrics.latencyMs || 0,
      model: res.metrics.model || 'Inpaint-Diffusion'
    };
  }

  /**
   * 4. Text-to-Image: Generate brand-new asset from text prompt
   */
  public async textToImage(prompt: string, targetFolderUri?: vscode.Uri, dimension: string = '1024x1024'): Promise<VisionOperationResult> {
    await this.policy.requireTrustedWorkspace('Generate image');
    if (!prompt.trim() || prompt.length > 4000) throw new Error('A bounded image prompt is required.');
    if (!targetFolderUri && !vscode.workspace.workspaceFolders?.length) throw new Error('Choose a workspace or target folder for generated images.');
    if (this.configManager.isOfflineMode()) throw new Error('Text-to-image is unavailable in offline mode.');
    const apiKey = await this.secretManager.getApiKey();
    if (!apiKey) throw new Error('Runware API key is required for text-to-image.');
    const size = /^(\d{2,4})x(\d{2,4})$/.exec(dimension);
    if (!size) throw new Error('Invalid image dimensions.');
    const width = Number(size[1]);
    const height = Number(size[2]);
    if (width < 64 || width > 2048 || height < 64 || height > 2048 || width % 8 || height % 8) {
      throw new Error('Image dimensions must be multiples of 8 between 64 and 2048.');
    }
    await this.policy.requireCloudConsent('Runware', 'Text-to-image generation');
    const taskUUID = crypto.randomUUID();
    const startTime = Date.now();
    const response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        taskType: 'imageInference', taskUUID, positivePrompt: prompt, width, height,
        model: 'runware:100@1', outputType: 'dataURI', outputFormat: 'PNG'
      }])
    });
    if (!response.ok) throw new Error(`Runware image generation failed (HTTP ${response.status}).`);
    const json = await response.json() as any;
    if (json.errors?.length) throw new Error('Runware image generation returned an error.');
    const results = Array.isArray(json.data) ? json.data : [json.data || json];
    if (results.length !== 1 || (results[0]?.taskUUID && results[0].taskUUID !== taskUUID)) {
      throw new Error('Runware response does not match the requested image job.');
    }
    const outputBuffer = this.dataUriToBuffer(results[0]?.imageDataURI || results[0]?.dataURI || '');
    const latencyMs = Date.now() - startTime;
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
      model: 'Runware imageInference runware:100@1'
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
    const decoded = decodeImageInput(dataUri);
    if (decoded.extension !== 'png') throw new Error('Provider returned an unexpected image format.');
    return decoded.buffer;
  }
}

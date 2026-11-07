// BatchProcessor.ts - Enterprise Batch Asset Processing Engine
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { IAIProvider } from '../ai/IAIProvider';
import { backgroundRemovalProvenance } from '../ai/BackgroundRemovalProvenance';
import { OperationType } from '../session/types';

export interface BatchItemResult {
  filePath: string;
  outputPath?: string;
  success: boolean;
  error?: string;
  latencyMs: number;
  provider?: string;
  mode?: 'model' | 'basic' | 'unknown';
  model?: string;
  costUsd?: number;
  costStatus?: 'actual' | 'estimated' | 'unknown';
}

export interface BatchSummary {
  operation: OperationType;
  total: number;
  succeeded: number;
  failed: number;
  totalTimeMs: number;
  outputDirectory: string;
  results: BatchItemResult[];
  manifestPath: string;
  manifestError?: string;
}

export class BatchProcessor {
  private static readonly SUPPORTED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp']);
  private aiProvider: IAIProvider;

  constructor(aiProvider: IAIProvider) {
    this.aiProvider = aiProvider;
  }

  public setAIProvider(provider: IAIProvider): void {
    this.aiProvider = provider;
  }

  /**
   * Scans a directory recursively or non-recursively for supported image files
   */
  public async scanImages(targetUri: vscode.Uri, recursive = false): Promise<vscode.Uri[]> {
    const stat = await vscode.workspace.fs.stat(targetUri);
    if (stat.type === vscode.FileType.File) {
      const ext = path.extname(targetUri.fsPath).toLowerCase();
      return BatchProcessor.SUPPORTED_EXTS.has(ext) ? [targetUri] : [];
    }

    const imageUris: vscode.Uri[] = [];
    const entries = await vscode.workspace.fs.readDirectory(targetUri);

    for (const [name, type] of entries) {
      const childUri = vscode.Uri.file(path.join(targetUri.fsPath, name));
      if (type === vscode.FileType.File) {
        const ext = path.extname(name).toLowerCase();
        if (BatchProcessor.SUPPORTED_EXTS.has(ext)) {
          imageUris.push(childUri);
        }
      } else if (type === vscode.FileType.Directory && recursive) {
        const subImages = await this.scanImages(childUri, recursive);
        imageUris.push(...subImages);
      }
    }

    return imageUris;
  }

  /**
   * Executes batch processing on a collection of images with progress notification
   */
  public async executeBatch(
    images: vscode.Uri[],
    operation: OperationType,
    outputDir: string,
    options: { factor?: 2 | 4; prompt?: string; beforeEach?: (image: vscode.Uri, index: number) => Promise<void>; beforeWrite?: (image: vscode.Uri, index: number) => Promise<void> } = {}
  ): Promise<BatchSummary> {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const startTime = Date.now();
    const results: BatchItemResult[] = [];
    const batchId = randomUUID();
    const manifestPath = path.join(outputDir, `.pixel-pilot-batch-${batchId}.json`);
    let manifestError: string | undefined;
    const manifest = { version: 1, batchId, operation, state: 'running', createdAt: Date.now(), updatedAt: Date.now(),
      sourceFiles: images.map(image => image.fsPath), results };
    const persistManifest = async () => {
      manifest.updatedAt = Date.now();
      const tempPath = `${manifestPath}.${randomUUID()}.tmp`;
      await fs.promises.writeFile(tempPath, JSON.stringify(manifest, null, 2), { flag: 'wx' });
      await fs.promises.rename(tempPath, manifestPath);
    };
    await persistManifest();
    let succeeded = 0;
    let failed = 0;
    let cancelled = false;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Pixel Pilot Enterprise: Đang xử lý lô (${images.length} ảnh)...`,
        cancellable: true
      },
      async (progress, token) => {
        const incrementStep = 100 / Math.max(images.length, 1);

        for (let i = 0; i < images.length; i++) {
          if (token.isCancellationRequested) {
            cancelled = true;
            vscode.window.showWarningMessage('Đã hủy tiến trình xử lý hàng loạt!');
            break;
          }

          const imgUri = images[i];
          const fileName = path.basename(imgUri.fsPath);
          const parsed = path.parse(fileName);
          progress.report({
            message: `[${i + 1}/${images.length}] Đang xử lý: ${fileName}`,
            increment: incrementStep
          });

          const itemStart = Date.now();

          try {
            await options.beforeEach?.(imgUri, i);
            if (token.isCancellationRequested) { cancelled = true; break; }
            // Read input file into data URI
            const fileBuf = await vscode.workspace.fs.readFile(imgUri);
            const ext = parsed.ext.toLowerCase().replace('.', '') || 'png';
            const base64 = Buffer.from(fileBuf).toString('base64');
            const dataUri = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${base64}`;

            let outBuffer: Buffer | null = null;
            let outExt = 'png';
            let provenance: Pick<BatchItemResult, 'provider' | 'mode' | 'model' | 'costUsd' | 'costStatus'> = {};

            switch (operation) {
              case 'remove_background': {
                const res = await this.aiProvider.removeBackground(dataUri);
                if (res.success && res.outputImageUri) {
                  outBuffer = this.extractBuffer(res.outputImageUri);
                  outExt = 'png';
                  const invokedProvider = /^Runware\b/i.test(this.aiProvider.name) ? 'runware' : 'comfyui';
                  provenance = { ...backgroundRemovalProvenance(res, invokedProvider),
                    costUsd: res.metrics?.costUsd, costStatus: res.metrics?.costStatus };
                } else {
                  throw new Error(res.error || 'Lỗi tách nền');
                }
                break;
              }

              case 'vectorize': {
                const res = await this.aiProvider.vectorize(dataUri);
                if (res.success && (res.textResult || res.outputImageUri)) {
                  const svgData = res.textResult || (this.extractBuffer(res.outputImageUri!)?.toString('utf-8') || '');
                  outBuffer = Buffer.from(svgData, 'utf-8');
                  outExt = 'svg';
                  provenance.model = res.metrics?.model;
                  provenance.costUsd = res.metrics?.costUsd;
                  provenance.costStatus = res.metrics?.costStatus;
                } else {
                  throw new Error(res.error || 'Lỗi Vectorize');
                }
                break;
              }

              case 'upscale': {
                const res = await this.aiProvider.upscale(dataUri, options.factor || 2);
                if (res.success && res.outputImageUri) {
                  outBuffer = this.extractBuffer(res.outputImageUri);
                  outExt = 'png';
                  const model = res.metrics?.model;
                  const isComfyModel = Boolean(model && /^ComfyUI\b/i.test(model));
                  const isSharpBasic = Boolean(model && /^Sharp Lanczos3 \+ sharpen upscale\b/i.test(model));
                  provenance = { model, costUsd: res.metrics?.costUsd, costStatus: res.metrics?.costStatus,
                    provider: isSharpBasic ? 'sharp' : isComfyModel ? 'comfyui' : /^Runware\b/i.test(this.aiProvider.name) ? 'runware' : 'unknown',
                    mode: isSharpBasic ? 'basic' : isComfyModel || /^Runware\b/i.test(this.aiProvider.name) ? 'model' : 'unknown' };
                } else {
                  throw new Error(res.error || 'Lỗi Upscale');
                }
                break;
              }

              default:
                throw new Error(`Tác vụ hàng loạt không hỗ trợ: ${operation}`);
            }

            if (outBuffer) {
              const outFileName = `${parsed.name}_${operation}.${outExt}`;
              await options.beforeWrite?.(imgUri, i);
              if (token.isCancellationRequested) { cancelled = true; break; }
              const outFilePath = await this.writeOutputWithoutOverwrite(outputDir, outFileName, outBuffer);

              succeeded++;
              results.push({
                filePath: imgUri.fsPath,
                outputPath: outFilePath,
                success: true,
                latencyMs: Date.now() - itemStart,
                ...provenance
              });
              try { await persistManifest(); } catch (error: any) { manifestError = error?.message || String(error); }
            }
          } catch (err: any) {
            failed++;
            results.push({
              filePath: imgUri.fsPath,
              success: false,
              error: err.message || String(err),
              latencyMs: Date.now() - itemStart
            });
            try { await persistManifest(); } catch (error: any) { manifestError = error?.message || String(error); }
          }
        }
      }
    );

    const summary: BatchSummary = {
      operation,
      total: images.length,
      succeeded,
      failed,
      totalTimeMs: Date.now() - startTime,
      outputDirectory: outputDir,
      results,
      manifestPath,
      manifestError
    };

    manifest.state = cancelled ? 'cancelled' : 'completed';
    try { await persistManifest(); } catch (error: any) { summary.manifestError = error?.message || String(error); }

    return summary;
  }

  /** Retry only failed inputs from the last run; successful files are never submitted again. */
  public async retryFailed(previous: BatchSummary, options: { factor?: 2 | 4; prompt?: string; beforeEach?: (image: vscode.Uri, index: number) => Promise<void>; beforeWrite?: (image: vscode.Uri, index: number) => Promise<void> } = {}): Promise<BatchSummary | undefined> {
    const failedImages = previous.results.filter(result => !result.success).map(result => vscode.Uri.file(result.filePath));
    if (failedImages.length === 0) return undefined;
    return this.executeBatch(failedImages, previous.operation, previous.outputDirectory, options);
  }

  private async writeOutputWithoutOverwrite(outputDir: string, fileName: string, buffer: Buffer): Promise<string> {
    const parsed = path.parse(fileName);
    for (let suffix = 0; suffix < 10000; suffix++) {
      const candidate = path.join(outputDir, suffix === 0
        ? fileName
        : `${parsed.name}_${suffix}${parsed.ext}`);
      try {
        await fs.promises.writeFile(candidate, buffer, { flag: 'wx' });
        return candidate;
      } catch (error: any) {
        if (error?.code !== 'EEXIST') throw error;
      }
    }
    throw new Error(`Could not allocate a unique output name for ${fileName}.`);
  }

  private extractBuffer(uriOrBase64: string): Buffer | null {
    if (uriOrBase64.startsWith('data:')) {
      const b64 = uriOrBase64.split(',')[1];
      return Buffer.from(b64, 'base64');
    }
    return Buffer.from(uriOrBase64);
  }
}

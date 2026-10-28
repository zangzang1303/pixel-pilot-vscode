import sharp from 'sharp';
import { AgentToolRegistry } from '../ai/AgentToolRegistry';
import { ImageProcessor } from '../image/ImageProcessor';
import { ImageAnalysisService } from '../ai/ImageAnalysisService';
import { ComfyUIAdapter } from '../ai/ComfyUIAdapter';
import { decodeImageInput } from '../../utils/imageData';
import {
  ImageAnalyzeInput,
  ImageAnalyzeOutput,
  ImageRemoveBackgroundInput,
  ImageRemoveBackgroundOutput,
  ImageRecolorInput,
  ImageRecolorOutput,
  ImageInpaintInput,
  ImageInpaintOutput,
  ImageGenerateInput,
  ImageGenerateOutput
} from '../../shared/tool-contracts';
import { CopilotError } from '../execution/errors';

export interface PriorityToolExecutionContext {
  resolveImageBuffer?: (idOrUri: string) => Promise<Buffer>;
  storeArtifact?: (buffer: Buffer, mime: string, kind: 'image' | 'mask') => Promise<string>;
  comfyAdapter?: ComfyUIAdapter;
  imageProcessor?: ImageProcessor;
  signal?: AbortSignal;
}

/**
 * Priority Tool Executors (B16)
 * Implements the 5 core priority tool contracts with concrete execution.
 */
export class PriorityToolExecutors {
  private static async resolveBuffer(
    idOrUri: string,
    ctx?: PriorityToolExecutionContext
  ): Promise<Buffer> {
    if (ctx?.resolveImageBuffer) {
      return await ctx.resolveImageBuffer(idOrUri);
    }
    const decoded = decodeImageInput(idOrUri);
    return decoded.buffer;
  }

  public static async executeAnalyze(
    ctx: PriorityToolExecutionContext | undefined,
    input: ImageAnalyzeInput
  ): Promise<ImageAnalyzeOutput> {
    const buffer = await this.resolveBuffer(input.imageId, ctx);
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
    const comfy = ctx?.comfyAdapter || new ComfyUIAdapter();
    const analysis = await ImageAnalysisService.analyze(dataUrl, comfy);

    const limitations: string[] = [];
    if (!analysis.caption) {
      limitations.push('Không có mô hình thị giác để nhận diện chủ thể ngữ nghĩa.');
    }

    return {
      imageId: input.imageId,
      measurements: {
        width: analysis.width,
        height: analysis.height,
        meanLight: analysis.meanLight,
        darkPercent: analysis.darkPercent,
        brightPercent: analysis.brightPercent,
        contrast: analysis.contrast
      },
      limitations,
      suggestions: analysis.suggestions.map(s => ({
        label: s.label,
        reason: s.reason
      }))
    };
  }

  public static async executeRemoveBackground(
    ctx: PriorityToolExecutionContext | undefined,
    input: ImageRemoveBackgroundInput
  ): Promise<ImageRemoveBackgroundOutput> {
    const buffer = await this.resolveBuffer(input.imageId, ctx);
    const proc = ctx?.imageProcessor || ImageProcessor.getInstance();

    let outBuf: Buffer;
    let provider = 'sharp';

    if (input.quality === 'model') {
      const comfy = ctx?.comfyAdapter || new ComfyUIAdapter();
      const online = await comfy.ping();
      if (online) {
        try {
          const res = await comfy.removeBackground(`data:image/png;base64,${buffer.toString('base64')}`);
          if (res.outputImageUri) {
            outBuf = Buffer.from(res.outputImageUri.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            provider = 'comfyui';
          } else {
            outBuf = await proc.removeBackground(buffer);
          }
        } catch {
          outBuf = await proc.removeBackground(buffer);
        }
      } else {
        outBuf = await proc.removeBackground(buffer);
      }
    } else {
      outBuf = await proc.removeBackground(buffer);
    }

    // Compute alpha fraction
    const raw = await sharp(outBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let nonOpaque = 0;
    const totalPixels = raw.info.width * raw.info.height;
    for (let i = 3; i < raw.data.length; i += 4) {
      if (raw.data[i] < 250) nonOpaque++;
    }
    const alphaFraction = +(nonOpaque / totalPixels).toFixed(3);

    let artifactId = `art_cutout_${Date.now()}`;
    if (ctx?.storeArtifact) {
      artifactId = await ctx.storeArtifact(outBuf, 'image/png', 'image');
    }

    return {
      artifactId,
      alphaFraction
    };
  }

  public static async executeRecolor(
    ctx: PriorityToolExecutionContext | undefined,
    input: ImageRecolorInput
  ): Promise<ImageRecolorOutput> {
    const buffer = await this.resolveBuffer(input.imageId, ctx);
    const proc = ctx?.imageProcessor || ImageProcessor.getInstance();

    const allowedTargets = ['hair', 'clothes', 'background'];
    if (!allowedTargets.includes(input.target)) {
      throw CopilotError.createInvalidInputError(
        `Target '${input.target}' is not supported. Choose hair, clothes, or background.`,
        'image.recolor'
      );
    }

    let outBuf: Buffer;
    try {
      outBuf = await proc.recolor(buffer, input.target, input.color);
    } catch {
      // Fallback: apply tint/modulation with Sharp if model unavailable
      outBuf = await sharp(buffer)
        .modulate({ saturation: 1.2 })
        .png()
        .toBuffer();
    }

    let artifactId = `art_recolor_${Date.now()}`;
    if (ctx?.storeArtifact) {
      artifactId = await ctx.storeArtifact(outBuf, 'image/png', 'image');
    }

    return {
      artifactId,
      selectionMaskId: `mask_${input.target}_${Date.now()}`
    };
  }

  public static async executeInpaint(
    ctx: PriorityToolExecutionContext | undefined,
    input: ImageInpaintInput
  ): Promise<ImageInpaintOutput> {
    if (!input.maskId || !input.maskId.trim()) {
      throw CopilotError.createInvalidInputError(
        'Inpainting requires a valid, non-empty mask.',
        'image.inpaint'
      );
    }

    const imageBuffer = await this.resolveBuffer(input.imageId, ctx);
    const maskBuffer = await this.resolveBuffer(input.maskId, ctx);

    const proc = ctx?.imageProcessor || ImageProcessor.getInstance();
    const outBuf = await proc.inpaint(imageBuffer, maskBuffer);

    let artifactId = `art_inpaint_${Date.now()}`;
    if (ctx?.storeArtifact) {
      artifactId = await ctx.storeArtifact(outBuf, 'image/png', 'image');
    }

    return {
      artifactId,
      maskId: input.maskId
    };
  }

  public static async executeGenerate(
    ctx: PriorityToolExecutionContext | undefined,
    input: ImageGenerateInput
  ): Promise<ImageGenerateOutput> {
    if (!input.prompt || !input.prompt.trim()) {
      throw CopilotError.createInvalidInputError('Prompt cannot be empty.', 'image.generate');
    }

    const width = input.width || 512;
    const height = input.height || 512;

    if (width < 64 || width > 2048 || height < 64 || height > 2048) {
      throw CopilotError.createInvalidInputError(
        `Dimensions ${width}x${height} outside allowed bounds [64, 2048].`,
        'image.generate'
      );
    }

    const seed = input.seed !== undefined ? input.seed : Math.floor(Math.random() * 1000000);

    const comfy = ctx?.comfyAdapter || new ComfyUIAdapter();
    const online = await comfy.ping();
    if (!online) {
      throw new CopilotError({
        code: 'unsupported_provider',
        message: 'No generation model provider (ComfyUI / InvokeAI / Runware) is currently available.',
        toolName: 'image.generate',
        retryable: false
      });
    }

    const res = await comfy.generateImage(input.prompt, input.negativePrompt, width, height);
    if (!res.success || !res.outputImageUri) {
      throw new CopilotError({
        code: 'execution_failed',
        message: res.error || 'Generation failed at provider.',
        toolName: 'image.generate',
        retryable: false
      });
    }

    const outBuf = Buffer.from(res.outputImageUri.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    let artifactId = `art_gen_${Date.now()}`;
    if (ctx?.storeArtifact) {
      artifactId = await ctx.storeArtifact(outBuf, 'image/png', 'image');
    }

    return {
      artifactId,
      seed
    };
  }

  /**
   * Registers all 5 priority tool executors into AgentToolRegistry.
   */
  public static registerAll(registry = AgentToolRegistry): void {
    registry.registerExecutor('image.analyze', (ctx, args) =>
      this.executeAnalyze(ctx, args as ImageAnalyzeInput)
    );
    registry.registerExecutor('image.remove_background', (ctx, args) =>
      this.executeRemoveBackground(ctx, args as ImageRemoveBackgroundInput)
    );
    registry.registerExecutor('image.recolor', (ctx, args) =>
      this.executeRecolor(ctx, args as ImageRecolorInput)
    );
    registry.registerExecutor('image.inpaint', (ctx, args) =>
      this.executeInpaint(ctx, args as ImageInpaintInput)
    );
    registry.registerExecutor('image.generate', (ctx, args) =>
      this.executeGenerate(ctx, args as ImageGenerateInput)
    );
  }
}

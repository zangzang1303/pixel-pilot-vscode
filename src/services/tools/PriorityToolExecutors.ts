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
  private static requireArtifactStore(ctx: PriorityToolExecutionContext | undefined, toolName: string) {
    if (!ctx?.storeArtifact) {
      throw new CopilotError({ code: 'invalid_input', message: `${toolName} requires artifact storage.`, toolName });
    }
    return ctx.storeArtifact;
  }

  private static async storeImage(store: NonNullable<PriorityToolExecutionContext['storeArtifact']>, buffer: Buffer, toolName: string): Promise<string> {
    const artifactId = await store(buffer, 'image/png', 'image');
    if (!artifactId || !artifactId.trim()) {
      throw new CopilotError({ code: 'execution_failed', message: `${toolName} did not persist an artifact.`, toolName });
    }
    return artifactId;
  }

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
    const store = this.requireArtifactStore(ctx, 'image.remove_background');
    const buffer = await this.resolveBuffer(input.imageId, ctx);
    const proc = ctx?.imageProcessor || ImageProcessor.getInstance();

    let outBuf: Buffer;

    if (input.quality === 'model') {
      const comfy = ctx?.comfyAdapter || new ComfyUIAdapter();
      if (!await comfy.ping()) {
        throw new CopilotError({ code: 'unsupported_provider', message: 'ComfyUI background removal model is unavailable.', toolName: 'image.remove_background' });
      }
      const res = await comfy.removeBackground(`data:image/png;base64,${buffer.toString('base64')}`);
      if (!res.success || !res.outputImageUri || !res.metrics?.model?.startsWith('ComfyUI')) {
        throw new CopilotError({ code: 'unsupported_provider', message: 'ComfyUI did not return a model background removal result.', toolName: 'image.remove_background' });
      }
      outBuf = decodeImageInput(res.outputImageUri).buffer;
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

    const artifactId = await this.storeImage(store, outBuf, 'image.remove_background');

    return {
      artifactId,
      alphaFraction
    };
  }

  public static async executeRecolor(
    ctx: PriorityToolExecutionContext | undefined,
    input: ImageRecolorInput
  ): Promise<ImageRecolorOutput> {
    const allowedTargets = ['hair', 'clothes', 'background'];
    if (!allowedTargets.includes(input.target)) {
      throw CopilotError.createInvalidInputError(
        `Target '${input.target}' is not supported. Choose hair, clothes, or background.`,
        'image.recolor'
      );
    }

    const store = this.requireArtifactStore(ctx, 'image.recolor');
    const buffer = await this.resolveBuffer(input.imageId, ctx);
    const proc = ctx?.imageProcessor || ImageProcessor.getInstance();

    const outBuf = await proc.recolor(buffer, input.target, input.color);
    const before = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const after = await sharp(outBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (before.info.width !== after.info.width || before.info.height !== after.info.height || before.data.equals(after.data)) {
      throw new CopilotError({ code: 'execution_failed', message: 'Recolor did not change the image pixels.', toolName: 'image.recolor' });
    }
    return { artifactId: await this.storeImage(store, outBuf, 'image.recolor') };
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

    const store = this.requireArtifactStore(ctx, 'image.inpaint');

    const imageBuffer = await this.resolveBuffer(input.imageId, ctx);
    const maskBuffer = await this.resolveBuffer(input.maskId, ctx);

    const proc = ctx?.imageProcessor || ImageProcessor.getInstance();
    const outBuf = await proc.inpaint(imageBuffer, maskBuffer);

    const artifactId = await this.storeImage(store, outBuf, 'image.inpaint');

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

    const store = this.requireArtifactStore(ctx, 'image.generate');

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

    const outBuf = await sharp(decodeImageInput(res.outputImageUri).buffer).png().toBuffer();
    const artifactId = await this.storeImage(store, outBuf, 'image.generate');

    return { artifactId };
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

import { ComfyUIAdapter } from '../ai/ComfyUIAdapter';
import { GenerationOptions, InvokeApiService, InvokeModel } from '../InvokeApiService';
import { AIResult } from '../session/types';

type InvokeGeneration = Pick<InvokeApiService, 'ping' | 'getModels' | 'generateTextToImage'>;
type ComfyGeneration = Pick<ComfyUIAdapter, 'generateImage'>;

/** One provider route for the Generate button on both webview surfaces. */
export class CanvasGenerationExecutor {
  constructor(
    private readonly invoke: InvokeGeneration,
    private readonly makeComfy: () => ComfyGeneration = () => new ComfyUIAdapter()
  ) {}

  public async execute(
    prompt: string,
    model?: string | InvokeModel,
    options: GenerationOptions = {},
    onProgress?: (status: string, percentage?: number) => void
  ): Promise<{ result: AIResult; imageName: string }> {
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4096) {
      throw new Error('Generation prompt must contain 1–4096 characters.');
    }

    const invokeOnline = await this.invoke.ping();
    const models = invokeOnline ? await this.invoke.getModels() : [];
    if (invokeOnline && models.length > 0) {
      const selected = model || models[0];
      const generated = await this.invoke.generateTextToImage(prompt, selected, options, onProgress);
      if (!generated.dataUrl) throw new Error('InvokeAI did not return an image.');
      return {
        imageName: generated.imageName,
        result: {
          success: true,
          outputImageUri: generated.dataUrl,
          metrics: {
            model: `InvokeAI/${typeof selected === 'string' ? selected : selected.key}`,
            latencyMs: 0,
            costUsd: 0
          }
        }
      };
    }

    onProgress?.(invokeOnline
      ? 'InvokeAI has no available model; generating with local ComfyUI.'
      : 'Generating with local ComfyUI.', 35);
    const result = await this.makeComfy().generateImage(
      prompt, options.negativePrompt, options.width, options.height
    );
    if (!result.success || !result.outputImageUri) {
      throw new Error(result.error || 'ComfyUI did not return an image.');
    }
    return { result, imageName: 'PixelPilot_ComfyUI.png' };
  }
}

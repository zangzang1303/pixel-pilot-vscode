import { ComfyUIAdapter } from '../ai/ComfyUIAdapter';
import { GenerationOptions, InvokeApiService, InvokeModel } from '../InvokeApiService';
import { AIResult } from '../session/types';

type InvokeGeneration = Pick<InvokeApiService, 'ping' | 'getModels' | 'generateTextToImage'>;
type ComfyGeneration = Pick<ComfyUIAdapter, 'generateImage'>;

function cancelled(): Error { return new Error('Generation cancelled.'); }

/** Stop waiting for an InvokeAI response after cancellation. Its server job may still run. */
function waitForResult<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return pending;
  if (signal.aborted) return Promise.reject(cancelled());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => { signal.removeEventListener('abort', onAbort); reject(cancelled()); };
    signal.addEventListener('abort', onAbort, { once: true });
    pending.then(
      value => { signal.removeEventListener('abort', onAbort); resolve(value); },
      error => { signal.removeEventListener('abort', onAbort); reject(error); }
    );
  });
}

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
    onProgress?: (status: string, percentage?: number) => void,
    signal?: AbortSignal
  ): Promise<{ result: AIResult; imageName: string }> {
    const startedAt = Date.now();
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4096) {
      throw new Error('Generation prompt must contain 1–4096 characters.');
    }

    if (signal?.aborted) throw cancelled();
    const invokeOnline = await waitForResult(this.invoke.ping(), signal);
    if (signal?.aborted) throw cancelled();
    const models = invokeOnline ? await waitForResult(this.invoke.getModels(), signal) : [];
    if (signal?.aborted) throw cancelled();
    if (invokeOnline && models.length > 0) {
      const selected = model || models[0];
      const generated = await waitForResult(this.invoke.generateTextToImage(prompt, selected, options,
        (status, percentage) => { if (!signal?.aborted) onProgress?.(status, percentage); }), signal);
      if (signal?.aborted) throw cancelled();
      if (!generated.dataUrl) throw new Error('InvokeAI did not return an image.');
      return {
        imageName: generated.imageName,
        result: {
          success: true,
          outputImageUri: generated.dataUrl,
          metrics: {
            model: `InvokeAI/${typeof selected === 'string' ? selected : selected.key}`,
            latencyMs: Date.now() - startedAt,
            costUsd: undefined,
            costStatus: 'unknown'
          }
        }
      };
    }

    onProgress?.(invokeOnline
      ? 'InvokeAI has no available model; generating with local ComfyUI.'
      : 'Generating with local ComfyUI.', 35);
    const result = await this.makeComfy().generateImage(
      prompt, options.negativePrompt, options.width, options.height, signal
    );
    if (signal?.aborted) throw cancelled();
    if (!result.success || !result.outputImageUri) {
      throw new Error(result.error || 'ComfyUI did not return an image.');
    }
    return { result, imageName: 'PixelPilot_ComfyUI.png' };
  }
}

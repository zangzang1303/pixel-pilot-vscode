import { AIResult } from '../session/types';
import { decodeImageInput } from '../../utils/imageData';

export interface ImageResultProvenance {
  provider: 'comfyui' | 'runware' | 'sharp' | 'unknown';
  mode: 'model' | 'basic' | 'unknown';
  model: string;
  costUsd?: number;
  costStatus?: 'actual' | 'estimated' | 'unknown';
}

/** Resolve the engine that produced an image, including adapter-managed fallbacks. */
export async function resolveAdapterImageResult(
  result: AIResult | undefined,
  basicFallback: () => Promise<Buffer>,
  basicModel: string
): Promise<{ buffer: Buffer; provenance: ImageResultProvenance }> {
  if (!result?.success || !result.outputImageUri) {
    return { buffer: await basicFallback(), provenance: {
      provider: 'sharp', mode: 'basic', model: basicModel, costUsd: 0, costStatus: 'estimated'
    } };
  }

  const model = result.metrics?.model?.trim() || 'Unknown image engine';
  const isRunware = /^Runware\b/i.test(model);
  const isComfyModel = /^(ComfyUI\b|Stable Diffusion\b|Depth Anything\b)/i.test(model);
  const isBasic = /^(Local\b|Sharp\b|Native\b)/i.test(model);
  return {
    buffer: decodeImageInput(result.outputImageUri).buffer,
    provenance: {
      provider: isRunware ? 'runware' : isComfyModel ? 'comfyui' : isBasic ? 'sharp' : 'unknown',
      mode: isRunware || isComfyModel ? 'model' : isBasic ? 'basic' : 'unknown',
      model,
      costUsd: result.metrics?.costUsd,
      costStatus: result.metrics?.costStatus || (isBasic || isComfyModel ? 'estimated' : 'unknown')
    }
  };
}

import { AIResult } from '../session/types';

export interface BackgroundRemovalProvenance {
  provider: 'comfyui' | 'runware' | 'sharp' | 'unknown';
  mode: 'model' | 'basic' | 'unknown';
  model: string;
}

/** The ComfyUI adapter can return a local color cutout after a successful call. */
export function backgroundRemovalProvenance(result: AIResult, invokedProvider: 'comfyui' | 'runware'): BackgroundRemovalProvenance {
  const model = result.metrics?.model?.trim() || 'Unknown background removal engine';
  if (/^Native background removal\b/i.test(model)) {
    return { provider: 'sharp', mode: 'basic', model };
  }
  if (/^ComfyUI\b/i.test(model)) {
    return { provider: 'comfyui', mode: 'model', model };
  }
  if (invokedProvider === 'runware') {
    return { provider: 'runware', mode: 'model', model };
  }
  return { provider: 'unknown', mode: 'unknown', model };
}

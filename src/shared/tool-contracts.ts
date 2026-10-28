/**
 * Standard typed contracts for the prioritized image tools (Section 10 of COPILOT_DEVELOPMENT_PLAN.md).
 * Kept dependency-free so both Extension Host and Webview can consume these contracts.
 */

export type PriorityToolName =
  | 'image.analyze'
  | 'image.remove_background'
  | 'image.recolor'
  | 'image.inpaint'
  | 'image.generate';

export interface ImageAnalyzeInput {
  imageId: string;
  includeCaption?: boolean;
}

export interface ImageMeasurements {
  width: number;
  height: number;
  meanLight: number;
  darkPercent: number;
  brightPercent: number;
  contrast: number;
}

export interface ImageAnalyzeOutput {
  imageId: string;
  measurements: ImageMeasurements;
  limitations: string[];
  suggestions: Array<{ label: string; reason: string }>;
}

export interface ImageRemoveBackgroundInput {
  imageId: string;
  quality?: 'model' | 'basic';
  preserveDetails?: boolean;
}

export interface ImageRemoveBackgroundOutput {
  artifactId: string;
  previewArtifactId?: string;
  alphaFraction?: number;
}

export interface ImageRecolorInput {
  imageId: string;
  target: 'hair' | 'clothes' | 'background';
  color: string;
}

export interface ImageRecolorOutput {
  artifactId: string;
  previewArtifactId?: string;
  selectionMaskId?: string;
}

export interface ImageInpaintInput {
  imageId: string;
  maskId?: string;
  prompt: string;
  seed?: number;
}

export interface ImageInpaintOutput {
  artifactId: string;
  previewArtifactId?: string;
  maskId?: string;
}

export interface ImageGenerateInput {
  prompt: string;
  width?: number;
  height?: number;
  seed?: number;
  negativePrompt?: string;
}

export interface ImageGenerateOutput {
  artifactId: string;
  previewArtifactId?: string;
  seed?: number;
}

export type PriorityToolInputs = {
  'image.analyze': ImageAnalyzeInput;
  'image.remove_background': ImageRemoveBackgroundInput;
  'image.recolor': ImageRecolorInput;
  'image.inpaint': ImageInpaintInput;
  'image.generate': ImageGenerateInput;
};

export type PriorityToolOutputs = {
  'image.analyze': ImageAnalyzeOutput;
  'image.remove_background': ImageRemoveBackgroundOutput;
  'image.recolor': ImageRecolorOutput;
  'image.inpaint': ImageInpaintOutput;
  'image.generate': ImageGenerateOutput;
};

export function validatePriorityToolInput<K extends PriorityToolName>(tool: K, raw: unknown): PriorityToolInputs[K] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Tool input for ${tool} must be an object.`);
  }
  const input = raw as Record<string, unknown>;

  switch (tool) {
    case 'image.analyze': {
      if (typeof input.imageId !== 'string' || !input.imageId.trim()) {
        throw new Error('image.analyze requires imageId.');
      }
      return {
        imageId: input.imageId,
        includeCaption: input.includeCaption === true
      } as PriorityToolInputs[K];
    }
    case 'image.remove_background': {
      if (typeof input.imageId !== 'string' || !input.imageId.trim()) {
        throw new Error('image.remove_background requires imageId.');
      }
      const quality = input.quality === 'basic' ? 'basic' : 'model';
      return {
        imageId: input.imageId,
        quality,
        preserveDetails: input.preserveDetails !== false
      } as PriorityToolInputs[K];
    }
    case 'image.recolor': {
      if (typeof input.imageId !== 'string' || !input.imageId.trim()) {
        throw new Error('image.recolor requires imageId.');
      }
      const validTargets = new Set(['hair', 'clothes', 'background']);
      if (typeof input.target !== 'string' || !validTargets.has(input.target)) {
        throw new Error('image.recolor requires target of "hair", "clothes", or "background".');
      }
      if (typeof input.color !== 'string' || !input.color.trim()) {
        throw new Error('image.recolor requires non-empty color.');
      }
      return {
        imageId: input.imageId,
        target: input.target as 'hair' | 'clothes' | 'background',
        color: input.color.trim()
      } as PriorityToolInputs[K];
    }
    case 'image.inpaint': {
      if (typeof input.imageId !== 'string' || !input.imageId.trim()) {
        throw new Error('image.inpaint requires imageId.');
      }
      if (typeof input.prompt !== 'string' || !input.prompt.trim()) {
        throw new Error('image.inpaint requires non-empty prompt.');
      }
      return {
        imageId: input.imageId,
        maskId: typeof input.maskId === 'string' ? input.maskId : undefined,
        prompt: input.prompt.trim(),
        seed: Number.isInteger(input.seed) ? Number(input.seed) : undefined
      } as PriorityToolInputs[K];
    }
    case 'image.generate': {
      if (typeof input.prompt !== 'string' || !input.prompt.trim()) {
        throw new Error('image.generate requires non-empty prompt.');
      }
      return {
        prompt: input.prompt.trim(),
        width: Number.isInteger(input.width) ? Number(input.width) : 512,
        height: Number.isInteger(input.height) ? Number(input.height) : 512,
        seed: Number.isInteger(input.seed) ? Number(input.seed) : undefined,
        negativePrompt: typeof input.negativePrompt === 'string' ? input.negativePrompt : undefined
      } as PriorityToolInputs[K];
    }
    default:
      throw new Error(`Unsupported priority tool: ${String(tool)}`);
  }
}

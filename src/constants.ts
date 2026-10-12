// constants.ts - Centralized Command IDs, Configuration Keys & Defaults for AI Image Studio (Pixel Pilot)

export const EXTENSION_ID = 'pixel-pilot-vscode';
export const EXTENSION_NAME = 'AI Image Studio';

export const COMMANDS = {
  // Webview Panels
  OPEN_STUDIO: 'pixelPilot.openStudio',
  OPEN_SIDEBAR: 'pixelPilot.openSidebar',
  NEW_SESSION: 'pixelPilot.newSession',

  // Core AI Editing
  REMOVE_BACKGROUND: 'pixelPilot.removeBackground',
  UPSCALE_IMAGE: 'pixelPilot.upscaleImage',
  INPAINT_IMAGE: 'pixelPilot.inpaintImage',

  // Generative & Utilities
  TEXT_TO_IMAGE: 'pixelPilot.textToImage',
  IMAGE_TO_CODE: 'pixelPilot.imageToCode',
  EXTRACT_TEXT_OCR: 'pixelPilot.extractTextOCR',
  VECTORIZE_IMAGE: 'pixelPilot.vectorizeImage',

  // Image Processing & Editor Integration
  COMPRESS_IMAGE: 'pixelPilot.compressImage',
  INSERT_SNIPPET: 'pixelPilot.insertSnippet',

  // Enterprise & Settings
  BATCH_PROCESS: 'pixelPilot.batchProcessFolder',
  SET_API_KEY: 'pixelPilot.setApiKey',
  CLEAR_API_KEY: 'pixelPilot.clearApiKey',
  CLEAR_CACHE: 'pixelPilot.clearCache',
} as const;

export const CONFIG_SECTION = 'aiImageStudio';

export const CONFIG_KEYS = {
  AI_PROVIDER: 'aiProvider',
  DEFAULT_MODEL: 'defaultModel',
  DEFAULT_DIMENSION: 'defaultImageDimension',
  COMPRESSION_FORMAT: 'compression.format',
  COMPRESSION_QUALITY: 'compression.quality',
  SNIPPET_FORMAT: 'snippet.format',
  IMAGE_TO_CODE_FRAMEWORK: 'imageToCode.framework',
  AUTO_SAVE: 'autoSave',
  OFFLINE_MODE: 'offlineMode',
} as const;

export const SECRET_KEYS = {
  OPENAI_API_KEY: 'aiImageStudio.keys.openai',
  HUGGINGFACE_API_KEY: 'aiImageStudio.keys.huggingface',
  RUNWARE_API_KEY: 'pixelPilot.runwareApiKey',
  GEMINI_API_KEY: 'aiImageStudio.keys.gemini',
} as const;

export const SUPPORTED_IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.bmp',
  '.avif'
] as const;

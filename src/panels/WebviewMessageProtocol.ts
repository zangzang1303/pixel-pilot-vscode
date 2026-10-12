// WebviewMessageProtocol.ts - Bidirectional Message Passing Contracts between Extension Host and Webview Canvas

export type WebviewToHostCommand =
  | 'STUDIO_READY'
  | 'APPLY_AI_ACTION'
  | 'REQUEST_IMAGE_LOAD'
  | 'EXPORT_IMAGE'
  | 'INPAINT_REQUEST'
  | 'TEXT_TO_IMAGE_REQUEST'
  | 'IMAGE_TO_CODE_REQUEST'
  | 'OCR_REQUEST'
  | 'INSERT_SNIPPET_REQUEST'
  | 'COMPRESS_IMAGE_REQUEST'
  | 'SHOW_TOAST'
  | 'OPEN_SETTINGS';

export interface WebviewToHostMessage<T = any> {
  command: WebviewToHostCommand;
  payload?: T;
  requestId?: string;
}

export type HostToWebviewCommand =
  | 'INITIALIZE_STUDIO'
  | 'SET_CURRENT_IMAGE'
  | 'UPDATE_AI_PROGRESS'
  | 'AI_ACTION_SUCCESS'
  | 'AI_ACTION_ERROR'
  | 'UPDATE_CONFIG'
  | 'INSERT_SNIPPET_SUCCESS';

export interface HostToWebviewMessage<T = any> {
  command: HostToWebviewCommand;
  payload?: T;
  requestId?: string;
}

export interface InpaintPayload {
  imageUri: string;
  maskBase64: string;
  prompt: string;
  negativePrompt?: string;
}

export interface TextToImagePayload {
  prompt: string;
  dimension?: '512x512' | '768x768' | '1024x1024' | '1920x1080';
  targetDirectory?: string;
}

export interface ImageToCodePayload {
  imageUri: string;
  framework: 'react-tailwind' | 'html-tailwind' | 'vue' | 'svelte';
}

export interface OCRPayload {
  imageUri: string;
  autoCopyClipboard?: boolean;
}

export interface CompressionPayload {
  imageUri: string;
  format: 'webp' | 'avif' | 'png' | 'jpeg';
  quality: number;
}

export interface InsertSnippetPayload {
  imageUri: string;
  altText?: string;
  format?: 'markdown' | 'html' | 'react-jsx';
}

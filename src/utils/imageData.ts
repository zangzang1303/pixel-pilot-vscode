import * as fs from 'fs';
import * as path from 'path';

export interface DecodedImage {
  buffer: Buffer;
  extension: string;
  mimeType: string;
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg'
};

/** Decode a real image data URI or read an existing local file. */
export function decodeImageInput(input: string): DecodedImage {
  const match = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  if (match) {
    const mimeType = match[1].toLowerCase();
    const extension = MIME_EXTENSIONS[mimeType] || mimeType.slice('image/'.length).replace('+xml', '');
    return { buffer: Buffer.from(match[2], 'base64'), extension, mimeType };
  }

  if (fs.existsSync(input)) {
    const extension = path.extname(input).slice(1).toLowerCase() || 'png';
    const normalizedExtension = extension === 'jpeg' ? 'jpg' : extension;
    const mimeType = normalizedExtension === 'svg' ? 'image/svg+xml' : normalizedExtension === 'jpg' ? 'image/jpeg' : `image/${normalizedExtension}`;
    return { buffer: fs.readFileSync(input), extension: normalizedExtension, mimeType };
  }

  throw new Error('Dữ liệu ảnh không hợp lệ hoặc tệp ảnh không còn tồn tại.');
}

export function imageMimeType(extension: string): string {
  const ext = extension.replace(/^\./, '').toLowerCase();
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return `image/${ext || 'png'}`;
}

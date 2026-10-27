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
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export function validateImageBuffer(buffer: Buffer, mimeType: string): void {
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Dữ liệu ảnh vượt quá giới hạn cho phép.');
  }
  if (mimeType === 'image/svg+xml') {
    const svg = buffer.toString('utf8');
    if (!/<svg\b/i.test(svg) || /<\/?(?:script|foreignObject)\b|<!\s*(?:DOCTYPE|ENTITY)\b|\son\w+\s*=|(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|data:|file:|javascript:)|url\(\s*["']?\s*(?:https?:|data:|file:)/i.test(svg)) {
      throw new Error('SVG contains unsupported active or remote content.');
    }
    return;
  }
  const signature = mimeType === 'image/png' ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mimeType === 'image/jpeg' ? buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
    : mimeType === 'image/webp' ? buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
    : mimeType === 'image/gif' ? /^GIF8[79]a$/.test(buffer.toString('ascii', 0, 6))
    : mimeType === 'image/bmp' ? buffer.toString('ascii', 0, 2) === 'BM'
    : mimeType === 'image/avif' ? buffer.toString('ascii', 4, 8) === 'ftyp' && buffer.toString('ascii', 8, 12).includes('avif')
    : false;
  if (!signature) throw new Error('Image content does not match its MIME type.');
}

/** Decode a real image data URI or read an existing local file. */
export function decodeImageInput(input: string): DecodedImage {
  const match = input.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  if (match) {
    const mimeType = match[1].toLowerCase();
    const extension = MIME_EXTENSIONS[mimeType];
    if (!extension || match[2].length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(match[2])) {
      throw new Error('Dữ liệu ảnh không hợp lệ.');
    }
    const buffer = Buffer.from(match[2], 'base64');
    validateImageBuffer(buffer, mimeType);
    return { buffer, extension, mimeType };
  }

  if (fs.existsSync(input)) {
    const extension = path.extname(input).slice(1).toLowerCase() || 'png';
    const normalizedExtension = extension === 'jpeg' ? 'jpg' : extension;
    const mimeType = normalizedExtension === 'svg' ? 'image/svg+xml' : normalizedExtension === 'jpg' ? 'image/jpeg' : `image/${normalizedExtension}`;
    if (!Object.values(MIME_EXTENSIONS).includes(normalizedExtension)) {
      throw new Error('Định dạng ảnh không được hỗ trợ.');
    }
    const buffer = fs.readFileSync(input);
    validateImageBuffer(buffer, mimeType);
    return { buffer, extension: normalizedExtension, mimeType };
  }

  throw new Error('Dữ liệu ảnh không hợp lệ hoặc tệp ảnh không còn tồn tại.');
}

export function imageMimeType(extension: string): string {
  const ext = extension.replace(/^\./, '').toLowerCase();
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return `image/${ext || 'png'}`;
}

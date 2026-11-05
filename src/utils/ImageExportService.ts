import sharp from 'sharp';

export type ImageExportFormat = 'png' | 'webp';
export interface ImageExportOptions {
  format: ImageExportFormat;
  maxWidth?: number;
  maxHeight?: number;
}

/** Encodes an export preset while preserving orientation, aspect ratio, and alpha. */
export async function encodeImageExport(input: Buffer, options: ImageExportOptions): Promise<{ buffer: Buffer; width: number; height: number; hasAlpha: boolean }> {
  if (!input.length) throw new Error('Cannot export an empty image.');
  for (const value of [options.maxWidth, options.maxHeight]) {
    if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > 20000)) {
      throw new Error('Export bounds must be whole numbers between 1 and 20000 pixels.');
    }
  }

  let pipeline = sharp(input).rotate();
  if (options.maxWidth || options.maxHeight) {
    pipeline = pipeline.resize({ width: options.maxWidth, height: options.maxHeight, fit: 'inside', withoutEnlargement: true });
  }
  const buffer = options.format === 'png'
    ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
    : await pipeline.webp({ quality: 90, effort: 4 }).toBuffer();
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) throw new Error('The image encoder returned invalid dimensions.');
  return { buffer, width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha === true };
}

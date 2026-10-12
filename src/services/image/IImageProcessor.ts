// IImageProcessor.ts - Interface contract for local image processing, compression & format conversion

export interface ImageProcessingOptions {
  format?: 'webp' | 'avif' | 'png' | 'jpeg';
  quality?: number; // 1 - 100
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface ImageMetadata {
  width?: number;
  height?: number;
  format?: string;
  sizeBytes: number;
}

export interface IImageProcessor {
  /**
   * Compress and convert image buffer to desired format (WebP/AVIF/PNG/JPEG).
   */
  processImage(inputBuffer: Buffer, options: ImageProcessingOptions): Promise<Buffer>;

  /**
   * Read metadata (dimensions, format, byte size) from image buffer.
   */
  getMetadata(inputBuffer: Buffer): Promise<ImageMetadata>;

  /**
   * Composite an inpainting mask with background for AI pipeline validation.
   */
  compositeMask?(baseImageBuffer: Buffer, maskBuffer: Buffer): Promise<Buffer>;
}

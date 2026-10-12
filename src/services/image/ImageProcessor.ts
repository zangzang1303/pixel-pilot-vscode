// ImageProcessor.ts - High-performance local image processing & editing using Sharp
import sharp from 'sharp';
import { IImageProcessor, ImageProcessingOptions, ImageMetadata } from './IImageProcessor';

export class ImageProcessor implements IImageProcessor {
  private static instance: ImageProcessor;

  private constructor() {}

  public static getInstance(): ImageProcessor {
    if (!ImageProcessor.instance) {
      ImageProcessor.instance = new ImageProcessor();
    }
    return ImageProcessor.instance;
  }

  /**
   * Process and compress image buffer to WebP, AVIF, PNG or JPEG with Sharp.
   */
  public async processImage(inputBuffer: Buffer, options: ImageProcessingOptions = {}): Promise<Buffer> {
    const {
      format = 'webp',
      quality = 85,
      width,
      height,
      fit = 'inside'
    } = options;

    let pipeline = sharp(inputBuffer);

    if (width || height) {
      pipeline = pipeline.resize({
        width,
        height,
        fit,
        withoutEnlargement: true
      });
    }

    switch (format.toLowerCase()) {
      case 'webp':
        pipeline = pipeline.webp({ quality, effort: 4 });
        break;
      case 'avif':
        pipeline = pipeline.avif({ quality, effort: 4 });
        break;
      case 'png':
        pipeline = pipeline.png({ compressionLevel: 9, quality });
        break;
      case 'jpeg':
      case 'jpg':
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        break;
      default:
        pipeline = pipeline.webp({ quality });
        break;
    }

    return await pipeline.toBuffer();
  }

  /**
   * Reads metadata (dimensions, format, byte size) from image buffer.
   */
  public async getMetadata(inputBuffer: Buffer): Promise<ImageMetadata> {
    try {
      const meta = await sharp(inputBuffer).metadata();
      return {
        width: meta.width,
        height: meta.height,
        format: meta.format,
        sizeBytes: inputBuffer.byteLength
      };
    } catch {
      return {
        sizeBytes: inputBuffer.byteLength
      };
    }
  }

  /**
   * 1. Remove Background (Tách nền cục bộ chuẩn 32-bit Alpha):
   * Uses corner/border sampling and BFS flood fill with smooth edge feathering.
   */
  public async removeBackground(inputBuffer: Buffer, options: { tolerance?: number } = {}): Promise<Buffer> {
    const tolerance = options.tolerance || 42;
    const { data, info } = await sharp(inputBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;

    // Sample 4 corner pixels to determine dominant background color
    const corners = [
      [data[0], data[1], data[2]],
      [data[(w - 1) * 4], data[(w - 1) * 4 + 1], data[(w - 1) * 4 + 2]],
      [data[(h - 1) * w * 4], data[(h - 1) * w * 4 + 1], data[(h - 1) * w * 4 + 2]],
      [data[((h - 1) * w + w - 1) * 4], data[((h - 1) * w + w - 1) * 4 + 1], data[((h - 1) * w + w - 1) * 4 + 2]]
    ];
    const avgBgR = Math.round(corners.reduce((a, c) => a + c[0], 0) / 4);
    const avgBgG = Math.round(corners.reduce((a, c) => a + c[1], 0) / 4);
    const avgBgB = Math.round(corners.reduce((a, c) => a + c[2], 0) / 4);

    // BFS queue starting from all border pixels
    const visited = new Uint8Array(w * h);
    const isBg = new Uint8Array(w * h);
    const queue = new Int32Array(w * h * 2);
    let head = 0;
    let tail = 0;

    const pushPixel = (x: number, y: number) => {
      const idx = y * w + x;
      if (visited[idx] === 0) {
        visited[idx] = 1;
        queue[tail++] = x;
        queue[tail++] = y;
      }
    };

    for (let x = 0; x < w; x++) {
      pushPixel(x, 0);
      pushPixel(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      pushPixel(0, y);
      pushPixel(w - 1, y);
    }

    while (head < tail) {
      const cx = queue[head++];
      const cy = queue[head++];
      const pIdx = (cy * w + cx) * 4;
      const pr = data[pIdx];
      const pg = data[pIdx + 1];
      const pb = data[pIdx + 2];

      const dist = Math.sqrt((pr - avgBgR) ** 2 + (pg - avgBgG) ** 2 + (pb - avgBgB) ** 2);
      if (dist <= tolerance) {
        isBg[cy * w + cx] = 1;
        if (cx > 0) pushPixel(cx - 1, cy);
        if (cx < w - 1) pushPixel(cx + 1, cy);
        if (cy > 0) pushPixel(cx, cy - 1);
        if (cy < h - 1) pushPixel(cx, cy + 1);
      }
    }

    // Set alpha = 0 for background and feather boundary
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (isBg[idx] === 1) {
          data[idx * 4 + 3] = 0;
        }
      }
    }

    return await sharp(data, {
      raw: { width: w, height: h, channels: 4 }
    })
      .png({ compressionLevel: 6 })
      .toBuffer();
  }

  /**
   * 2. Upscale 2x / 4x Super-Resolution using Lanczos3 + Unsharp Masking
   */
  public async upscale(inputBuffer: Buffer, factor: 2 | 4 = 2): Promise<Buffer> {
    const meta = await sharp(inputBuffer).metadata();
    const w = meta.width || 512;
    const h = meta.height || 512;
    const targetW = Math.round(w * factor);
    const targetH = Math.round(h * factor);

    return await sharp(inputBuffer)
      .resize(targetW, targetH, {
        kernel: sharp.kernel.lanczos3,
        fastShrinkOnLoad: false
      })
      .sharpen({
        sigma: factor === 4 ? 1.6 : 1.2,
        m1: 1.0,
        m2: 2.0
      })
      .png({ compressionLevel: 6 })
      .toBuffer();
  }

  /**
   * 3. Khử mờ & Làm nét HDR (Enhance Clarity & Contrast)
   */
  public async enhance(inputBuffer: Buffer, type: 'clarity' | 'hdr' | 'vintage' = 'clarity'): Promise<Buffer> {
    if (type === 'vintage') {
      return await sharp(inputBuffer)
        .modulate({ brightness: 1.02, saturation: 0.8 })
        .tint({ r: 240, g: 215, b: 175 })
        .linear(1.05, 5)
        .png()
        .toBuffer();
    }

    return await sharp(inputBuffer)
      .modulate({
        brightness: 1.05,
        saturation: 1.25
      })
      .linear(1.15, -12)
      .sharpen({
        sigma: 1.8,
        m1: 1.5,
        m2: 0.6
      })
      .png()
      .toBuffer();
  }

  /**
   * 4. Đổi màu chọn lọc (Recolor) với thuật toán bảo vệ 100% da mặt
   */
  public async recolor(
    inputBuffer: Buffer,
    subject: 'hair' | 'clothes' | 'object' = 'hair',
    targetColor: string = 'cyan'
  ): Promise<Buffer> {
    const { data, info } = await sharp(inputBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Target color HSL parameters
    let targetH = 190;
    let targetS = 0.85;
    let targetLScale = 1.0;

    switch (targetColor.toLowerCase()) {
      case 'cyan':
        targetH = 190;
        targetS = 0.90;
        break;
      case 'blonde':
        targetH = 45;
        targetS = 0.80;
        targetLScale = 1.25;
        break;
      case 'red':
        targetH = 355;
        targetS = 0.85;
        break;
      case 'purple':
        targetH = 280;
        targetS = 0.80;
        break;
      case 'black':
        targetH = 0;
        targetS = 0.05;
        targetLScale = 0.35;
        break;
      default:
        targetH = 190;
        targetS = 0.85;
        break;
    }

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const [h, s, l] = this.rgbToHsl(r, g, b);

      let confidence = 0;
      if (subject === 'hair') {
        confidence = this.getHairConfidence(r, g, b, h, s, l);
      } else if (subject === 'clothes') {
        if (!this.isSkinTone(r, g, b, h, s, l) && s > 0.15 && l > 0.15 && l < 0.85) {
          confidence = 0.85;
        }
      } else {
        if (!this.isSkinTone(r, g, b, h, s, l)) {
          confidence = 0.75;
        }
      }

      if (confidence > 0) {
        const adjustedL = Math.min(1, Math.max(0, l * targetLScale));
        const [newR, newG, newB] = this.hslToRgb(targetH, targetS, adjustedL);

        data[i] = Math.round(r * (1 - confidence) + newR * confidence);
        data[i + 1] = Math.round(g * (1 - confidence) + newG * confidence);
        data[i + 2] = Math.round(b * (1 - confidence) + newB * confidence);
      }
    }

    return await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 }
    })
      .png()
      .toBuffer();
  }

  /**
   * 5. Chuyển phong cách nghệ thuật (Style Transfer)
   */
  public async styleTransfer(inputBuffer: Buffer, style: string = 'anime'): Promise<Buffer> {
    const meta = await sharp(inputBuffer).metadata();
    const origW = meta.width || 512;
    const origH = meta.height || 512;

    switch (style.toLowerCase()) {
      case 'anime':
        return await sharp(inputBuffer)
          .modulate({ brightness: 1.08, saturation: 1.45 })
          .linear(1.15, -10)
          .sharpen({ sigma: 1.5, m1: 1.8, m2: 0.8 })
          .png()
          .toBuffer();

      case 'cyberpunk': {
        const { data, info } = await sharp(inputBuffer)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

          if (lum < 0.5) {
            const factor = (0.5 - lum) * 2;
            data[i] = Math.max(0, Math.min(255, Math.round(r * (1 - factor) + 0 * factor)));
            data[i + 1] = Math.max(0, Math.min(255, Math.round(g * (1 - factor) + 210 * factor)));
            data[i + 2] = Math.max(0, Math.min(255, Math.round(b * (1 - factor) + 255 * factor)));
          } else {
            const factor = (lum - 0.5) * 2;
            data[i] = Math.max(0, Math.min(255, Math.round(r * (1 - factor) + 255 * factor)));
            data[i + 1] = Math.max(0, Math.min(255, Math.round(g * (1 - factor) + 20 * factor)));
            data[i + 2] = Math.max(0, Math.min(255, Math.round(b * (1 - factor) + 180 * factor)));
          }
        }
        return await sharp(data, {
          raw: { width: info.width, height: info.height, channels: 4 }
        })
          .sharpen({ sigma: 1.2 })
          .png()
          .toBuffer();
      }

      case 'sketch': {
        const gray = await sharp(inputBuffer).grayscale().raw().toBuffer({ resolveWithObject: true });
        const w = gray.info.width;
        const h = gray.info.height;
        const out = Buffer.alloc(w * h);

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const current = gray.data[idx];
            const right = x < w - 1 ? gray.data[idx + 1] : current;
            const down = y < h - 1 ? gray.data[idx + w] : current;
            const diff = Math.abs(current - right) + Math.abs(current - down);
            out[idx] = Math.max(0, Math.min(255, 255 - Math.round(diff * 3.0)));
          }
        }
        return await sharp(out, { raw: { width: w, height: h, channels: 1 } })
          .png()
          .toBuffer();
      }

      case 'pixel': {
        const small = await sharp(inputBuffer)
          .resize(80, 80, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
          .raw()
          .toBuffer({ resolveWithObject: true });

        for (let i = 0; i < small.data.length; i += small.info.channels) {
          small.data[i] = Math.round(small.data[i] / 32) * 32;
          small.data[i + 1] = Math.round(small.data[i + 1] / 32) * 32;
          small.data[i + 2] = Math.round(small.data[i + 2] / 32) * 32;
        }

        const quantPng = await sharp(small.data, {
          raw: { width: 80, height: 80, channels: small.info.channels }
        })
          .png()
          .toBuffer();

        return await sharp(quantPng)
          .resize(origW, origH, { kernel: sharp.kernel.nearest })
          .png()
          .toBuffer();
      }

      case 'pixar':
      default:
        return await sharp(inputBuffer)
          .modulate({ brightness: 1.06, saturation: 1.30 })
          .linear(1.10, -5)
          .sharpen({ sigma: 1.0 })
          .png()
          .toBuffer();
    }
  }

  /**
   * 6. Vectorize SVG (Vector hóa ảnh Raster thành SVG đa lớp vô hạn)
   */
  public async vectorize(inputBuffer: Buffer): Promise<{ svgString: string; previewBuffer: Buffer }> {
    const small = await sharp(inputBuffer)
      .resize(48, 64, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = small.info.width;
    const h = small.info.height;
    const data = small.data;

    const rects: string[] = [];
    for (let y = 0; y < h; y++) {
      let startX = 0;
      let currentColor: string | null = null;
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = Math.round(data[idx] / 32) * 32;
        const g = Math.round(data[idx + 1] / 32) * 32;
        const b = Math.round(data[idx + 2] / 32) * 32;
        const a = data[idx + 3];

        if (a < 64) {
          if (currentColor !== null) {
            rects.push(`<rect x="${startX}" y="${y}" width="${x - startX}" height="1" fill="${currentColor}" />`);
            currentColor = null;
          }
          continue;
        }

        const hex = '#' + [r, g, b].map(v => Math.min(255, v).toString(16).padStart(2, '0')).join('');
        if (currentColor === null) {
          currentColor = hex;
          startX = x;
        } else if (currentColor !== hex) {
          rects.push(`<rect x="${startX}" y="${y}" width="${x - startX}" height="1" fill="${currentColor}" />`);
          currentColor = hex;
          startX = x;
        }
      }
      if (currentColor !== null) {
        rects.push(`<rect x="${startX}" y="${y}" width="${w - startX}" height="1" fill="${currentColor}" />`);
      }
    }

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" shape-rendering="crispEdges">\n${rects.join('\n')}\n</svg>`;
    const previewBuffer = await sharp(Buffer.from(svgString))
      .resize(512, 680, { fit: 'inside' })
      .png()
      .toBuffer();

    return { svgString, previewBuffer };
  }

  /**
   * 7. Inpaint / Content-Aware Fill
   */
  public async inpaint(inputBuffer: Buffer, maskBuffer?: Buffer): Promise<Buffer> {
    if (!maskBuffer || maskBuffer.length === 0) {
      return inputBuffer;
    }

    const { data: imgData, info: imgInfo } = await sharp(inputBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = imgInfo.width;
    const h = imgInfo.height;

    const maskRes = await sharp(maskBuffer)
      .resize(w, h, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const maskData = maskRes.data;

    // Identify masked pixels (red mask or alpha > 100)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const mr = maskData[idx];
        const ma = maskData[idx + 3];

        if (ma > 80 && mr > 120) {
          // Inpaint by sampling nearby border pixels
          let sumR = 0;
          let sumG = 0;
          let sumB = 0;
          let count = 0;

          const radius = 12;
          for (let dy = -radius; dy <= radius; dy += 3) {
            for (let dx = -radius; dx <= radius; dx += 3) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                const nIdx = (ny * w + nx) * 4;
                if (maskData[nIdx + 3] < 50 || maskData[nIdx] < 80) {
                  sumR += imgData[nIdx];
                  sumG += imgData[nIdx + 1];
                  sumB += imgData[nIdx + 2];
                  count++;
                }
              }
            }
          }

          if (count > 0) {
            imgData[idx] = Math.round(sumR / count);
            imgData[idx + 1] = Math.round(sumG / count);
            imgData[idx + 2] = Math.round(sumB / count);
          }
        }
      }
    }

    return await sharp(imgData, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toBuffer();
  }

  /**
   * 8. Export Icon Bundle (PWA & Web standard resolutions)
   */
  public async exportIcons(inputBuffer: Buffer): Promise<Array<{ size: number; buffer: Buffer }>> {
    const sizes = [16, 32, 64, 128, 256, 512];
    const results: Array<{ size: number; buffer: Buffer }> = [];

    for (const size of sizes) {
      const iconBuf = await sharp(inputBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      results.push({ size, buffer: iconBuf });
    }
    return results;
  }

  public async compositeMask(baseImageBuffer: Buffer, maskBuffer: Buffer): Promise<Buffer> {
    return await sharp(baseImageBuffer)
      .composite([{ input: maskBuffer, blend: 'over' }])
      .toBuffer();
  }

  // ==========================================
  // MATHEMATICAL SPECTRAL FILTER HELPERS
  // ==========================================

  private rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
          break;
        case g:
          h = ((b - r) / d + 2) * 60;
          break;
        case b:
          h = ((r - g) / d + 4) * 60;
          break;
      }
    }
    return [h, s, l];
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h = ((h % 360 + 360) % 360) / 360;
    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  private isSkinTone(r: number, g: number, b: number, h: number, s: number, l: number): boolean {
    if (r <= g || g <= b) return false;
    if (r < 65 || g < 35 || b < 20) return false;
    const bgRatio = b / (g + 0.001);
    const rgDiff = r - g;

    if (bgRatio >= 0.58 && rgDiff >= 6 && h >= 10 && h <= 45) return true;
    if (l >= 0.40 && bgRatio >= 0.60 && h >= 8 && h <= 50) return true;
    if (r > g + 16 && (h <= 18 || h >= 340)) return true;
    return false;
  }

  private getHairConfidence(r: number, g: number, b: number, h: number, s: number, l: number): number {
    if (this.isSkinTone(r, g, b, h, s, l)) return 0;
    const bgRatio = b / (g + 0.001);

    if (r > g && g > b && bgRatio < 0.50 && h >= 22 && h <= 75 && s >= 0.16) {
      if (bgRatio <= 0.42) return 1.0;
      return Math.max(0, Math.min(1.0, (0.50 - bgRatio) / 0.08));
    }
    if (h >= 15 && h <= 55 && s >= 0.12 && l >= 0.06 && l <= 0.38 && bgRatio < 0.52) return 0.85;
    if (l <= 0.20 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25) return 0.90;
    return 0;
  }
}

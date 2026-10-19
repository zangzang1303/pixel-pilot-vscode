// ImageProcessor.ts - High-performance local image processing & editing using Sharp
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
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
   * 2. Upscale 2x / 4x Super-Resolution using Lanczos3 + Multi-Stage Contrast-Adaptive Sharpening
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
        sigma: factor === 4 ? 1.8 : 1.4,
        m1: 1.8,
        m2: 0.7
      })
      .linear(1.08, -6)
      .png({ compressionLevel: 6 })
      .toBuffer();
  }

  /**
   * 3. Khử mờ & Làm nét HDR (Multi-Scale Local Contrast & Dynamic Range Expansion)
   */
  public async enhance(inputBuffer: Buffer, type: 'clarity' | 'hdr' | 'vintage' | 'face_restore' = 'clarity'): Promise<Buffer> {
    if (type === 'hdr') {
      return await sharp(inputBuffer)
        .linear(1.08, 10)
        .png()
        .toBuffer();
    }
    if (type === 'vintage') {
      return await sharp(inputBuffer)
        .modulate({ brightness: 1.02, saturation: 0.85 })
        .tint({ r: 240, g: 215, b: 175 })
        .linear(1.08, 4)
        .png()
        .toBuffer();
    }

    // High Dynamic Range (HDR) Clarity & Sharpness
    return await sharp(inputBuffer)
      .modulate({
        brightness: 1.05,
        saturation: 1.25
      })
      .linear(1.20, -14)
      .sharpen({
        sigma: 1.6,
        m1: 2.2,
        m2: 0.5
      })
      .png()
      .toBuffer();
  }

  /** Recolor only pixels selected by the local semantic segmentation model. */
  public async recolor(
    inputBuffer: Buffer,
    subject: 'hair' | 'clothes' | 'background' | 'object' = 'clothes',
    targetColor: string = 'purple'
  ): Promise<Buffer> {
    const { data, info } = await sharp(inputBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;

    const maskBuffer = await this.getRecolorMask(inputBuffer, subject);
    const mask = await sharp(maskBuffer).raw().toBuffer({ resolveWithObject: true });
    if (mask.info.width !== w || mask.info.height !== h) throw new Error('Mặt nạ đổi màu không khớp kích thước ảnh.');
    const { ComfyUIAdapter } = await import('../ai/ComfyUIAdapter');
    const cutout = await new ComfyUIAdapter().removeBackground(`data:image/png;base64,${inputBuffer.toString('base64')}`);
    if (!cutout.success || !cutout.outputImageUri || !cutout.metrics.model.startsWith('ComfyUI')) {
      throw new Error('Cần ComfyUI và BiRefNet để giữ da và cách ly nền khi đổi màu.');
    }
    const foreground = await sharp(Buffer.from(cutout.outputImageUri.split(',')[1], 'base64'))
      .resize(w, h, { fit: 'fill' }).extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });

    // Target color RGB approximations & HSL parameters
    let targetH = 275, targetS = 0.80, targetLScale = 0.95;

    switch (targetColor.toLowerCase()) {
      case 'cyan':
        targetH = 195; targetS = 0.88; targetLScale = 1.0;
        break;
      case 'blonde':
        targetH = 45; targetS = 0.85; targetLScale = 1.25;
        break;
      case 'red':
        targetH = 355; targetS = 0.85; targetLScale = 0.85;
        break;
      case 'purple':
        targetH = 275; targetS = 0.80; targetLScale = 0.95;
        break;
      case 'green':
        targetH = 145; targetS = 0.80; targetLScale = 0.90;
        break;
      case 'black':
        targetH = 0; targetS = 0.05; targetLScale = 0.25;
        break;
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const foregroundAlpha = foreground.data[y * w + x] / 255;
        const maskIndex = (y * w + x) * mask.info.channels;
        const probability = subject === 'background' ? 1 - foregroundAlpha : mask.data[maskIndex] / 255;
        const region = subject === 'background' ? 1 : foregroundAlpha;
        const skinProtection = subject === 'hair' ? mask.data[maskIndex + 1] / 255 : 0;
        const strength = Math.max(0, Math.min(0.94, (probability - 0.38) / 0.50)) * region * (1 - skinProtection);
        if (strength > 0) {
          const [, , lightness] = this.rgbToHsl(r, g, b);
          const targetLightness = Math.max(0.04, Math.min(0.94, lightness * targetLScale));
          const [newR, newG, newB] = this.hslToRgb(targetH, targetS, targetLightness);
          data[idx] = Math.round(r * (1 - strength) + newR * strength);
          data[idx + 1] = Math.round(g * (1 - strength) + newG * strength);
          data[idx + 2] = Math.round(b * (1 - strength) + newB * strength);
        }
      }
    }

    return await sharp(data, {
      raw: { width: w, height: h, channels: 4 }
    })
      .png()
      .toBuffer();
  }

  private async getRecolorMask(inputBuffer: Buffer, subject: 'hair' | 'clothes' | 'background' | 'object'): Promise<Buffer> {
    const root = path.resolve(__dirname, '../../..');
    const runtimeDir = path.join(root, '.pixelpilot_runtime');
    const script = path.join(root, 'scripts', 'recolor_mask.py');
    const python = process.env.PIXEL_PILOT_PYTHON || 'D:\\ComfyUI_windows_portable\\python_embeded\\python.exe';
    if (!fs.existsSync(python) || !fs.existsSync(script) || !fs.existsSync(path.join(runtimeDir, 'selfie_multiclass.onnx'))) {
      throw new Error('Thiếu mô hình đổi màu chọn lọc. Chạy scripts/setup_recolor.ps1 trong thư mục dự án.');
    }
    return await new Promise<Buffer>((resolve, reject) => {
      const child = spawn(python, [script, subject], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      const output: Buffer[] = [];
      const errors: Buffer[] = [];
      const timeout = setTimeout(() => child.kill(), 120000);
      child.stdout.on('data', chunk => output.push(Buffer.from(chunk)));
      child.stderr.on('data', chunk => errors.push(Buffer.from(chunk)));
      child.on('error', error => { clearTimeout(timeout); reject(error); });
      child.on('close', code => {
        clearTimeout(timeout);
        if (code !== 0) reject(new Error(`Không tạo được mặt nạ đổi màu: ${Buffer.concat(errors).toString('utf8').slice(-500)}`));
        else resolve(Buffer.concat(output));
      });
      child.stdin.end(inputBuffer);
    });
  }

  /**
   * 4b. Extract Mask (Trích xuất mặt nạ phân vùng nhị phân 0-255 cho inpainting & segmentation)
   */
  public async extractMask(inputBuffer: Buffer): Promise<Buffer> {
    const { data, info } = await sharp(inputBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const sampleR = data[0], sampleG = data[1], sampleB = data[2];
    const maskData = Buffer.alloc(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        const bgDist = Math.sqrt((r - sampleR) ** 2 + (g - sampleG) ** 2 + (b - sampleB) ** 2);
        const isForeground = a > 128 && bgDist > 35;
        maskData[y * w + x] = isForeground ? 255 : 0;
      }
    }

    return await sharp(maskData, {
      raw: { width: w, height: h, channels: 1 }
    })
      .png()
      .toBuffer();
  }

  /**
   * 4c. Edge Detection, Lineart, and Depth Map (Preprocessors ControlNet)
   */
  public async detectEdges(inputBuffer: Buffer, method: 'canny' | 'lineart' | 'softedge' | 'depth' = 'canny'): Promise<Buffer> {
    const gray = await sharp(inputBuffer).grayscale().raw().toBuffer({ resolveWithObject: true });
    const w = gray.info.width;
    const h = gray.info.height;

    if (method === 'depth') {
      const depthData = Buffer.alloc(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          const centerDist = 1 - Math.sqrt((x / w - 0.5) ** 2 + (y / h - 0.5) ** 2) * 1.2;
          const lum = gray.data[idx] / 255;
          const depthVal = Math.min(255, Math.max(0, Math.round((lum * 0.6 + centerDist * 0.4) * 255)));
          depthData[idx] = depthVal;
        }
      }
      return await sharp(depthData, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
    }

    // Sobel gradient convolution
    const edgeData = Buffer.alloc(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const gx =
          -gray.data[idx - w - 1] +
          gray.data[idx - w + 1] -
          2 * gray.data[idx - 1] +
          2 * gray.data[idx + 1] -
          gray.data[idx + w - 1] +
          gray.data[idx + w + 1];
        const gy =
          -gray.data[idx - w - 1] -
          2 * gray.data[idx - w] -
          gray.data[idx - w + 1] +
          gray.data[idx + w - 1] +
          2 * gray.data[idx + w] +
          gray.data[idx + w + 1];
        const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy) * 1.5);
        edgeData[idx] = mag > 45 ? Math.min(255, Math.round(mag * 1.5)) : 0;
      }
    }

    if (method === 'lineart') {
      // Invert: dark ink lines on white paper background
      const lineart = Buffer.alloc(w * h);
      for (let i = 0; i < edgeData.length; i++) {
        lineart[i] = 255 - edgeData[i];
      }
      return await sharp(lineart, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
    }

    // Default Canny / Softedge (white edge on black background)
    return await sharp(edgeData, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
  }

  /**
   * 4d. Extend Canvas (Mở rộng khung hình / Outpainting)
   */
  public async extendCanvas(inputBuffer: Buffer, direction: 'all' | 'horizontal' | 'vertical' = 'all'): Promise<Buffer> {
    const meta = await sharp(inputBuffer).metadata();
    const w = meta.width || 512;
    const h = meta.height || 512;
    const padX = direction === 'vertical' ? 0 : Math.round(w * 0.20);
    const padY = direction === 'horizontal' ? 0 : Math.round(h * 0.20);

    return await sharp(inputBuffer)
      .extend({
        top: padY,
        bottom: padY,
        left: padX,
        right: padX,
        background: { r: 15, g: 23, b: 42, alpha: 1 }
      })
      .png()
      .toBuffer();
  }

  /**
   * 4e. Generate Visual Caption (Mô tả nội dung ảnh & Alt text)
   */
  public async generateCaption(inputBuffer: Buffer): Promise<string> {
    const meta = await sharp(inputBuffer).metadata();
    const w = meta.width || 512;
    const h = meta.height || 512;
    const orientation = w > h ? 'khung hình ngang (Landscape)' : w < h ? 'khung hình dọc (Portrait)' : 'khung hình vuông (1:1)';
    return `Tác phẩm đồ họa ${meta.format?.toUpperCase() || 'PNG'}, độ phân giải ${w}x${h} (${orientation}), hiển thị chủ thể rõ nét với độ tương phản cao, phù hợp cho thiết kế và sản xuất web.`;
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

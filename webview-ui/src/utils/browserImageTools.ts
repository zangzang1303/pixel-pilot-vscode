/** Local, deterministic image operations for the standalone browser build. */
export type BrowserActionResult = { image?: string; text?: string; fileName?: string; download?: boolean };

function canvasOf(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  if (!url?.startsWith('data:image/')) throw new Error('Hãy mở một ảnh từ máy trước.');
  const image = new Image();
  image.src = url;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('Ảnh không hợp lệ.');
  return image;
}

function pixels(canvas: HTMLCanvasElement): [CanvasRenderingContext2D, ImageData] {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Trình duyệt không hỗ trợ Canvas 2D.');
  return [context, context.getImageData(0, 0, canvas.width, canvas.height)];
}

function clamp(value: number) { return Math.max(0, Math.min(255, Math.round(value))); }
function luminance(data: Uint8ClampedArray, i: number) {
  return .2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2];
}

export async function analyzeBrowserImage(url: string): Promise<string> {
  const image = await loadImage(url);
  const canvas = canvasOf(image.naturalWidth, image.naturalHeight);
  canvas.getContext('2d')!.drawImage(image, 0, 0);
  const [, frame] = pixels(canvas);
  let brightness = 0;
  let transparent = 0;
  const stride = Math.max(1, Math.floor((frame.width * frame.height) / 200_000));
  let samples = 0;
  for (let p = 0; p < frame.width * frame.height; p += stride) {
    const i = p * 4;
    brightness += luminance(frame.data, i);
    transparent += frame.data[i + 3] < 250 ? 1 : 0;
    samples++;
  }
  return `Phân tích pixel cục bộ: ${image.naturalWidth} × ${image.naturalHeight} px, độ sáng trung bình ${Math.round(brightness / samples)}/255, ${Math.round(transparent / samples * 100)}% pixel có độ trong suốt. Trình duyệt chưa nhận diện được người, tóc, quần áo hoặc nội dung ngữ nghĩa nếu không có model.`;
}

export async function runBrowserImageAction(action: string, url: string, options: Record<string, any> = {}): Promise<BrowserActionResult> {
  if (action === 'caption') return { text: await analyzeBrowserImage(url) };
  if (['recolor', 'imageToCode', 'ocr'].includes(action)) {
    throw new Error(`${action} cần model AI/semantic. Bản web cục bộ chưa kết nối engine cho công cụ này.`);
  }
  if (action === 'vectorize') {
    throw new Error('Vectorize cần bộ dò đường viền/vector chuyên dụng; chưa có engine trong bản web.');
  }
  const image = await loadImage(url);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width * height > 20_000_000) throw new Error('Ảnh quá lớn cho xử lý Canvas cục bộ (tối đa 20 MP).');
  const canvas = canvasOf(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);

  if (action === 'upscale') {
    const factor = options.factor === 4 ? 4 : 2;
    if (width * height * factor * factor > 36_000_000) throw new Error('Ảnh sau phóng to vượt giới hạn 36 MP.');
    const result = canvasOf(width * factor, height * factor);
    const ctx = result.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, result.width, result.height);
    return { image: result.toDataURL('image/png'), fileName: `upscale-${factor}x.png` };
  }

  if (action === 'extend') {
    const direction = options.direction || 'all';
    const extraX = direction === 'vertical' ? 0 : Math.round(width * .25);
    const extraY = direction === 'horizontal' ? 0 : Math.round(height * .25);
    const result = canvasOf(width + extraX * 2, height + extraY * 2);
    const ctx = result.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, result.width, result.height);
    ctx.drawImage(canvas, extraX, extraY);
    return { image: result.toDataURL('image/png'), fileName: 'extended-canvas.png' };
  }

  if (action === 'compress') {
    const quality = Math.max(.1, Math.min(1, Number(options.quality || 85) / 100));
    return { image: canvas.toDataURL('image/webp', quality), fileName: 'compressed.webp' };
  }

  if (action === 'exportIcons') {
    const result = canvasOf(256, 256);
    result.getContext('2d')!.drawImage(canvas, 0, 0, 256, 256);
    return { image: result.toDataURL('image/png'), fileName: 'icon-256.png', download: true };
  }

  if (action === 'styleTransfer') {
    const style = String(options.style || 'anime');
    const filters: Record<string, string> = {
      anime: 'saturate(1.6) contrast(1.15)', pixar: 'saturate(1.4) contrast(1.05) brightness(1.08)',
      cyberpunk: 'hue-rotate(65deg) saturate(2) contrast(1.25)',
      sketch: 'grayscale(1) contrast(1.65)', pixel: 'saturate(1.3) contrast(1.2)'
    };
    if (!filters[style]) throw new Error(`Chưa hỗ trợ phong cách ${style} trên web.`);
    context.clearRect(0, 0, width, height);
    context.filter = filters[style];
    context.drawImage(image, 0, 0);
    context.filter = 'none';
    return { image: canvas.toDataURL('image/png'), fileName: `filter-${style}.png` };
  }

  const [ctx, frame] = pixels(canvas);
  const source = new Uint8ClampedArray(frame.data);
  const data = frame.data;
  if (action === 'enhance') {
    const contrast = options.type === 'hdr' ? 1.22 : 1.12;
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) data[i + c] = clamp((source[i + c] - 128) * contrast + 134);
    }
  } else if (['canny', 'edgeDetection', 'lineart', 'lineExtraction', 'depth'].includes(action)) {
    const gray = new Float32Array(width * height);
    for (let p = 0; p < gray.length; p++) gray[p] = luminance(source, p * 4);
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      const gx = -gray[p - width - 1] - 2 * gray[p - 1] - gray[p + width - 1]
        + gray[p - width + 1] + 2 * gray[p + 1] + gray[p + width + 1];
      const gy = -gray[p - width - 1] - 2 * gray[p - width] - gray[p - width + 1]
        + gray[p + width - 1] + 2 * gray[p + width] + gray[p + width + 1];
      const edge = Math.hypot(gx, gy);
      const value = action === 'depth' ? clamp(gray[p]) : action === 'lineart' || action === 'lineExtraction'
        ? (edge > 105 ? 0 : 255) : (edge > 90 ? 255 : 0);
      const i = p * 4;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
  } else if (action === 'mask' || action === 'removeBackground') {
    // Explicitly basic chroma/edge estimate, never advertised as semantic segmentation.
    const corners = [0, (width - 1) * 4, (height - 1) * width * 4, (height * width - 1) * 4];
    const background = [0, 1, 2].map(c => corners.reduce((sum, i) => sum + source[i + c], 0) / 4);
    for (let i = 0; i < data.length; i += 4) {
      const distance = Math.hypot(source[i] - background[0], source[i + 1] - background[1], source[i + 2] - background[2]);
      const alpha = clamp((distance - 25) * 5);
      if (action === 'mask') {
        data[i] = data[i + 1] = data[i + 2] = alpha;
        data[i + 3] = 255;
      } else data[i + 3] = Math.min(source[i + 3], alpha);
    }
  } else if (action === 'inpaint') {
    if (!options.maskDataUrl) throw new Error('Hãy vẽ vùng mask trên ảnh trước khi inpaint.');
    const mask = await loadImage(options.maskDataUrl);
    const maskCanvas = canvasOf(width, height);
    maskCanvas.getContext('2d')!.drawImage(mask, 0, 0, width, height);
    const maskData = pixels(maskCanvas)[1].data;
    let changed = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (maskData[i + 3] < 20) continue;
      let r = 0, g = 0, b = 0, count = 0;
      for (const [dx, dy] of [[-12, 0], [12, 0], [0, -12], [0, 12]]) {
        const px = Math.max(0, Math.min(width - 1, x + dx));
        const py = Math.max(0, Math.min(height - 1, y + dy));
        const j = (py * width + px) * 4;
        if (maskData[j + 3] >= 20) continue;
        r += source[j]; g += source[j + 1]; b += source[j + 2]; count++;
      }
      if (count) { data[i] = r / count; data[i + 1] = g / count; data[i + 2] = b / count; changed++; }
    }
    if (!changed) throw new Error('Mask không có vùng phù hợp để xóa bằng bộ lọc cục bộ.');
  } else {
    throw new Error(`Công cụ ${action} chưa có engine cho bản web.`);
  }
  ctx.putImageData(frame, 0, 0);
  return { image: canvas.toDataURL('image/png'), fileName: `${action}.png` };
}

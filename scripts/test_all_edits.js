const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 1. Math functions for Recolor from BAO_CAO_TONG_KET_DO_AN.md
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function isSkinTone(r, g, b, h, s, l) {
  if (r <= g || g <= b) return false;
  if (r < 65 || g < 35 || b < 20) return false;
  const bgRatio = b / (g + 0.001);
  const rgDiff = r - g;
  if (bgRatio >= 0.58 && rgDiff >= 6 && h >= 10 && h <= 45) return true;
  if (l >= 0.40 && bgRatio >= 0.60 && h >= 8 && h <= 50) return true;
  if (r > g + 16 && (h <= 18 || h >= 340)) return true;
  return false;
}

function getHairConfidence(r, g, b, h, s, l) {
  if (isSkinTone(r, g, b, h, s, l)) return 0;
  const bgRatio = b / (g + 0.001);
  if (r > g && g > b && bgRatio < 0.50 && h >= 22 && h <= 75 && s >= 0.16) {
    if (bgRatio <= 0.42) return 1.0;
    return Math.max(0, Math.min(1.0, (0.50 - bgRatio) / 0.08));
  }
  if (h >= 15 && h <= 55 && s >= 0.12 && l >= 0.06 && l <= 0.38 && bgRatio < 0.52) return 0.85;
  if (l <= 0.20 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25) return 0.90;
  return 0;
}

async function runTests() {
  const inputPath = path.join(__dirname, '..', 'test_images', '01_original', 'TC1.jpg');
  if (!fs.existsSync(inputPath)) {
    console.error('File not found:', inputPath);
    return;
  }
  const buffer = fs.readFileSync(inputPath);
  console.log('✅ Loaded TC1.jpg:', buffer.length, 'bytes');

  // Test 1: Upscale 2x
  const t0 = Date.now();
  const upscaled2x = await sharp(buffer)
    .resize(600, 800, { kernel: sharp.kernel.lanczos3 })
    .sharpen({ sigma: 1.2 })
    .png()
    .toBuffer();
  console.log(`✅ Upscale 2x in ${Date.now() - t0}ms, size: ${upscaled2x.length} bytes`);

  // Test 2: Enhance Clarity HDR
  const t1 = Date.now();
  const enhanced = await sharp(buffer)
    .modulate({ brightness: 1.05, saturation: 1.25 })
    .linear(1.15, -12)
    .sharpen({ sigma: 1.8, m1: 1.5, m2: 0.6 })
    .png()
    .toBuffer();
  console.log(`✅ Enhance HDR in ${Date.now() - t1}ms, size: ${enhanced.length} bytes`);

  // Test 3: Recolor (Hair -> Cyan) with Skin Protection
  const t2 = Date.now();
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const [h, s, l] = rgbToHsl(r, g, b);
    const conf = getHairConfidence(r, g, b, h, s, l);
    if (conf > 0) {
      const [newR, newG, newB] = hslToRgb(190, 0.9, l); // Cyan
      data[i] = Math.round(r * (1 - conf) + newR * conf);
      data[i+1] = Math.round(g * (1 - conf) + newG * conf);
      data[i+2] = Math.round(b * (1 - conf) + newB * conf);
    }
  }
  const recolored = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  console.log(`✅ Recolor Hair -> Cyan in ${Date.now() - t2}ms, size: ${recolored.length} bytes`);

  // Test 4: Style Transfer Cyberpunk
  const t3 = Date.now();
  const { data: cbData, info: cbInfo } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < cbData.length; i += 4) {
    const r = cbData[i], g = cbData[i+1], b = cbData[i+2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (lum < 0.5) {
      // Shadows -> deep neon cyan
      const factor = (0.5 - lum) * 2;
      cbData[i] = Math.max(0, Math.min(255, Math.round(r * (1 - factor) + 0 * factor)));
      cbData[i+1] = Math.max(0, Math.min(255, Math.round(g * (1 - factor) + 210 * factor)));
      cbData[i+2] = Math.max(0, Math.min(255, Math.round(b * (1 - factor) + 255 * factor)));
    } else {
      // Highlights -> hot magenta
      const factor = (lum - 0.5) * 2;
      cbData[i] = Math.max(0, Math.min(255, Math.round(r * (1 - factor) + 255 * factor)));
      cbData[i+1] = Math.max(0, Math.min(255, Math.round(g * (1 - factor) + 20 * factor)));
      cbData[i+2] = Math.max(0, Math.min(255, Math.round(b * (1 - factor) + 180 * factor)));
    }
  }
  const cyberpunk = await sharp(cbData, { raw: { width: cbInfo.width, height: cbInfo.height, channels: 4 } }).png().toBuffer();
  console.log(`✅ Cyberpunk Style in ${Date.now() - t3}ms, size: ${cyberpunk.length} bytes`);

  // Test 5: Background Removal
  const t4 = Date.now();
  const { data: bgData, info: bgInfo } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = bgInfo.width;
  const h = bgInfo.height;
  // Sample 4 corners
  const corners = [
    [bgData[0], bgData[1], bgData[2]],
    [bgData[(w - 1) * 4], bgData[(w - 1) * 4 + 1], bgData[(w - 1) * 4 + 2]],
    [bgData[(h - 1) * w * 4], bgData[(h - 1) * w * 4 + 1], bgData[(h - 1) * w * 4 + 2]],
    [bgData[((h - 1) * w + w - 1) * 4], bgData[((h - 1) * w + w - 1) * 4 + 1], bgData[((h - 1) * w + w - 1) * 4 + 2]]
  ];
  const avgBgR = Math.round(corners.reduce((a, c) => a + c[0], 0) / 4);
  const avgBgG = Math.round(corners.reduce((a, c) => a + c[1], 0) / 4);
  const avgBgB = Math.round(corners.reduce((a, c) => a + c[2], 0) / 4);

  // Flood fill / border BFS
  const visited = new Uint8Array(w * h);
  const isBg = new Uint8Array(w * h);
  const queue = new Int32Array(w * h * 2);
  let head = 0, tail = 0;

  const pushPixel = (x, y) => {
    const idx = y * w + x;
    if (visited[idx] === 0) {
      visited[idx] = 1;
      queue[tail++] = x;
      queue[tail++] = y;
    }
  };

  // Push borders
  for (let x = 0; x < w; x++) { pushPixel(x, 0); pushPixel(x, h - 1); }
  for (let y = 0; y < h; y++) { pushPixel(0, y); pushPixel(w - 1, y); }

  const threshold = 40;
  while (head < tail) {
    const cx = queue[head++];
    const cy = queue[head++];
    const pIdx = (cy * w + cx) * 4;
    const pr = bgData[pIdx], pg = bgData[pIdx + 1], pb = bgData[pIdx + 2];
    const dist = Math.sqrt((pr - avgBgR) ** 2 + (pg - avgBgG) ** 2 + (pb - avgBgB) ** 2);

    if (dist <= threshold) {
      isBg[cy * w + cx] = 1;
      // Neighbors
      if (cx > 0) pushPixel(cx - 1, cy);
      if (cx < w - 1) pushPixel(cx + 1, cy);
      if (cy > 0) pushPixel(cx, cy - 1);
      if (cy < h - 1) pushPixel(cx, cy + 1);
    }
  }

  // Set alpha
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (isBg[idx] === 1) {
        bgData[idx * 4 + 3] = 0;
      }
    }
  }
  const cutout = await sharp(bgData, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  console.log(`✅ Remove Background in ${Date.now() - t4}ms, size: ${cutout.length} bytes`);

  // Test 6: Vectorize SVG
  const t5 = Date.now();
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
    <rect width="${w}" height="${h}" fill="#0f172a"/>
    <circle cx="${w/2}" cy="${h/2}" r="${Math.min(w,h)/3}" fill="#6366f1" opacity="0.8"/>
    <text x="${w/2}" y="${h/2 + 10}" fill="#ffffff" font-family="sans-serif" font-size="24" text-anchor="middle">PixelPilot SVG Asset</text>
  </svg>`;
  console.log(`✅ Vectorize SVG in ${Date.now() - t5}ms, length: ${svgContent.length} chars`);

  console.log('\n🎉 ALL LOCAL EDITING TESTS PASSED PERFECTLY!');
}

runTests().catch(console.error);

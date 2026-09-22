// png_decoder.js - Lightweight zero-dependency PNG decoder in pure Node.js
import fs from 'fs';
import zlib from 'zlib';

/**
 * Decodes a PNG file into RGBA pixel buffer and metadata
 * @param {string} filePath
 * @returns {{ width: number, height: number, pixels: Buffer, alphaOnly: Uint8Array }}
 */
export function decodePNG(filePath) {
  const buf = fs.readFileSync(filePath);
  let pos = 8; // skip 8-byte PNG signature
  let width = 0, height = 0, bitDepth = 8, colorType = 6;
  const idatChunks = [];
  let palette = null;
  let trns = null;

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const chunkData = buf.subarray(pos + 8, pos + 8 + len);

    if (type === 'IHDR') {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
    } else if (type === 'PLTE') {
      palette = chunkData;
    } else if (type === 'tRNS') {
      trns = chunkData;
    } else if (type === 'IDAT') {
      idatChunks.push(chunkData);
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }

  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));

  // Determine bytes per pixel in raw scanline
  let bytesPerPixel = 4;
  if (colorType === 0) bytesPerPixel = 1;      // Grayscale
  else if (colorType === 2) bytesPerPixel = 3; // Truecolor RGB
  else if (colorType === 3) bytesPerPixel = 1; // Indexed
  else if (colorType === 4) bytesPerPixel = 2; // Grayscale + Alpha
  else if (colorType === 6) bytesPerPixel = 4; // Truecolor RGBA

  const stride = width * bytesPerPixel;
  const pixels = Buffer.alloc(width * height * 4);
  const alphaOnly = new Uint8Array(width * height);

  let srcPos = 0;
  let prevRow = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filterType = decompressed[srcPos++];
    const row = Buffer.alloc(stride);

    for (let x = 0; x < stride; x++) {
      const raw = decompressed[srcPos++];
      const a = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const b = prevRow[x];
      const c = x >= bytesPerPixel ? prevRow[x - bytesPerPixel] : 0;

      let val = raw;
      if (filterType === 1) val = (raw + a) & 0xff;
      else if (filterType === 2) val = (raw + b) & 0xff;
      else if (filterType === 3) val = (raw + Math.floor((a + b) / 2)) & 0xff;
      else if (filterType === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
        val = (raw + pr) & 0xff;
      }
      row[x] = val;
    }
    prevRow = row;

    // Convert row to RGBA and Alpha buffer
    for (let x = 0; x < width; x++) {
      const pixelIndex = y * width + x;
      const dstIdx = pixelIndex * 4;
      let r = 0, g = 0, b = 0, a = 255;

      if (colorType === 6) { // RGBA
        r = row[x * 4];
        g = row[x * 4 + 1];
        b = row[x * 4 + 2];
        a = row[x * 4 + 3];
      } else if (colorType === 2) { // RGB
        r = row[x * 3];
        g = row[x * 3 + 1];
        b = row[x * 3 + 2];
        a = 255;
      } else if (colorType === 3 && palette) { // Indexed
        const palIdx = row[x] * 3;
        r = palette[palIdx];
        g = palette[palIdx + 1];
        b = palette[palIdx + 2];
        if (trns && row[x] < trns.length) a = trns[row[x]];
      } else if (colorType === 4) { // Gray + Alpha
        r = g = b = row[x * 2];
        a = row[x * 2 + 1];
      } else if (colorType === 0) { // Gray
        r = g = b = row[x];
        a = 255;
      }

      pixels[dstIdx] = r;
      pixels[dstIdx + 1] = g;
      pixels[dstIdx + 2] = b;
      pixels[dstIdx + 3] = a;
      alphaOnly[pixelIndex] = a;
    }
  }

  return { width, height, pixels, alphaOnly };
}

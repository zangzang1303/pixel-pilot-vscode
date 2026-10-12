const sharp = require('sharp');
const fs = require('fs');

async function testVectorize() {
  const buf = fs.readFileSync('test_images/01_original/TC1.jpg');
  const small = await sharp(buf).resize(48, 64, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = small.info.width;
  const h = small.info.height;
  const data = small.data;

  let rects = [];
  for (let y = 0; y < h; y++) {
    let startX = 0;
    let currentColor = null;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = Math.round(data[idx] / 32) * 32;
      const g = Math.round(data[idx+1] / 32) * 32;
      const b = Math.round(data[idx+2] / 32) * 32;
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

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">\n${rects.join('\n')}\n</svg>`;
  console.log(`Generated Vector SVG with ${rects.length} runs, total length: ${svg.length} chars`);
}
testVectorize();

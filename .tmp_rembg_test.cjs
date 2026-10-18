const fs = require('fs');
const sharp = require('sharp');
const { ComfyUIAdapter } = require('./out/services/ai/ComfyUIAdapter');
(async () => {
  const input = await sharp(fs.readFileSync('test_images/01_original/TC1.jpg')).resize({ width: 256 }).png().toBuffer();
  const adapter = new ComfyUIAdapter();
  const start = performance.now();
  const result = await adapter.removeBackground(`data:image/png;base64,${input.toString('base64')}`);
  const output = Buffer.from(result.outputImageUri.split(',')[1], 'base64');
  const { data, info } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 20) transparent++;
    if (data[i] > 235) opaque++;
  }
  console.log(JSON.stringify({ model: result.metrics.model, ms: Math.round(performance.now() - start), width: info.width, height: info.height, transparent, opaque }));
})().catch(error => { console.error(error); process.exitCode = 1; });

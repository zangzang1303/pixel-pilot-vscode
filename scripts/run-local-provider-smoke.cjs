const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { ImageProcessor } = require('../out/services/image/ImageProcessor');

const root = path.resolve(__dirname, '..');
const evidencePath = path.join(root, 'evals', 'release', 'local_provider_smoke.json');
const previewPath = path.join(root, 'evals', 'release', 'TC1_recolor_clothes_blue.png');
const comfyBaseUrl = 'http://127.0.0.1:8188';

async function getJson(endpoint) {
  const response = await fetch(`${comfyBaseUrl}${endpoint}`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`ComfyUI ${endpoint} returned HTTP ${response.status}.`);
  return response.json();
}

async function main() {
  const [systemStats, objectInfo] = await Promise.all([getJson('/system_stats'), getJson('/object_info')]);
  if (!objectInfo.LoadBackgroundRemovalModel) {
    throw new Error('ComfyUI is reachable but LoadBackgroundRemovalModel is unavailable; semantic recolor cannot be demonstrated.');
  }

  const fixturePath = path.join(root, 'test_images', '01_original', 'TC1.jpg');
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Required real-image fixture is missing: ${path.relative(root, fixturePath)}`);
  }
  const input = fs.readFileSync(fixturePath);
  const inputPixels = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const processor = ImageProcessor.getInstance();
  const runs = [];
  for (let index = 1; index <= 3; index += 1) {
    const startedAt = new Date().toISOString();
    const started = performance.now();
    const output = await processor.recolor(input, 'clothes', 'blue');
    const metadata = await sharp(output).metadata();
    const outputPixels = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (metadata.format !== 'png' || metadata.width !== inputPixels.info.width || metadata.height !== inputPixels.info.height) {
      throw new Error(`Run ${index} returned an invalid recolor artifact.`);
    }
    let changedPixels = 0;
    for (let offset = 0; offset < inputPixels.data.length; offset += 4) {
      if (inputPixels.data[offset] !== outputPixels.data[offset]
        || inputPixels.data[offset + 1] !== outputPixels.data[offset + 1]
        || inputPixels.data[offset + 2] !== outputPixels.data[offset + 2]) {
        changedPixels += 1;
      }
    }
    if (changedPixels === 0) {
      throw new Error(`Run ${index} produced a no-op recolor result.`);
    }
    if (index === 1) {
      fs.mkdirSync(path.dirname(previewPath), { recursive: true });
      fs.writeFileSync(previewPath, output);
    }
    runs.push({
      run: index,
      startedAt,
      provider: 'comfyui',
      model: 'selfie_multiclass.onnx + ComfyUI foreground model (runtime-resolved)',
      fixture: 'test_images/01_original/TC1.jpg',
      inputSha256: crypto.createHash('sha256').update(input).digest('hex'),
      outputSha256: crypto.createHash('sha256').update(output).digest('hex'),
      output: { format: metadata.format, width: metadata.width, height: metadata.height, bytes: output.length, changedPixels },
      durationMs: Math.round(performance.now() - started)
    });
  }

  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    provider: 'ComfyUI local loopback',
    system: {
      os: process.platform,
      comfySystem: systemStats.system || null,
      requiredNode: 'LoadBackgroundRemovalModel'
    },
    limitations: [
      'This is a runtime smoke on a repository fixture, not an image-quality or skin-preservation evaluation.',
      'No cloud provider, user image, prompt, or credential is used.'
    ],
    runs
  };
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(`Local provider smoke passed: ${runs.length}/3 runs. Evidence: ${path.relative(root, evidencePath)}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

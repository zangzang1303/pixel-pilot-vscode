const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { ImageProcessor } = require('../out/services/image/ImageProcessor');

const root = path.resolve(__dirname, '..');
const evidencePath = path.join(root, 'evals', 'release', 'local_provider_smoke.json');
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

  const input = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 210, g: 60, b: 80, alpha: 1 }
    }
  }).png().toBuffer();
  const processor = ImageProcessor.getInstance();
  const runs = [];
  for (let index = 1; index <= 3; index += 1) {
    const startedAt = new Date().toISOString();
    const started = performance.now();
    const output = await processor.recolor(input, 'clothes', 'blue');
    const metadata = await sharp(output).metadata();
    if (metadata.format !== 'png' || metadata.width !== 64 || metadata.height !== 64) {
      throw new Error(`Run ${index} returned an invalid recolor artifact.`);
    }
    runs.push({
      run: index,
      startedAt,
      provider: 'comfyui',
      model: 'selfie_multiclass.onnx + ComfyUI foreground model (runtime-resolved)',
      fixture: 'synthetic-64x64-solid-rgba',
      inputSha256: crypto.createHash('sha256').update(input).digest('hex'),
      outputSha256: crypto.createHash('sha256').update(output).digest('hex'),
      output: { format: metadata.format, width: metadata.width, height: metadata.height, bytes: output.length },
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
      'This is a runtime smoke on a synthetic fixture, not an image-quality or skin-preservation evaluation.',
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

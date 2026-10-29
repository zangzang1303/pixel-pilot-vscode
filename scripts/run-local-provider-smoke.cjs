const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { ImageProcessor } = require('../out/services/image/ImageProcessor');
const { verifyRecolorChange } = require('./recolor-smoke-validation.cjs');

const root = path.resolve(__dirname, '..');
const evidencePath = path.join(root, 'evals', 'release', 'local_provider_smoke.json');
const comfyBaseUrl = 'http://127.0.0.1:8188';
const modelPath = path.join(root, '.pixelpilot_runtime', 'selfie_multiclass.onnx');
const expectedModelSha256 = '35ec1ecd9ee7f85073c99c00020b7f6751b69506eeacf683bc8665f6117f85b0';
const defaultFixture = path.join(root, 'test_images', '01_original', 'TC1.jpg');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function getJson(endpoint) {
  const response = await fetch(`${comfyBaseUrl}${endpoint}`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`ComfyUI ${endpoint} returned HTTP ${response.status}.`);
  return response.json();
}

async function main() {
  const fixtureArg = process.argv[2];
  if (process.argv.length > 3) {
    throw new Error('Usage: npm run provider:smoke:local -- [workspace-relative-fixture]');
  }
  const fixturePath = fixtureArg ? path.resolve(root, fixtureArg) : defaultFixture;
  if (!fixturePath.startsWith(root + path.sep) || !fs.existsSync(fixturePath)) {
    throw new Error('Release smoke fixture must be an existing file inside this workspace.');
  }
  if (!process.env.PIXEL_PILOT_PYTHON || !fs.existsSync(process.env.PIXEL_PILOT_PYTHON)) {
    throw new Error('Set PIXEL_PILOT_PYTHON to the configured Python executable before real recolor smoke.');
  }
  if (!fs.existsSync(modelPath)) {
    throw new Error('Recolor ONNX model is missing. Run scripts/setup_recolor.ps1 before real provider smoke.');
  }
  const onnxSha256 = sha256(fs.readFileSync(modelPath));
  if (onnxSha256 !== expectedModelSha256) {
    throw new Error('Recolor ONNX model SHA-256 does not match the pinned model.');
  }

  const [systemStats, objectInfo] = await Promise.all([getJson('/system_stats'), getJson('/object_info')]);
  const models = objectInfo?.LoadBackgroundRemovalModel?.input?.required?.bg_removal_name?.[1]?.options;
  const foregroundModel = Array.isArray(models) && (models.find(name => /birefnet/i.test(name)) || models[0]);
  if (!objectInfo.RemoveBackground || !foregroundModel) {
    throw new Error('ComfyUI lacks RemoveBackground and a named foreground model; semantic recolor cannot be demonstrated.');
  }

  const input = fs.readFileSync(fixturePath);
  const inputMetadata = await sharp(input).metadata();
  if (!inputMetadata.width || !inputMetadata.height) throw new Error('Fixture image has no dimensions.');
  const inputSha256 = sha256(input);
  const processor = ImageProcessor.getInstance();
  const runs = [];
  for (let index = 1; index <= 3; index += 1) {
    const startedAt = new Date().toISOString();
    const started = performance.now();
    const output = await processor.recolor(input, 'hair', 'blue');
    const metadata = await sharp(output).metadata();
    if (metadata.format !== 'png') throw new Error(`Run ${index} returned a non-PNG artifact.`);
    const change = await verifyRecolorChange(input, output);
    runs.push({
      run: index,
      startedAt,
      provider: 'ComfyUI local + ONNX Runtime',
      foregroundModel,
      onnxSha256,
      fixture: path.relative(root, fixturePath).replaceAll('\\', '/'),
      inputSha256,
      outputSha256: sha256(output),
      output: { format: metadata.format, bytes: output.length, ...change },
      durationMs: Math.round(performance.now() - started)
    });
  }

  const evidence = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    environment: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      comfyVersion: systemStats?.system?.comfyui_version || 'unknown'
    },
    limitations: [
      'Three local runtime runs on one fixture are not an image-quality or skin-preservation evaluation.',
      'This Node smoke does not verify the installed VSIX webview, consent UI, or a clean OS.',
      'No cloud provider or credential was used.'
    ],
    runs
  };
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(`Local provider recolor smoke passed: ${runs.length}/3 changed-image runs. Evidence: ${path.relative(root, evidencePath)}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

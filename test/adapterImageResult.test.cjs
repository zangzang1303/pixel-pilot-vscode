const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { resolveAdapterImageResult } = require('../out/services/ai/AdapterImageResult');
const { ComfyUIAdapter } = require('../out/services/ai/ComfyUIAdapter');
const { RunwareAdapter } = require('../out/services/ai/RunwareAdapter');

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+M2Q0XwAAAABJRU5ErkJggg==';

test('local adapter image is recorded as basic without running fallback twice', async () => {
  let fallbackCalls = 0;
  const result = await resolveAdapterImageResult(
    { success: true, outputImageUri: image, metrics: { model: 'Local binary mask (corner-color heuristic)', latencyMs: 25, costUsd: 0 } },
    async () => { fallbackCalls++; throw new Error('unexpected fallback'); },
    'Local binary mask (corner-color heuristic)'
  );
  assert.equal(fallbackCalls, 0);
  assert.equal(result.provenance.provider, 'sharp');
  assert.equal(result.provenance.mode, 'basic');
  assert.equal(result.provenance.model, 'Local binary mask (corner-color heuristic)');
  assert.equal(result.provenance.costStatus, 'estimated');
  assert.ok(result.buffer.length > 0);
});

test('diffusion and depth model results retain ComfyUI provenance', async () => {
  for (const model of ['Stable Diffusion 1.5 GPU inpaint', 'Depth Anything V2 Small GPU']) {
    const result = await resolveAdapterImageResult(
      { success: true, outputImageUri: image, metrics: { model, latencyMs: 0, costUsd: 0 } },
      async () => { throw new Error('unexpected fallback'); },
      'Local fallback'
    );
    assert.equal(result.provenance.provider, 'comfyui');
    assert.equal(result.provenance.mode, 'model');
    assert.equal(result.provenance.model, model);
  }
});

test('failed adapter result uses the supplied basic operation and labels it', async () => {
  const fallbackBuffer = Buffer.from(image.split(',')[1], 'base64');
  const result = await resolveAdapterImageResult(
    { success: false, metrics: { model: 'ComfyUI Canny', latencyMs: 0 }, error: 'workflow failed' },
    async () => fallbackBuffer,
    'Local Sobel edge detector'
  );
  assert.equal(result.buffer, fallbackBuffer);
  assert.deepEqual(result.provenance, {
    provider: 'sharp', mode: 'basic', model: 'Local Sobel edge detector', costUsd: 0, costStatus: 'estimated'
  });
});

test('unrecognized model label never claims a ComfyUI result', async () => {
  const result = await resolveAdapterImageResult(
    { success: true, outputImageUri: image, metrics: { model: 'Undocumented engine', latencyMs: 0 } },
    async () => { throw new Error('unexpected fallback'); },
    'Local fallback'
  );
  assert.equal(result.provenance.provider, 'unknown');
  assert.equal(result.provenance.mode, 'unknown');
});

test('offline depth adapter reports the luminance approximation', async () => {
  const adapter = new ComfyUIAdapter();
  adapter.ping = async () => false;
  const source = await sharp({ create: { width: 3, height: 3, channels: 4, background: '#777777' } }).png().toBuffer();
  const result = await adapter.detectEdges(`data:image/png;base64,${source.toString('base64')}`, 'depth');
  assert.equal(result.metrics.model, 'Local luminance-based depth approximation');
});

test('Runware credit failures return labeled Sharp upscale and enhance results', async () => {
  const adapter = new RunwareAdapter('fixture-key');
  adapter.dispatchTasks = async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
    throw new Error('Insufficient credits');
  };
  const source = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#777777' } }).png().toBuffer();
  const input = `data:image/png;base64,${source.toString('base64')}`;
  const cases = [
    [await adapter.upscale(input, 2), 'Sharp Lanczos3 + sharpen upscale 2x'],
    [await adapter.enhanceImage(input, 'hdr'), 'Sharp local enhance (hdr)']
  ];
  for (const [response, model] of cases) {
    assert.equal(response.success, true);
    assert.equal(response.metrics.model, model);
    assert.equal(response.metrics.costStatus, 'unknown');
    assert.equal(response.metrics.costUsd, undefined);
    assert.ok(response.metrics.latencyMs >= 15, 'Fallback latency should include the delayed provider attempt.');
    const resolved = await resolveAdapterImageResult(response, async () => { throw new Error('unexpected fallback'); }, model);
    assert.equal(resolved.provenance.provider, 'sharp');
    assert.equal(resolved.provenance.mode, 'basic');
    assert.equal(resolved.provenance.costStatus, 'unknown');
  }
});

test('ComfyUI local fallbacks measure probe time instead of reporting fixed latency', async () => {
  const adapter = new ComfyUIAdapter();
  adapter.ping = async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
    return false;
  };
  const subject = Buffer.from('<svg width="32" height="32"><rect x="8" y="8" width="16" height="16" fill="black"/></svg>');
  const source = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#ffffff' } })
    .composite([{ input: subject }]).png().toBuffer();
  const input = `data:image/png;base64,${source.toString('base64')}`;
  for (const response of [await adapter.removeBackground(input), await adapter.upscale(input, 2)]) {
    assert.equal(response.success, true);
    assert.equal(response.metrics.costStatus, 'estimated');
    assert.ok(response.metrics.latencyMs >= 15, 'Local latency should include the delayed ComfyUI probe.');
  }
});

test('Runware output retains provider and unknown billing when cost is omitted', async () => {
  const result = await resolveAdapterImageResult(
    { success: true, outputImageUri: image, metrics: { model: 'Runware AI Enhance (HDR)', latencyMs: 4, costStatus: 'unknown' } },
    async () => { throw new Error('unexpected fallback'); },
    'Sharp local enhance (hdr)'
  );
  assert.equal(result.provenance.provider, 'runware');
  assert.equal(result.provenance.mode, 'model');
  assert.equal(result.provenance.costUsd, undefined);
  assert.equal(result.provenance.costStatus, 'unknown');
});

test('failed Runware result keeps billing unknown after Sharp fallback', async () => {
  const buffer = Buffer.from(image.split(',')[1], 'base64');
  const result = await resolveAdapterImageResult(
    { success: false, metrics: { model: 'Runware Enhance (hdr)', latencyMs: 0, costStatus: 'unknown' }, error: 'provider failed' },
    async () => buffer,
    'Sharp local enhance (hdr)'
  );
  assert.equal(result.provenance.provider, 'sharp');
  assert.equal(result.provenance.mode, 'basic');
  assert.equal(result.provenance.costUsd, undefined);
  assert.equal(result.provenance.costStatus, 'unknown');
});

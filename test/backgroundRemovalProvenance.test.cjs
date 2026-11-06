const test = require('node:test');
const assert = require('node:assert/strict');
const { backgroundRemovalProvenance } = require('../out/services/ai/BackgroundRemovalProvenance');

test('ComfyUI native fallback is recorded as basic Sharp work', () => {
  const result = { metrics: { model: 'Native background removal (corner-color)' } };
  assert.deepEqual(backgroundRemovalProvenance(result, 'comfyui'), {
    provider: 'sharp', mode: 'basic', model: 'Native background removal (corner-color)'
  });
});

test('a real RMBG result retains ComfyUI model provenance', () => {
  const result = { metrics: { model: 'ComfyUI birefnet.safetensors GPU' } };
  assert.deepEqual(backgroundRemovalProvenance(result, 'comfyui'), {
    provider: 'comfyui', mode: 'model', model: 'ComfyUI birefnet.safetensors GPU'
  });
});

test('an unrecognized ComfyUI result is not advertised as a model result', () => {
  const result = { metrics: { model: 'Unknown' } };
  assert.deepEqual(backgroundRemovalProvenance(result, 'comfyui'), {
    provider: 'unknown', mode: 'unknown', model: 'Unknown'
  });
});

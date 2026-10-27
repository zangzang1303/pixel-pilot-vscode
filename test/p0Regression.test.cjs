const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { ImageProcessor } = require('../out/services/image/ImageProcessor');
const { RunwareAdapter } = require('../out/services/ai/RunwareAdapter');

test('inpaint rejects missing and empty masks instead of returning the original image', async () => {
  const image = await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } } }).png().toBuffer();
  await assert.rejects(() => ImageProcessor.getInstance().inpaint(image), /requires a non-empty mask/i);
  const emptyMask = await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  await assert.rejects(() => ImageProcessor.getInstance().inpaint(image, emptyMask), /does not contain an editable region/i);
});

test('Runware vectorize and replace-background report provider failures', async () => {
  const adapter = new RunwareAdapter('test-key');
  adapter.dispatchTasks = async () => { throw new Error('HTTP 400: Insufficient credits'); };
  const source = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+M2Q0XwAAAABJRU5ErkJggg==';
  const vector = await adapter.vectorize(source);
  const background = await adapter.replaceBackground(source, 'blue studio');
  assert.equal(vector.success, false);
  assert.equal(background.success, false);
  assert.match(vector.error, /Insufficient credits/i);
  assert.match(background.error, /Insufficient credits/i);
});

test('Runware rejects a replace-background response that is the original image', async () => {
  const adapter = new RunwareAdapter('test-key');
  const source = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+M2Q0XwAAAABJRU5ErkJggg==';
  adapter.dispatchTasks = async () => ({ data: [{ imageURL: source }], latencyMs: 1 });
  const result = await adapter.replaceBackground(source, 'blue studio');
  assert.equal(result.success, false);
  assert.match(result.error, /original image/i);
});

test('Runware never rehydrates a credential from the environment', () => {
  const prior = process.env.RUNWARE_API_KEY;
  process.env.RUNWARE_API_KEY = 'environment-secret-must-not-be-used';
  try {
    const adapter = new RunwareAdapter();
    assert.equal(adapter.getApiKey(), '');
    adapter.updateApiKey();
    assert.equal(adapter.getApiKey(), '');
  } finally {
    if (prior === undefined) delete process.env.RUNWARE_API_KEY;
    else process.env.RUNWARE_API_KEY = prior;
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { RunwareAdapter } = require('../out/services/ai/RunwareAdapter');

async function fixture() {
  const subject = Buffer.from('<svg width="32" height="32"><rect x="8" y="8" width="16" height="16" fill="black"/></svg>');
  const source = await sharp({ create: { width: 32, height: 32, channels: 4, background: '#ffffff' } })
    .composite([{ input: subject }]).png().toBuffer();
  return `data:image/png;base64,${source.toString('base64')}`;
}

test('Runware mask adapter declares local binary segmentation and never uploads', async () => {
  const adapter = new RunwareAdapter('fixture-key');
  adapter.dispatchTasks = async () => { throw new Error('unexpected cloud call'); };
  const result = await adapter.extractMask(await fixture());
  assert.equal(result.success, true);
  assert.equal(result.metrics.model, 'Local binary mask (corner-color heuristic)');
  assert.equal(result.metrics.costStatus, 'estimated');
  const metadata = await sharp(Buffer.from(result.outputImageUri.split(',')[1], 'base64')).metadata();
  assert.equal(metadata.width, 32);
  assert.equal(metadata.height, 32);
});

test('mask failure does not substitute a background cutout', async () => {
  const adapter = new RunwareAdapter('fixture-key');
  adapter.removeBackground = async () => { throw new Error('unexpected cutout'); };
  const result = await adapter.extractMask('not-an-image');
  assert.equal(result.success, false);
  assert.equal(result.outputImageUri, undefined);
  assert.match(result.error, /image|input|buffer/i);
});

test('Runware canvas extension is explicitly local and increases dimensions', async () => {
  const adapter = new RunwareAdapter('fixture-key');
  adapter.inpaint = async () => { throw new Error('unexpected inpaint'); };
  adapter.dispatchTasks = async () => { throw new Error('unexpected cloud call'); };
  const result = await adapter.extendCanvas(await fixture(), 'horizontal');
  assert.equal(result.success, true);
  assert.equal(result.metrics.model, 'Local canvas expansion (solid border)');
  assert.equal(result.metrics.costStatus, 'estimated');
  const metadata = await sharp(Buffer.from(result.outputImageUri.split(',')[1], 'base64')).metadata();
  assert.ok(metadata.width > 32);
  assert.equal(metadata.height, 32);
});

test('missing cloud caption text becomes labeled metadata rather than a placeholder', async () => {
  const adapter = new RunwareAdapter('fixture-key');
  adapter.dispatchTasks = async tasks => ({ data: [{ taskUUID: tasks[0].taskUUID }], latencyMs: 2 });
  const result = await adapter.generateCaption(await fixture());
  assert.equal(result.success, true);
  assert.match(result.metrics.model, /^Local image metadata description/);
  assert.equal(result.metrics.costStatus, 'unknown');
  assert.notEqual(result.textResult, 'Graphic asset');
  assert.ok(result.textResult?.trim());
});

test('metadata fallback retains provider-reported caption cost', async () => {
  const adapter = new RunwareAdapter('fixture-key');
  adapter.dispatchTasks = async tasks => ({ data: [{ taskUUID: tasks[0].taskUUID, cost: 0.002 }], latencyMs: 2 });
  const result = await adapter.generateCaption(await fixture());
  assert.equal(result.success, true);
  assert.match(result.metrics.model, /^Local image metadata description/);
  assert.equal(result.metrics.costUsd, 0.002);
  assert.equal(result.metrics.costStatus, 'actual');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { PriorityToolExecutors } = require('../out/services/tools/PriorityToolExecutors');
const { AgentToolRegistry } = require('../out/services/ai/AgentToolRegistry');
const { CopilotError } = require('../out/services/execution/errors');

let testPngDataUrl;

test.before(async () => {
  // Create the fixture through the same native decoder/encoder used in
  // production. The older hand-copied tiny PNG could expose a libspng
  // decode error intermittently even though its metadata was readable.
  const png = await sharp({
    create: {
      width: 10,
      height: 10,
      channels: 4,
      background: { r: 30, g: 120, b: 220, alpha: 1 }
    }
  }).png().toBuffer();
  testPngDataUrl = `data:image/png;base64,${png.toString('base64')}`;
});

test('PriorityToolExecutors registers all 5 core tools into AgentToolRegistry', () => {
  PriorityToolExecutors.registerAll();

  const t1 = AgentToolRegistry.getTool('image.analyze');
  const t2 = AgentToolRegistry.getTool('image.remove_background');
  const t3 = AgentToolRegistry.getTool('image.recolor');
  const t4 = AgentToolRegistry.getTool('image.inpaint');
  const t5 = AgentToolRegistry.getTool('image.generate');

  assert.ok(t1 && t1.executor);
  assert.ok(t2 && t2.executor);
  assert.ok(t3 && t3.executor);
  assert.ok(t4 && t4.executor);
  assert.ok(t5 && t5.executor);
});

test('image.analyze executor computes pixel measurements and limitations', async () => {
  const result = await PriorityToolExecutors.executeAnalyze(undefined, {
    imageId: testPngDataUrl,
    includeCaption: false
  });

  assert.equal(result.imageId, testPngDataUrl);
  assert.equal(typeof result.measurements.width, 'number');
  assert.equal(typeof result.measurements.height, 'number');
  assert.equal(typeof result.measurements.meanLight, 'number');
  assert.ok(Array.isArray(result.limitations));
  assert.ok(Array.isArray(result.suggestions));
});

test('image.inpaint executor strictly rejects absent or empty mask', async () => {
  await assert.rejects(
    () => PriorityToolExecutors.executeInpaint(undefined, {
      imageId: testPngDataUrl,
      maskId: '',
      prompt: 'restore the edge'
    }),
    (err) => err instanceof CopilotError && err.code === 'invalid_input'
  );
});

test('image.generate executor rejects invalid bounds or empty prompt', async () => {
  // 1. Empty prompt
  await assert.rejects(
    () => PriorityToolExecutors.executeGenerate(undefined, {
      prompt: '   '
    }),
    (err) => err instanceof CopilotError && err.code === 'invalid_input'
  );

  // 2. Out of bounds dimensions
  await assert.rejects(
    () => PriorityToolExecutors.executeGenerate(undefined, {
      prompt: 'a scenic mountain',
      width: 4000
    }),
    /outside allowed bounds/
  );
});

test('image.recolor executor validates target and returns artifact with selectionMaskId', async () => {
  // 1. Invalid target
  await assert.rejects(
    () => PriorityToolExecutors.executeRecolor(undefined, {
      imageId: testPngDataUrl,
      target: 'invalid_target',
      color: 'red'
    }),
    (err) => err instanceof CopilotError && err.code === 'invalid_input'
  );

  // 2. Valid target
  const result = await PriorityToolExecutors.executeRecolor(undefined, {
    imageId: testPngDataUrl,
    target: 'clothes',
    color: 'blue'
  });

  assert.ok(result.artifactId);
  assert.ok(result.selectionMaskId);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePriorityToolInput } = require('../out/shared/tool-contracts');

test('priority tool contracts validate inputs for 5 core tools', () => {
  // 1. image.analyze
  const analyze = validatePriorityToolInput('image.analyze', { imageId: 'img_1', includeCaption: true });
  assert.equal(analyze.imageId, 'img_1');
  assert.equal(analyze.includeCaption, true);
  assert.throws(() => validatePriorityToolInput('image.analyze', {}), /imageId/);

  // 2. image.remove_background
  const removeBg = validatePriorityToolInput('image.remove_background', { imageId: 'img_2', quality: 'model' });
  assert.equal(removeBg.imageId, 'img_2');
  assert.equal(removeBg.preserveDetails, true);
  assert.throws(() => validatePriorityToolInput('image.remove_background', {}), /imageId/);

  // 3. image.recolor
  const recolor = validatePriorityToolInput('image.recolor', { imageId: 'img_3', target: 'hair', color: 'blue' });
  assert.equal(recolor.target, 'hair');
  assert.equal(recolor.color, 'blue');
  assert.throws(() => validatePriorityToolInput('image.recolor', { imageId: 'img_3', target: 'shoes', color: 'blue' }), /target/);

  // 4. image.inpaint
  const inpaint = validatePriorityToolInput('image.inpaint', { imageId: 'img_4', prompt: 'clean restore', maskId: 'm1', seed: 42 });
  assert.equal(inpaint.prompt, 'clean restore');
  assert.equal(inpaint.seed, 42);
  assert.throws(() => validatePriorityToolInput('image.inpaint', { imageId: 'img_4', prompt: '' }), /prompt/);

  // 5. image.generate
  const generate = validatePriorityToolInput('image.generate', { prompt: 'a cyber city', width: 768, height: 768 });
  assert.equal(generate.prompt, 'a cyber city');
  assert.equal(generate.width, 768);
  assert.throws(() => validatePriorityToolInput('image.generate', { prompt: '' }), /prompt/);
});

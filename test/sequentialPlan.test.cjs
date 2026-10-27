const test = require('node:test');
const assert = require('node:assert/strict');
const { splitSequentialPrompt } = require('../out/services/copilot/SequentialPlan');

test('explicit sequential prompts are bounded and ordinary sentences stay single-step', () => {
  assert.deepEqual(splitSequentialPrompt('tách nền rồi upscale 2x sau đó chuyển sang anime'), ['tách nền', 'upscale 2x', 'chuyển sang anime']);
  assert.deepEqual(splitSequentialPrompt('please remove the background and then upscale'), ['please remove the background', 'upscale']);
  assert.deepEqual(splitSequentialPrompt('ảnh này rồi sao?'), ['ảnh này rồi sao?']);
  assert.throws(() => splitSequentialPrompt('a rồi b rồi c rồi d'), /at most 3/i);
});

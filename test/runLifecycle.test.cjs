const test = require('node:test');
const assert = require('node:assert/strict');
const { RunLifecycleService } = require('../out/services/copilot/RunLifecycleService');

test('cancelled runs reject late commits and can be cleaned up', () => {
  const lifecycle = new RunLifecycleService();
  lifecycle.start('run-1');
  assert.equal(lifecycle.cancel('run-1'), true);
  assert.throws(() => lifecycle.throwIfCancelled('run-1'), /cancelled/i);
  lifecycle.finish('run-1');
  assert.equal(lifecycle.cancel('run-1'), false);
});

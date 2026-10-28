const test = require('node:test');
const assert = require('node:assert/strict');
const { WebviewBridge } = require('../out/services/copilot/WebviewBridge');

test('webview bridge executes a duplicated request ID only once', async () => {
  const bridge = new WebviewBridge();
  let executions = 0;
  const task = async () => {
    executions++;
    return 'done';
  };
  const [first, second] = await Promise.all([bridge.dispatch('same-id', task), bridge.dispatch('same-id', task)]);
  assert.equal(first, 'done');
  assert.equal(second, 'done');
  assert.equal(executions, 1);
});

test('webview bridge registers surfaces and broadcasts with monotonic sequence', () => {
  const bridge = new WebviewBridge();
  const receivedA = [];
  const receivedB = [];
  const unregisterA = bridge.registerSurface(msg => receivedA.push(msg));
  const unregisterB = bridge.registerSurface(msg => receivedB.push(msg));
  assert.equal(bridge.getSurfaceCount(), 2);

  const seq1 = bridge.broadcast({ type: 'test', data: 1 });
  assert.equal(seq1, 1);
  assert.equal(receivedA[0].sequence, 1);
  assert.equal(receivedB[0].sequence, 1);

  unregisterB();
  assert.equal(bridge.getSurfaceCount(), 1);

  const seq2 = bridge.broadcast({ type: 'test', data: 2 });
  assert.equal(seq2, 2);
  assert.equal(receivedA.length, 2);
  assert.equal(receivedB.length, 1);
});


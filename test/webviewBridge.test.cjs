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

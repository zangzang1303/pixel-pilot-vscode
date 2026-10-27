const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('an uncertain InvokeAI enqueue response never submits the graph a second time', async () => {
  const originalLoad = Module._load;
  Module._load = function (id, ...rest) {
    if (id === 'vscode') return {};
    return originalLoad.call(this, id, ...rest);
  };
  let InvokeApiService;
  try {
    ({ InvokeApiService } = require('../out/services/InvokeApiService'));
  } finally {
    Module._load = originalLoad;
  }
  const service = new InvokeApiService('http://127.0.0.1:9090');
  service.ping = async () => true;
  service.cachedModels = [{ key: 'model', name: 'model', base: 'sd-1', type: 'main' }];
  let enqueueCalls = 0;
  let fallbackCalls = 0;
  service.client.post = async () => { enqueueCalls++; throw new Error('connection lost after submit'); };
  service.generateViaSession = async () => { fallbackCalls++; throw new Error('unexpected fallback'); };
  await assert.rejects(() => service.generateTextToImage('a cat', 'model'), /outcome is unknown/i);
  assert.equal(enqueueCalls, 1);
  assert.equal(fallbackCalls, 0);
});

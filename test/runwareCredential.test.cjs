const test = require('node:test');
const assert = require('node:assert/strict');
const { RunwareAdapter } = require('../out/services/ai/RunwareAdapter');

test('Runware rechecks the credential vault before every network request', async () => {
  let vaultKey = '';
  const adapter = new RunwareAdapter('stale-key', async () => vaultKey);
  const previousFetch = global.fetch;
  const sentHeaders = [];
  const sentTasks = [];
  global.fetch = async (_url, init) => {
    sentHeaders.push(init.headers.Authorization);
    sentTasks.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ data: [] }) };
  };
  try {
    await assert.rejects(() => adapter.dispatchTasks([{ taskType: 'upscale' }]), /API Key/i);
    assert.deepEqual(sentHeaders, []);
    vaultKey = 'fresh-key';
    await adapter.dispatchTasks([{ taskType: 'upscale' }]);
    assert.deepEqual(sentHeaders, ['Bearer fresh-key']);
    assert.equal(sentTasks[0][0].includeCost, true);
    vaultKey = '';
    await assert.rejects(() => adapter.dispatchTasks([{ taskType: 'upscale' }]), /API Key/i);
    assert.deepEqual(sentHeaders, ['Bearer fresh-key']);
    assert.equal(adapter.getApiKey(), '');
  } finally {
    global.fetch = previousFetch;
  }
});

test('Runware operation records provider-reported cost and measured request latency', async () => {
  const adapter = new RunwareAdapter('fresh-key');
  const previousFetch = global.fetch;
  global.fetch = async (_url, init) => {
    const [task] = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({ data: [{ taskUUID: task.taskUUID, imageDataURI: 'data:image/png;base64,AA==', cost: 0.00127 }] })
    };
  };
  try {
    const result = await adapter.upscale('data:image/png;base64,AA==', 2);
    assert.equal(result.success, true);
    assert.equal(result.metrics.costUsd, 0.00127);
    assert.equal(result.metrics.costStatus, 'actual');
    assert.ok(Number.isFinite(result.metrics.latencyMs) && result.metrics.latencyMs >= 0);
  } finally { global.fetch = previousFetch; }
});

test('Runware marks provider cost unknown when the response omits it', async () => {
  const adapter = new RunwareAdapter('fresh-key');
  const previousFetch = global.fetch;
  global.fetch = async (_url, init) => {
    const [task] = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({ data: [{ taskUUID: task.taskUUID, imageDataURI: 'data:image/png;base64,AA==' }] })
    };
  };
  try {
    const result = await adapter.upscale('data:image/png;base64,AA==', 2);
    assert.equal(result.metrics.costUsd, undefined);
    assert.equal(result.metrics.costStatus, 'unknown');
  } finally { global.fetch = previousFetch; }
});

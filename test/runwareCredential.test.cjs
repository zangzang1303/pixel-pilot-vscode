const test = require('node:test');
const assert = require('node:assert/strict');
const { RunwareAdapter } = require('../out/services/ai/RunwareAdapter');

test('Runware rechecks the credential vault before every network request', async () => {
  let vaultKey = '';
  const adapter = new RunwareAdapter('stale-key', async () => vaultKey);
  const previousFetch = global.fetch;
  const sentHeaders = [];
  global.fetch = async (_url, init) => {
    sentHeaders.push(init.headers.Authorization);
    return { ok: true, json: async () => ({ data: [] }) };
  };
  try {
    await assert.rejects(() => adapter.dispatchTasks([{ taskType: 'upscale' }]), /API Key/i);
    assert.deepEqual(sentHeaders, []);
    vaultKey = 'fresh-key';
    await adapter.dispatchTasks([{ taskType: 'upscale' }]);
    assert.deepEqual(sentHeaders, ['Bearer fresh-key']);
    vaultKey = '';
    await assert.rejects(() => adapter.dispatchTasks([{ taskType: 'upscale' }]), /API Key/i);
    assert.deepEqual(sentHeaders, ['Bearer fresh-key']);
    assert.equal(adapter.getApiKey(), '');
  } finally {
    global.fetch = previousFetch;
  }
});

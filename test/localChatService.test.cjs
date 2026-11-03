const test = require('node:test');
const assert = require('node:assert/strict');
const { LocalChatService } = require('../out/services/ai/LocalChatService');

test('local chat returns unavailable without starting or contacting a remote service', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url) => {
    requests.push(String(url));
    return { ok: true, json: async () => ({ models: [] }) };
  };
  try {
    assert.equal(await LocalChatService.reply('Ảnh này có gì?', []), null);
    assert.deepEqual(requests, ['http://127.0.0.1:11434/api/tags']);
  } finally {
    global.fetch = originalFetch;
  }
});

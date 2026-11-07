const test = require('node:test');
const assert = require('node:assert/strict');
const { ComfyUIAdapter } = require('../out/services/ai/ComfyUIAdapter');

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+M2Q0XwAAAABJRU5ErkJggg==';

test('ComfyUI removal aborts its upload and does not run the local fallback', async () => {
  const adapter = new ComfyUIAdapter();
  adapter.ping = async () => true;
  adapter.getAvailableRmbgNode = async () => 'RMBG';
  const caller = new AbortController();
  const originalFetch = global.fetch;
  let notifyUpload;
  const uploadStarted = new Promise(resolve => { notifyUpload = resolve; });
  let calls = 0;
  try {
    global.fetch = (_url, init) => {
      calls++;
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        notifyUpload(init.signal);
      });
    };
    const pending = adapter.removeBackground(image, { signal: caller.signal });
    const transportSignal = await uploadStarted;
    caller.abort();
    await assert.rejects(pending, /request cancelled/i);
    assert.equal(transportSignal.aborted, true);
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('ComfyUI workflow stops polling after cancellation following prompt submission', async () => {
  const adapter = new ComfyUIAdapter();
  const caller = new AbortController();
  const originalFetch = global.fetch;
  const urls = [];
  try {
    global.fetch = async url => {
      urls.push(String(url));
      return { ok: true, json: async () => ({ prompt_id: 'queued-fixture' }) };
    };
    const pending = adapter.executeWorkflow({ '1': { class_type: 'Fixture' } }, 60000, caller.signal);
    while (urls.length === 0) await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    caller.abort();
    await assert.rejects(pending, /request cancelled/i);
    assert.equal(urls.length, 1);
    assert.match(urls[0], /\/prompt$/);
  } finally {
    global.fetch = originalFetch;
  }
});

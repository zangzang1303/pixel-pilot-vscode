const test = require('node:test');
const assert = require('node:assert/strict');
const { RunwareAdapter } = require('../out/services/ai/RunwareAdapter');
const { ImageProcessor } = require('../out/services/image/ImageProcessor');

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

test('cancelled Runware upscale aborts transport without starting Sharp fallback', async () => {
  const adapter = new RunwareAdapter('fresh-key');
  const controller = new AbortController();
  const processor = ImageProcessor.getInstance();
  const previousUpscale = processor.upscale;
  const previousFetch = global.fetch;
  let fallbackCalls = 0;
  let requestStarted;
  const started = new Promise(resolve => { requestStarted = resolve; });
  processor.upscale = async () => { fallbackCalls += 1; throw new Error('fallback must not run'); };
  global.fetch = (_url, init) => new Promise((_resolve, reject) => {
    requestStarted();
    init.signal.addEventListener('abort', () => reject(new Error('transport aborted')), { once: true });
  });
  try {
    const pending = adapter.upscale('data:image/png;base64,AA==', 2, controller.signal);
    await started;
    controller.abort();
    const result = await pending;
    assert.equal(result.success, false);
    assert.match(result.error, /cancelled/i);
    assert.equal(fallbackCalls, 0);
  } finally {
    processor.upscale = previousUpscale;
    global.fetch = previousFetch;
  }
});

test('pre-cancelled background removal never sends a cloud request', async () => {
  const adapter = new RunwareAdapter('fresh-key');
  const controller = new AbortController();
  controller.abort();
  const previousFetch = global.fetch;
  let sends = 0;
  global.fetch = async () => { sends += 1; throw new Error('must not send'); };
  try {
    const result = await adapter.removeBackground('data:image/png;base64,AA==', { signal: controller.signal });
    assert.equal(result.success, false);
    assert.match(result.error, /cancelled/i);
    assert.equal(sends, 0);
  } finally { global.fetch = previousFetch; }
});

test('cancelled Runware enhance aborts transport without starting Sharp fallback', async () => {
  const adapter = new RunwareAdapter('fresh-key');
  const controller = new AbortController();
  const processor = ImageProcessor.getInstance();
  const previousEnhance = processor.enhance;
  const previousFetch = global.fetch;
  let fallbackCalls = 0;
  let requestStarted;
  const started = new Promise(resolve => { requestStarted = resolve; });
  processor.enhance = async () => { fallbackCalls += 1; throw new Error('fallback must not run'); };
  global.fetch = (_url, init) => new Promise((_resolve, reject) => {
    requestStarted();
    init.signal.addEventListener('abort', () => reject(new Error('transport aborted')), { once: true });
  });
  try {
    const pending = adapter.enhanceImage('data:image/png;base64,AA==', 'clarity', controller.signal);
    await started;
    controller.abort();
    const result = await pending;
    assert.equal(result.success, false);
    assert.match(result.error, /cancelled/i);
    assert.equal(fallbackCalls, 0);
  } finally {
    processor.enhance = previousEnhance;
    global.fetch = previousFetch;
  }
});

test('pre-cancelled background replacement never sends a cloud request', async () => {
  const adapter = new RunwareAdapter('fresh-key');
  const controller = new AbortController();
  controller.abort();
  const previousFetch = global.fetch;
  let sends = 0;
  global.fetch = async () => { sends += 1; throw new Error('must not send'); };
  try {
    const result = await adapter.replaceBackground('data:image/png;base64,AA==', 'blue backdrop', controller.signal);
    assert.equal(result.success, false);
    assert.match(result.error, /cancelled/i);
    assert.equal(sends, 0);
  } finally { global.fetch = previousFetch; }
});

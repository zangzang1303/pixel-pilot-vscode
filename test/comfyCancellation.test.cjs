const test = require('node:test');
const assert = require('node:assert/strict');
const { ComfyUIAdapter } = require('../out/services/ai/ComfyUIAdapter');
const { ImageProcessor } = require('../out/services/image/ImageProcessor');
const sharp = require('sharp');

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

test('cancelled Canvas inpaint aborts upload without starting local fill', async () => {
  const adapter = new ComfyUIAdapter();
  const processor = ImageProcessor.getInstance();
  const originalInpaint = processor.inpaint;
  const caller = new AbortController();
  const source = await sharp({ create: { width: 4, height: 4, channels: 4, background: '#884422' } }).png().toBuffer();
  const mask = await sharp({ create: { width: 4, height: 4, channels: 4, background: '#ffffff' } }).png().toBuffer();
  let notifyUpload;
  const uploadStarted = new Promise(resolve => { notifyUpload = resolve; });
  let localCalls = 0;
  adapter.hasDiffusionCheckpoint = async () => true;
  adapter.uploadImage = (_buffer, _filename, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('upload aborted')), { once: true });
    notifyUpload(signal);
  });
  processor.inpaint = async () => { localCalls++; throw new Error('local fill must not run'); };
  try {
    const pending = adapter.inpaint(
      `data:image/png;base64,${source.toString('base64')}`,
      `data:image/png;base64,${mask.toString('base64')}`,
      'remove object', caller.signal
    );
    const uploadSignal = await uploadStarted;
    caller.abort();
    await assert.rejects(pending, /request cancelled/i);
    assert.equal(uploadSignal.aborted, true);
    assert.equal(localCalls, 0);
  } finally {
    processor.inpaint = originalInpaint;
  }
});

test('cancelled Canvas mask, Canny, extend, and style skip local fallbacks', async () => {
  const source = await sharp({ create: { width: 4, height: 4, channels: 4, background: '#884422' } }).png().toBuffer();
  const dataUrl = `data:image/png;base64,${source.toString('base64')}`;
  const processor = ImageProcessor.getInstance();
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: true, json: async () => ({
      LoadBackgroundRemovalModel: { input: { required: { bg_removal_name: [['BiRefNet']] } } }
    }) });
    for (const [name, method, invoke] of [
      ['mask', 'extractMask', (adapter, signal) => adapter.extractMask(dataUrl, signal)],
      ['canny', 'detectEdges', (adapter, signal) => adapter.detectEdges(dataUrl, 'canny', signal)],
      ['extend', 'extendCanvas', (adapter, signal) => adapter.extendCanvas(dataUrl, 'all', undefined, signal)],
      ['style', 'styleTransfer', (adapter, signal) => adapter.styleTransfer(dataUrl, 'anime', undefined, signal)]
    ]) {
      const adapter = new ComfyUIAdapter();
      const caller = new AbortController();
      const originalFallback = processor[method];
      let fallbackCalls = 0;
      let notifyUpload;
      const uploadStarted = new Promise(resolve => { notifyUpload = resolve; });
      adapter.ping = async () => true;
      adapter.getAvailableRmbgNode = async () => 'RemoveBackground';
      adapter.hasDiffusionCheckpoint = async () => true;
      adapter.uploadImage = (_buffer, _filename, signal) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('upload aborted')), { once: true });
        notifyUpload(signal);
      });
      processor[method] = async () => { fallbackCalls++; throw new Error('fallback must not run'); };
      try {
        const pending = invoke(adapter, caller.signal);
        const uploadSignal = await uploadStarted;
        caller.abort();
        await assert.rejects(pending, /request cancelled/i, name);
        assert.equal(uploadSignal.aborted, true, name);
        assert.equal(fallbackCalls, 0, name);
      } finally {
        processor[method] = originalFallback;
      }
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test('cancelled background replacement skips the scenic fallback after generation starts', async () => {
  const adapter = new ComfyUIAdapter();
  const caller = new AbortController();
  const source = await sharp({ create: { width: 4, height: 4, channels: 4, background: '#884422' } }).png().toBuffer();
  const dataUrl = `data:image/png;base64,${source.toString('base64')}`;
  let notifyGeneration;
  const generationStarted = new Promise(resolve => { notifyGeneration = resolve; });
  let scenicCalls = 0;
  adapter.removeBackground = async (_image, options) => {
    assert.equal(options.signal, caller.signal);
    return { success: true, outputImageUri: dataUrl, metrics: { model: 'fixture cutout' } };
  };
  adapter.generateImage = (_prompt, _negative, _width, _height, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('generation aborted')), { once: true });
    notifyGeneration(signal);
  });
  adapter.createScenicBackdrop = async () => { scenicCalls++; throw new Error('scenic fallback must not run'); };
  const pending = adapter.replaceBackground(dataUrl, 'blue studio', caller.signal);
  const generationSignal = await generationStarted;
  caller.abort();
  await assert.rejects(pending, /request cancelled/i);
  assert.equal(generationSignal.aborted, true);
  assert.equal(scenicCalls, 0);
});

test('pre-cancelled ComfyUI generation does not probe or submit a workflow', async () => {
  const adapter = new ComfyUIAdapter();
  const caller = new AbortController();
  caller.abort();
  let probes = 0;
  let workflows = 0;
  adapter.hasDiffusionCheckpoint = async () => { probes++; return true; };
  adapter.executeWorkflow = async () => { workflows++; throw new Error('workflow must not run'); };
  await assert.rejects(() => adapter.generateImage('blue studio', '', 512, 512, caller.signal), /request cancelled/i);
  assert.equal(probes, 0);
  assert.equal(workflows, 0);
});

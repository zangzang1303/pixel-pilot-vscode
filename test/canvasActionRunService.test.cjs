const test = require('node:test');
const assert = require('node:assert/strict');
const { CanvasActionRunService, fingerprintCanvasAction } = require('../out/services/execution/CanvasActionRunService');

const request = (options = {}) => fingerprintCanvasAction({
  action: 'inpaint', dataUrl: 'data:image/png;base64,AA==',
  sessionId: 's1', nodeId: 'n1', options
});

test('Canvas request ID replays its terminal state without restarting paid work', () => {
  const runs = new CanvasActionRunService();
  const fingerprint = request({ prompt: 'restore', strength: 0.5 });
  assert.deepEqual(runs.begin('same', fingerprint, true), { kind: 'started' });
  assert.deepEqual(runs.begin('same', request({ strength: 0.5, prompt: 'restore' }), true),
    { kind: 'existing', state: 'running', previewId: undefined });
  assert.equal(runs.finish('same', 'succeeded'), true);
  assert.deepEqual(runs.begin('same', fingerprint, true),
    { kind: 'existing', state: 'succeeded', previewId: undefined });
  assert.equal(runs.finish('same', 'failed'), false);
  assert.deepEqual(runs.begin('same', request({ prompt: 'different' }), true), { kind: 'conflict' });
});

test('cancel belongs only to a running Canvas request and prevents late success from being recorded', () => {
  const runs = new CanvasActionRunService();
  runs.begin('edit', request(), true);
  const signal = runs.signal('edit');
  assert.equal(runs.cancel('edit'), true);
  assert.equal(signal.aborted, true);
  assert.equal(runs.cancel('edit'), false);
  assert.equal(runs.finish('edit', 'succeeded'), false);
  assert.equal(runs.finish('edit', 'cancelled'), true);
  assert.equal(runs.finish('edit', 'succeeded'), false);
  assert.deepEqual(runs.begin('edit', request(), true),
    { kind: 'existing', state: 'cancelled', previewId: undefined });
  assert.equal(runs.cancel('edit'), false);
});

test('bounded receipts retain active work and a preview ID for idempotent retry', () => {
  const runs = new CanvasActionRunService(2);
  runs.begin('active', request(), true);
  runs.begin('preview', request(), true);
  runs.finish('preview', 'awaiting_apply', 'preview-1');
  assert.deepEqual(runs.begin('preview', request(), true),
    { kind: 'existing', state: 'awaiting_apply', previewId: 'preview-1' });
  runs.begin('new', request(), true);
  assert.deepEqual(runs.begin('active', request(), true),
    { kind: 'existing', state: 'running', previewId: undefined });
  assert.deepEqual(runs.begin('preview', request(), true),
    { kind: 'started' });
});

test('Generate cancellation is rejected once session commit begins', () => {
  const runs = new CanvasActionRunService();
  runs.begin('before', request(), true);
  assert.equal(runs.cancel('before'), true);
  assert.equal(runs.lockCommit('before'), false);
  assert.equal(runs.finish('before', 'cancelled'), true);

  runs.begin('after', request(), true);
  assert.equal(runs.lockCommit('after'), true);
  assert.equal(runs.cancel('after'), false);
  assert.equal(runs.finish('after', 'succeeded'), true);
});

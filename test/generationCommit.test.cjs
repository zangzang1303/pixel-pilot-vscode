const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SessionManager } = require('../out/services/session/SessionManager');
const { GenerationCommitService } = require('../out/services/session/GenerationCommitService');

const image = 'data:image/png;base64,AA==';
const result = { success: true, outputImageUri: image, metrics: { model: 'InvokeAI/test-model', latencyMs: 12, costUsd: 0 } };

test('generated image creates a persistent generate root with provenance and export path', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-pilot-generate-'));
  try {
    const sessions = new SessionManager(directory);
    const service = new GenerationCommitService(sessions, { saveToCache: async () => 'cached-generated.png' });
    const generated = await service.commit(service.capture(), 'a red kite', result, { width: 512 });
    sessions.setNodeExportPath(generated.sessionId, generated.rootNodeId, './assets/kite.png');

    const reopened = new SessionManager(directory).getActiveSession();
    assert.equal(reopened.sessionId, generated.sessionId);
    assert.equal(reopened.currentNodeId, generated.rootNodeId);
    assert.equal(reopened.nodes[reopened.rootNodeId].operation, 'generate');
    assert.equal(reopened.nodes[reopened.rootNodeId].metrics.model, 'InvokeAI/test-model');
    assert.equal(reopened.nodes[reopened.rootNodeId].prompt, 'a red kite');
    assert.equal(reopened.nodes[reopened.rootNodeId].params.exportPath, './assets/kite.png');
    assert.equal(reopened.nodes[reopened.rootNodeId].outputImageUri, 'cached-generated.png');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('late generated image is saved as another session without stealing the active session', async () => {
  const sessions = new SessionManager();
  const first = sessions.createSession('first.png');
  let release;
  const service = new GenerationCommitService(sessions, {
    saveToCache: () => new Promise(resolve => { release = resolve; })
  });
  const target = service.capture();
  const pending = service.commit(target, 'new image', result);
  const second = sessions.createSession('second.png');
  release('generated.png');
  const generated = await pending;

  assert.equal(target.sessionId, first.sessionId);
  assert.equal(sessions.getActiveSession().sessionId, second.sessionId);
  assert.equal(sessions.getSession(generated.sessionId).nodes[generated.rootNodeId].operation, 'generate');
  assert.throws(() => service.capture(target), /selected session changed/i);
});

test('selection change during generation also preserves the selected node', async () => {
  const sessions = new SessionManager();
  const original = sessions.createSession('source.png');
  let release;
  const service = new GenerationCommitService(sessions, {
    saveToCache: () => new Promise(resolve => { release = resolve; })
  });
  const pending = service.commit(service.capture(), 'another image', result);
  const selected = sessions.addOperationNode(original.sessionId, original.rootNodeId, 'upscale', 'Upscale', 'source.png', 'selected.png', result.metrics);
  release('generated.png');
  await pending;
  assert.equal(sessions.getActiveSession().currentNodeId, selected.nodeId);
});

test('failed or empty generation leaves sessions unchanged', async () => {
  const sessions = new SessionManager();
  const current = sessions.createSession('source.png');
  const service = new GenerationCommitService(sessions, { saveToCache: async () => { throw new Error('disk full'); } });
  await assert.rejects(() => service.commit(service.capture(), 'a kite', result), /disk full/);
  await assert.rejects(() => service.commit(service.capture(), 'a kite', { ...result, outputImageUri: undefined }), /did not produce an image/i);
  assert.equal(sessions.getAllSessions().length, 1);
  assert.equal(sessions.getActiveSession().sessionId, current.sessionId);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SessionManager } = require('../out/services/session/SessionManager');
const { SessionCommitService } = require('../out/services/session/SessionCommitService');
const { CanvasActionCommitService } = require('../out/services/session/CanvasActionCommitService');

const image = 'data:image/png;base64,AA==';
const metrics = { model: 'test', latencyMs: 0, costUsd: 0 };

test('canvas edit stays in the pinned session after switching sessions', async () => {
  const sessions = new SessionManager();
  const first = sessions.createSession('first.png');
  const assets = [];
  const service = new CanvasActionCommitService(sessions, new SessionCommitService(sessions, {
    saveToCache: async value => { assets.push(value); return `artifact-${assets.length}.png`; }
  }));
  const target = service.capture();
  const second = sessions.createSession('second.png');

  const result = await service.commit(target, 'upscale', image, { factor: 2 });
  assert.equal(result.parentId, first.rootNodeId);
  assert.equal(result.operation, 'upscale');
  assert.equal(sessions.getActiveSession().sessionId, second.sessionId);
  assert.equal(sessions.getSession(second.sessionId).currentNodeId, second.rootNodeId);
  assert.equal(sessions.getSession(first.sessionId).currentNodeId, result.nodeId);
  assert.deepEqual(assets, [image]);
});

test('canvas edit branches without stealing a newer selected node', async () => {
  const sessions = new SessionManager();
  const session = sessions.createSession('source.png');
  const service = new CanvasActionCommitService(sessions, new SessionCommitService(sessions, {
    saveToCache: async () => 'result.png'
  }));
  const target = service.capture();
  const selected = sessions.addOperationNode(session.sessionId, session.rootNodeId, 'enhance', 'Enhance', 'source.png', 'selected.png', metrics);
  assert.throws(() => service.capture(target), /selected image changed/i);

  const result = await service.commit(target, 'recolor', image, { color: 'cyan' });
  assert.equal(result.parentId, session.rootNodeId);
  assert.equal(sessions.getActiveSession().currentNodeId, selected.nodeId);
  assert.deepEqual(result.params, { color: 'cyan', source: 'canvas_button' });
});

test('failed canvas artifact write does not create an edit node', async () => {
  const sessions = new SessionManager();
  const session = sessions.createSession('source.png');
  const service = new CanvasActionCommitService(sessions, new SessionCommitService(sessions, {
    saveToCache: async () => { throw new Error('disk full'); }
  }));
  const target = service.capture();
  await assert.rejects(() => service.commit(target, 'inpaint', image), /disk full/);
  assert.deepEqual(Object.keys(sessions.getActiveSession().nodes), [session.rootNodeId]);
});

test('canvas action keeps the mask reference and excludes raw mask data from params', async () => {
  const sessions = new SessionManager();
  sessions.createSession('source.png');
  const service = new CanvasActionCommitService(sessions, new SessionCommitService(sessions, {
    saveToCache: async () => 'result.png'
  }));
  const result = await service.commit(service.capture(), 'inpaint', image, { prompt: 'restore', maskDataUrl: image }, 'mask.png');
  assert.equal(result.maskUri, 'mask.png');
  assert.equal(result.prompt, 'restore');
  assert.equal(result.params.maskDataUrl, undefined);
  const empty = new SessionManager();
  assert.throws(() => new CanvasActionCommitService(empty, new SessionCommitService(empty, {
    saveToCache: async () => 'unused.png'
  })).capture(), /Load an image/);
});

test('late caption attaches to the pinned image without creating an edit', () => {
  const sessions = new SessionManager();
  const first = sessions.createSession('first.png');
  const service = new CanvasActionCommitService(sessions, new SessionCommitService(sessions, {
    saveToCache: async () => 'unused.png'
  }));
  const target = service.capture();
  const second = sessions.createSession('second.png');
  const caption = service.recordCaption(target, 'A sample image');
  assert.equal(caption.nodeId, first.rootNodeId);
  assert.equal(sessions.getSession(first.sessionId).messages.at(-1).text, 'A sample image');
  assert.equal(sessions.getSession(second.sessionId).messages.length, 1);
  assert.deepEqual(Object.keys(sessions.getSession(first.sessionId).nodes), [first.rootNodeId]);
});

test('canvas edit and export path survive reopening the session store', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-pilot-canvas-'));
  try {
    const sessions = new SessionManager(directory);
    sessions.createSession('source.png');
    const service = new CanvasActionCommitService(sessions, new SessionCommitService(sessions, {
      saveToCache: async () => 'cached-result.png'
    }));
    const result = await service.commit(service.capture(), 'vectorize', image, { exportPath: './assets/vector.svg' });
    const reopened = new SessionManager(directory).getActiveSession();
    assert.equal(reopened.currentNodeId, result.nodeId);
    assert.equal(reopened.nodes[result.nodeId].operation, 'vectorize');
    assert.equal(reopened.nodes[result.nodeId].params.exportPath, './assets/vector.svg');
    assert.equal(reopened.nodes[result.nodeId].outputImageUri, 'cached-result.png');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('canvas edit records provider provenance in node metrics', async () => {
  const sessions = new SessionManager();
  sessions.createSession('source.png');
  const service = new CanvasActionCommitService(sessions, new SessionCommitService(sessions, {
    saveToCache: async () => 'cached-result.png'
  }));
  const result = await service.commit(service.capture(), 'removeBackground', image, { provider: 'comfyui' });
  assert.equal(result.metrics.model, 'Canvas action (comfyui)');
});


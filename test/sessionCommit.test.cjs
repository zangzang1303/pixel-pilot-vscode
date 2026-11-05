const test = require('node:test');
const assert = require('node:assert/strict');
const { SessionManager } = require('../out/services/session/SessionManager');
const { SessionCommitService } = require('../out/services/session/SessionCommitService');

const metrics = { model: 'test', latencyMs: 1, costUsd: 0 };

test('commit persists an artifact before advancing the DAG', async () => {
  const manager = new SessionManager();
  const session = manager.createSession('source.png', 'commit');
  const commits = [];
  const service = new SessionCommitService(manager, { saveToCache: async value => { commits.push(value); return 'artifact.png'; } });
  const node = await service.commitImageResult({ sessionId: session.sessionId, parentId: session.rootNodeId, operation: 'upscale', intent: { label: 'Upscale' }, result: { success: true, outputImageUri: 'data:image/png;base64,AA==', metrics } });
  assert.equal(commits.length, 1);
  assert.equal(node.outputImageUri, 'artifact.png');
  assert.equal(manager.getActiveSession().currentNodeId, node.nodeId);
});

test('a failed artifact write leaves the current DAG node unchanged', async () => {
  const manager = new SessionManager();
  const session = manager.createSession('source.png', 'commit');
  const service = new SessionCommitService(manager, { saveToCache: async () => { throw new Error('disk full'); } });
  await assert.rejects(() => service.commitImageResult({ sessionId: session.sessionId, parentId: session.rootNodeId, operation: 'upscale', intent: { label: 'Upscale' }, result: { success: true, outputImageUri: 'data:image/png;base64,AA==', metrics } }), /disk full/i);
  assert.equal(manager.getActiveSession().currentNodeId, session.rootNodeId);
});

test('persisted metrics distinguish estimated local zero from unreported cloud cost', async () => {
  const manager = new SessionManager();
  const session = manager.createSession('source.png');
  const service = new SessionCommitService(manager, { saveToCache: async () => 'artifact.png' });
  const local = await service.commitImageResult({ sessionId: session.sessionId, parentId: session.rootNodeId, operation: 'upscale', intent: { label: 'Local' }, result: { success: true, outputImageUri: 'data:image/png;base64,AA==', metrics: { model: 'Local Sharp', latencyMs: 5, costUsd: 0 } } });
  const cloud = await service.commitImageResult({ sessionId: session.sessionId, parentId: session.rootNodeId, operation: 'upscale', intent: { label: 'Cloud' }, result: { success: true, outputImageUri: 'data:image/png;base64,AA==', metrics: { model: 'Runware example', latencyMs: 5, costUsd: 0 } } });
  assert.equal(local.metrics.costStatus, 'estimated');
  assert.equal(local.metrics.costUsd, 0);
  assert.equal(cloud.metrics.costStatus, 'unknown');
  assert.equal(cloud.metrics.costUsd, undefined);
});

test('a late result branches from its pinned parent without stealing the selected node', async () => {
  const manager = new SessionManager();
  const session = manager.createSession('source.png');
  let release;
  const service = new SessionCommitService(manager, { saveToCache: () => new Promise(resolve => { release = resolve; }) });
  const pending = service.commitImageResult({ sessionId: session.sessionId, parentId: session.rootNodeId, operation: 'upscale', intent: { label: 'Upscale' }, result: { success: true, outputImageUri: 'data:image/png;base64,AA==', metrics } });
  const selected = manager.addOperationNode(session.sessionId, session.rootNodeId, 'enhance', 'Enhance', 'source.png', 'other.png', metrics);
  release('late-result.png');
  const committed = await pending;
  assert.equal(committed.parentId, session.rootNodeId);
  assert.equal(manager.getSession(session.sessionId).currentNodeId, selected.nodeId);
  assert.deepEqual(manager.getSession(session.sessionId).nodes[session.rootNodeId].childrenIds, [selected.nodeId, committed.nodeId]);
});

test('cancellation while persisting an artifact leaves the DAG unchanged', async () => {
  const manager = new SessionManager();
  const session = manager.createSession('source.png');
  const controller = new AbortController();
  let release;
  const service = new SessionCommitService(manager, { saveToCache: () => new Promise(resolve => { release = resolve; }) });
  const pending = service.commitImageResult({ sessionId: session.sessionId, parentId: session.rootNodeId, operation: 'upscale', intent: { label: 'Upscale' }, signal: controller.signal, result: { success: true, outputImageUri: 'data:image/png;base64,AA==', metrics } });
  controller.abort();
  release('late-result.png');
  await assert.rejects(pending, /cancelled/i);
  assert.equal(manager.getSession(session.sessionId).currentNodeId, session.rootNodeId);
});

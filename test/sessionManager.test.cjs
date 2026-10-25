const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SessionManager } = require('../out/services/session/SessionManager');

function tempStore() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-pilot-session-'));
}

test('session DAG persists operations, chat, and active node', () => {
  const directory = tempStore();
  try {
    const manager = new SessionManager(directory);
    const session = manager.createSession('data:image/png;base64,AA==', 'Product');
    const first = manager.addOperationNode(
      session.sessionId,
      session.rootNodeId,
      'upscale',
      'Upscale 2x',
      session.nodes[session.rootNodeId].outputImageUri,
      'cached-result.png',
      { model: 'test', latencyMs: 12, costUsd: 0 }
    );
    manager.addMessage(session.sessionId, { sender: 'user', text: 'continue', nodeId: first.nodeId });

    const restored = new SessionManager(directory).getActiveSession();
    assert.ok(restored);
    assert.equal(restored.title, 'Product');
    assert.equal(restored.currentNodeId, first.nodeId);
    assert.equal(restored.nodes[session.rootNodeId].childrenIds[0], first.nodeId);
    assert.equal(restored.messages.at(-1).text, 'continue');
    assert.equal(fs.existsSync(path.join(directory, '.pixelpilot_sessions.json.tmp')), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('rollback creates a branch without deleting prior history', () => {
  const manager = new SessionManager();
  const session = manager.createSession('original.png');
  const first = manager.addOperationNode(session.sessionId, session.rootNodeId, 'enhance', 'Enhance', 'original.png', 'enhanced.png', { model: 'test', latencyMs: 1, costUsd: 0 });
  manager.rollbackToNode(session.sessionId, session.rootNodeId);
  const second = manager.addOperationNode(session.sessionId, session.rootNodeId, 'upscale', 'Upscale', 'original.png', 'upscaled.png', { model: 'test', latencyMs: 1, costUsd: 0 });
  const updated = manager.getSession(session.sessionId);
  assert.deepEqual(updated.nodes[session.rootNodeId].childrenIds, [first.nodeId, second.nodeId]);
  assert.equal(updated.currentNodeId, second.nodeId);
});

test('importDAG validates the root and repairs a missing current node', () => {
  const manager = new SessionManager();
  assert.throws(() => manager.importDAG(JSON.stringify({ sessionId: 'bad', rootNodeId: 'missing', nodes: {} })), /Invalid Session DAG/);

  const source = manager.createSession('original.png');
  const exported = JSON.parse(manager.exportDAG(source.sessionId));
  exported.sessionId = 'imported';
  exported.currentNodeId = 'missing';
  const imported = manager.importDAG(JSON.stringify(exported));
  assert.equal(imported.currentNodeId, imported.rootNodeId);
});

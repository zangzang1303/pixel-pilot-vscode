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
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, '.pixelpilot_sessions.json'), 'utf8')).schemaVersion, 2);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('malformed persisted session data is quarantined instead of overwritten', () => {
  const directory = tempStore();
  try {
    fs.writeFileSync(path.join(directory, '.pixelpilot_sessions.json'), '{not json', 'utf8');
    const manager = new SessionManager(directory);
    assert.equal(manager.getActiveSession(), null);
    const quarantined = fs.readdirSync(directory).filter(name => name.startsWith('.pixelpilot_sessions.json.corrupt.'));
    assert.equal(quarantined.length, 1);
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

test('referenced artifacts include every DAG image and mask', () => {
  const manager = new SessionManager();
  const source = path.resolve('cache-source.png');
  const result = path.resolve('cache-result.png');
  const mask = path.resolve('cache-mask.png');
  const session = manager.createSession(source, 'assets');
  manager.addOperationNode(session.sessionId, session.rootNodeId, 'inpaint', 'inpaint', source, result, { model: 'test', latencyMs: 0, costUsd: 0 }, { maskUri: mask });
  const artifacts = manager.getReferencedArtifactPaths();
  assert.deepEqual(artifacts, new Set([source, result, mask]));
});

test('importDAG rejects cycles and invalid parent links', () => {
  const manager = new SessionManager();
  const invalid = {
    sessionId: 'broken', title: 'broken', createdAt: 0, updatedAt: 0,
    rootNodeId: 'root', currentNodeId: 'root', messages: [],
    nodes: {
      root: { nodeId: 'root', parentId: 'child', childrenIds: [], timestamp: 0, operation: 'original', operationLabel: 'root', inputImageUri: '', outputImageUri: '', metrics: { model: 'test', latencyMs: 0, costUsd: 0 } },
      child: { nodeId: 'child', parentId: 'root', childrenIds: [], timestamp: 0, operation: 'upscale', operationLabel: 'child', inputImageUri: '', outputImageUri: '', metrics: { model: 'test', latencyMs: 0, costUsd: 0 } }
    }
  };
  assert.throws(() => manager.importDAG(JSON.stringify(invalid)), /root must not have a parent/i);
});

test('failed session-store rename rejects an edit and rolls back the in-memory DAG', () => {
  const directory = tempStore();
  const originalRename = fs.renameSync;
  try {
    const manager = new SessionManager(directory);
    const session = manager.createSession('source.png');
    const storePath = path.join(directory, '.pixelpilot_sessions.json');
    const before = fs.readFileSync(storePath, 'utf8');
    fs.renameSync = () => { throw new Error('disk rename failed'); };
    assert.throws(() => manager.addOperationNode(
      session.sessionId, session.rootNodeId, 'upscale', 'Upscale', 'source.png',
      'result.png', { model: 'test', latencyMs: 1, costUsd: 0 }
    ), /disk rename failed/);
    assert.equal(manager.getSession(session.sessionId).currentNodeId, session.rootNodeId);
    assert.deepEqual(manager.getSession(session.sessionId).nodes[session.rootNodeId].childrenIds, []);
    assert.equal(fs.readFileSync(storePath, 'utf8'), before);
    assert.equal(fs.existsSync(`${storePath}.tmp`), false);
  } finally {
    fs.renameSync = originalRename;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('first v2 write backs up a valid legacy session store byte for byte', () => {
  const directory = tempStore();
  try {
    const storePath = path.join(directory, '.pixelpilot_sessions.json');
    const source = new SessionManager().createSession('source.png', 'legacy');
    const legacy = JSON.stringify([source]);
    fs.writeFileSync(storePath, legacy, 'utf8');
    const manager = new SessionManager(directory);
    manager.renameSession(source.sessionId, 'migrated');
    const backups = fs.readdirSync(directory).filter(name => name.startsWith('.pixelpilot_sessions.json.v1.bak.'));
    assert.equal(backups.length, 1);
    assert.equal(fs.readFileSync(path.join(directory, backups[0]), 'utf8'), legacy);
    const current = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    assert.equal(current.schemaVersion, 2);
    assert.equal(current.sessions[0].title, 'migrated');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { SessionManager } = require('../out/services/session/SessionManager');
const { ContextBuilder } = require('../out/services/copilot/ContextBuilder');

test('context builder pins a node and bounds copied history', () => {
  const manager = new SessionManager();
  const session = manager.createSession('original.png', 'context');
  const first = manager.addOperationNode(session.sessionId, session.rootNodeId, 'upscale', 'upscale', 'original.png', 'upscaled.png', { model: 'test', latencyMs: 0, costUsd: 0 });
  for (let index = 0; index < 20; index++) manager.addMessage(session.sessionId, { sender: 'user', text: `message ${index}` });
  const snapshot = new ContextBuilder().build(manager.getSession(session.sessionId), first.nodeId);
  assert.equal(snapshot.nodeId, first.nodeId);
  assert.equal(snapshot.currentImageUri, 'upscaled.png');
  assert.deepEqual(snapshot.ancestry, [first.nodeId, session.rootNodeId]);
  assert.equal(snapshot.conversationHistory.length, 16);
  assert.throws(() => snapshot.ancestry.push('mutate'), /object is not extensible|read only/i);
});

test('context builder detects stale revisions and validates mask bounds', () => {
  const manager = new SessionManager();
  const session = manager.createSession('original.png', 'context');
  const builder = new ContextBuilder();
  const snapshot = builder.build(manager.getSession(session.sessionId), session.rootNodeId, { maskUri: 'mask.png' });
  assert.equal(snapshot.maskUri, 'mask.png');
  assert.equal(snapshot.maskValidForImage, true);
  assert.equal(builder.isStaleRevision(manager.getSession(session.sessionId), session.rootNodeId, snapshot.revision), false);
  assert.equal(builder.isStaleRevision(manager.getSession(session.sessionId), session.rootNodeId, 'old_rev_123'), true);
});


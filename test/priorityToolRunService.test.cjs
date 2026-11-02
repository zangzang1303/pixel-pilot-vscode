const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { PriorityToolRunService } = require('../out/services/copilot/PriorityToolRunService');
const { AgentToolRegistry } = require('../out/services/ai/AgentToolRegistry');
const { ExecutionEngine } = require('../out/services/execution/ExecutionEngine');
const { ArtifactStore } = require('../out/services/storage/ArtifactStore');
const { SessionManager } = require('../out/services/session/SessionManager');
const { SessionCommitService } = require('../out/services/session/SessionCommitService');

async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-pilot-priority-'));
  const source = path.join(dir, 'source.png');
  fs.writeFileSync(source, await sharp({ create: { width: 8, height: 8, channels: 4, background: 'red' } }).png().toBuffer());
  const sessions = new SessionManager();
  const session = sessions.createSession(source);
  const artifacts = new ArtifactStore(dir);
  const commits = new SessionCommitService(sessions, { saveToCache: async value => value });
  return { dir, source, sessions, session, artifacts, commits };
}

test('priority tool pins image input and commits the persisted artifact to the DAG', async () => {
  const f = await fixture();
  try {
    let actualArgs;
    let executions = 0;
    const orchestrator = {
      validateTool: AgentToolRegistry.validateToolCall.bind(AgentToolRegistry),
      executeTool: async (_name, args, context) => {
        executions++;
        actualArgs = args;
        const output = await sharp(f.source).tint('blue').png().toBuffer();
        return { artifactId: await context.storeArtifact(output, 'image/png', 'image') };
      }
    };
    const service = new PriorityToolRunService(orchestrator, new ExecutionEngine(), f.artifacts, f.sessions, f.commits);
    await assert.rejects(() => service.run({ requestId: 'wrong-image', sessionId: f.session.sessionId, parentId: f.session.rootNodeId, toolName: 'image.recolor', args: { imageId: 'other.png', target: 'clothes', color: 'blue' } }), /pinned node/);
    const result = await service.run({ requestId: 'recolor-1', sessionId: f.session.sessionId, parentId: f.session.rootNodeId, toolName: 'image.recolor', args: { target: 'clothes', color: 'blue' } });
    assert.equal(actualArgs.imageId, f.source);
    assert.ok(result.artifactId?.startsWith('art_'));
    assert.equal(f.sessions.getSession(f.session.sessionId).nodes[result.nodeId].params.artifactId, result.artifactId);
    assert.ok(fs.existsSync(f.sessions.getSession(f.session.sessionId).nodes[result.nodeId].outputImageUri));
    const repeated = await service.run({ requestId: 'recolor-1', sessionId: f.session.sessionId, parentId: f.session.rootNodeId, toolName: 'image.recolor', args: { target: 'clothes', color: 'blue' } });
    assert.equal(repeated.nodeId, result.nodeId);
    assert.equal(executions, 1);
    await assert.rejects(() => service.run({ requestId: 'recolor-1', sessionId: f.session.sessionId, parentId: f.session.rootNodeId, toolName: 'image.recolor', args: { target: 'clothes', color: 'red' } }), /already used/);
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test('cancelled priority tool cannot commit a late provider result', async () => {
  const f = await fixture();
  try {
    let release;
    let started;
    const ready = new Promise(resolve => { started = resolve; });
    const orchestrator = {
      validateTool: AgentToolRegistry.validateToolCall.bind(AgentToolRegistry),
      executeTool: async () => {
        started();
        await new Promise(resolve => { release = resolve; });
        return { artifactId: 'art_late' };
      }
    };
    const service = new PriorityToolRunService(orchestrator, new ExecutionEngine(), f.artifacts, f.sessions, f.commits);
    const pending = service.run({ requestId: 'recolor-cancel', sessionId: f.session.sessionId, parentId: f.session.rootNodeId, toolName: 'image.recolor', args: { target: 'hair', color: 'blue' } });
    await ready;
    assert.equal(service.cancel('recolor-cancel'), true);
    release();
    await assert.rejects(pending, /cancelled/i);
    assert.equal(f.sessions.getSession(f.session.sessionId).currentNodeId, f.session.rootNodeId);
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

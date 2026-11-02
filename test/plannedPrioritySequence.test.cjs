const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SessionManager } = require('../out/services/session/SessionManager');
const { CopilotOrchestrator } = require('../out/services/copilot/CopilotOrchestrator');
const { PlanExecutionCoordinator } = require('../out/services/planner/PlanExecutionCoordinator');
const { PlannedPrioritySequenceService } = require('../out/services/copilot/PlannedPrioritySequenceService');

test('planned priority sequence resumes from a durable checkpoint and binds the committed DAG node', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-pilot-plan-run-'));
  try {
    let sessions = new SessionManager(dir);
    const session = sessions.createSession('source.png');
    const plan = {
      planId: 'plan_durable_priority', intent: 'edit', prompt: 'tách nền rồi đổi áo sang xanh', summary: '2 steps',
      steps: [
        { stepId: 'step_1', toolName: 'image.remove_background', args: { imageId: 'source.png', quality: 'model' }, route: { providerId: 'comfyui', isCloud: false } },
        { stepId: 'step_2', toolName: 'image.recolor', args: { imageId: '$prev.artifactId', target: 'clothes', color: 'blue' }, inputBindings: { imageId: '$prev.artifactId' }, route: { providerId: 'comfyui', isCloud: false } }
      ]
    };
    const metrics = { model: 'fixture', latencyMs: 1, costUsd: 0 };
    let firstRuns = 0;
    let secondRuns = 0;
    const fakePriority = {
      run: async input => {
        if (input.toolName === 'image.remove_background') {
          firstRuns++;
          const node = sessions.addOperationNode(session.sessionId, input.parentId, 'remove_background', 'Cutout', 'source.png', 'cutout.png', metrics, { params: { artifactId: 'art_cutout' } });
          return { nodeId: node.nodeId, artifactId: 'art_cutout' };
        }
        secondRuns++;
        assert.equal(input.parentId, 'node_1_remove_background');
        assert.equal(input.args.imageId, undefined);
        if (secondRuns === 1) throw new Error('local model unavailable');
        const node = sessions.addOperationNode(session.sessionId, input.parentId, 'recolor', 'Recolor', 'cutout.png', 'recolored.png', metrics, { params: { artifactId: 'art_recolored' } });
        return { nodeId: node.nodeId, artifactId: 'art_recolored' };
      }
    };
    const makeService = () => new PlannedPrioritySequenceService(
      new CopilotOrchestrator(undefined, undefined, new PlanExecutionCoordinator(path.join(dir, 'checkpoints'))),
      fakePriority, sessions);
    const wrongRoute = JSON.parse(JSON.stringify(plan));
    wrongRoute.steps[0].route.providerId = 'sharp';
    await assert.rejects(() => makeService().run({ plan: wrongRoute, sessionId: session.sessionId, initialNodeId: session.rootNodeId, expectedSteps: 2 }), /basic Sharp/);
    assert.equal(firstRuns, 0);
    await assert.rejects(() => makeService().run({ plan, sessionId: session.sessionId, initialNodeId: session.rootNodeId, expectedSteps: 2 }), /local model unavailable/);
    assert.equal(firstRuns, 1);
    sessions = new SessionManager(dir);
    const checkpoint = await makeService().run({ plan, sessionId: session.sessionId, initialNodeId: session.rootNodeId, expectedSteps: 2 });
    assert.equal(checkpoint.isCompleted, true);
    assert.equal(firstRuns, 1);
    assert.equal(secondRuns, 2);
    assert.equal(sessions.getSession(session.sessionId).currentNodeId, 'node_2_recolor');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

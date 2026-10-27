const test = require('node:test');
const assert = require('node:assert/strict');
const { CopilotOrchestrator } = require('../out/services/copilot/CopilotOrchestrator');

test('orchestrator delegates planning and shares registry validation', async () => {
  let received;
  const orchestrator = new CopilotOrchestrator({
    decideTool: async (prompt, context, config) => {
      received = { prompt, context, config };
      return { type: 'chat', replyText: 'ok', thought: 'test', reasoningSteps: [] };
    }
  });
  const decision = await orchestrator.plan('hello', { currentNodeId: 'node-1' }, { provider: 'local' });
  assert.equal(decision.replyText, 'ok');
  assert.equal(received.context.currentNodeId, 'node-1');
  assert.equal(orchestrator.validateTool('upscale_image', { factor: 2 }).intent.operation, 'upscale');
  assert.throws(() => orchestrator.validateTool('unknown', {}), /Unknown tool/i);
});

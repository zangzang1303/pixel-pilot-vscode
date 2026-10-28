const test = require('node:test');
const assert = require('node:assert/strict');
const { CopilotOrchestrator } = require('../out/services/copilot/CopilotOrchestrator');
const { AgentToolRegistry } = require('../out/services/ai/AgentToolRegistry');

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

test('orchestrator classifies intent and executes through registry', async () => {
  AgentToolRegistry.registerExecutor('image.generate', async (context, args) => {
    return { artifactId: 'gen-123', prompt: args.prompt };
  });

  const orchestrator = new CopilotOrchestrator();
  assert.equal(orchestrator.classifyIntent('tách nền ảnh này').type, 'tool');
  assert.equal(orchestrator.classifyIntent('phân tích ảnh này').type, 'analyze');
  assert.equal(orchestrator.classifyIntent('chào bạn').type, 'chat');

  const result = await orchestrator.executeTool('image.generate', { prompt: 'mountains' });
  assert.equal(result.artifactId, 'gen-123');
});


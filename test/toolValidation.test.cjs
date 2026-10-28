const test = require('node:test');
const assert = require('node:assert/strict');
const { AgentToolRegistry, ToolValidationError } = require('../out/services/ai/AgentToolRegistry');

test('tool registry rejects an unknown tool instead of substituting another edit', () => {
  assert.throws(
    () => AgentToolRegistry.validateToolCall('unregistered_tool', { targetColor: 'red' }),
    ToolValidationError
  );
});

test('tool registry validates required arguments, enums, and numeric values', () => {
  assert.throws(
    () => AgentToolRegistry.validateToolCall('upscale_image', { factor: 3 }),
    /unsupported value/i
  );
  assert.throws(
    () => AgentToolRegistry.validateToolCall('recolor_subject', { target: 'face', targetColor: 'cyan' }),
    /unsupported value/i
  );
  assert.throws(
    () => AgentToolRegistry.validateToolCall('replace_background', {}),
    /Missing required argument/i
  );
  assert.throws(
    () => AgentToolRegistry.validateToolCall('upscale_image', { factor: Number.NaN }),
    /finite number/i
  );
});

test('tool registry applies documented defaults only after validation', () => {
  const call = AgentToolRegistry.validateToolCall('remove_background', {});
  assert.equal(call.args.preserveDetails, true);
  assert.equal(call.intent.operation, 'remove_background');
});

test('tool registry rejects duplicate tool registration', () => {
  assert.throws(
    () => AgentToolRegistry.register({
      name: 'upscale_image',
      displayName: 'Duplicate Upscale',
      category: 'core',
      description: 'dup',
      parameters: { type: 'object', properties: {} },
      mapToIntent: () => ({ operation: 'upscale', label: 'dup' })
    }),
    /already registered/i
  );
});

test('tool registry executes registered executor and reports unavailable reasons', async () => {
  let executedArgs;
  AgentToolRegistry.registerExecutor('image.generate', async (context, args) => {
    executedArgs = args;
    return { artifactId: 'gen-123' };
  });

  const res = await AgentToolRegistry.execute('image.generate', { prompt: 'a cute cat' });
  assert.equal(res.artifactId, 'gen-123');
  assert.equal(executedArgs.prompt, 'a cute cat');

  // Tool with unavailable reason
  AgentToolRegistry.register({
    name: 'custom_disabled_tool',
    displayName: 'Disabled Tool',
    category: 'core',
    description: 'test',
    unavailableReason: 'Requires GPU acceleration',
    parameters: { type: 'object', properties: {} },
    mapToIntent: () => ({ operation: 'preprocess', label: 'disabled' })
  });
  await assert.rejects(
    () => AgentToolRegistry.execute('custom_disabled_tool', {}),
    /Requires GPU acceleration/i
  );
});


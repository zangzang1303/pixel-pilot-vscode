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

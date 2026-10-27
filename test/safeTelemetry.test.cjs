const test = require('node:test');
const assert = require('node:assert/strict');
const { SafeTelemetry } = require('../out/services/copilot/SafeTelemetry');

test('safe telemetry is bounded and cannot retain content-like fields', () => {
  const telemetry = new SafeTelemetry(2);
  telemetry.record({ requestId: 'run-1', command: 'tool', outcome: 'started', toolName: 'upscale_image', latencyMs: -1, prompt: 'secret prompt', image: 'data:image/png;base64,secret' });
  telemetry.record({ requestId: 'run-2', command: 'chat', outcome: 'succeeded', latencyMs: 12.2 });
  telemetry.record({ requestId: 'run-3', command: 'cancel', outcome: 'cancelled' });
  const events = telemetry.recent();
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], { at: events[0].at, requestId: 'run-2', command: 'chat', outcome: 'succeeded', toolName: undefined, latencyMs: 12 });
  assert.equal(JSON.stringify(events).includes('secret'), false);
});

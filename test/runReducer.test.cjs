const test = require('node:test');
const assert = require('node:assert/strict');

// Import transpiled runReducer
const { runReducer, initialRunState } = require('../out/shared/runReducer');

test('runReducer handles full lifecycle: start -> progress -> succeed', () => {
  let state = initialRunState;
  assert.equal(state.phase, 'idle');

  // 1. Start run
  state = runReducer(state, {
    type: 'start',
    requestId: 'req-001',
    label: 'Tách nền AI',
    toolName: 'image.remove_background',
    provider: 'ComfyUI GPU'
  });

  assert.equal(state.phase, 'executing');
  assert.equal(state.requestId, 'req-001');
  assert.equal(state.toolName, 'image.remove_background');
  assert.equal(state.provider, 'ComfyUI GPU');
  assert.equal(state.fraction, 0);

  // 2. Progress update
  state = runReducer(state, {
    type: 'progress',
    requestId: 'req-001',
    stage: 'Sampling diffusion steps...',
    fraction: 0.65
  });

  assert.equal(state.phase, 'processing');
  assert.equal(state.stage, 'Sampling diffusion steps...');
  assert.equal(state.fraction, 0.65);

  // 3. Succeed with metrics
  state = runReducer(state, {
    type: 'succeed',
    requestId: 'req-001',
    metrics: { latencyMs: 1420, model: 'BiRefNet' }
  });

  assert.equal(state.phase, 'succeeded');
  assert.equal(state.metrics.latencyMs, 1420);
  assert.equal(state.metrics.model, 'BiRefNet');
});

test('runReducer ignores terminal event with mismatched requestId', () => {
  let state = runReducer(initialRunState, {
    type: 'start',
    requestId: 'req-active',
    label: 'Inpaint'
  });

  // Mismatched request ID should be ignored
  const staleState = runReducer(state, {
    type: 'succeed',
    requestId: 'req-old-stale'
  });

  assert.equal(staleState.phase, 'executing');
  assert.equal(staleState.requestId, 'req-active');
});

test('runReducer handles cancel and fail actions correctly', () => {
  let state = runReducer(initialRunState, {
    type: 'start',
    requestId: 'req-to-cancel',
    label: 'Generate'
  });

  state = runReducer(state, {
    type: 'cancel',
    requestId: 'req-to-cancel'
  });

  assert.equal(state.phase, 'cancelled');

  // Reset
  state = runReducer(state, { type: 'reset' });
  assert.equal(state.phase, 'idle');

  // Fail
  state = runReducer(state, {
    type: 'start',
    requestId: 'req-to-fail',
    label: 'Recolor'
  });

  state = runReducer(state, {
    type: 'fail',
    requestId: 'req-to-fail',
    error: 'Model out of memory'
  });

  assert.equal(state.phase, 'failed');
  assert.equal(state.error, 'Model out of memory');
});

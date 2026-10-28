const test = require('node:test');
const assert = require('node:assert/strict');
const { ExecutionEngine } = require('../out/services/execution/ExecutionEngine');
const { CopilotError } = require('../out/services/execution/errors');

test('ExecutionEngine executes successfully and tracks status', async () => {
  const engine = new ExecutionEngine();
  const requestId = 'req-success-1';

  const result = await engine.execute({ requestId, toolName: 'image.analyze' }, async (signal, attempt) => {
    assert.equal(signal.aborted, false);
    assert.equal(attempt, 1);
    return { ok: true, data: 42 };
  });

  assert.equal(result.ok, true);
  assert.equal(result.data, 42);
  assert.equal(engine.isRunning(requestId), false);
});

test('ExecutionEngine rejects duplicate active requestId', async () => {
  const engine = new ExecutionEngine();
  const requestId = 'req-dup-1';

  let resolveInner;
  const barrier = new Promise(r => { resolveInner = r; });

  const promise1 = engine.execute({ requestId }, async () => {
    await barrier;
    return 'done';
  });

  await assert.rejects(
    () => engine.execute({ requestId }, async () => 'dup'),
    /is already in progress/i
  );

  resolveInner();
  await promise1;
});

test('ExecutionEngine cancels running task promptly and throws cancelled error', async () => {
  const engine = new ExecutionEngine();
  const requestId = 'req-cancel-1';

  let abortedObserved = false;
  const promise = engine.execute({ requestId, timeoutMs: 10000 }, async (signal) => {
    await new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        abortedObserved = true;
        reject(CopilotError.createCancelledError());
      });
    });
  });

  assert.equal(engine.isRunning(requestId), true);
  const cancelAck = engine.cancel(requestId);
  assert.equal(cancelAck, true);

  await assert.rejects(promise, (err) => {
    return err instanceof CopilotError && err.code === 'cancelled';
  });
  assert.equal(abortedObserved, true);
  assert.equal(engine.isRunning(requestId), false);
});

test('ExecutionEngine retries transient errors but not non-retryable errors', async () => {
  const engine = new ExecutionEngine();
  const requestId = 'req-retry-1';
  let attempts = 0;

  // 1. Transient error: retryable
  const res = await engine.execute({ requestId, maxRetries: 2 }, async (_signal, attempt) => {
    attempts++;
    if (attempt < 3) {
      throw new CopilotError({ code: 'network_error', message: 'Connection reset', retryable: true });
    }
    return 'success-after-retry';
  });

  assert.equal(attempts, 3);
  assert.equal(res, 'success-after-retry');

  // 2. Non-retryable error: stops at attempt 1
  let nonRetryAttempts = 0;
  await assert.rejects(
    () => engine.execute({ requestId: 'req-noretry-1', maxRetries: 2 }, async () => {
      nonRetryAttempts++;
      throw new CopilotError({ code: 'invalid_input', message: 'Bad params', retryable: false });
    }),
    /Bad params/
  );
  assert.equal(nonRetryAttempts, 1);
});

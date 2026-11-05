const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchWithTimeout } = require('../out/utils/fetchWithTimeout');

test('provider fetch timeout aborts the request and reports a bounded error', async () => {
  let aborted = false;
  const hangingFetch = (_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      aborted = true;
      reject(new Error('aborted'));
    });
  });
  await assert.rejects(
    () => fetchWithTimeout('https://provider.invalid', { method: 'POST' }, 5, hangingFetch),
    /timed out after 5ms/i
  );
  assert.equal(aborted, true);
});

test('provider fetch propagates caller cancellation and distinguishes it from timeout', async () => {
  const caller = new AbortController();
  const hangingFetch = (_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  const pending = fetchWithTimeout('https://provider.invalid', { method: 'POST', signal: caller.signal }, 1000, hangingFetch);
  caller.abort();
  await assert.rejects(pending, /request cancelled/i);
});

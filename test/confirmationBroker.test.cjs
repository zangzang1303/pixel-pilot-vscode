const test = require('node:test');
const assert = require('node:assert/strict');
const { ConfirmationBroker } = require('../out/services/copilot/ConfirmationBroker');

test('confirmation tokens are one-time and timeout to denial', async () => {
  const broker = new ConfirmationBroker();
  let published;
  const pending = broker.request('Runware', 'Upscale', request => { published = request; }, 1000);
  assert.match(published.token, /^[0-9a-f-]{36}$/i);
  assert.equal(broker.settle(published.token, true), true);
  assert.equal(await pending, true);
  assert.equal(broker.settle(published.token, true), false);
  const timedOut = broker.request('Runware', 'Upscale', () => {}, 5);
  assert.equal(await timedOut, false);
});

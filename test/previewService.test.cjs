const test = require('node:test');
const assert = require('node:assert/strict');
const { PreviewService } = require('../out/services/session/PreviewService');

const createPreview = (service, id = 'p1') => service.stage({
  previewId: id, sessionId: 's1', parentNodeId: 'n1', sourceRevision: 'rev-1', payload: 'staged-image'
}, 100);

test('preview apply is idempotent and calls durable commit once', async () => {
  const service = new PreviewService(1000, 4);
  createPreview(service);
  let commits = 0;
  const apply = () => service.apply('p1', () => 'rev-1', async () => ({ nodeId: `n${++commits}` }), 110);
  const [first, duplicate] = await Promise.all([apply(), apply()]);
  const retry = await apply();
  assert.deepEqual(first, { status: 'applied', value: { nodeId: 'n1' } });
  assert.deepEqual(duplicate, first);
  assert.deepEqual(retry, first);
  assert.equal(commits, 1);
});

test('stale preview is not committed; discard does not call commit', async () => {
  const service = new PreviewService(1000, 4);
  createPreview(service);
  let commits = 0;
  const stale = await service.apply('p1', () => 'rev-2', async () => ++commits, 110);
  assert.deepEqual(stale, { status: 'stale', currentRevision: 'rev-2' });
  assert.equal(service.discard('p1'), true);
  assert.equal(commits, 0);
});

test('expired and over-capacity previews are rejected', async () => {
  const service = new PreviewService(10, 1);
  createPreview(service);
  assert.throws(() => createPreview(service, 'p2'), /too many pending previews/i);
  assert.deepEqual(await service.apply('p1', () => 'rev-1', async () => 'never', 111), { status: 'expired' });
});

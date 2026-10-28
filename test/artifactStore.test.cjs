const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { ArtifactStore } = require('../out/services/storage/ArtifactStore');

test('ArtifactStore stores image with sha256 content addressability and deduplicates', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-store-test-'));
  try {
    const store = new ArtifactStore(tmpDir);

    // 1x1 transparent PNG buffer
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

    const rec1 = await store.store(pngBuffer, 'image/png', { kind: 'image' });
    assert.ok(rec1.id.startsWith('art_'));
    assert.equal(rec1.kind, 'image');
    assert.equal(rec1.mime, 'image/png');
    assert.equal(rec1.byteSize, pngBuffer.length);
    assert.ok(rec1.sha256.length === 64);

    // Store identical buffer again -> deduplication returns existing record
    const rec2 = await store.store(pngBuffer, 'image/png', { kind: 'image' });
    assert.equal(rec2.id, rec1.id);
    assert.equal(rec2.sha256, rec1.sha256);

    // Retrieve by ID
    const retrieved = await store.get(rec1.id);
    assert.ok(retrieved);
    assert.equal(retrieved.record.id, rec1.id);
    assert.equal(retrieved.buffer.equals(pngBuffer), true);

    // Lookup by hash
    const byHash = store.getByHash(rec1.sha256);
    assert.ok(byHash);
    assert.equal(byHash.id, rec1.id);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('ArtifactStore prunes unreferenced artifacts without deleting referenced history', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-store-gc-'));
  try {
    const store = new ArtifactStore(tmpDir);

    const buf1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    // Different 1x1 red PNG
    const buf2 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

    const rec1 = await store.store(buf1, 'image/png', { kind: 'image' });
    const rec2 = await store.store(buf2, 'image/png', { kind: 'image' });

    // Only rec1 is referenced by active DAG
    const referenced = new Set([rec1.id]);
    const gcResult = await store.pruneUnreferenced(referenced);

    assert.equal(gcResult.retained, 1);
    assert.equal(gcResult.deleted, 1);

    // rec1 still exists
    assert.ok(await store.get(rec1.id));
    // rec2 was deleted
    assert.equal(await store.get(rec2.id), undefined);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { ArtifactStore } = require('../out/services/storage/ArtifactStore');

async function png(color) {
  return sharp({ create: { width: 3, height: 2, channels: 4, background: color } }).png().toBuffer();
}

test('ArtifactStore recovers a corrupt manifest from the last known-good backup', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-store-recovery-'));
  try {
    const first = new ArtifactStore(dir);
    const keep = await first.store(await png({ r: 200, g: 0, b: 0, alpha: 1 }), 'image/png', { kind: 'image' });
    await first.store(await png({ r: 0, g: 200, b: 0, alpha: 1 }), 'image/png', { kind: 'image' });
    const manifest = path.join(dir, 'artifacts', 'manifest.json');
    fs.writeFileSync(manifest, '{broken json');

    const recovered = new ArtifactStore(dir);
    assert.ok(await recovered.get(keep.id));
    assert.ok(fs.readdirSync(path.join(dir, 'artifacts')).some(name => name.startsWith('manifest.json.corrupt-')));
    assert.ok(fs.existsSync(`${manifest}.bak`));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('concurrent stores serialize manifest writes without losing records', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-store-concurrent-'));
  try {
    const store = new ArtifactStore(dir);
    const records = await Promise.all([
      png({ r: 100, g: 10, b: 10, alpha: 1 }),
      png({ r: 10, g: 100, b: 10, alpha: 1 }),
      png({ r: 10, g: 10, b: 100, alpha: 1 })
    ].map(buffer => buffer.then(data => store.store(data, 'image/png', { kind: 'image' }))));
    const reopened = new ArtifactStore(dir);
    for (const record of records) assert.ok(await reopened.get(record.id));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('pruning a referenced artifact retains its parent and preview dependencies', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-store-refs-'));
  try {
    const store = new ArtifactStore(dir);
    const parent = await store.store(await png({ r: 120, g: 0, b: 0, alpha: 1 }), 'image/png', { kind: 'image' });
    const preview = await store.store(await png({ r: 0, g: 120, b: 0, alpha: 1 }), 'image/png', { kind: 'image' });
    const result = await store.store(await png({ r: 0, g: 0, b: 120, alpha: 1 }), 'image/png', {
      kind: 'image', parentArtifactId: parent.id, previewArtifactId: preview.id
    });
    const unrelated = await store.store(await png({ r: 50, g: 50, b: 0, alpha: 1 }), 'image/png', { kind: 'image' });

    const pruned = await store.pruneUnreferenced(new Set([result.id]));
    assert.equal(pruned.deleted, 1);
    assert.ok(await store.get(result.id));
    assert.ok(await store.get(parent.id));
    assert.ok(await store.get(preview.id));
    assert.equal(await store.get(unrelated.id), undefined);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('session artifact paths are mapped to IDs before pruning', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'art-store-path-refs-'));
  try {
    const store = new ArtifactStore(dir);
    const referenced = await store.store(await png({ r: 10, g: 90, b: 150, alpha: 1 }), 'image/png', { kind: 'image' });
    const unreferenced = await store.store(await png({ r: 150, g: 90, b: 10, alpha: 1 }), 'image/png', { kind: 'image' });
    const refs = new Set([store.getAbsolutePath(referenced.id)]);
    const pruned = await store.pruneUnreferencedPaths(refs);
    assert.equal(pruned.deleted, 1);
    assert.ok(await store.get(referenced.id));
    assert.equal(await store.get(unreferenced.id), undefined);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

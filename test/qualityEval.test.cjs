const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { evaluateQualityManifest } = require('../scripts/quality-eval.cjs');

function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-quality-eval-'));
  const items = [];
  for (let index = 0; index < 60; index++) {
    const content = Buffer.from(`synthetic fixture image ${index}`);
    const file = `inputs/${index}.png`;
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
    items.push({
      id: `item-${index}`,
      sourcePath: file,
      sourceSha256: digest(content),
      split: index < 40 ? 'development' : 'holdout',
      contentGroup: index % 3 === 0 ? 'portrait' : 'product'
    });
  }
  const runs = items.slice(40).map((item, index) => {
    const output = Buffer.from(`synthetic output ${index}`);
    const outputPath = `outputs/${index}.png`;
    fs.mkdirSync(path.dirname(path.join(root, outputPath)), { recursive: true });
    fs.writeFileSync(path.join(root, outputPath), output);
    return {
      itemId: item.id, task: 'remove_background', provider: 'fixture-local', model: 'fixture-v1',
      configSha256: 'a'.repeat(64), outputPath, outputSha256: digest(output),
      raters: [
        { id: 'rater-a', severeFailure: false, scores: { requirement: 5, preservation: 4 } },
        { id: 'rater-b', severeFailure: false, scores: { requirement: 4, preservation: 4 } }
      ]
    };
  });
  const manifest = {
    schemaVersion: 1,
    dataset: { id: 'synthetic-test-only', revision: 'test-v1', rightsConfirmed: true, rightsSource: 'generated synthetic test bytes', items },
    rubric: { version: 'test-v1', criteria: { requirement: 'Follows task', preservation: 'Preserves subject' }, criteriaByTask: { remove_background: ['requirement', 'preservation'] } },
    thresholds: { development: 40, holdout: 20, minPairsPerGroup: 20, minPassingPairs: 17 },
    runs
  };
  return { root, manifest };
}

test('quality eval accepts a complete per-task holdout with two independent raters', () => {
  const f = fixture();
  try {
    const report = evaluateQualityManifest(f.manifest, f.root);
    assert.equal(report.status, 'pass');
    assert.deepEqual(report.splitCounts, { development: 40, holdout: 20 });
    assert.deepEqual(report.groups.map(group => [group.total, group.passed, group.status]), [[20, 20, 'pass']]);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('quality eval rejects holdout leakage and source/output hash mismatch', () => {
  const f = fixture();
  try {
    f.manifest.dataset.items[40].sourceSha256 = f.manifest.dataset.items[0].sourceSha256;
    f.manifest.runs[0].outputSha256 = 'b'.repeat(64);
    const report = evaluateQualityManifest(f.manifest, f.root);
    assert.equal(report.status, 'invalid');
    assert.ok(report.errors.some(error => error.includes('leaks across')));
    assert.ok(report.errors.some(error => error.includes('output file hash mismatch')));
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('quality eval rejects duplicate image content within the same split', () => {
  const f = fixture();
  try {
    const first = f.manifest.dataset.items[0];
    const duplicate = f.manifest.dataset.items[1];
    fs.copyFileSync(path.join(f.root, first.sourcePath), path.join(f.root, duplicate.sourcePath));
    duplicate.sourceSha256 = first.sourceSha256;
    const report = evaluateQualityManifest(f.manifest, f.root);
    assert.equal(report.status, 'invalid');
    assert.ok(report.errors.some(error => error.includes('duplicate source content')));
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('quality eval fails a model group below its per-group acceptance threshold', () => {
  const f = fixture();
  try {
    for (const run of f.manifest.runs.slice(0, 4)) {
      for (const rater of run.raters) rater.scores.preservation = 3;
    }
    const report = evaluateQualityManifest(f.manifest, f.root);
    assert.equal(report.status, 'fail');
    assert.equal(report.groups[0].passed, 16);
    assert.equal(report.groups[0].status, 'fail');
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('quality eval requires adjudication when independent raters disagree', () => {
  const f = fixture();
  try {
    f.manifest.runs[0].raters[1].scores.requirement = 2;
    const report = evaluateQualityManifest(f.manifest, f.root);
    assert.equal(report.status, 'invalid');
    assert.ok(report.errors.some(error => error.includes('rater disagreement requires')));
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

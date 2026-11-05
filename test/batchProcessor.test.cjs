const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const vscode = {
  Uri: { file: fsPath => ({ fsPath }) },
  ProgressLocation: { Notification: 1 },
  window: {
    withProgress: async (_options, callback) => callback({ report() {} }, { isCancellationRequested: false })
  },
  workspace: { fs: { readFile: uri => fs.promises.readFile(uri.fsPath) } }
};
const originalLoad = Module._load;
Module._load = function (id, ...rest) {
  if (id === 'vscode') return vscode;
  return originalLoad.call(this, id, ...rest);
};
let BatchProcessor;
try {
  ({ BatchProcessor } = require('../out/services/batch/BatchProcessor'));
} finally {
  Module._load = originalLoad;
}

const output = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+M2Q0XwAAAABJRU5ErkJggg==';
const provider = calls => ({
  removeBackground: async () => { calls.count++; return { success: true, outputImageUri: output }; }
});

test('batch checks per-item authorization and retains successful work when a later item is denied', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixelpilot-batch-policy-'));
  const outputDir = path.join(root, 'output');
  const calls = { count: 0 };
  let authorizationChecks = 0;
  try {
    const processor = new BatchProcessor(provider(calls));
    const images = [0, 1].map(index => {
      const filePath = path.join(root, `image${index}.png`);
      fs.writeFileSync(filePath, 'source');
      return { fsPath: filePath };
    });
    const summary = await processor.executeBatch(images, 'remove_background', outputDir, {
      beforeEach: async () => {
        authorizationChecks++;
        if (authorizationChecks === 2) throw new Error('offline mode enabled');
      }
    });
    assert.equal(summary.succeeded, 1);
    assert.equal(summary.failed, 1);
    assert.equal(calls.count, 1);
    assert.equal(authorizationChecks, 2);
    assert.equal(fs.existsSync(path.join(outputDir, 'image0_remove_background.png')), true);
    assert.equal(fs.existsSync(path.join(outputDir, 'image1_remove_background.png')), false);
    assert.ok(fs.existsSync(summary.manifestPath));
    assert.equal(JSON.parse(fs.readFileSync(summary.manifestPath, 'utf8')).results.length, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('batch writes unique outputs and preserves a pre-existing file', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixelpilot-batch-output-'));
  const outputDir = path.join(root, 'output');
  const calls = { count: 0 };
  try {
    fs.mkdirSync(outputDir);
    const expected = path.join(outputDir, 'image_remove_background.png');
    fs.writeFileSync(expected, 'keep-existing');
    const images = ['first', 'second'].map((folder, index) => {
      const directory = path.join(root, folder);
      fs.mkdirSync(directory);
      const filePath = path.join(directory, 'image.png');
      fs.writeFileSync(filePath, `source-${index}`);
      return { fsPath: filePath };
    });
    const summary = await new BatchProcessor(provider(calls)).executeBatch(images, 'remove_background', outputDir);
    assert.equal(summary.succeeded, 2);
    assert.equal(calls.count, 2);
    assert.equal(fs.readFileSync(expected, 'utf8'), 'keep-existing');
    assert.equal(new Set(summary.results.map(result => result.outputPath)).size, 2);
    assert.ok(summary.results.every(result => result.outputPath && fs.existsSync(result.outputPath)));
    assert.ok(fs.existsSync(summary.manifestPath));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('batch retry processes only failed inputs and emits a new manifest', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixelpilot-batch-retry-'));
  const outputDir = path.join(root, 'output');
  const attempted = [];
  const failingProvider = {
    removeBackground: async dataUri => {
      const decoded = Buffer.from(dataUri.split(',')[1], 'base64').toString();
      attempted.push(decoded);
      return decoded === 'fail' ? { success: false, error: 'temporary provider failure' } : { success: true, outputImageUri: output };
    }
  };
  try {
    const processor = new BatchProcessor(failingProvider);
    const images = ['ok', 'fail'].map((data, index) => {
      const filePath = path.join(root, `image${index}.png`);
      fs.writeFileSync(filePath, data);
      return { fsPath: filePath };
    });
    const first = await processor.executeBatch(images, 'remove_background', outputDir);
    assert.equal(first.succeeded, 1);
    assert.equal(first.failed, 1);
    processor.setAIProvider(provider({ count: 0 }));
    const retry = await processor.retryFailed(first);
    assert.equal(retry.total, 1);
    assert.equal(retry.succeeded, 1);
    assert.deepEqual(attempted, ['ok', 'fail']);
    assert.notEqual(retry.manifestPath, first.manifestPath);
    assert.ok(fs.existsSync(retry.manifestPath));
    assert.equal(fs.existsSync(path.join(outputDir, 'image0_remove_background.png')), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('batch rechecks workspace permission immediately before writing output', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixelpilot-batch-write-policy-'));
  const outputDir = path.join(root, 'output');
  const calls = { count: 0 };
  try {
    const imagePath = path.join(root, 'image.png');
    fs.writeFileSync(imagePath, 'source');
    const summary = await new BatchProcessor(provider(calls)).executeBatch([{ fsPath: imagePath }], 'remove_background', outputDir, {
      beforeWrite: async () => { throw new Error('workspace trust revoked'); }
    });
    assert.equal(calls.count, 1);
    assert.equal(summary.failed, 1);
    assert.equal(fs.existsSync(path.join(outputDir, 'image_remove_background.png')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('10-image batch keeps interleaved successes and retries only failed inputs', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixelpilot-batch-ten-'));
  const outputDir = path.join(root, 'output');
  const attempted = [];
  const providerWithInterleavedFailures = {
    removeBackground: async dataUri => {
      const content = Buffer.from(dataUri.split(',')[1], 'base64').toString();
      attempted.push(content);
      return content.startsWith('fail') ? { success: false, error: 'fixture failure' } : { success: true, outputImageUri: output };
    }
  };
  try {
    const images = Array.from({ length: 10 }, (_, index) => {
      const filePath = path.join(root, `image${index}.png`);
      fs.writeFileSync(filePath, index === 2 || index === 5 || index === 8 ? `fail-${index}` : `ok-${index}`);
      return { fsPath: filePath };
    });
    const processor = new BatchProcessor(providerWithInterleavedFailures);
    const first = await processor.executeBatch(images, 'remove_background', outputDir);
    assert.equal(first.total, 10);
    assert.equal(first.succeeded, 7);
    assert.equal(first.failed, 3);
    assert.ok(fs.existsSync(first.manifestPath));
    assert.equal(JSON.parse(fs.readFileSync(first.manifestPath, 'utf8')).results.length, 10);
    processor.setAIProvider(provider({ count: 0 }));
    const retry = await processor.retryFailed(first);
    assert.equal(retry.total, 3);
    assert.equal(retry.succeeded, 3);
    assert.deepEqual(attempted, images.map((_, index) => index === 2 || index === 5 || index === 8 ? `fail-${index}` : `ok-${index}`));
    for (const result of first.results.filter(item => item.success)) assert.ok(fs.existsSync(result.outputPath));
    assert.ok(fs.existsSync(retry.manifestPath));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

test('asset storage rejects remote, malformed and active SVG artifacts', async () => {
  const originalLoad = Module._load;
  Module._load = function (id, ...rest) {
    if (id === 'vscode') return {};
    return originalLoad.call(this, id, ...rest);
  };
  let AssetStorageService;
  try {
    ({ AssetStorageService } = require('../out/services/storage/AssetStorageService'));
  } finally {
    Module._load = originalLoad;
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-pilot-assets-'));
  try {
    const storage = new AssetStorageService({ globalStorageUri: { fsPath: directory } });
    await assert.rejects(() => storage.saveToCache('https://example.com/image.png'), /invalid|exist|không hợp lệ/i);
    await assert.rejects(() => storage.saveToCache('data:image/png;base64,not-base64!'), /invalid|hợp lệ/i);
    await assert.rejects(() => storage.saveToCache(Buffer.from('<svg onload="alert(1)"></svg>'), 'svg'), /active|remote/i);
    await assert.rejects(() => storage.saveToCache('data:image/png;base64,aGVsbG8='), /MIME type/i);
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+M2Q0XwAAAABJRU5ErkJggg==';
    const saved = await storage.saveToCache(`data:image/png;base64,${png}`);
    assert.deepEqual(fs.readFileSync(saved), Buffer.from(png, 'base64'));
    assert.equal(storage.isStoredArtifact(saved), true);
    assert.match(storage.getWebviewUri(saved), /^data:image\/png;base64,/);
    const outside = path.join(directory, 'outside.png');
    fs.writeFileSync(outside, Buffer.from(png, 'base64'));
    assert.equal(storage.isStoredArtifact(outside), false);
    assert.equal(storage.getWebviewUri(outside), '');
    assert.equal(storage.getWebviewUri('https://example.com/image.png'), '');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

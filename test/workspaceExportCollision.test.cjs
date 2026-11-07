const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

test('workspace asset export preserves existing files and handles concurrent names and partial icon failure', async () => {
  const files = new Map();
  const directories = new Set();
  let failIconSize = 0;
  const uri = fsPath => ({ fsPath, toString: () => fsPath });
  const root = uri(path.resolve('fixture-workspace'));
  const existing = path.join(root.fsPath, 'assets', 'photo.png');
  files.set(existing, Buffer.from('original'));
  const oldIconDirectory = path.join(root.fsPath, 'assets', 'icons');
  directories.add(oldIconDirectory);
  files.set(path.join(oldIconDirectory, 'icon-16x16.png'), Buffer.from('old icon'));
  const vscode = {
    Uri: { joinPath: (base, ...parts) => uri(path.join(base.fsPath, ...parts)), file: uri },
    workspace: {
      workspaceFolders: [{ uri: root }],
      fs: {
        createDirectory: async target => { directories.add(target.fsPath); },
        stat: async target => {
          await Promise.resolve();
          if (directories.has(target.fsPath)) return { type: 2, size: 0 };
          if (!files.has(target.fsPath)) throw { code: 'FileNotFound' };
          return { type: 1, size: files.get(target.fsPath).length };
        },
        writeFile: async (target, data) => {
          files.set(target.fsPath, Buffer.from(data));
          if (failIconSize && target.fsPath.endsWith(`icon-${failIconSize}x${failIconSize}.png`)) {
            throw new Error('disk full');
          }
        },
        delete: async target => {
          if (files.delete(target.fsPath)) return;
          if (directories.has(target.fsPath) &&
              ![...files.keys()].some(file => file.startsWith(`${target.fsPath}${path.sep}`))) {
            directories.delete(target.fsPath);
            return;
          }
          throw new Error('not empty or missing');
        }
      }
    }
  };
  const originalLoad = Module._load;
  Module._load = function (id, ...rest) {
    if (id === 'vscode') return vscode;
    return originalLoad.call(this, id, ...rest);
  };
  let FileSystemUtils;
  try {
    ({ FileSystemUtils } = require('../out/utils/fileSystem'));
  } finally {
    Module._load = originalLoad;
  }

  const saved = await FileSystemUtils.saveImageToWorkspace(Buffer.from('new'), 'photo.png');
  assert.equal(saved.fileName, 'photo_1.png');
  assert.equal(files.get(existing).toString(), 'original');
  assert.equal(files.get(saved.uri.fsPath).toString(), 'new');

  const [first, second] = await Promise.all([
    FileSystemUtils.saveImageToWorkspace(Buffer.from('one'), 'parallel.png'),
    FileSystemUtils.saveImageToWorkspace(Buffer.from('two'), 'parallel.png')
  ]);
  assert.notEqual(first.uri.fsPath, second.uri.fsPath);
  assert.equal(files.get(first.uri.fsPath).toString(), 'one');
  assert.equal(files.get(second.uri.fsPath).toString(), 'two');

  const bundle = await FileSystemUtils.saveIconBundle([{ size: 16, buffer: Buffer.from('new icon') }], 'icons');
  assert.equal(bundle.relativeDirectory, './assets/icons_1');
  assert.equal(files.get(path.join(oldIconDirectory, 'icon-16x16.png')).toString(), 'old icon');
  const [bundleA, bundleB] = await Promise.all([
    FileSystemUtils.saveIconBundle([{ size: 16, buffer: Buffer.from('a') }], 'parallel-icons'),
    FileSystemUtils.saveIconBundle([{ size: 16, buffer: Buffer.from('b') }], 'parallel-icons')
  ]);
  assert.notEqual(bundleA.directory.fsPath, bundleB.directory.fsPath);
  assert.equal(files.get(path.join(bundleA.directory.fsPath, 'icon-16x16.png')).toString(), 'a');
  assert.equal(files.get(path.join(bundleB.directory.fsPath, 'icon-16x16.png')).toString(), 'b');

  failIconSize = 32;
  const failedDirectory = path.join(root.fsPath, 'assets', 'partial');
  await assert.rejects(() => FileSystemUtils.saveIconBundle([
    { size: 16, buffer: Buffer.from('first') },
    { size: 32, buffer: Buffer.from('failed') }
  ], 'partial'), /disk full/);
  assert.equal(directories.has(failedDirectory), false);
  assert.equal([...files.keys()].some(file => file.startsWith(`${failedDirectory}${path.sep}`)), false);
});

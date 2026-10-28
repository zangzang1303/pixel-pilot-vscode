const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Package manifest and distribution artifacts verification (B28)', () => {
  const rootDir = path.resolve(__dirname, '..');
  const pkgPath = path.join(rootDir, 'package.json');
  assert.ok(fs.existsSync(pkgPath), 'package.json must exist');

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // 1. Basic package identity
  assert.equal(pkg.name, 'pixel-pilot-vscode');
  assert.ok(pkg.version);
  assert.ok(pkg.engines && pkg.engines.vscode, 'Must declare minimum VS Code engine compatibility');

  // 2. Contributed commands
  const contributes = pkg.contributes;
  assert.ok(contributes, 'Must have contributes section');
  assert.ok(Array.isArray(contributes.commands), 'Must contribute commands array');
  assert.ok(contributes.commands.length > 0, 'Must have at least one command');

  // 3. Contributed views
  assert.ok(contributes.viewsContainers, 'Must define viewsContainers');
  assert.ok(contributes.views, 'Must define views');

  // 4. Contributed configuration
  assert.ok(contributes.configuration, 'Must define configuration');
  const props = contributes.configuration.properties;
  assert.ok(props['pixelPilot.offlineMode'], 'Must support offlineMode configuration');

  // 5. Build artifacts verification
  const outExtension = path.join(rootDir, 'out', 'extension.js');
  assert.ok(fs.existsSync(outExtension), 'Compiled extension host (out/extension.js) must exist');

  const webviewDist = path.join(rootDir, 'webview-ui', 'dist', 'index.html');
  assert.ok(fs.existsSync(webviewDist), 'Compiled webview bundle (webview-ui/dist/index.html) must exist');
  const webviewSize = fs.statSync(webviewDist).size;
  assert.ok(webviewSize > 50000, 'Webview bundle should be valid single-file artifact');

  // 6. Packaging hygiene: .vscodeignore should exclude tests and scratch
  const ignorePath = path.join(rootDir, '.vscodeignore');
  if (fs.existsSync(ignorePath)) {
    const ignoreContent = fs.readFileSync(ignorePath, 'utf8');
    assert.ok(ignoreContent.includes('test') || ignoreContent.includes('src'), 'Should ignore tests or dev source in package');
  }
});

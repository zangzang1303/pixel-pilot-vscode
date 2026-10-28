const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { downloadAndUnzipVSCode } = require('@vscode/test-electron');

const root = path.resolve(__dirname, '..');
const extensionRoot = process.env.PIXEL_PILOT_E2E_EXTENSION_ROOT
  ? path.resolve(process.env.PIXEL_PILOT_E2E_EXTENSION_ROOT)
  : root;
const extensionManifest = path.join(extensionRoot, 'package.json');
if (!fs.existsSync(extensionManifest) || JSON.parse(fs.readFileSync(extensionManifest, 'utf8')).name !== 'pixel-pilot-vscode') {
  throw new Error('E2E extension root must contain the Pixel Pilot package manifest.');
}
const candidates = [
  process.env.VSCODE_EXECUTABLE_PATH,
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe'),
  'C:\\Program Files\\Microsoft VS Code\\Code.exe'
].filter(Boolean);
const vscodeExecutablePath = candidates.find(candidate => {
  if (!fs.existsSync(candidate)) return false;
  const probeEnvironment = { ...process.env };
  delete probeEnvironment.ELECTRON_RUN_AS_NODE;
  const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8', env: probeEnvironment });
  // The local "Code.exe" can be a Node-based CLI shim. The test runner needs
  // the Electron desktop executable, whose version is numeric (for example
  // 1.85.2), not a Node version such as v24.x.
  return probe.status === 0 && !/^v\d+\./.test((probe.stdout || '').trim());
});

async function main() {
  // Download the minimum VS Code version advertised by package.json into the
  // runner-owned .vscode-test directory; never reuse the user's profile.
  const executable = vscodeExecutablePath || await downloadAndUnzipVSCode({ version: '1.85.2' });
  const profileRoot = path.join(root, '.vscode-test', 'e2e-profile');
  const args = [
    `--extensionTestsPath=${path.join(root, 'test', 'e2e', 'extensionHost.cjs')}`,
    `--extensionDevelopmentPath=${extensionRoot}`,
    `--user-data-dir=${path.join(profileRoot, 'user-data')}`,
    `--extensions-dir=${path.join(profileRoot, 'extensions')}`,
    '--disable-updates',
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-workspace-trust'
  ];

  const exitCode = await new Promise((resolve, reject) => {
    const environment = { ...process.env };
    // Codex/Extension Host invocations set this flag so Code.exe behaves as
    // Node. The E2E child must be the Electron desktop application instead.
    delete environment.ELECTRON_RUN_AS_NODE;
    const child = spawn(executable, args, {
      stdio: 'inherit',
      windowsHide: true,
      shell: false,
      env: environment
    });
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
  if (exitCode !== 0) {
    throw new Error(`Extension Development Host E2E failed with exit code ${exitCode}.`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

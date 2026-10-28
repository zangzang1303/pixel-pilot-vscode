const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const sourceRoots = [path.join(root, 'src'), path.join(root, 'webview-ui', 'src')];
const forbiddenPatterns = [
  { pattern: /@ts-ignore\b|@ts-nocheck\b/, message: 'TypeScript suppression pragma is not allowed.' },
  { pattern: /\beval\s*\(/, message: 'eval() is not allowed.' },
  { pattern: /\bnew\s+Function\s*\(/, message: 'Dynamic Function construction is not allowed.' },
  { pattern: /dangerouslySetInnerHTML\b/, message: 'Raw HTML injection is not allowed in the webview.' }
];

function collectSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

const violations = [];
for (const sourceRoot of sourceRoots) {
  for (const filePath of collectSourceFiles(sourceRoot)) {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const { pattern, message } of forbiddenPatterns) {
        if (pattern.test(line)) {
          violations.push(`${path.relative(root, filePath)}:${index + 1}: ${message}`);
        }
      }
    });
  }
}

if (violations.length > 0) {
  console.error('Source-policy lint failed:\n' + violations.join('\n'));
  process.exit(1);
}

function runTypecheck(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const hostTsc = path.join(root, 'node_modules', 'typescript', 'lib', 'tsc.js');
const webviewTsc = path.join(root, 'webview-ui', 'node_modules', 'typescript', 'lib', 'tsc.js');

runTypecheck(process.execPath, [hostTsc, '-p', '.', '--noEmit'], root);
runTypecheck(process.execPath, [webviewTsc, '--noEmit'], path.join(root, 'webview-ui'));
console.log('Source-policy lint and host/webview type-check passed.');

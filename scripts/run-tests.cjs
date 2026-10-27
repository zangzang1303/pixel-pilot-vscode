const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const testDir = path.resolve(__dirname, '..', 'test');
const files = fs.readdirSync(testDir)
  .filter(file => file.endsWith('.test.cjs'))
  .sort()
  .map(file => path.join(testDir, file));

if (files.length === 0) {
  throw new Error('No Node test files were found.');
}

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);

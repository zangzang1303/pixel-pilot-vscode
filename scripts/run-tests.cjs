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

// A few integration tests load Sharp's native module and access temporary
// artifacts.  Running every file in a separate worker makes those tests
// contend for native resources and has produced intermittent libspng read
// failures.  Keep the suite deterministic; the work under test is still
// asynchronous inside each file.
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);

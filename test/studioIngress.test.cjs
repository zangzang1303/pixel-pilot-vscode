const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('Studio routes active applyAction messages through the shared Copilot host ingress', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'panels', 'StudioPanel.ts'), 'utf8');
  const activeCase = source.indexOf("case 'applyAction':");
  const legacyCase = source.indexOf("case '__legacyApplyAction':");
  assert.ok(activeCase >= 0, 'Studio must retain the active applyAction ingress.');
  assert.ok(legacyCase > activeCase, 'The inline executor must not be the active applyAction ingress.');
  const activeBlock = source.slice(activeCase, legacyCase);
  assert.match(activeBlock, /await this\._copilot\.handleStudioMessage\(message\)/,
    'Studio must forward active image actions to the shared host.');
});

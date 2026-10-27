const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('cloud policy checks Workspace Trust and requires a fresh native consent', async () => {
  let dialogs = 0;
  let approved = false;
  let offline = false;
  const vscode = {
    workspace: { isTrusted: false, getConfiguration: () => ({ get: key => key === 'offlineMode' ? offline : undefined }) },
    window: { showWarningMessage: async () => { dialogs++; return approved ? 'Continue' : undefined; } }
  };
  const originalLoad = Module._load;
  Module._load = function (id, ...rest) {
    if (id === 'vscode') return vscode;
    return originalLoad.call(this, id, ...rest);
  };
  let PolicyService;
  try {
    ({ PolicyService } = require('../out/services/security/PolicyService'));
  } finally {
    Module._load = originalLoad;
  }
  const policy = new PolicyService();
  await assert.rejects(() => policy.requireCloudConsent('Runware', 'Upscale'), /not trusted/i);
  assert.equal(dialogs, 0);
  vscode.workspace.isTrusted = true;
  await assert.rejects(() => policy.requireCloudConsent('Runware', 'Upscale'), /not approved/i);
  assert.equal(dialogs, 1);
  approved = true;
  await policy.requireCloudConsent('Runware', 'Upscale');
  await policy.requireCloudConsent('Runware', 'Upscale');
  assert.equal(dialogs, 3);
  offline = true;
  await assert.rejects(() => policy.requireCloudConsent('Runware', 'Upscale'), /offline mode/i);
  assert.equal(dialogs, 3);
});

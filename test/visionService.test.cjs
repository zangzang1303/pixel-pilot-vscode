const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('legacy VisionService does not generate a placeholder or write on denied/mismatched cloud jobs', async () => {
  let approved = false;
  const vscode = {
    workspace: {
      isTrusted: true,
      workspaceFolders: [{ uri: { fsPath: 'C:\\workspace' } }],
      getConfiguration: () => ({ inspect: () => ({}) })
    },
    window: { showWarningMessage: async () => approved ? 'Continue' : undefined },
    Uri: { file: fsPath => ({ fsPath }) }
  };
  const originalLoad = Module._load;
  Module._load = function (id, ...rest) {
    if (id === 'vscode') return vscode;
    return originalLoad.call(this, id, ...rest);
  };
  let VisionService;
  try {
    ({ VisionService } = require('../out/services/ai/VisionService'));
  } finally {
    Module._load = originalLoad;
  }
  const service = VisionService.getInstance({ secrets: { get: async () => undefined } });
  let key = '';
  service.secretManager = { getApiKey: async () => key };
  service.configManager = { isOfflineMode: () => false };
  let writes = 0;
  service.fsService = { getAvailableFileUri: async () => ({ fsPath: 'C:\\workspace\\result.png' }), writeFile: async () => { writes++; } };
  const previousFetch = global.fetch;
  let fetches = 0;
  global.fetch = async () => { fetches++; return { ok: true, json: async () => ({ data: [{ taskUUID: 'wrong-job', imageDataURI: 'data:image/png;base64,AA==' }] }) }; };
  try {
    await assert.rejects(() => service.textToImage('a cat'), /API key is required/i);
    key = 'test-key';
    await assert.rejects(() => service.textToImage('a cat'), /not approved/i);
    assert.equal(fetches, 0);
    approved = true;
    await assert.rejects(() => service.textToImage('a cat'), /does not match/i);
    assert.equal(fetches, 1);
    assert.equal(writes, 0);
  } finally {
    global.fetch = previousFetch;
  }
});

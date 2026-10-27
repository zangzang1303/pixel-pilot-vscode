const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('global legacy keys migrate once and disconnect cannot rehydrate them', async () => {
  const values = new Map();
  const settings = { apiKey: 'global-runware', llmApiKey: 'global-llm' };
  const updates = [];
  const config = {
    inspect: key => ({ globalValue: settings[key], workspaceValue: 'workspace-key' }),
    get: key => settings[key],
    update: async (key, value, target) => { updates.push([key, target]); settings[key] = value; }
  };
  const vscode = {
    workspace: { getConfiguration: () => config },
    ConfigurationTarget: { Global: 1 },
    window: { showInformationMessage: () => {} }
  };
  const originalLoad = Module._load;
  Module._load = function (id, ...rest) {
    if (id === 'vscode') return vscode;
    return originalLoad.call(this, id, ...rest);
  };
  let SecretManager;
  try {
    ({ SecretManager } = require('../out/services/security/SecretManager'));
  } finally {
    Module._load = originalLoad;
  }
  const secrets = {
    get: async key => values.get(key),
    store: async (key, value) => { values.set(key, value); },
    delete: async key => { values.delete(key); }
  };
  const manager = new SecretManager({ secrets });
  assert.equal(await manager.getApiKey(), 'global-runware');
  assert.equal(await manager.getLlmApiKey(), 'global-llm');
  assert.deepEqual(updates, [['apiKey', 1], ['llmApiKey', 1]]);
  await manager.setLlmProvider('openai');
  assert.equal(await manager.getLlmApiKey(), '');
  await manager.setLlmProvider('gemini');
  assert.equal(await manager.getLlmApiKey(), 'global-llm');
  await manager.deleteApiKey();
  await manager.deleteLlmApiKey();
  settings.apiKey = 'stale-runware';
  settings.llmApiKey = 'stale-llm';
  assert.equal(await manager.getApiKey(), '');
  assert.equal(await manager.getLlmApiKey(), '');
  await manager.setApiKey('new-runware');
  assert.equal(await manager.getApiKey(), 'new-runware');
  await manager.setLlmProvider('openai');
  await manager.setLlmApiKey('openai-key');
  assert.equal(await manager.getLlmApiKey(), 'openai-key');
  await manager.setLlmProvider('gemini');
  assert.equal(await manager.getLlmApiKey(), '');
  await assert.rejects(() => manager.setLlmProvider('mystery'), /Unsupported/);
});

test('workspace-scoped legacy key is not silently moved to global SecretStorage', async () => {
  const originalLoad = Module._load;
  Module._load = function (id, ...rest) {
    if (id === 'vscode') return { workspace: { getConfiguration: () => ({ inspect: () => ({ workspaceValue: 'workspace-only' }) }) } };
    return originalLoad.call(this, id, ...rest);
  };
  let SecretManager;
  try {
    delete require.cache[require.resolve('../out/services/security/SecretManager')];
    ({ SecretManager } = require('../out/services/security/SecretManager'));
  } finally {
    Module._load = originalLoad;
  }
  const values = new Map();
  const manager = new SecretManager({ secrets: { get: async key => values.get(key), store: async (key, value) => values.set(key, value), delete: async key => values.delete(key) } });
  assert.equal(await manager.getApiKey(), '');
  assert.equal(values.size, 0);
});

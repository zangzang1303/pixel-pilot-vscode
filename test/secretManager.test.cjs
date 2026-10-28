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

function createVault(initialValues = new Map(), initialSettings = {}) {
  const values = initialValues;
  const settings = { ...initialSettings };
  const config = {
    get: key => settings[key],
    inspect: key => ({ globalValue: settings[key] }),
    update: async (key, value) => { settings[key] = value; }
  };
  const mockVscode = { workspace: { getConfiguration: () => config }, ConfigurationTarget: { Global: 1 } };
  const originalLoad = Module._load;
  Module._load = function (id, ...rest) {
    if (id === 'vscode') return mockVscode;
    return originalLoad.call(this, id, ...rest);
  };
  let SecretManager;
  try {
    delete require.cache[require.resolve('../out/services/security/SecretManager')];
    ({ SecretManager } = require('../out/services/security/SecretManager'));
  } finally {
    Module._load = originalLoad;
  }
  const secrets = {
    get: async key => values.get(key),
    store: async (key, value) => { values.set(key, value); },
    delete: async key => { values.delete(key); }
  };
  return { manager: new SecretManager({ secrets }), secrets, values, settings, SecretManager };
}

test('LLM vault keeps multiple provider keys and disconnects only the selected provider', async () => {
  const { manager, secrets, values, SecretManager } = createVault();
  await manager.setLlmProvider('gemini');
  await manager.setLlmApiKey('gemini-secret');
  await manager.setLlmProvider('openai');
  await manager.setLlmApiKey('openai-secret');
  assert.equal(await manager.getLlmApiKey(), 'openai-secret');
  await manager.setLlmProvider('gemini');
  assert.equal(await manager.getLlmApiKey(), 'gemini-secret');
  await manager.deleteLlmApiKey();
  assert.equal(await manager.getLlmApiKey(), '');
  await manager.setLlmProvider('openai');
  assert.equal(await manager.getLlmApiKey(), 'openai-secret');
  assert.equal(await new SecretManager({ secrets }).getLlmApiKey(), 'openai-secret');
  assert.equal(values.get('pixelPilot.llmApiKey.gemini'), undefined);
  assert.equal(values.get('pixelPilot.llmApiKey.openai'), 'openai-secret');
});

test('tagged legacy LLM key migrates only to its provider slot', async () => {
  const values = new Map([
    ['pixelPilot.llmApiKey', 'old-openai-secret'],
    ['pixelPilot.llmApiKeyProvider', 'openai']
  ]);
  const { manager } = createVault(values);
  assert.equal(await manager.getLlmApiKey(), '');
  await manager.setLlmProvider('openai');
  assert.equal(await manager.getLlmApiKey(), 'old-openai-secret');
  assert.equal(values.get('pixelPilot.llmApiKey.openai'), 'old-openai-secret');
  assert.equal(values.has('pixelPilot.llmApiKey'), false);
  await manager.setLlmProvider('gemini');
  assert.equal(await manager.getLlmApiKey(), '');
});

test('old global disconnect blocks legacy resurrection but permits a new provider key', async () => {
  const values = new Map([
    ['pixelPilot.llmDisconnected', '1'],
    ['pixelPilot.llmApiKey', 'old-secret']
  ]);
  const { manager } = createVault(values);
  assert.equal(await manager.getLlmApiKey(), '');
  await manager.setLlmProvider('openai');
  await manager.setLlmApiKey('new-openai-secret');
  assert.equal(await manager.getLlmApiKey(), 'new-openai-secret');
  await manager.setLlmProvider('gemini');
  assert.equal(await manager.getLlmApiKey(), '');
});

test('replacing an untagged legacy key retires it instead of exposing it to another provider', async () => {
  const values = new Map([
    ['pixelPilot.llmProvider', 'openai'],
    ['pixelPilot.llmApiKey', 'old-openai-secret']
  ]);
  const { manager } = createVault(values);
  await manager.setLlmApiKey('new-openai-secret');
  assert.equal(values.has('pixelPilot.llmApiKey'), false);
  assert.equal(await manager.getLlmApiKey(), 'new-openai-secret');
  await manager.setLlmProvider('gemini');
  assert.equal(await manager.getLlmApiKey(), '');
});

test('a tagged legacy key for one provider does not block another provider settings migration', async () => {
  const values = new Map([
    ['pixelPilot.llmApiKey', 'old-openai-secret'],
    ['pixelPilot.llmApiKeyProvider', 'openai']
  ]);
  const { manager, settings } = createVault(values, { llmProvider: 'gemini', llmApiKey: 'old-gemini-secret' });
  assert.equal(await manager.getLlmApiKey(), 'old-gemini-secret');
  assert.equal(settings.llmApiKey, undefined);
  await manager.setLlmProvider('openai');
  assert.equal(await manager.getLlmApiKey(), 'old-openai-secret');
  assert.equal(values.has('pixelPilot.llmApiKey'), false);
});

test('LLM fallback diagnostics do not expose a provider key from an error', async () => {
  const { LLMProvider } = require('../out/services/ai/LLMProvider');
  const canary = 'canary-private-api-key';
  const previousFetch = global.fetch;
  const previousWarn = console.warn;
  const warnings = [];
  global.fetch = async () => { throw new Error(`request URL contained ${canary}`); };
  console.warn = (...parts) => warnings.push(parts.join(' '));
  try {
    await LLMProvider.planWithLLM('hello', undefined, { provider: 'gemini', apiKey: canary });
  } finally {
    global.fetch = previousFetch;
    console.warn = previousWarn;
  }
  assert.ok(warnings.length > 0);
  assert.equal(warnings.join(' ').includes(canary), false);
});

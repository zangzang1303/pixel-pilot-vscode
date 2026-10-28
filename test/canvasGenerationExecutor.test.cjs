const test = require('node:test');
const assert = require('node:assert/strict');
const { CanvasGenerationExecutor } = require('../out/services/copilot/CanvasGenerationExecutor');

const image = 'data:image/png;base64,AA==';
const comfyResult = { success: true, outputImageUri: image, metrics: { model: 'ComfyUI/checkpoint', latencyMs: 1, costUsd: 0 } };

test('shared Generate executor selects InvokeAI for both surfaces when a model is available', async () => {
  const calls = [];
  const invoke = {
    ping: async () => true,
    getModels: async () => [{ key: 'model-a', name: 'Model A' }],
    generateTextToImage: async (prompt, model, options, progress) => {
      calls.push({ prompt, model, options });
      progress('running', 50);
      return { dataUrl: image, imageName: 'invoke.png' };
    }
  };
  const progress = [];
  const executor = new CanvasGenerationExecutor(invoke, () => { throw new Error('ComfyUI must not run'); });
  const generated = await executor.execute('a kite', undefined, { width: 512 }, (status, percentage) => progress.push([status, percentage]));
  assert.equal(generated.imageName, 'invoke.png');
  assert.equal(generated.result.metrics.model, 'InvokeAI/model-a');
  assert.deepEqual(calls, [{ prompt: 'a kite', model: { key: 'model-a', name: 'Model A' }, options: { width: 512 } }]);
  assert.deepEqual(progress, [['running', 50]]);
});

test('shared Generate executor selects ComfyUI when InvokeAI is offline or has no model', async () => {
  for (const online of [false, true]) {
    let invokeCalls = 0;
    let comfyCalls = 0;
    const invoke = {
      ping: async () => online,
      getModels: async () => [],
      generateTextToImage: async () => { invokeCalls++; throw new Error('unexpected InvokeAI call'); }
    };
    const executor = new CanvasGenerationExecutor(invoke, () => ({
      generateImage: async (prompt, negative, width, height) => {
        comfyCalls++;
        assert.deepEqual([prompt, negative, width, height], ['a kite', 'blur', 512, 512]);
        return comfyResult;
      }
    }));
    const generated = await executor.execute('a kite', undefined, { negativePrompt: 'blur', width: 512, height: 512 });
    assert.equal(generated.result.metrics.model, 'ComfyUI/checkpoint');
    assert.equal(invokeCalls, 0);
    assert.equal(comfyCalls, 1);
  }
});

test('invalid prompt or empty provider output cannot become a generated success', async () => {
  let providerCalls = 0;
  const invoke = {
    ping: async () => { providerCalls++; return true; },
    getModels: async () => [{ key: 'model-a', name: 'Model A' }],
    generateTextToImage: async () => ({ dataUrl: '', imageName: 'missing.png' })
  };
  const executor = new CanvasGenerationExecutor(invoke, () => { throw new Error('unexpected ComfyUI call'); });
  await assert.rejects(() => executor.execute(''), /prompt/i);
  await assert.rejects(() => executor.execute('x'.repeat(4097)), /prompt/i);
  assert.equal(providerCalls, 0);
  await assert.rejects(() => executor.execute('a kite'), /did not return an image/i);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { ComfyUIAdapter } = require('../out/services/ai/ComfyUIAdapter');

async function withObjectInfo(data, action) {
  const originalFetch = global.fetch;
  try {
    global.fetch = async url => {
      assert.match(String(url), /\/object_info$/);
      return { ok: true, status: 200, json: async () => data };
    };
    return await action(new ComfyUIAdapter());
  } finally {
    global.fetch = originalFetch;
  }
}

test('ComfyUI setup probe separates installed node from missing foreground model', async () => {
  await withObjectInfo({
    RemoveBackground: {},
    LoadBackgroundRemovalModel: { input: { required: { bg_removal_name: [[], {}] } } }
  }, async adapter => {
    assert.deepEqual(await adapter.getRmbgSetupStatus(), {
      node: 'RemoveBackground', model: 'missing', modelIssue: 'Danh sách foreground model rỗng.'
    });
    assert.equal(await adapter.getAvailableRmbgNode(), null);
  });
});

test('ComfyUI setup probe identifies a missing model loader separately', async () => {
  await withObjectInfo({ RemoveBackground: {} }, async adapter => {
    assert.deepEqual(await adapter.getRmbgSetupStatus(), {
      node: 'RemoveBackground', model: 'missing', modelIssue: 'Thiếu node LoadBackgroundRemovalModel.'
    });
    assert.equal(await adapter.getAvailableRmbgNode(), null);
  });
});

test('ComfyUI setup probe recognizes supported model choice formats', async () => {
  for (const choices of [
    [['birefnet.safetensors'], {}],
    [null, { options: ['birefnet.safetensors'] }]
  ]) {
    await withObjectInfo({
      RemoveBackground: {},
      LoadBackgroundRemovalModel: { input: { required: { bg_removal_name: choices } } }
    }, async adapter => {
      assert.deepEqual(await adapter.getRmbgSetupStatus(), {
        node: 'RemoveBackground', model: 'available', modelName: 'birefnet.safetensors'
      });
      assert.equal(await adapter.getAvailableRmbgNode(), 'RemoveBackground');
    });
  }
});

test('ComfyUI custom RMBG node reports model metadata as unknown', async () => {
  await withObjectInfo({ ImageRemBg: {} }, async adapter => {
    assert.deepEqual(await adapter.getRmbgSetupStatus(), {
      node: 'ImageRemBg', model: 'unknown'
    });
    assert.equal(await adapter.getAvailableRmbgNode(), 'ImageRemBg');
  });
});

test('native cutout and mask workflows select a model exposed in the first choice slot', async () => {
  const originalFetch = global.fetch;
  const modelData = {
    LoadBackgroundRemovalModel: {
      input: { required: { bg_removal_name: [['birefnet.safetensors'], {}] } }
    }
  };
  const image = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#ffffff' } }).png().toBuffer();
  const adapter = new ComfyUIAdapter();
  const workflows = [];
  try {
    global.fetch = async url => ({
      ok: true,
      json: async () => String(url).endsWith('/object_info')
        ? { RemoveBackground: {}, ...modelData }
        : modelData
    });
    adapter.ping = async () => true;
    adapter.uploadImage = async () => ({ name: 'fixture.png', subfolder: '', type: 'input' });
    adapter.executeWorkflow = async workflow => {
      workflows.push(workflow);
      return { promptId: 'local-fixture', outputImages: [image] };
    };

    const input = `data:image/png;base64,${image.toString('base64')}`;
    const cutout = await adapter.removeBackground(input);
    const mask = await adapter.extractMask(input);
    assert.equal(cutout.metrics.model, 'ComfyUI birefnet.safetensors GPU');
    assert.equal(mask.metrics.model, 'ComfyUI birefnet.safetensors mask GPU');
    assert.equal(workflows.length, 2);
    assert.ok(workflows.every(workflow => workflow['2'].inputs.bg_removal_name === 'birefnet.safetensors'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('offline upscale reports the Sharp algorithm instead of a GPU model', async () => {
  const adapter = new ComfyUIAdapter();
  adapter.ping = async () => false;
  const image = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#ffffff' } }).png().toBuffer();
  const result = await adapter.upscale(`data:image/png;base64,${image.toString('base64')}`, 2);
  assert.equal(result.success, true);
  assert.equal(result.metrics.model, 'Sharp Lanczos3 + sharpen upscale 2x');
  const output = await sharp(Buffer.from(result.outputImageUri.split(',')[1], 'base64')).metadata();
  assert.equal(output.width, 4);
  assert.equal(output.height, 4);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { ProviderCatalog } = require('../out/services/execution/ProviderCatalog');
const { ImageProcessor } = require('../out/services/image/ImageProcessor');

test('default ComfyUI probe advertises model tools only with node and recolor prerequisites', async () => {
  const originalFetch = global.fetch;
  const originalPrerequisites = ImageProcessor.hasRecolorPrerequisites;
  try {
    global.fetch = async url => ({
      ok: true,
      json: async () => String(url).endsWith('/object_info')
        ? { RemoveBackground: {}, LoadBackgroundRemovalModel: { input: { required: { bg_removal_name: [null, { options: ['birefnet.safetensors'] }] } } } }
        : {}
    });
    ImageProcessor.hasRecolorPrerequisites = () => false;
    const catalog = new ProviderCatalog();
    const withoutMaskRuntime = await catalog.probe('comfyui');
    assert.ok(withoutMaskRuntime.supportedTools.includes('image.remove_background'));
    assert.equal(withoutMaskRuntime.supportedTools.includes('image.recolor'), false);
    ImageProcessor.hasRecolorPrerequisites = () => true;
    const ready = await catalog.probe('comfyui');
    assert.ok(ready.supportedTools.includes('image.recolor'));
  } finally {
    global.fetch = originalFetch;
    ImageProcessor.hasRecolorPrerequisites = originalPrerequisites;
  }
});

test('ProviderCatalog probes Sharp with basic local capabilities', async () => {
  const catalog = new ProviderCatalog();
  const sharpCap = await catalog.probe('sharp');

  assert.equal(sharpCap.isOnline, true);
  assert.equal(sharpCap.providerId, 'sharp');
  assert.ok(sharpCap.supportedTools.includes('image.analyze'));
  assert.ok(sharpCap.supportedTools.includes('image.remove_background'));
  assert.equal(sharpCap.supportedTools.includes('image.recolor'), false);
  assert.ok(sharpCap.supportedTools.includes('image.inpaint'));
  assert.equal(sharpCap.supportedTools.includes('image.generate'), false);
  assert.match(sharpCap.unavailableReasons['image.generate'], /raster processor/i);
  assert.match(sharpCap.unavailableReasons['image.recolor'], /Python.*ONNX/i);
});

test('ProviderCatalog does not assume all tools ready when provider is online', async () => {
  const catalog = new ProviderCatalog();

  // Register a mock ComfyUI probe that is online but only has RMBG installed
  catalog.registerProbe('comfyui', async () => ({
    providerId: 'comfyui',
    name: 'ComfyUI (Local)',
    isOnline: true,
    supportedTools: ['image.remove_background'],
    unavailableReasons: {
      'image.generate': 'No checkpoint models found in models/checkpoints.'
    }
  }));

  const cap = await catalog.probe('comfyui');
  assert.equal(cap.isOnline, true);
  assert.equal(cap.supportedTools.includes('image.remove_background'), true);
  assert.equal(cap.supportedTools.includes('image.generate'), false);

  const checkGen = await catalog.isToolSupported('comfyui', 'image.generate');
  assert.equal(checkGen.supported, false);
  assert.match(checkGen.reason, /No checkpoint models found/i);
});

test('ProviderCatalog queries available providers for specific tools', async () => {
  const catalog = new ProviderCatalog();

  catalog.registerProbe('comfyui', async () => ({
    providerId: 'comfyui', name: 'ComfyUI (Local)', isOnline: false, supportedTools: []
  }));

  catalog.registerProbe('runware', async () => ({
    providerId: 'runware',
    name: 'Runware Cloud',
    isOnline: true,
    supportedTools: ['image.generate', 'image.remove_background']
  }));

  const genProviders = await catalog.getAvailableProvidersForTool('image.generate');
  assert.deepEqual(genProviders, ['runware']);

  const rmbgProviders = await catalog.getAvailableProvidersForTool('image.remove_background');
  assert.ok(rmbgProviders.includes('sharp'));
  assert.ok(rmbgProviders.includes('runware'));
});

test('ProviderCatalog handles unregistered or failing probes gracefully', async () => {
  const catalog = new ProviderCatalog();

  const unknown = await catalog.probe('ollama');
  assert.equal(unknown.isOnline, false);
  assert.equal(unknown.supportedTools.length, 0);

  catalog.registerProbe('invokeai', async () => {
    throw new Error('Connection refused at port 9090');
  });

  const failed = await catalog.probe('invokeai');
  assert.equal(failed.isOnline, false);
  assert.match(failed.unavailableReasons['image.generate'], /Connection refused/i);
});

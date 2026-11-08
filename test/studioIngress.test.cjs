const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('Studio routes both image-action message names through the shared Copilot host ingress', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'panels', 'StudioPanel.ts'), 'utf8');
  const activeCase = source.indexOf("case 'applyAction':");
  const legacyCase = source.indexOf("case '__legacyApplyAction':");
  assert.ok(activeCase >= 0, 'Studio must retain the active applyAction ingress.');
  assert.ok(legacyCase > activeCase, 'The old message name must remain an alias.');
  const activeBlock = source.slice(activeCase, source.indexOf("case 'chatMessage':", legacyCase));
  assert.match(activeBlock, /await this\._copilot\.handleStudioMessage\(\{ \.\.\.message, command: 'applyAction' \}\)/,
    'Both names must forward image actions to the shared host.');
  assert.doesNotMatch(activeBlock, /saveCanvasAction|new ComfyUIAdapter/, 'Studio must not execute a second image pipeline.');
  const upscaleBlock = source.slice(source.indexOf("case 'upscale':"), source.indexOf("case 'insertSnippet':"));
  assert.match(upscaleBlock, /await this\._copilot\.handleStudioMessage\(message\)/,
    'The separate Studio upscale button must use the shared host.');
  assert.doesNotMatch(upscaleBlock, /saveCanvasAction|ImageProcessor/, 'Studio must not retain a second upscale pipeline.');
  const generateBlock = source.slice(source.indexOf("case 'generate':"), source.indexOf("case 'upscale':"));
  assert.match(generateBlock, /await this\._copilot\.handleStudioMessage\(message\)/,
    'Studio Generate must use the shared host request lifecycle.');
  assert.doesNotMatch(generateBlock, /executeCanvasGeneration|finishCanvasGeneration/,
    'Studio must not retain a second Generate pipeline.');

  const provider = fs.readFileSync(path.join(__dirname, '..', 'src', 'providers', 'PixelPilotViewProvider.ts'), 'utf8');
  const legacyUpscale = provider.slice(provider.indexOf("case 'upscale': {"), provider.indexOf("case 'applyAction': {"));
  assert.match(legacyUpscale, /await this\.handleMessage\(\{[\s\S]*command: 'applyAction'/,
    'Legacy upscale must use the Canvas request lifecycle.');
  assert.doesNotMatch(legacyUpscale, /saveCanvasAction|ImageProcessor/, 'Host must not retain a separate upscale executor.');
  const app = fs.readFileSync(path.join(__dirname, '..', 'webview-ui', 'src', 'App.tsx'), 'utf8');
  assert.doesNotMatch(app, /command: 'upscale'/, 'Current UI must use applyAction for Upscale.');
});

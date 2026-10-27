const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('OCR and image-to-code never call cloud on denial or fabricate output', async () => {
  let trusted = false;
  let approved = false;
  const vscode = {
    workspace: { get isTrusted() { return trusted; } },
    window: { showWarningMessage: async () => approved ? 'Continue' : undefined }
  };
  const originalLoad = Module._load;
  Module._load = function (id, ...rest) {
    if (id === 'vscode') return vscode;
    return originalLoad.call(this, id, ...rest);
  };
  let OCRService, CodeGenService;
  try {
    ({ OCRService } = require('../out/services/ai/OCRService'));
    ({ CodeGenService } = require('../out/services/ai/CodeGenService'));
  } finally {
    Module._load = originalLoad;
  }
  const ocr = OCRService.getInstance();
  const codegen = CodeGenService.getInstance();
  let provider = 'gemini';
  const secrets = { getLlmProvider: async () => provider, getLLMKey: async () => 'test-key' };
  ocr.secretManager = secrets;
  codegen.secretManager = secrets;
  let calls = 0;
  ocr.callGeminiOCR = async () => { calls++; return ''; };
  codegen.callGeminiVision = async () => { calls++; return ''; };
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+M2Q0XwAAAABJRU5ErkJggg==', 'base64');
  const request = { imageBuffer: image, imageMimeType: 'image/png', framework: 'react-tailwind' };

  await assert.rejects(() => ocr.extractText(image, 'image/png'), /not trusted/i);
  await assert.rejects(() => codegen.generateCodeFromImage(request), /not trusted/i);
  trusted = true;
  await assert.rejects(() => ocr.extractText(image, 'image/png'), /not approved/i);
  await assert.rejects(() => codegen.generateCodeFromImage(request), /not approved/i);
  assert.equal(calls, 0);

  provider = 'groq';
  await assert.rejects(() => ocr.extractText(image, 'image/png'), /unavailable/i);
  await assert.rejects(() => codegen.generateCodeFromImage(request), /unavailable/i);
  assert.equal(calls, 0);

  provider = 'gemini';
  approved = true;
  const emptyOcr = await ocr.extractText(image, 'image/png');
  assert.equal(emptyOcr.fullText, '');
  assert.equal(emptyOcr.confidence, undefined);
  await assert.rejects(() => codegen.generateCodeFromImage(request), /returned no code/i);
  assert.equal(calls, 2);
});

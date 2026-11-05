const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { encodeImageExport } = require('../out/utils/ImageExportService');

test('PNG export fits within custom bounds, preserves aspect ratio and alpha', async () => {
  const input = await sharp({ create: { width: 1200, height: 600, channels: 4, background: { r: 200, g: 30, b: 20, alpha: 0.4 } } }).png().toBuffer();
  const result = await encodeImageExport(input, { format: 'png', maxWidth: 400, maxHeight: 400 });
  assert.equal(result.width, 400);
  assert.equal(result.height, 200);
  assert.equal(result.hasAlpha, true);
  const { data, info } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 4);
  assert.ok(data[3] > 0 && data[3] < 255);
});

test('WebP export retains alpha and does not enlarge a smaller source', async () => {
  const input = await sharp({ create: { width: 80, height: 40, channels: 4, background: { r: 0, g: 120, b: 230, alpha: 0 } } }).png().toBuffer();
  const result = await encodeImageExport(input, { format: 'webp', maxWidth: 1024, maxHeight: 1024 });
  assert.equal(result.width, 80);
  assert.equal(result.height, 40);
  assert.equal(result.hasAlpha, true);
});

test('export rejects invalid bounds before encoding', async () => {
  await assert.rejects(() => encodeImageExport(Buffer.from('not an image'), { format: 'png', maxWidth: 0 }), /whole numbers/);
});

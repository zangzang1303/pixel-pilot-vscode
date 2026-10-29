const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { verifyRecolorChange } = require('../scripts/recolor-smoke-validation.cjs');

test('recolor smoke rejects a reencoded but unchanged image', async () => {
  const input = await sharp({
    create: { width: 10, height: 10, channels: 4, background: { r: 20, g: 40, b: 60, alpha: 1 } }
  }).png().toBuffer();
  const unchanged = await sharp(input).png({ compressionLevel: 0 }).toBuffer();
  await assert.rejects(verifyRecolorChange(input, unchanged), /no-op image/);
});

test('recolor smoke requires changed RGB pixels at the same dimensions', async () => {
  const input = await sharp({
    create: { width: 10, height: 10, channels: 4, background: { r: 20, g: 40, b: 60, alpha: 1 } }
  }).png().toBuffer();
  const changed = await sharp(input).tint({ r: 180, g: 50, b: 80 }).png().toBuffer();
  const proof = await verifyRecolorChange(input, changed);
  assert.equal(proof.width, 10);
  assert.ok(proof.changedPixels > 0);
  await assert.rejects(verifyRecolorChange(input, await sharp(changed).resize(8, 8).png().toBuffer()), /dimensions/);
});

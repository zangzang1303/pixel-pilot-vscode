const assert = require('node:assert/strict');
const path = require('node:path');

const extensionRoot = process.argv[2];
if (!extensionRoot) {
  throw new Error('Usage: node scripts/verify-installed-vsix.cjs <installed-extension-root>');
}

const sharp = require(path.join(extensionRoot, 'node_modules', 'sharp'));

(async () => {
  const image = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: { r: 20, g: 40, b: 60, alpha: 1 }
    }
  }).png().toBuffer();
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 2);
  assert.equal(metadata.height, 2);
  console.log('Installed VSIX Sharp runtime smoke passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
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

  const recolorScript = path.join(extensionRoot, 'scripts', 'recolor_mask.py');
  assert.ok(fs.existsSync(recolorScript), 'Installed VSIX must include the recolor mask script.');
  const recolorModel = path.join(extensionRoot, '.pixelpilot_runtime', 'selfie_multiclass.onnx');
  if (!fs.existsSync(recolorModel)) {
    const { ImageProcessor } = require(path.join(extensionRoot, 'out', 'services', 'image', 'ImageProcessor'));
    await assert.rejects(
      ImageProcessor.getInstance().recolor(image, 'clothes', 'blue'),
      /Thiếu mô hình đổi màu chọn lọc/,
      'Recolor without its model must report unavailable instead of returning an image.'
    );
    console.log('Installed VSIX recolor missing-model behavior passed.');
  } else {
    console.log('Installed VSIX recolor model exists; run provider:smoke:local to verify the configured runtime.');
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

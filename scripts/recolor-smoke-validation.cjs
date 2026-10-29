const sharp = require('sharp');

async function verifyRecolorChange(input, output, minimumChangedFraction = 0.001) {
  const source = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (result.info.width !== source.info.width || result.info.height !== source.info.height) {
    throw new Error('Recolor output dimensions differ from the input fixture.');
  }
  const pixels = source.info.width * source.info.height;
  let changedPixels = 0;
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const offset = pixel * 4;
    if (source.data[offset] !== result.data[offset] ||
        source.data[offset + 1] !== result.data[offset + 1] ||
        source.data[offset + 2] !== result.data[offset + 2]) {
      changedPixels += 1;
    }
  }
  if (changedPixels < Math.ceil(pixels * minimumChangedFraction)) {
    throw new Error('Recolor returned a no-op image; provider smoke cannot pass.');
  }
  return {
    width: source.info.width,
    height: source.info.height,
    changedPixels,
    changedFraction: changedPixels / pixels
  };
}

module.exports = { verifyRecolorChange };

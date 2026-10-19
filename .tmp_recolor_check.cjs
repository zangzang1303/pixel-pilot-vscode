const fs = require('fs');
const sharp = require('sharp');
const { ImageProcessor } = require('./out/services/image/ImageProcessor');
(async () => {
  const input = fs.readFileSync('test_images/01_original/TC1.jpg');
  const output = await ImageProcessor.getInstance().recolor(input, 'hair', 'cyan');
  fs.writeFileSync('.tmp_recolor_tc1.png', output);
  const a = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let changed = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i+1] - b.data[i+1]) + Math.abs(a.data[i+2] - b.data[i+2]) > 45) changed++;
  }
  console.log(JSON.stringify({ width: a.info.width, height: a.info.height, changedPixels: changed, changedPercent: (changed / (a.info.width * a.info.height) * 100).toFixed(1) }));
})().catch(error => { console.error(error); process.exitCode = 1; });

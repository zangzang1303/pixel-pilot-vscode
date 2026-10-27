const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { decodeImageInput, imageMimeType } = require('../out/utils/imageData');

test('decodeImageInput supports MIME types containing +xml', () => {
  const source = '<svg xmlns="http://www.w3.org/2000/svg"/>';
  const decoded = decodeImageInput(`data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}`);
  assert.equal(decoded.extension, 'svg');
  assert.equal(decoded.mimeType, 'image/svg+xml');
  assert.equal(decoded.buffer.toString('utf8'), source);
});

test('decodeImageInput reads local files and normalizes jpeg', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-pilot-image-'));
  const file = path.join(directory, 'photo.jpeg');
  try {
    fs.writeFileSync(file, Buffer.from([1, 2, 3]));
    const decoded = decodeImageInput(file);
    assert.equal(decoded.extension, 'jpg');
    assert.equal(decoded.mimeType, 'image/jpeg');
    assert.deepEqual([...decoded.buffer], [1, 2, 3]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('decodeImageInput rejects unknown input instead of treating text as base64', () => {
  assert.throws(() => decodeImageInput('not-an-image'), /không hợp lệ|không còn tồn tại/i);
  assert.equal(imageMimeType('jpg'), 'image/jpeg');
});

test('decodeImageInput rejects SVG with active content', () => {
  const source = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}`;
  assert.throws(() => decodeImageInput(dataUri), /active or remote content/i);
});

test('decodeImageInput rejects malformed base64 before allocation', () => {
  assert.throws(
    () => decodeImageInput('data:image/png;base64,not-valid-base64'),
    /không hợp lệ|not valid/i
  );
});

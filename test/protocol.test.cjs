const test = require('node:test');
const assert = require('node:assert/strict');
const { PROTOCOL_VERSION, parseRunRequest } = require('../out/shared/protocol');

test('protocol v2 accepts a bounded valid tool request', () => {
  const result = parseRunRequest({ version: PROTOCOL_VERSION, requestId: 'r-1', command: 'tool', toolName: 'upscale_image', args: { factor: 2 } });
  assert.equal(result.ok, true);
  assert.equal(result.value.toolName, 'upscale_image');
});

test('protocol v2 rejects malformed or unsupported messages', () => {
  assert.equal(parseRunRequest({ version: 1, requestId: 'r-1', command: 'chat', text: 'hi' }).ok, false);
  assert.equal(parseRunRequest({ version: PROTOCOL_VERSION, requestId: '../bad', command: 'chat', text: 'hi' }).ok, false);
  assert.equal(parseRunRequest({ version: PROTOCOL_VERSION, requestId: 'r-1', command: 'tool', args: {} }).ok, false);
  assert.equal(parseRunRequest({ version: PROTOCOL_VERSION, requestId: 'r-1', command: 'unknown' }).ok, false);
  assert.equal(parseRunRequest({ version: PROTOCOL_VERSION, requestId: 'r-1', command: 'cancel' }).ok, false);
  assert.equal(parseRunRequest({ version: PROTOCOL_VERSION, requestId: 'r-2', command: 'cancel', targetRequestId: 'r-1' }).ok, true);
});

test('protocol v2 parses and validates client messages', () => {
  const { parseClientMessage } = require('../out/shared/protocol');
  const valid = parseClientMessage({
    protocolVersion: PROTOCOL_VERSION,
    requestId: 'req-42',
    type: 'copilot.submit',
    sessionId: 'session-1',
    nodeId: 'node-1',
    text: 'remove background'
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.value.type, 'copilot.submit');

  assert.equal(parseClientMessage(null).ok, false);
  assert.equal(parseClientMessage({ protocolVersion: 1, requestId: 'r', type: 'test' }).ok, false);
  assert.equal(parseClientMessage({ protocolVersion: PROTOCOL_VERSION, requestId: '', type: 'test' }).ok, false);
});


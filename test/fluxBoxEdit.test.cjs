const test = require('node:test');
const assert = require('node:assert/strict');
const { RunwareAdapter } = require('../out/services/ai/RunwareAdapter');

test('FLUX.3 Klein edit sends a reference box and records the returned cost', async () => {
  const adapter = new RunwareAdapter('test-key');
  const source = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+M2Q0XwAAAABJRU5ErkJggg==';
  let task;
  adapter.dispatchTasks = async tasks => {
    [task] = tasks;
    return { data: [{ taskUUID: task.taskUUID, imageDataURI: source, cost: 0.008 }], latencyMs: 42 };
  };
  const box = [100, 200, 600, 700];
  const result = await adapter.editBoundingBox(source, box, 'red chair', 'Change the chair to blue');
  assert.equal(result.success, true);
  assert.equal(result.metrics.costUsd, 0.008);
  assert.equal(result.metrics.costStatus, 'actual');
  assert.equal(task.model, 'bfl:flux@3-image-klein');
  assert.deepEqual(task.inputs.referenceImages, [source]);
  assert.deepEqual(task.settings.boundingBoxes[0].sourceBox, box);
  assert.deepEqual(task.settings.boundingBoxes[0].targetBox, box);
  assert.match(task.positivePrompt, /<selected_1>/);
});

test('FLUX.3 Klein rejects an invalid box without sending a request', async () => {
  const adapter = new RunwareAdapter('test-key');
  adapter.dispatchTasks = async () => { throw new Error('Should not send'); };
  const result = await adapter.editBoundingBox('image', [500, 100, 100, 900], 'chair', 'blue');
  assert.equal(result.success, false);
  assert.match(result.error, /Bounding box/);
});

test('FLUX box edit forwards caller cancellation to the provider request', async () => {
  const adapter = new RunwareAdapter('test-key');
  const source = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+M2Q0XwAAAABJRU5ErkJggg==';
  const controller = new AbortController();
  let receivedSignal;
  adapter.dispatchTasks = async (_tasks, signal) => {
    receivedSignal = signal;
    controller.abort();
    return { data: [{ imageDataURI: source }], latencyMs: 1 };
  };
  const result = await adapter.editBoundingBox(source, [100, 200, 600, 700], 'red chair', 'Make it blue', controller.signal);
  assert.equal(receivedSignal, controller.signal);
  assert.equal(result.success, false);
  assert.match(result.error, /cancelled/i);
});

test('FLUX box edit marks missing provider cost as unknown instead of zero USD', async () => {
  const adapter = new RunwareAdapter('test-key');
  const source = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+M2Q0XwAAAABJRU5ErkJggg==';
  adapter.dispatchTasks = async () => ({ data: [{ imageDataURI: source }], latencyMs: 5 });
  const result = await adapter.editBoundingBox(source, [100, 200, 600, 700], 'chair', 'Change color');
  assert.equal(result.success, true);
  assert.equal(result.metrics.costUsd, undefined);
  assert.equal(result.metrics.costStatus, 'unknown');
});

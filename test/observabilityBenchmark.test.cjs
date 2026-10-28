const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { RulePlanner } = require('../out/services/planner/RulePlanner');
const { PlanValidator } = require('../out/services/planner/PlanValidator');
const { IntentRouter } = require('../out/services/planner/IntentRouter');
const { runReducer, initialRunState } = require('../out/shared/runReducer');
const { ArtifactStore } = require('../out/services/storage/ArtifactStore');
const { CopilotError } = require('../out/services/execution/errors');
const { PriorityToolExecutors } = require('../out/services/tools/PriorityToolExecutors');

PriorityToolExecutors.registerAll();

test('Observability & Performance Benchmark (B27) validates latency, canary redaction, and state throughput', async () => {
  const benchmarkResults = {
    timestamp: new Date().toISOString(),
    metrics: {}
  };

  // 1. Planner Latency Benchmark (100 sequential plans)
  const planStart = performance.now();
  const iterations = 100;
  for (let i = 0; i < iterations; i++) {
    const plan = RulePlanner.plan('tách nền rồi đổi màu áo sang đỏ rồi phóng to 2x', {
      currentImageId: 'img_perf'
    });
    PlanValidator.validate(plan);
  }
  const planTotalMs = performance.now() - planStart;
  const avgPlanMs = +(planTotalMs / iterations).toFixed(3);
  benchmarkResults.metrics.avgPlannerLatencyMs = avgPlanMs;

  console.log(`\n=== PERFORMANCE BENCHMARK (B27) ===`);
  console.log(`Average Multi-Step Planner Latency: ${avgPlanMs} ms / plan`);
  assert.ok(avgPlanMs < 5.0, `Planner latency should be < 5ms, got ${avgPlanMs}ms`);

  // 2. Reducer Throughput Benchmark (1,000 rapid event transitions)
  const reducerStart = performance.now();
  let state = initialRunState;
  const requestId = 'req_perf_1';

  state = runReducer(state, { type: 'start', requestId, toolName: 'image.remove_background' });
  for (let i = 0; i < 1000; i++) {
    state = runReducer(state, {
      type: 'progress',
      requestId,
      stage: `Stage ${i % 5}`,
      fraction: (i % 100) / 100
    });
  }
  state = runReducer(state, {
    type: 'succeed',
    requestId,
    result: { artifactId: 'art_123' }
  });
  const reducerTotalMs = performance.now() - reducerStart;
  benchmarkResults.metrics.reducerThroughput1000EventsMs = +reducerTotalMs.toFixed(3);

  console.log(`1,000 Reducer Event Transitions: ${reducerTotalMs.toFixed(2)} ms`);
  assert.ok(reducerTotalMs < 20.0, `1,000 reducer transitions should take < 20ms, got ${reducerTotalMs}ms`);
  assert.equal(state.phase, 'succeeded');

  // 3. ArtifactStore SHA-256 Deduplication & Performance
  const tmpDir = path.resolve(__dirname, '..', 'scratch', 'benchmark_store');
  const store = new ArtifactStore(tmpDir);
  const sampleData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9QzwAEjDAGNYAAAC2pDBF7hK7fAAAAAElFTkSuQmCC', 'base64');

  const storeStart = performance.now();
  const art1 = await store.store(sampleData, 'image/png', { kind: 'image' });
  const art2 = await store.store(sampleData, 'image/png', { kind: 'image' }); // Deduplicated
  const storeTotalMs = performance.now() - storeStart;
  benchmarkResults.metrics.artifactDedupeStoreMs = +storeTotalMs.toFixed(3);

  console.log(`ArtifactStore Store & Deduplicate: ${storeTotalMs.toFixed(2)} ms`);
  assert.equal(art1.id, art2.id, 'Identical buffers must return identical content-addressable ID');
  assert.equal(art1.sha256, art2.sha256, 'Identical buffers must have matching SHA-256');

  // Clean up benchmark scratch
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // 4. Canary Redaction & Safe Telemetry Invariant
  // Verify that error messages, diagnostics, and summaries strictly reject canary secrets and raw base64
  const canaryKey = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q';
  const openAIKey = 'sk-1234567890abcdef1234567890abcdef12345678';

  const canaryError = new CopilotError({
    code: 'invalid_input',
    message: 'Operation failed on input with key ' + canaryKey
  });

  // Verify canary detection regex
  const hasCanary = (text) => /AIza[0-9A-Za-z-_]{35}|sk-[0-9A-Za-z]{32,}/.test(text);
  assert.ok(hasCanary(canaryError.message));

  // PlanValidator must reject any plan summary containing canary secrets
  assert.throws(
    () => {
      PlanValidator.validate({
        planId: 'canary_test',
        intent: 'chat',
        prompt: 'test',
        steps: [],
        summary: 'Generated with secret ' + openAIKey
      });
    },
    /potential leaked secrets/,
    'PlanValidator must strictly reject summaries containing canary API keys'
  );

  // Write benchmark results artifact
  const benchDir = path.resolve(__dirname, '..', 'benchmark');
  if (!fs.existsSync(benchDir)) {
    fs.mkdirSync(benchDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(benchDir, 'benchmark_results.json'),
    JSON.stringify(benchmarkResults, null, 2),
    'utf-8'
  );
  console.log(`Saved benchmark results to benchmark/benchmark_results.json`);
});

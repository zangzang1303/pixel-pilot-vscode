const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const sharp = require('sharp');
const { ArtifactStore } = require('../out/services/storage/ArtifactStore');
const { SessionManager } = require('../out/services/session/SessionManager');

const ROOT = path.resolve(__dirname, '..');
const WIDTH = 3840;
const HEIGHT = 2160;
const NODE_COUNT = 100;

function parseArgs(argv) {
  const result = { iterations: 5, sharpConcurrency: undefined, output: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--iterations') result.iterations = Number(argv[++i]);
    else if (argv[i] === '--sharp-concurrency') result.sharpConcurrency = Number(argv[++i]);
    else if (argv[i] === '--output') result.output = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!Number.isInteger(result.iterations) || result.iterations < 2 || result.iterations > 30) {
    throw new Error('--iterations must be an integer from 2 to 30.');
  }
  if (result.sharpConcurrency !== undefined && (!Number.isInteger(result.sharpConcurrency) || result.sharpConcurrency < 1 || result.sharpConcurrency > 16)) {
    throw new Error('--sharp-concurrency must be an integer from 1 to 16.');
  }
  return result;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)].toFixed(2));
}

function summarize(values) {
  return {
    samples: values.length,
    minMs: Number(Math.min(...values).toFixed(2)),
    medianMs: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    maxMs: Number(Math.max(...values).toFixed(2))
  };
}

function summarizeBytes(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    p50Bytes: sorted[Math.floor((sorted.length - 1) * 0.5)],
    p95Bytes: sorted[Math.ceil(sorted.length * 0.95) - 1],
    peakBytes: sorted[sorted.length - 1]
  };
}

function elapsedMs(start) {
  return Number((Number(process.hrtime.bigint() - start) / 1e6).toFixed(2));
}

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function directoryBytes(directory) {
  if (!fs.existsSync(directory)) return 0;
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((sum, entry) => {
    const fullPath = path.join(directory, entry.name);
    return sum + (entry.isDirectory() ? directoryBytes(fullPath) : fs.statSync(fullPath).size);
  }, 0);
}

function removeBenchmarkTempDirectory(directory) {
  const root = path.resolve(os.tmpdir());
  const target = path.resolve(directory);
  const relative = path.relative(root, target);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative) || !path.basename(target).startsWith('pixel-pilot-performance-')) {
    throw new Error(`Refusing to remove an unexpected benchmark temporary path: ${target}`);
  }
  fs.rmSync(target, { recursive: true, force: true });
}

async function createFixture() {
  const raw = Buffer.alloc(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const offset = (y * WIDTH + x) * 4;
      raw[offset] = (x * 13 + y * 3) & 0xff;
      raw[offset + 1] = (x * 5 + y * 11) & 0xff;
      raw[offset + 2] = ((x >> 3) ^ (y >> 2)) & 0xff;
      raw[offset + 3] = 255;
    }
  }
  return sharp(raw, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
    .png({ compressionLevel: 1 })
    .toBuffer();
}

async function benchmarkImagePipeline(fixture, iterations, rssSamples) {
  const timings = [];
  let lastOutput;
  let outputMetadata;
  for (let i = 0; i < iterations + 1; i++) {
    const start = process.hrtime.bigint();
    const output = await sharp(fixture)
      .resize(WIDTH, HEIGHT, { fit: 'fill', withoutEnlargement: true })
      .sharpen({ sigma: 1.1 })
      .webp({ quality: 90, effort: 4 })
      .toBuffer();
    const duration = elapsedMs(start);
    if (i > 0) {
      timings.push(duration); // First iteration is a warm-up, not a sample.
      rssSamples.push(process.memoryUsage().rss);
    }
    lastOutput = output;
    outputMetadata = await sharp(output).metadata();
  }
  if (!lastOutput || outputMetadata?.width !== WIDTH || outputMetadata?.height !== HEIGHT) {
    throw new Error('4K image pipeline returned unexpected dimensions.');
  }
  return {
    timing: summarize(timings),
    output: lastOutput,
    outputSha256: hash(lastOutput),
    outputBytes: lastOutput.length,
    dimensions: `${outputMetadata.width}x${outputMetadata.height}`
  };
}

async function benchmarkArtifactStore(storageRoot, imageBuffer, rssSamples) {
  const store = new ArtifactStore(storageRoot);
  const firstStart = process.hrtime.bigint();
  const first = await store.store(imageBuffer, 'image/webp', {
    kind: 'image', provenance: { mode: 'basic', provider: 'local-benchmark' }
  });
  const firstStoreMs = elapsedMs(firstStart);
  rssSamples.push(process.memoryUsage().rss);

  const duplicateStart = process.hrtime.bigint();
  const duplicate = await store.store(imageBuffer, 'image/webp', {
    kind: 'image', provenance: { mode: 'basic', provider: 'local-benchmark' }
  });
  const duplicateStoreMs = elapsedMs(duplicateStart);
  rssSamples.push(process.memoryUsage().rss);
  const deduplicated = duplicate.id === first.id;
  if (!deduplicated) throw new Error('ArtifactStore created a second record for identical bytes.');

  const readStart = process.hrtime.bigint();
  const loaded = await store.get(first.id);
  const readMs = elapsedMs(readStart);
  rssSamples.push(process.memoryUsage().rss);
  if (!loaded || hash(loaded.buffer) !== first.sha256) throw new Error('Artifact read-back hash did not match.');

  return {
    firstStoreMs,
    duplicateStoreMs,
    readMs,
    deduplicated,
    storedBytes: first.byteSize,
    manifestBytes: fs.statSync(path.join(storageRoot, 'artifacts', 'manifest.json')).size
  };
}

function benchmarkSession(storageRoot, outputHash, rssSamples) {
  const sessionsDir = path.join(storageRoot, 'sessions');
  const manager = new SessionManager(sessionsDir);
  const session = manager.createSession(`benchmark://${outputHash}`, 'Pixel Pilot 100-node benchmark');
  const nodeTimings = [];
  let parentId = session.rootNodeId;

  for (let i = 0; i < NODE_COUNT; i++) {
    const start = process.hrtime.bigint();
    const node = manager.addOperationNode(
      session.sessionId,
      parentId,
      'enhance',
      `Benchmark step ${i + 1}`,
      `benchmark://${outputHash}`,
      `benchmark://${outputHash}`,
      { model: 'local-benchmark', latencyMs: 0, costUsd: 0, costStatus: 'estimated' },
      { params: { benchmarkStep: i + 1 } }
    );
    nodeTimings.push(elapsedMs(start));
    rssSamples.push(process.memoryUsage().rss);
    parentId = node.nodeId;
  }

  const sessionFile = path.join(sessionsDir, '.pixelpilot_sessions.json');
  const persistedBytes = fs.statSync(sessionFile).size;
  const reloadStart = process.hrtime.bigint();
  const restored = new SessionManager(sessionsDir).getSession(session.sessionId);
  const reloadMs = elapsedMs(reloadStart);
  const restoredNodes = restored ? Object.keys(restored.nodes).length : 0;
  if (restoredNodes !== NODE_COUNT + 1) throw new Error(`Expected ${NODE_COUNT + 1} persisted nodes, got ${restoredNodes}.`);

  return {
    nodeCount: restoredNodes,
    mutationTotal: summarize(nodeTimings),
    reloadMs,
    persistedBytes
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.sharpConcurrency !== undefined) sharp.concurrency(args.sharpConcurrency);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-pilot-performance-'));
  const memoryBefore = process.memoryUsage();
  const rssSamples = [];
  try {
    const fixture = await createFixture();
    const fixtureSha256 = hash(fixture);
    const image = await benchmarkImagePipeline(fixture, args.iterations, rssSamples);
    const artifact = await benchmarkArtifactStore(tempRoot, image.output, rssSamples);
    const session = benchmarkSession(tempRoot, image.outputSha256, rssSamples);
    const memoryAfter = process.memoryUsage();

    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      scope: 'Local Sharp 4K pipeline, ArtifactStore persistence/dedup/read, SessionManager persistence/reload at 100 operation nodes. No AI provider is called.',
      environment: {
        platform: `${os.platform()} ${os.release()}`,
        architecture: os.arch(),
        cpu: os.cpus()[0]?.model || 'unknown',
        logicalCores: os.cpus().length,
        totalMemoryBytes: os.totalmem(),
        node: process.version,
        sharpConcurrency: sharp.concurrency(),
        sharp: sharp.versions
      },
      input: { dimensions: `${WIDTH}x${HEIGHT}`, bytes: fixture.length, sha256: fixtureSha256 },
      iterations: args.iterations,
      imagePipeline: {
        timing: image.timing,
        outputDimensions: image.dimensions,
        outputBytes: image.outputBytes,
        outputSha256: image.outputSha256
      },
      artifactStore: artifact,
      session,
      resources: {
        rssBeforeBytes: memoryBefore.rss,
        rssAfterBytes: memoryAfter.rss,
        rssDeltaBytes: memoryAfter.rss - memoryBefore.rss,
        sampledRssBytes: summarizeBytes(rssSamples),
        heapUsedBeforeBytes: memoryBefore.heapUsed,
        heapUsedAfterBytes: memoryAfter.heapUsed,
        artifactStorageBytes: directoryBytes(path.join(tempRoot, 'artifacts')),
        sessionStorageBytes: fs.statSync(path.join(tempRoot, 'sessions', '.pixelpilot_sessions.json')).size,
        temporaryStorageBytes: directoryBytes(tempRoot)
      },
      interpretation: 'This is a local implementation baseline, not provider latency, image-quality acceptance, a clean-VM result, or a comparison against a prior optimized revision.'
    };

    const outputPath = args.output
      ? path.resolve(process.cwd(), args.output)
      : path.join(ROOT, 'benchmark', 'performance-results', `baseline-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    console.log(JSON.stringify({ outputPath, imagePipeline: image.timing, session: session.mutationTotal }, null, 2));
  } finally {
    removeBenchmarkTempDirectory(tempRoot);
  }
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});

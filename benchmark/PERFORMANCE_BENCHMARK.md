# Local performance benchmark

Run from the repository root on the machine being measured:

```powershell
npm.cmd run benchmark:performance
npm.cmd run benchmark:performance -- --iterations 7
npm.cmd run benchmark:performance -- --iterations 7 --sharp-concurrency 1
npm.cmd run benchmark:performance -- --output .\benchmark\my-machine-baseline.json
```

The command compiles the extension, generates a deterministic 3840×2160 PNG fixture, warms up once, then measures local Sharp resize/sharpen/WebP processing. It also measures ArtifactStore first-write, duplicate-write and read-back, plus 100 sequential SessionManager DAG mutations and reload. It records p50/median and p95 timings, RSS samples, disk bytes, runtime versions, fixture/output hashes and session file size. No AI provider is called.

Reports are written to `benchmark/performance-results/` with unique names by default. The directory is ignored by Git so machine-specific output does not enter source history by accident. Pass `--output` to choose another path; an existing report is never overwritten.

Run on the same machine, Node/Sharp version and power profile before comparing changes. `--sharp-concurrency` changes libvips worker concurrency for this benchmark process only and can be used to investigate memory/latency tradeoffs. Treat results as an implementation baseline only. They do not measure provider latency or establish image quality. To accept an optimization, compare its p50/p95, RSS and disk results with a retained baseline, and separately confirm that output quality and dimensions have not regressed.

## Captured baseline — 06/11/2026

The retained report is [`windows-dev-20261106.json`](performance-evidence/windows-dev-20261106.json). It was captured on Windows 11 (build 22621), x64, Intel Core i7-12650H, 16 logical cores, Node 24.11.1, Sharp 0.35.5, default Sharp concurrency 16.

| Measure | Result |
| --- | ---: |
| 3840×2160 Sharp pipeline, p50 / p95 (5 measured samples) | 1,559 / 2,577 ms |
| Sampled process RSS, p50 / p95 / peak | 226.3 / 228.1 / 228.3 MiB |
| ArtifactStore first write / duplicate / read | 13.49 / 2.95 / 4.86 ms |
| SessionManager 100-node mutation, p50 / p95 | 2.19 / 3.91 ms per node |
| Session reload / persisted JSON | 4.80 ms / 144,428 bytes |
| Temporary storage for artifact and session | 3.74 MiB |

The p95 from five samples is only the largest observed sample, not a stable tail-latency estimate. Exploratory runs with Sharp concurrency 1/4/8 showed lower RSS in some runs but inconsistent latency across separate processes. No production concurrency setting or image algorithm was changed based on these observations. Repeat with more iterations under a controlled, idle power profile before selecting an optimization; image-quality acceptance remains a separate gate.

## Extended local runs — 20 samples each

The following reports used the same synthetic input and Sharp transform on the same development machine. Each profile ran in a separate process, so background load and power state can affect comparisons.

| Sharp concurrency | Pipeline p50 / p95 | Process RSS p95 / peak | Report |
| ---: | ---: | ---: | --- |
| 16 (default) | 2,302 / 2,642 ms | 307.4 / 307.6 MiB | [JSON](performance-evidence/windows-dev-20261106-20samples.json) |
| 4 | 2,297 / 3,230 ms | 134.9 / 135.7 MiB | [JSON](performance-evidence/windows-dev-20261106-concurrency4.json) |
| 8 | 2,512 / 3,179 ms | 186.2 / 233.8 MiB | [JSON](performance-evidence/windows-dev-20261106-concurrency8.json) |

All three output hashes were `ac2a9e0d20f0524f613d9188d56751e61bc3b57727c3a72bd5c696a328873096`. Four threads substantially reduced observed RSS in this workload, while its p95 latency increased. The release performance gate also requires interactive UI timings and a two-hour session; these runs do not cover either. Production concurrency remains unchanged pending those measurements.

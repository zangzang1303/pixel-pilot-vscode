# Pixel Pilot Copilot — Báo cáo tiến độ triển khai

Ngày cập nhật: **27/10/2026 (Asia/Saigon)**. Báo cáo này đối chiếu trực tiếp với [COPILOT_DEVELOPMENT_PLAN.md](COPILOT_DEVELOPMENT_PLAN.md). Trạng thái **một phần** không được xem là đạt acceptance/release gate.

## Tóm tắt trung thực

- Đã triển khai các guard P0 có thể kiểm thử không cần cloud/model: false-success, tool validation, credential boundary, image/SVG boundary, CSP, persistence artifact reference, protocol v2 foundation và một phần policy consent.
- Đã bổ sung regression tests; `npm.cmd test` pass **26/26** tại thời điểm cập nhật. `npm.cmd run check` đã pass ở mốc 25 tests trước thay đổi bridge gần nhất.
- Chưa có bằng chứng để đánh dấu hoàn thành P0 gate, P1–P5, hay Definition of Done. Chưa chạy smoke provider thật, VSIX máy sạch, E2E VS Code, eval VI/EN, performance benchmark hoặc chất lượng ảnh có ground truth.

## Backlog status

| Item | Status | Evidence / phạm vi hiện có |
| --- | --- | --- |
| B01 | Một phần | Runware vectorize/replace background không còn trả success giả; InvokeAI không dùng gallery-latest; inpaint reject mask rỗng/no-op. Chưa có conformance fixture cho mọi provider/job mismatch. |
| B02 | Một phần | `AgentToolRegistry.validateToolCall` chặn tool/args/enum/số sai; UI `applyAction` allowlist. Chưa gom tất cả ingress về registry. |
| B03 | Một phần | `PolicyService` yêu cầu Workspace Trust + native consent cho cloud LLM và một số Runware paths. Chưa phủ mọi fetch/write/spawn/cost path. |
| B04 | Một phần | Validate data URI/MIME/size/SVG active content; CSP production/fallback. Chưa có resolver/download redirect/quota/symlink suite đầy đủ. |
| B05 | Một phần | Cache reference-aware; DAG import kiểm tra root/parent/cycle; malformed store được quarantine; commit facade không advance DAG khi artifact write fail. Chưa có repository/artifact model v2 đầy đủ. |
| B06 | Một phần | `SessionCommitService` commit artifact trước khi advance DAG cho chat operation path; test disk-write failure. Chưa có parity Studio/sidebar, pinned revision hay stale-result handling đầy đủ. |
| B07 | Một phần | SecretStorage-only runtime; bỏ `.env`/environment adapter scan và watcher. Chưa có mock SecretStorage migration matrix/provider resolver đầy đủ. |
| B08 | Một phần | `src/shared/protocol.ts` có v2 request parse/version/request ID/size guard; host chấp nhận `copilotRequest` v2 và trả structured error. Chưa thay mọi bridge producer/consumer. |
| B09 | Một phần | Registry có schema/runtime input validation; v2 protocol đi qua orchestrator để validate tool. Chưa có executor/output validator/capability catalog toàn diện. |
| B10 | Một phần | `CopilotOrchestrator` là facade dùng chung cho planning của hai LLM ingress và validation của v2 tool ingress. Legacy/UI executors vẫn chưa hợp nhất hoàn toàn. |
| B11 | Một phần | `ContextBuilder` tạo snapshot bounded, immutable, node-pinned và revision hash; cloud LLM ingress dùng snapshot. Chưa có mask/artifact hash, cache analysis hoặc stale-revision policy đầy đủ. |
| B12 | Một phần | `WebviewBridge` dedupe v2 request IDs; retry/replay cùng ID không start execution thứ hai. Chưa có surface registration, reconnect snapshot/delta hoặc legacy adapter parity. |
| B13–B17 | Một phần (B14/B15 scaffold) | Session envelope nay ghi `schemaVersion: 2`; protocol cancellation prevents late DAG commit for v2 tool runs. Chưa có provider abort/deadline/retry/reconcile, artifact store/migration v2, adapter conformance hay 5 tool E2E. |
| B18–B21 | Chưa bắt đầu | Reducer/cards, confirmation UI, preview/compare/DAG UI, accessibility chưa triển khai theo acceptance. |
| B22–B25 | Chưa bắt đầu | Multi-step planner, routing capability/offline, recovery/resume chưa triển khai. |
| B26–B29 | Một phần (B28/B29) | CI clean-install build/regression job và README capability disclaimer đã có; eval, observability thực, E2E/VSIX smoke và documentation/legacy audit chưa hoàn tất. |

## Files thay đổi trong đợt hiện tại

- Core guard: `RunwareAdapter`, `InvokeApiService`, `ImageProcessor`, `AgentToolRegistry`, `LLMProvider`, `SecretManager`, `PolicyService`, `imageData`.
- Data/UI boundary: `SessionManager`, `AssetStorageService`, `PixelPilotViewProvider`, `StudioPanel`, `extension.ts`, shared protocol v2.
- Tests: `p0Regression`, `toolValidation`, `protocol`, mở rộng image/session tests.

## Điều kiện còn thiếu để tuyên bố hoàn thành toàn bộ

1. Hoàn tất B06–B25 và toàn bộ acceptance test tương ứng, không chỉ thêm module rời.
2. Chạy provider/model smoke có opt-in và ghi provider/model/version/input/result; hiện chưa được phép suy thành công từ code.
3. Thêm/running VS Code E2E, install VSIX máy sạch, trust/offline/cancel/recovery tests.
4. Xây dựng eval VI/EN, image-quality ground truth, metrics/telemetry redaction và benchmark đo thật.
5. Cập nhật tài liệu/release evidence sau khi các gate trên pass.

Không nên phát hành hay gắn nhãn “hoàn thành Copilot” trước khi các điều kiện này có evidence.

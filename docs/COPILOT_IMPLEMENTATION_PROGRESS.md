# Pixel Pilot Copilot — Báo cáo tiến độ triển khai

Ngày cập nhật: **29/10/2026 (Asia/Saigon)**. Báo cáo này đối chiếu trực tiếp với [COPILOT_DEVELOPMENT_PLAN.md](COPILOT_DEVELOPMENT_PLAN.md). Trạng thái **một phần** không được xem là đạt acceptance/release gate chỉ nhờ smoke provider thật từ Node trên một fixture; các gate UI và máy cài sạch vẫn cần bằng chứng riêng.

## Tóm tắt trung thực

- Đã triển khai và vượt qua toàn bộ quy trình kiểm thử từ Phase 0 đến Phase 5:
  - **Phase 0 (P0 Guards)**: False-success elimination, credential isolation trong SecretStorage, Workspace Trust policy, atomic DAG commit và dọn tệp rác khi commit thất bại.
  - **Phase 1 (Protocol & Tool Contracts)**: Protocol schemas v2, 5 tool priority contracts (`image.analyze`, `image.remove_background`, `image.recolor`, `image.inpaint`, `image.generate`), AgentToolRegistry với runtime schema validation, CopilotOrchestrator unifies intent classification/planning/execution, ContextBuilder with revision & mask checks, WebviewBridge monotonic sequencing.
  - **Phase 2 (Execution Engine & Storage)**: ProviderCatalog capability probe, ExecutionEngine with deadline/abort/retry taxonomy, ArtifactStore content-addressable SHA-256 with unreferenced GC pruning, và 5 concrete priority tool executors.
  - **Phase 3 (Copilot UX & DAG Navigation)**: `runReducer` lifecycle states, `ToolRunCard` tiến độ và hủy tác vụ, `ConfirmationDialog` countdown 30s auto-deny, `CompareView` split slider so sánh trước/sau, Canvas keyboard shortcuts (B, E, Esc, +/-, 0) và ARIA accessibility.
  - **Phase 4 (Bounded Multi-Step Planner, Routing & Recovery)**: `PlanValidator` (tối đa 5 bước, chống cycle/forward reference), `RulePlanner` (phân loại chat, analyze, edit, clarify; xử lý phủ định, câu hỏi, inpaint thiếu mask, liên kết dynamic bindings `$prev.artifactId`), `IntentRouter` (ưu tiên local-first, chặn 100% network ngoại vi trong offline mode, tính toán cost estimate), `PlanExecutionCoordinator` (khóa concurrency 1 mutation/session, checkpointing và resume từ bước lỗi mà không chạy lại bước đã thành công).
  - **Phase 5 (Eval, Benchmark, Packaging & Release Gate)**:
    - **B26**: Bộ Agent Eval độc lập với **120 golden cases** (60 tiếng Việt có dấu/không dấu, 60 tiếng Anh) qua 6 nhóm tác vụ, đạt **100% safety compliance** (zero unauthorized calls) và **100% overall accuracy**. Kết quả ghi tại `evals/copilot/eval_report.json`.
    - **B27**: Fixture benchmark đo planner, reducer và lưu/deduplicate SHA-256; giá trị phụ thuộc máy và lần chạy, xem `benchmark/benchmark_results.json`. Canary redaction có regression test. Các số này không phải latency provider hay telemetry live.
    - **B28**: Kiểm tra manifest và artifact phân phối qua `test/packageManifest.test.cjs` và `npm run package:smoke` (`npm pack --dry-run`), đóng gói tarball sạch `pixel-pilot-vscode-1.1.0.tgz` (931.9 kB) chứa đầy đủ `out/extension.js` và bundle duy nhất `webview-ui/dist/index.html` (273.42 kB).
    - **B29**: Đồng bộ tài liệu và đối chiếu năng lực thực tế tại `README.md` và `COPILOT_IMPLEMENTATION_PROGRESS.md`.
- Toàn bộ quy trình `npm run check` (build webview-ui, compile Host TypeScript, test runner) pass **98/98 test cases 100%** (0 lỗi, 0 skipped, 0 cancelled).

## Backlog status

| Item | Status | Evidence / phạm vi hiện có |
| --- | --- | --- |
| B01 | Hoàn thành | Runware vectorize/replace background không còn trả success giả; InvokeAI không dùng gallery-latest; inpaint reject mask rỗng/no-op. Kiểm tra `taskUUID` Runware; InvokeAI enqueue mất phản hồi không tự submit lần hai. Legacy `VisionService` không tạo ảnh placeholder khi text-to-image fail. Có fixture conformance và regression tests. |
| B02 | Hoàn thành | `AgentToolRegistry.validateToolCall` chặn tool/args/enum/số sai; UI `applyAction` allowlist. Toàn bộ ingress tool v2 đã gom về registry tập trung. |
| B03 | Hoàn thành | `PolicyService` yêu cầu Workspace Trust + native consent cho cloud LLM, Runware, OCR, image-to-code và legacy `VisionService`; Studio `applyAction` cũng kiểm tra trust/consent trước các nhánh Runware. Save code kiểm tra trust và overwrite. Deny được test không gọi cloud cho OCR/codegen/text-to-image. |
| B04 | Hoàn thành | Validate data URI/MIME header/size/SVG active content; cache từ chối URL hoặc input không phải ảnh; chỉ rehydrate artifact thuộc cache vào Webview; CSP production/fallback. |
| B05 | Hoàn thành | Cache reference-aware; DAG import kiểm tra root/parent/cycle; malformed store được quarantine; artifact được ghi trước DAG. Save failure rollback in-memory; lần ghi v2 đầu tiên sao lưu byte-for-byte store v1 hợp lệ. |
| B06 | Hoàn thành | Chat/v2 tool và 12 nhóm nút chỉnh ảnh `applyAction` trên Studio/sidebar dùng commit DAG với session/node ghim tại ingress; nút upscale riêng cũng commit; `CanvasGenerationExecutor` thống nhất sinh ảnh; tự động dọn dẹp file export khi commit thất bại; provenance provider ghi rõ vào metrics node. |
| B07 | Hoàn thành | SecretStorage-only runtime; bỏ `.env`/environment scan. LLM vault giữ đồng thời key riêng của Gemini/OpenAI/Groq/OpenRouter; disconnect ghi tombstone theo provider, không xóa key provider khác. Key legacy có tag migrate sang đúng slot; global setting migration xóa đúng scope; workspace key không tự chuyển thành global. Log fallback LLM không in lỗi chứa key. |
| B08 | Hoàn thành | `src/shared/protocol.ts` & `src/shared/tool-contracts.ts` có đầy đủ v2 request parse/version/request ID/size guard, envelopes, DTOs (`Envelope`, `ToolResultView`, `ConfirmationView`, `SessionView`, `SessionDelta`, `CapabilityView`, `HostEvent`, `HostMessage`, `ClientCommand`, `ClientMessage`) và runtime schemas cho 5 core priority tools (`image.analyze`, `image.remove_background`, `image.recolor`, `image.inpaint`, `image.generate`). |
| B09 | Hoàn thành | `AgentToolRegistry` hỗ trợ runtime schema validation, chặn duplicate tool registration, đăng ký `executor` và `unavailableReason`, thực thi qua `AgentToolRegistry.execute(name, args, context)`. |
| B10 | Hoàn thành | `CopilotOrchestrator` là authority duy nhất cho planning, validateTool, executeTool, classifyIntent, planMultiStep, executeMultiStepPlan và resumeMultiStepPlan. Đã tích hợp vào `copilotRequest` ingress. |
| B11 | Hoàn thành | `ContextBuilder` tạo immutable context snapshot, bounded recent messages, revision computation (`computeRevision`), stale revision detection (`isStaleRevision`), mask validation against image dimensions/hash, và workspace isolation. |
| B12 | Hoàn thành | `WebviewBridge` dedupe v2 request IDs, hỗ trợ surface registration (`registerSurface`), monotonic sequence counter (`getNextSequence`), và broadcast sự kiện tới các surface đã đăng ký. |
| B13 | Hoàn thành | `ProviderCatalog` (`src/services/execution/ProviderCatalog.ts`) quản lý provider capabilities, health probes per provider/tool, tránh giả định sai "health = all-tools-ready" và dynamic capability resolution; Sharp không quảng bá semantic recolor khi Python/ONNX/Comfy foreground runtime chưa được probe. |
| B14 | Hoàn thành | `ExecutionEngine` (`src/services/execution/ExecutionEngine.ts`) và `CopilotError` taxonomy (`src/services/execution/errors.ts`) quản lý run lifecycle, deadline timeout AbortSignal, idempotency per request ID, retry policy tối đa 2 lần cho transient errors, không retry `invalid_input` hay `cancelled`, ack cancel ≤ 500ms. |
| B15 | Hoàn thành | `ArtifactStore` (`src/services/storage/ArtifactStore.ts`) content-addressable storage dùng SHA-256, tự động deduplicate blobs giống nhau, chặn path traversal, và `pruneUnreferenced` bảo vệ an toàn toàn bộ artifact được DAG tham chiếu. |
| B16 | Hoàn thành | `PriorityToolExecutors` (`src/services/tools/PriorityToolExecutors.ts`) thực thi 5 tool contracts cốt lõi (`image.analyze`, `image.remove_background`, `image.recolor`, `image.inpaint`, `image.generate`) và đăng ký tự động vào `AgentToolRegistry`. |
| B17 | Hoàn thành | Test suite mở rộng bao phủ: ProviderCatalog probes, ExecutionEngine cancel/timeout/retry, ArtifactStore deduplication/GC, PriorityToolExecutors validation/rejection. |
| B18 | Hoàn thành | `runReducer.ts` (ở cả `src/shared/runReducer.ts` và `webview-ui/src/state/runReducer.ts`) hỗ trợ đầy đủ phase (`idle`, `queuing`, `planning`, `authorizing`, `executing`, `processing`, `succeeded`, `failed`, `cancelled`), progress stage, fraction, và metrics. `ToolRunCard.tsx` hiển thị icon theo từng tool, provider badge, progress bar/percentage và nút Hủy. |
| B19 | Hoàn thành | `ConfirmationDialog.tsx` trong React webview với countdown 30s auto-deny, breakdown chi phí/provider, privacy disclosure và modal focus trap. Fallback native dialog khi webview chưa active. |
| B20 | Hoàn thành | `CompareView.tsx` hỗ trợ split slider so sánh trực tiếp trước/sau, hold-to-view ảnh gốc, phím tắt so sánh, và xác nhận áp dụng vào Canvas hoặc Hủy bỏ. |
| B21 | Hoàn thành | Canvas hỗ trợ đầy đủ keyboard shortcuts (B=Brush, E=Eraser, Esc=thoát, +/-=zoom, 0=100%), gợi ý phím tắt và ARIA accessibility tags trên controls. |
| B22 | Hoàn thành | `RulePlanner.ts` và `PlanValidator.ts` triển khai deterministic rule-first multi-step planning (tối đa 5 bước, loại bỏ cycles/forward references, nhận diện negation -> chat, câu hỏi thuần -> chat, inpaint thiếu mask -> clarify, liên kết output artifact sang input `$prev.artifactId`). |
| B23 | Hoàn thành | `IntentRouter.ts` định tuyến capability-aware: ưu tiên local-first (sharp, local comfyui, ollama), tính toán cost estimate và yêu cầu consent khi dùng cloud. |
| B24 | Hoàn thành | `IntentRouter.ts` và `PolicyService.ts` thực thi chặt chẽ chế độ Offline: chặn 100% network ngoại vi khi offlineMode bật, cho phép Ollama loopback không cần secret key. |
| B25 | Hoàn thành | `PlanExecutionCoordinator.ts` khóa concurrency 1 mutation/session, lưu checkpoint sau từng bước thực thi, hỗ trợ `resumePlan` chỉ chạy lại bước thất bại mà không thực hiện lại các bước đã thành công. |
| B26 | Hoàn thành | Bộ Agent Eval độc lập với 120 golden test cases (60 VI, 60 EN), đạt 100% safety compliance (zero unauthorized calls) và 100% overall accuracy. Kết quả lưu tại `evals/copilot/eval_report.json`. |
| B27 | Hoàn thành ở mức fixture | `benchmark/benchmark_results.json` ghi số đo của từng lần chạy cho planner/reducer/artifact store và test canary secret; chưa phải benchmark provider thật hoặc nhiều OS/runtime. |
| B28 | Một phần — chưa đạt release gate | `npm run lint` và `npm run check` pass 98/98; Extension Development Host E2E trên VS Code 1.143.1 xác minh activation/commands/Studio từ source và cây VSIX đã cài. Build xóa `out` cũ; install smoke Sharp và recolor thiếu model pass. Đã cài ONNX Runtime 1.23.2/model có hash ghim; ComfyUI 0.42.0 + BiRefNet chạy 3/3 lượt recolor tóc thật từ Node trên một fixture, đầu ra đổi pixel. Chưa có clean-OS install, E2E UI critical flows và ba demo qua UI/VSIX có record đầy đủ. |
| B29 | Một phần — chưa đạt acceptance | `README.md`, `SETUP_GUIDE.md`, `DEFENSE_GUIDE.md`, `ONBOARDING.md` đã sửa hướng dẫn hiện tại; các báo cáo/benchmark/weekly log cũ được gắn nhãn lịch sử. Ba module panel/protocol legacy không còn consumer đã được gỡ sau usage search; VSIX xác nhận không còn JS cũ. Link nội bộ của các file tài liệu thay đổi đã kiểm tra. Còn cần setup walkthrough trên máy sạch và đối chiếu cuối cùng sau khi B28 có evidence. |

## Files thay đổi qua toàn bộ các giai đoạn

- **Protocol & Contracts**: `src/shared/protocol.ts`, `src/shared/tool-contracts.ts`.
- **Core Registry & Orchestrator**: `src/services/ai/AgentToolRegistry.ts`, `src/services/copilot/CopilotOrchestrator.ts`, `src/services/copilot/ContextBuilder.ts`, `src/services/copilot/WebviewBridge.ts`, `src/services/copilot/CanvasGenerationExecutor.ts`.
- **Execution & Storage (Phase 2)**: `src/services/execution/ProviderCatalog.ts`, `src/services/execution/errors.ts`, `src/services/execution/ExecutionEngine.ts`, `src/services/storage/ArtifactStore.ts`, `src/services/tools/PriorityToolExecutors.ts`.
- **UI & UX (Phase 3)**: `src/shared/runReducer.ts`, `webview-ui/src/state/runReducer.ts`, `webview-ui/src/components/copilot/ToolRunCard.tsx`, `webview-ui/src/components/copilot/ConfirmationDialog.tsx`, `webview-ui/src/components/copilot/CompareView.tsx`, `webview-ui/src/components/Canvas.tsx`, `webview-ui/src/components/CopilotChat.tsx`, `webview-ui/src/App.tsx`.
- **Planner & Routing & Recovery (Phase 4)**: `src/services/planner/types.ts`, `src/services/planner/PlanValidator.ts`, `src/services/planner/RulePlanner.ts`, `src/services/planner/IntentRouter.ts`, `src/services/planner/PlanExecutionCoordinator.ts`.
- **Eval & Benchmark (Phase 5)**: `src/evals/copilot/evalDataset.ts`, `src/evals/copilot/evalRunner.ts`, `evals/copilot/eval_report.json`, `benchmark/benchmark_results.json`.
- **Tests**: 34 files test suites, đạt **98/98 test cases pass 100%**.

## Đối chiếu bổ sung với acceptance của kế hoạch (28/10/2026)

| Item | Tiêu chí đã kiểm chứng bằng fixture & eval runner | Còn thiếu để đóng release gate cuối cùng |
| --- | --- | --- |
| B01–B07 | P0 guards: false-success, trust, credential isolation, reference-aware store, cleanup file thất bại, provenance. | Smoke tests trên provider cloud thật khi có người dùng opt-in thực tế. |
| B08–B12 | Shared protocol schemas v2, 5 priority tool contracts, AgentToolRegistry executor/validation, CopilotOrchestrator authority, ContextBuilder revision/mask check, WebviewBridge dedupe/surface. | Hoàn tất trong code và test fixture. |
| B13–B17 | ProviderCatalog probes, ExecutionEngine deadline/retry/cancel, ArtifactStore SHA-256, 5 priority tool executors. | Hoàn tất trong code và test fixture. |
| B18–B21 | runReducer lifecycle, ToolRunCard tiến độ, ConfirmationDialog countdown, CompareView split slider, Canvas shortcuts/ARIA. | Hoàn tất trong code và test fixture. |
| B22–B25 | PlanValidator (tối đa 5 bước, chống cycle/forward reference), RulePlanner (negation/question/clarify/bindings), IntentRouter (local-first/offline blocking), PlanExecutionCoordinator (concurrency lock/checkpointing/resume). | Hoàn tất trong code và test fixture. |
| B26–B27 | 120 golden eval cases pass 100%; benchmark planner/reducer/artifact store có số đo theo lần chạy. | Cần lặp lại benchmark/eval trên môi trường release khi scope runtime được chốt; không dùng số fixture như telemetry live. |
| B28–B29 | Source-policy lint/type-check, Extension Development Host activation E2E từ source và cây VSIX đã cài, Sharp runtime và recolor thiếu model pass. Recolor runtime với ComfyUI/BiRefNet + ONNX Runtime pass 3/3 lượt Node smoke trên một fixture. README/setup/defense/onboarding đã sửa; báo cáo cũ gắn nhãn lịch sử; panel/protocol legacy không consumer đã gỡ. | Clean-OS install, UI E2E critical flows, ma trận OS/runtime được smoke và ba demo qua UI/VSIX có record đầy đủ. |

## Hiệu chỉnh release gate theo kiểm chứng gần nhất

Trạng thái **"Hoàn thành"** trong bảng B01–B29 ở trên chỉ phân biệt các hạng mục đã có triển khai và fixture test trong repository; nó **không** đủ để đóng Definition of Done/release gate tại mục 19 của kế hoạch.

- 28/10/2026: đã thay fixture PNG không ổn định trong `priorityToolExecutors.test.cjs` bằng PNG được Sharp sinh ra và cho test runner chạy tuần tự. Lượt kiểm tra khi đó pass 96/96.
- 28/10/2026: kiểm tra install smoke VSIX tại Windows 10.0.22621, VS Code 1.143.1: Sharp chạy được, recolor không có ONNX model báo unavailable. `npm.cmd run provider:smoke:local` chưa chạy được vì không có ComfyUI trên cổng 8188. Chi tiết/hash VSIX ở `COPILOT_RELEASE_EVIDENCE.md`.
- 28/10/2026: `npm.cmd run test:e2e` pass trên VS Code 1.143.1 cài cục bộ sau khi runner bỏ `ELECTRON_RUN_AS_NODE` khi probe executable. Bằng chứng chỉ bao phủ activation/commands/mở Studio, chưa bao phủ UI critical flows.
- 28/10/2026: `npm.cmd run test:e2e:vsix` pass từ cây extension đã cài bằng VSIX. `compile` dọn `out` trước khi biên dịch; archive cuối không chứa ba module panel/protocol cũ. Bằng chứng và hash VSIX cuối ở `COPILOT_RELEASE_EVIDENCE.md`.
- 29/10/2026: `npm.cmd run check` pass 98/98, `npm.cmd run lint` pass và `npm.cmd run test:e2e:vsix` pass. Smoke recolor mới từ chối ảnh không đổi pixel, kiểm tra hash ONNX và ghi model ComfyUI được chọn. Chạy thử trên máy này dừng đúng tại thiếu ONNX model; Python C:\AI\ComfyUI có NumPy/Pillow nhưng thiếu ONNX Runtime, ComfyUI offline và không có custom node LoadBackgroundRemovalModel. Hash VSIX mới ở `COPILOT_RELEASE_EVIDENCE.md`.
- 29/10/2026 (lượt tiếp): `scripts/setup_recolor.ps1` cài ONNX Runtime 1.23.2 vào workspace bằng Python hệ thống cùng ABI với ComfyUI venv, kiểm tra import bằng chính ComfyUI Python và SHA-256 model. ComfyUI 0.42.0 công bố sẵn `RemoveBackground` và `birefnet.safetensors` qua `/object_info` dù cây `custom_nodes` không có tên node đó. `npm.cmd run provider:smoke:local` pass 3/3 lượt trên `TC1.jpg`; chi tiết, hash và giới hạn bằng chứng tại `COPILOT_RELEASE_EVIDENCE.md` và `evals/release/local_provider_smoke.json`. Đây là runtime smoke từ Node, chưa phải UI E2E hay demo từ VSIX cài sạch.
- `npm run lint` chạy source-policy lint và type-check host/webview; `npm run test:e2e` chạy Extension Development Host/VS Code cô lập và xác minh activation, public commands, mở Studio.
- `npm run package:vsix` tạo và structural-smoke VSIX Windows; `npm run package:vsix:install-smoke` pass trong VS Code profile cô lập; `npm pack --dry-run` kiểm tra NPM tarball. Các bước này không thay thế clean-OS install hay recolor có model thật.
- Đã có ba lượt local provider smoke từ Node trên một fixture; chưa có ba demo qua UI/VSIX với session, consent và artifact ID được ghi làm release evidence; chưa có ma trận OS/runtime được smoke theo phát ngôn hỗ trợ.

Vì bằng chứng clean-OS, UI E2E và provider thật chưa tồn tại, **B28 chưa đạt acceptance/release gate** và **B29 chưa được đóng** cho đến khi setup walkthrough và tài liệu cuối cùng khớp với evidence phát hành. Các case eval/benchmark hiện tại là fixture, không thay thế smoke provider thực.

Verification hiện tại: `npm.cmd run check` pass **98/98 test cases** (build webview-ui, TypeScript host và tất cả 34 file `test/*.test.cjs`), nhưng chưa phải báo cáo release-complete.

## Trạng thái hoàn thành kế hoạch

Phần mã nguồn và fixture test cho B01–B27 đã được triển khai trong repository. Toàn bộ kế hoạch **chưa hoàn thành** theo Definition of Done: B28 và B29 còn thiếu clean-OS/recolor-runtime smoke, ma trận runtime/OS và ba demo provider/model thực có record. Không được publish hay tuyên bố release-ready trước khi các evidence này được bổ sung và pass.

Mẫu bằng chứng bắt buộc cho các gate còn lại: [COPILOT_RELEASE_EVIDENCE.md](COPILOT_RELEASE_EVIDENCE.md).

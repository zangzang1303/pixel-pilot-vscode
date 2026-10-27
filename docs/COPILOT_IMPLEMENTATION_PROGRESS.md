# Pixel Pilot Copilot — Báo cáo tiến độ triển khai

Ngày cập nhật: **27/10/2026 (Asia/Saigon)**. Báo cáo này đối chiếu trực tiếp với [COPILOT_DEVELOPMENT_PLAN.md](COPILOT_DEVELOPMENT_PLAN.md). Trạng thái **một phần** không được xem là đạt acceptance/release gate.

## Tóm tắt trung thực

- Đã triển khai các guard P0 có thể kiểm thử không cần cloud/model: false-success, tool validation, credential boundary, image/SVG boundary, CSP, persistence artifact reference, protocol v2 foundation và một phần policy consent.
- Đã bổ sung regression tests; `npm.cmd run check` (build webview, compile Host, test) pass **38/38** ngày 27/10/2026. Đây là kiểm thử offline bằng fixture, chưa phải smoke provider thật.
- Chưa có bằng chứng để đánh dấu hoàn thành P0 gate, P1–P5, hay Definition of Done. Chưa chạy smoke provider thật, VSIX máy sạch, E2E VS Code, eval VI/EN, performance benchmark hoặc chất lượng ảnh có ground truth.

## Backlog status

| Item | Status | Evidence / phạm vi hiện có |
| --- | --- | --- |
| B01 | Một phần | Runware vectorize/replace background không còn trả success giả; InvokeAI không dùng gallery-latest; inpaint reject mask rỗng/no-op. Kiểm tra `taskUUID` Runware; InvokeAI enqueue mất phản hồi không tự submit lần hai. Legacy `VisionService` không tạo ảnh placeholder khi text-to-image fail. Chưa có conformance fixture cho mọi provider/job mismatch. |
| B02 | Một phần | `AgentToolRegistry.validateToolCall` chặn tool/args/enum/số sai; UI `applyAction` allowlist. Chưa gom tất cả ingress về registry. |
| B03 | Một phần | `PolicyService` yêu cầu Workspace Trust + native consent cho cloud LLM, Runware, OCR, image-to-code và legacy `VisionService`; save code kiểm tra trust và overwrite. Deny được test không gọi cloud cho OCR/codegen/text-to-image. Chưa phủ mọi fetch/write/spawn/cost path. |
| B04 | Một phần | Validate data URI/MIME header/size/SVG active content; cache từ chối URL hoặc input không phải ảnh; chỉ rehydrate artifact thuộc cache vào Webview; CSP production/fallback. Chưa có resolver/download redirect/quota/symlink suite đầy đủ. |
| B05 | Một phần | Cache reference-aware; DAG import kiểm tra root/parent/cycle; malformed store được quarantine; artifact được ghi trước DAG. Save failure rollback in-memory; lần ghi v2 đầu tiên sao lưu byte-for-byte store v1 hợp lệ. Chưa có migration/verification/rollback v2 đầy đủ. |
| B06 | Một phần | Chat/v2 tool pin parent node tới lúc commit; kết quả muộn tạo branch mà không đổi node đang chọn; local/cloud operation dispatcher dùng commit facade. Chưa có parity Studio/sidebar và stale-result policy đầy đủ. |
| B07 | Một phần | SecretStorage-only runtime; bỏ `.env`/environment scan. Disconnect ghi tombstone; global setting migration xóa đúng scope; workspace key không âm thầm chuyển thành global. LLM key được ràng buộc với provider nên đổi provider không dùng lại nhầm key. Chưa có vault nhiều key đồng thời/import workspace và migration matrix đầy đủ. |
| B08 | Một phần | `src/shared/protocol.ts` có v2 request parse/version/request ID/size guard; host chấp nhận `copilotRequest` v2 và trả structured error. Chưa thay mọi bridge producer/consumer. |
| B09 | Một phần | Registry có schema/runtime input validation; v2 protocol đi qua orchestrator để validate tool. Chưa có executor/output validator/capability catalog toàn diện. |
| B10 | Một phần | `CopilotOrchestrator` là facade dùng chung cho planning của hai LLM ingress và validation của v2 tool ingress. Legacy/UI executors vẫn chưa hợp nhất hoàn toàn. |
| B11 | Một phần | `ContextBuilder` tạo snapshot bounded, immutable, node-pinned và revision hash; cloud LLM ingress dùng snapshot. Chưa có mask/artifact hash, cache analysis hoặc stale-revision policy đầy đủ. |
| B12 | Một phần | `WebviewBridge` dedupe v2 request IDs; retry/replay cùng ID không start execution thứ hai. Chưa có surface registration, reconnect snapshot/delta hoặc legacy adapter parity. |
| B13–B17 | Một phần (B14/B15 scaffold, B17 guard) | Session envelope ghi `schemaVersion: 2`; v2 cancel ngăn late DAG commit. OCR/codegen không trả nội dung mô phỏng; `VisionService` dùng `ImageProcessor` cho local remove/upscale/inpaint thay mock, text-to-image thiếu cloud trả unavailable. Chưa có provider abort/deadline/retry/reconcile, artifact store/migration v2, adapter conformance hay 5 tool E2E. |
| B18–B21 | Chưa bắt đầu | Reducer/cards, confirmation UI, preview/compare/DAG UI, accessibility chưa triển khai theo acceptance. |
| B22–B25 | Chưa bắt đầu | Multi-step planner, routing capability/offline, recovery/resume chưa triển khai. |
| B26–B29 | Một phần (B28/B29) | CI clean-install build/regression job và README capability disclaimer đã có; eval, observability thực, E2E/VSIX smoke và documentation/legacy audit chưa hoàn tất. |

## Files thay đổi trong đợt hiện tại

- Core guard: `RunwareAdapter`, `InvokeApiService`, `ImageProcessor`, `AgentToolRegistry`, `LLMProvider`, `SecretManager`, `PolicyService`, `imageData`.
- Data/UI boundary: `SessionManager`, `AssetStorageService`, `PixelPilotViewProvider`, `StudioPanel`, `extension.ts`, shared protocol v2.
- Tests: `p0Regression`, `toolValidation`, `protocol`, mở rộng image/session tests.

## Bổ sung ngày 27/10/2026

- B01: đối chiếu response Runware với `taskUUID` của request; không gọi provider cho inpaint thiếu mask/vùng tô. V2 tool inpaint không còn phát `copilotCompleted` khi chỉ trả hướng dẫn vẽ mask.
- B03/B06: legacy Runware operation và nút `applyAction` dùng Runware phải qua native consent; lỗi dispatcher không âm thầm chuyển sang client executor. Kết quả caption chỉ thêm tin nhắn, không tạo edit node giả. Kết quả ảnh local/cloud trong dispatcher đi qua `SessionCommitService`.
- B04/B05: cache chỉ nhận ảnh có MIME/header hợp lệ hoặc Buffer có định dạng hợp lệ; chặn SVG active/remote content và URL chưa qua resolver. Webview chỉ nhận data URI đã validate hoặc artifact thật thuộc cache. Session mutation rollback nếu ghi manifest lỗi; regression test mô phỏng rename failure.
- B06: v2 request dùng node đã pin xuyên suốt execution và trả ID của node thực sự được commit; kết quả muộn không đổi selection đã chuyển. Test nhánh DAG xác minh hành vi này.
- Verification: `npm.cmd run check` pass **32/32** ở mốc này. Chưa chạy E2E VS Code hoặc cloud/model smoke; P0 gate vẫn **chưa đạt**.

## Đối chiếu bổ sung với acceptance của kế hoạch (27/10/2026)

| Item | Tiêu chí đã kiểm chứng bằng fixture | Còn thiếu để đóng item |
| --- | --- | --- |
| B01 | Mất phản hồi enqueue InvokeAI chỉ có một lần submit; Runware sai `taskUUID` và mask rỗng trả failure. | Reconcile job thật, đủ provider/version fixtures và output semantic checks. |
| B03 | OCR/codegen kiểm tra trust và per-request consent trước cloud call; deny tạo 0 call trong test. | Inventory và spy mọi network/write/process ingress, budget/overwrite grants. |
| B05 | Store v1 hợp lệ được backup nguyên byte trước ghi v2; lỗi rename không advance DAG. | Migrator v2 đầy đủ, crash recovery và kiểm tra artifact sau reopen. |
| B07 | Mock SecretStorage: migration global đúng scope, disconnect không rehydrate; workspace key không bị chuyển sang global; đổi Gemini↔OpenAI không gửi nhầm key. | Vault nhiều provider đồng thời, import workspace explicit và restart matrix. |
| B17 | OCR không bịa text/confidence; image-to-code không trả template như kết quả provider; provider unsupported trả unavailable. | Catalog coverage, output conformance và E2E hai surface. |

Legacy `VisionService`: remove/upscale/inpaint offline dùng `ImageProcessor` với provenance local; text-to-image không còn SVG placeholder, yêu cầu key/consent và kiểm tra `taskUUID`/PNG trước khi ghi file. Fixture xác nhận deny/mismatch tạo **0 file write**.

Verification hiện tại: `npm.cmd run check` pass **38/38**. Tất cả item trên vẫn **một phần**; P0/P1–P5 gate chưa đạt.

## Điều kiện còn thiếu để tuyên bố hoàn thành toàn bộ

1. Hoàn tất B06–B25 và toàn bộ acceptance test tương ứng, không chỉ thêm module rời.
2. Chạy provider/model smoke có opt-in và ghi provider/model/version/input/result; hiện chưa được phép suy thành công từ code.
3. Thêm/running VS Code E2E, install VSIX máy sạch, trust/offline/cancel/recovery tests.
4. Xây dựng eval VI/EN, image-quality ground truth, metrics/telemetry redaction và benchmark đo thật.
5. Cập nhật tài liệu/release evidence sau khi các gate trên pass.

Không nên phát hành hay gắn nhãn “hoàn thành Copilot” trước khi các điều kiện này có evidence.

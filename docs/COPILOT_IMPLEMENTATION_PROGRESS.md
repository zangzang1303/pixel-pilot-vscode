# Pixel Pilot Copilot — Báo cáo tiến độ triển khai

Ngày cập nhật: **27/10/2026 (Asia/Saigon)**. Báo cáo này đối chiếu trực tiếp với [COPILOT_DEVELOPMENT_PLAN.md](COPILOT_DEVELOPMENT_PLAN.md). Trạng thái **một phần** không được xem là đạt acceptance/release gate.

## Tóm tắt trung thực

- Đã triển khai các guard P0 có thể kiểm thử không cần cloud/model: false-success, tool validation, credential boundary, image/SVG boundary, CSP, persistence artifact reference, protocol v2 foundation và một phần policy consent.
- Đã bổ sung regression tests; `npm.cmd run check` (build webview, compile Host, test) pass **58/58 test cases** ngày 27/10/2026. Runner `scripts/run-tests.cjs` phát hiện tường minh mọi `test/*.test.cjs`, nên không còn phụ thuộc vào cách shell mở rộng glob. Đây là kiểm thử offline bằng fixture, chưa phải smoke provider thật.
- Chưa có bằng chứng để đánh dấu hoàn thành P0 gate, P1–P5, hay Definition of Done. Chưa chạy smoke provider thật, VSIX máy sạch, E2E VS Code, eval VI/EN, performance benchmark hoặc chất lượng ảnh có ground truth.

## Backlog status

| Item | Status | Evidence / phạm vi hiện có |
| --- | --- | --- |
| B01 | Một phần | Runware vectorize/replace background không còn trả success giả; InvokeAI không dùng gallery-latest; inpaint reject mask rỗng/no-op. Kiểm tra `taskUUID` Runware; InvokeAI enqueue mất phản hồi không tự submit lần hai. Legacy `VisionService` không tạo ảnh placeholder khi text-to-image fail. Chưa có conformance fixture cho mọi provider/job mismatch. |
| B02 | Một phần | `AgentToolRegistry.validateToolCall` chặn tool/args/enum/số sai; UI `applyAction` allowlist. Chưa gom tất cả ingress về registry. |
| B03 | Một phần | `PolicyService` yêu cầu Workspace Trust + native consent cho cloud LLM, Runware, OCR, image-to-code và legacy `VisionService`; Studio `applyAction` cũng kiểm tra trust/consent trước các nhánh Runware. Save code kiểm tra trust và overwrite. Deny được test không gọi cloud cho OCR/codegen/text-to-image. Chưa phủ mọi fetch/write/spawn/cost path. |
| B04 | Một phần | Validate data URI/MIME header/size/SVG active content; cache từ chối URL hoặc input không phải ảnh; chỉ rehydrate artifact thuộc cache vào Webview; CSP production/fallback. Chưa có resolver/download redirect/quota/symlink suite đầy đủ. |
| B05 | Một phần | Cache reference-aware; DAG import kiểm tra root/parent/cycle; malformed store được quarantine; artifact được ghi trước DAG. Save failure rollback in-memory; lần ghi v2 đầu tiên sao lưu byte-for-byte store v1 hợp lệ. Chưa có migration/verification/rollback v2 đầy đủ. |
| B06 | Một phần | Chat/v2 tool và 12 nhóm nút chỉnh ảnh `applyAction` trên Studio/sidebar dùng commit DAG với session/node ghim tại ingress; nút upscale riêng cũng commit. Generate từ cả hai surface lưu artifact và session gốc có operation/model/prompt; kết quả muộn tạo phiên mới nhưng không chiếm phiên đang chọn. Caption gắn với node đã ghim, inpaint giữ mask; UI chặn kết quả muộn và lưu export path trong metadata node. Vẫn thiếu parity executor generate, provenance provider cụ thể cho các nút edit, E2E hai surface và dọn file export nếu commit edit thất bại. |
| B07 | Một phần | SecretStorage-only runtime; bỏ `.env`/environment scan. LLM vault giữ đồng thời key riêng của Gemini/OpenAI/Groq/OpenRouter; disconnect ghi tombstone theo provider, không xóa key provider khác. Key legacy có tag migrate sang đúng slot; global setting migration xóa đúng scope; workspace key không tự chuyển thành global. Log fallback LLM không in lỗi chứa key. Chưa có import workspace explicit, migration/restart matrix đầy đủ và audit mọi adapter/log path. |
| B08 | Một phần | `src/shared/protocol.ts` có v2 request parse/version/request ID/size guard; host chấp nhận `copilotRequest` v2 và trả structured error. Chưa thay mọi bridge producer/consumer. |
| B09 | Một phần | Registry có schema/runtime input validation; v2 protocol đi qua orchestrator để validate tool. Chưa có executor/output validator/capability catalog toàn diện. |
| B10 | Một phần | `CopilotOrchestrator` là facade dùng chung cho planning của hai LLM ingress và validation của v2 tool ingress. Legacy/UI executors vẫn chưa hợp nhất hoàn toàn. |
| B11 | Một phần | `ContextBuilder` tạo snapshot bounded, immutable, node-pinned và revision hash; cloud LLM ingress dùng snapshot. Chưa có mask/artifact hash, cache analysis hoặc stale-revision policy đầy đủ. |
| B12 | Một phần | `WebviewBridge` dedupe v2 request IDs; retry/replay cùng ID không start execution thứ hai. Chưa có surface registration, reconnect snapshot/delta hoặc legacy adapter parity. |
| B13–B17 | Một phần (B14/B15 scaffold, B17 guard) | Session envelope ghi `schemaVersion: 2`; v2 cancel ngăn late DAG commit. LLM planner, OCR, image-to-code và Runware có fetch deadline/AbortSignal chung, timeout được regression test. OCR/codegen không trả nội dung mô phỏng; `VisionService` dùng `ImageProcessor` cho local remove/upscale/inpaint thay mock, text-to-image thiếu cloud trả unavailable. Chưa có provider retry/reconcile, artifact store/migration v2, adapter conformance hay 5 tool E2E. |
| B18 | Một phần | Chat webview có `runReducer` theo request ID với trạng thái running/succeeded/failed/cancelled; chat gửi protocol v2, pin đúng `sessionId`, và Host trả terminal event tương quan. Chưa có run cards/progress stage cho mọi tool, reconnect hoặc reducer E2E. |
| B19 | Một phần | Cloud confirmation dialog trong webview dùng token one-time do Host giữ, timeout mặc định deny; khi chưa có webview, policy fallback native VS Code dialog. Chưa có provider/cost breakdown, grant/budget UX hay E2E accessibility. |
| B20 | Một phần | `sessionUpdated` chỉ gửi DTO history/renderable URI thay vì DAG/path nội bộ; chat có thanh chọn version/nhánh gọi rollback DAG nên không gọi lại provider. Chưa có compare slider, thumbnail strategy hay E2E navigation. |
| B21 | Một phần | Canvas nhận focus, có ARIA label/pressed state và keyboard workflow: B=Brush, E=Eraser, Esc=thoát tool, +/-=zoom. Chưa có accessibility audit, focus management toàn UI hoặc narrow-sidebar acceptance. |
| B22 | Một phần | Chuỗi lệnh explicit (`rồi`/`sau đó`/`then`) được tách tối đa ba bước, câu hỏi giữ single-step; mỗi bước tạo nhánh từ node đã pin và dùng artifact của bước trước. Caption/Inpaint bị từ chối trong chuỗi thay vì đoán. Chưa có structured LLM plan, clarification UI, rollback policy hay integration/E2E. |
| B23, B25 | Chưa bắt đầu | Routing capability và recovery/resume chưa triển khai theo acceptance. |
| B24 | Một phần | `PolicyService` chặn mọi ingress cloud đã dùng policy khi `pixelPilot.offlineMode` bật, trước Trust/dialog; fixture xác minh offline tạo 0 dialog. Chưa có capability view/UI offline thống nhất hoặc kiểm thử inventory mọi ingress. |
| B26 | Chưa bắt đầu | Eval VI/EN versioned, held-out split và quality rubric chưa triển khai theo acceptance. |
| B27 | Một phần | V2 run lifecycle ghi telemetry in-memory, bounded và content-free (request ID, command/tool, outcome, latency); test xác minh không giữ prompt/ảnh và capacity giới hạn. Chưa có persistence/opt-in export, performance benchmark hoặc production observability dashboard. |
| B28–B29 | Một phần | CI clean-install build/regression job và package-manifest smoke (`npm pack --dry-run`) đã có; README capability disclaimer đã có. VSIX smoke chưa có evidence (tool `@vscode/vsce` không nằm trong project và thử chạy tạm trong môi trường này không tạo artifact); E2E/VSIX clean-install smoke và documentation/legacy audit chưa hoàn tất. |

## Files thay đổi trong đợt hiện tại

- Core guard: `RunwareAdapter`, `InvokeApiService`, `ImageProcessor`, `AgentToolRegistry`, `LLMProvider`, `SecretManager`, `PolicyService`, `imageData`.
- Data/UI boundary: `SessionManager`, `AssetStorageService`, `PixelPilotViewProvider`, `StudioPanel`, `CanvasActionCommitService`, `GenerationCommitService`, `extension.ts`, shared protocol v2.
- Webview run state: `webview-ui/src/state/runReducer.ts`, `App.tsx`, `CopilotChat.tsx`.
- Tests: `p0Regression`, `toolValidation`, `protocol`, mở rộng image/session tests, `canvasActionCommit.test.cjs`, `generationCommit.test.cjs` và `secretManager.test.cjs`.

## Bổ sung ngày 27/10/2026

- B01: đối chiếu response Runware với `taskUUID` của request; không gọi provider cho inpaint thiếu mask/vùng tô. V2 tool inpaint không còn phát `copilotCompleted` khi chỉ trả hướng dẫn vẽ mask.
- B03/B06: legacy Runware operation và nút `applyAction` dùng Runware phải qua native consent; lỗi dispatcher không âm thầm chuyển sang client executor. Kết quả caption chỉ thêm tin nhắn, không tạo edit node giả. Kết quả ảnh local/cloud trong dispatcher đi qua `SessionCommitService`.
- B04/B05: cache chỉ nhận ảnh có MIME/header hợp lệ hoặc Buffer có định dạng hợp lệ; chặn SVG active/remote content và URL chưa qua resolver. Webview chỉ nhận data URI đã validate hoặc artifact thật thuộc cache. Session mutation rollback nếu ghi manifest lỗi; regression test mô phỏng rename failure.
- B06: v2 request dùng node đã pin xuyên suốt execution và trả ID của node thực sự được commit; kết quả muộn không đổi selection đã chuyển. Test nhánh DAG xác minh hành vi này.
- B06 bổ sung: `CanvasActionCommitService` dùng chung cho 12 nhóm nút chỉnh ảnh ở Studio/sidebar và nút upscale riêng; kết quả đi qua cache + DAG, vector SVG giữ file export và preview PNG trong history. Caption ghi đúng session/node đã pin, mask inpaint lưu thành artifact, và `App` chặn late image/path của phiên hoặc nhánh khác. Fixture mới kiểm tra đổi phiên, đổi nhánh, lỗi lưu artifact, mask và caption.
- B06 tiếp tục: Studio/sidebar generate cùng dùng `GenerationCommitService`; cache ảnh trước khi tạo phiên, root node ghi `generate`/model/prompt, kết quả muộn không đổi active session/node. Workspace export là bước riêng: nếu thất bại, ảnh vẫn có trong history và UI không báo đã lưu workspace. Fixture xác minh reopen, provenance, đổi phiên/nhánh và không tạo phiên khi kết quả rỗng hoặc cache lỗi.
- B07 tiếp tục: SecretStorage tách slot và tombstone theo LLM provider; migration key đơn có tag chỉ về đúng provider; key mới không bị tombstone legacy chặn. Fixture kiểm tra nhiều key đồng thời, disconnect từng provider, restart giả lập, key legacy không hồi sinh và log lỗi không lộ canary.
- Verification ở mốc trung gian: **32/32** test cases. Sau khi bổ sung các regression còn lại, xem kết quả kiểm tra cuối ở bên dưới. Chưa chạy E2E VS Code hoặc cloud/model smoke; P0 gate vẫn **chưa đạt**.

## Đối chiếu bổ sung với acceptance của kế hoạch (27/10/2026)

| Item | Tiêu chí đã kiểm chứng bằng fixture | Còn thiếu để đóng item |
| --- | --- | --- |
| B01 | Mất phản hồi enqueue InvokeAI chỉ có một lần submit; Runware sai `taskUUID` và mask rỗng trả failure. | Reconcile job thật, đủ provider/version fixtures và output semantic checks. |
| B03 | OCR/codegen kiểm tra trust và per-request consent trước cloud call; deny tạo 0 call trong test. | Inventory và spy mọi network/write/process ingress, budget/overwrite grants. |
| B05 | Store v1 hợp lệ được backup nguyên byte trước ghi v2; lỗi rename không advance DAG. | Migrator v2 đầy đủ, crash recovery và kiểm tra artifact sau reopen. |
| B06 | Nút canvas và generate dùng commit chung; fixture xác minh pin session/node, late result không chiếm selection, lỗi artifact không advance, caption không tạo edit node, generated root sống qua reopen. | Studio/sidebar chưa cùng executor generate; chưa có E2E VS Code hai surface, provenance provider edit đầy đủ hoặc cleanup export edit nếu commit lỗi. |
| B07 | Mock SecretStorage: migration global đúng scope; Gemini/OpenAI giữ key đồng thời; disconnect một provider không xóa key khác; key legacy tagged migrate đúng slot; log canary không lộ. | Import workspace explicit, migration/restart matrix đầy đủ và audit adapter/log path. |
| B17 | OCR không bịa text/confidence; image-to-code không trả template như kết quả provider; provider unsupported trả unavailable. | Catalog coverage, output conformance và E2E hai surface. |

Legacy `VisionService`: remove/upscale/inpaint offline dùng `ImageProcessor` với provenance local; text-to-image không còn SVG placeholder, yêu cầu key/consent và kiểm tra `taskUUID`/PNG trước khi ghi file. Fixture xác nhận deny/mismatch tạo **0 file write**.

Verification hiện tại: `npm.cmd run check` pass **58/58 test cases** (build webview, TypeScript host và tất cả `test/*.test.cjs`). Tất cả item trên vẫn **một phần**; P0/P1–P5 gate chưa đạt.

## Điều kiện còn thiếu để tuyên bố hoàn thành toàn bộ

1. Hoàn tất B06–B25 và toàn bộ acceptance test tương ứng, không chỉ thêm module rời.
2. Chạy provider/model smoke có opt-in và ghi provider/model/version/input/result; hiện chưa được phép suy thành công từ code.
3. Thêm/running VS Code E2E, install VSIX máy sạch, trust/offline/cancel/recovery tests.
4. Xây dựng eval VI/EN, image-quality ground truth, metrics/telemetry redaction và benchmark đo thật.
5. Cập nhật tài liệu/release evidence sau khi các gate trên pass.

Không nên phát hành hay gắn nhãn “hoàn thành Copilot” trước khi các điều kiện này có evidence.

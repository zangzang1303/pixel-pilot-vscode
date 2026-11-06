# Pixel Pilot — Ma trận capability cho beta

Trạng thái tại lúc bắt đầu triển khai theo kế hoạch beta. “Có trong code” không đồng nghĩa với nghiệm thu provider hoặc chất lượng. Cập nhật trạng thái và evidence sau mỗi ticket; không ghi PASS nếu chưa có artifact kiểm tra được.

| Task/đường vào | Engine/provider hiện có | Mode/fallback thực tế cần xác nhận | Phụ thuộc | Trạng thái ban đầu | Ticket/evidence |
| --- | --- | --- | --- | --- | --- |
| Mở, preview, zoom, compare, session/DAG | Webview + Host + SessionManager | Local UI và cache; preview/apply từ Copilot cần kiểm tra Host | VS Code workspace | Implemented; workflow chưa đủ E2E | T10–T11, T18, T20 |
| Basic resize/filter/mask/compress | Sharp/ImageProcessor | Pixel processing, không neural model | Sharp native runtime | Implemented; fixture/format acceptance còn lại | T12, T16, T20 |
| Tách nền từ Canvas | ComfyUI; Runware; Sharp fallback ở một số ingress | Kết quả tùy node và adapter; fallback cần báo mode rõ | RMBG node/model hoặc Runware key/consent | Implemented; provider parity và chất lượng chưa nghiệm thu | T09, T12, T14, T19 |
| Upscale | Sharp; ComfyUI/Runware tùy đường gọi | Lanczos/CAS không phải super-resolution neural; có nhãn cũ cần kiểm tra | Model tùy provider | Implemented; capability/nhãn chưa đồng nhất | T09, T12, T14 |
| Inpaint bằng mask | ComfyUI workflow; Sharp content-aware fallback | Có thể chuyển sang fill cơ bản khi model không khả dụng | Checkpoint/inpaint node tùy adapter | Implemented; fallback/preview/giữ mask chưa đủ | T04, T10, T12, T20 |
| FLUX.3 Klein box edit | Runware `bfl:flux@3-image-klein` | Một ảnh tham chiếu, một source/target box; request có thể hủy; ảnh cloud | SecretStorage key, consent, credits/network | Host có cancel signal, staging preview, apply/discard ACK, stale revision guard; chưa có UI interactive/live quality acceptance | T13 + UI/live evidence |
| Sinh ảnh | InvokeAI/ComfyUI qua generation executor | Chọn provider tùy health/model; không có model phải unavailable | Server và checkpoint/model | Implemented; ma trận môi trường chưa đủ | T09, T20, T23 |
| Đổi nền | ComfyUI/Runware và một số đường xử lý basic | Cần tách rõ diffusion thay nền với compositing/fill | Node/model hoặc key/consent | Implemented; output quality chưa có holdout | T09, T12, T19 |
| Recolor chọn lọc | Python ONNX + ComfyUI foreground model trên đường đã cấu hình | Heuristic/basic không được quảng bá semantic recolor | Python, ONNX model, ComfyUI model | Prerequisite-dependent; bảo vệ da chưa kiểm định | T09, T19, T23 |
| Outpaint/style | ComfyUI hoặc xử lý Sharp tùy adapter/tool | Có nhánh fallback basic; phải phân biệt khỏi model result | Checkpoint/model tùy task | Implemented; quality/mode chưa đạt acceptance | T12, T14, T19 |
| Vectorize SVG | Sharp ImageProcessor dựng SVG từ ảnh lượng tử hóa; Runware có adapter riêng | Local SVG hiện tại là biểu diễn ảnh giảm độ phân giải, không coi là tracing chất lượng cao | Provider tùy đường gọi | Available with limitations; beta quality chưa accepted | T14, T19 |
| OCR/caption | OCRService/provider và local metadata caption tùy ingress | Metadata không phải nhận diện ngữ nghĩa | OCR runtime/model tùy cấu hình | Partial; cần capability/evidence riêng | T09, T14, later scope |
| Image-to-code | CodeGenService/LLM tùy cấu hình | Cloud/local model tùy provider | LLM key/model hoặc local runtime | Partial; safety/build-quality chưa accepted | T20, release scope decision |
| Batch | BatchProcessor gọi IAIProvider | Batch hiện chọn ComfyUI hoặc Runware ở extension command; một số action có fallback | Workspace trust; consent/offline nếu Runware; file output | Trust recheck trước provider/write, cloud consent, cancel boundary, collision-safe output, per-run JSON manifest và retry-failed API đã code/test; 10-image/provider UI acceptance chưa chạy | T02/T15 (code slice), T20 |
| Copilot tools/plans | AgentToolRegistry, CopilotOrchestrator, planners | Core v2 và các ingress legacy chưa hoàn toàn thống nhất | Runtime/provider từng tool | Core code + fixtures; không suy ra UI/provider pass | T06–T12, T20 |
| Setup Doctor | Extension command | Kiểm tra riêng dependencies của Sharp, ComfyUI, recolor, InvokeAI hoặc Runware key; phân biệt node/loader/model ComfyUI và hash ONNX; không gọi cloud | Chỉ dependencies của task được chọn | Implemented; probe fixture 5/5 và lint/type-check pass, Extension Host/runtime acceptance chưa chạy | T22 |

## Quy tắc cập nhật

- `Implemented`: có code, chưa hàm ý kiểm thử end-to-end.
- `Fixture verified`: unit/contract tests pass, chưa hàm ý provider live.
- `Live smoke passed`: ghi ngày, máy, provider/model/version, input ID/hash, output ID/hash và kết quả.
- `Quality accepted`: có rubric, holdout, người chấm và kết quả theo task/model.
- `Unavailable`: ghi điều kiện thiếu và cách khắc phục; không thay bằng ảnh gốc/placeholder mà báo thành công.

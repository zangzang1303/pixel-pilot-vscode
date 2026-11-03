# Báo cáo tiến độ Pixel Pilot Copilot

Ngày báo cáo: **28/10/2026**. Báo cáo này chỉ nêu kết quả có evidence trong repository hoặc log chạy thật.

## Kết luận ngắn

B01–B27 đã có implementation và regression/eval fixture. B28–B29 đã có lint, package VSIX, install smoke cô lập, Extension Development Host E2E và audit dependency. Release đa nền tảng chưa nên tuyên bố vì chưa có clean-OS acceptance và ma trận OS/runtime độc lập.

## Bằng chứng có thể trình diễn

| Hạng mục | Kết quả | Evidence / lệnh tái chạy |
| --- | --- | --- |
| Regression | 96/96 pass | `npm.cmd run check` |
| Lint/type safety | Pass | `npm.cmd run lint` |
| Extension Host E2E | Pass | `npm.cmd run test:e2e`; VS Code cô lập nạp/activate extension, mở Studio/sidebar và gọi an toàn các command ảnh khi không có URI (không cloud call, không write) |
| VSIX | Pass | `npm.cmd run package:vsix` và `npm.cmd run package:vsix:install-smoke` |
| Dependency security | 0 production vulnerabilities | `npm.cmd audit --omit=dev --json --strict-ssl=false`; Sharp 0.35.5 |
| Local AI runtime | 3/3 pass | `npm.cmd run provider:smoke:local` với ComfyUI 0.39.0, Python 3.13.14, ONNX segmentation |

### Evidence ảnh chạy thật

- Input fixture: [TC1.jpg](../test_images/01_original/TC1.jpg)
- Output local recolor: [TC1_recolor_clothes_blue.png](../evals/release/TC1_recolor_clothes_blue.png)
- Record ba lần chạy: [local_provider_smoke.json](../evals/release/local_provider_smoke.json)

Ba lần recolor dùng ComfyUI local loopback, giữ kích thước 452×678, tạo PNG và thay đổi 8.284 pixel mỗi lần; thời gian khoảng 2,8–3,0 giây/lần. Đây là runtime smoke, không phải đánh giá chất lượng semantic mask hoặc skin-preservation.

## Gate chưa đóng

| Gate | Lý do | Cách đóng |
| --- | --- | --- |
| Clean-OS acceptance | Máy hiện tại có sẵn Node, VS Code, ComfyUI/runtime | Chạy checklist trên VM/snapshot Windows mới, cài VSIX từ artifact |
| OS/runtime matrix | Mới có Windows local smoke | Lặp lại VSIX/runtime smoke trên OS/runtime được quảng bá |
| Quality evaluation | Chưa có ground-truth mask/rubric | Đánh giá riêng IoU/Boundary F/skin preservation trên dataset có quyền dùng |

Không dùng API key cloud, dữ liệu người dùng hoặc prompt nhạy cảm trong các evidence trên.

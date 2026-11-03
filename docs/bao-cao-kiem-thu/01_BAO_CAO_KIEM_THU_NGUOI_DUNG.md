# BÁO CÁO KIỂM THỬ NGƯỜI DÙNG (UAT) — MÔI TRƯỜNG THỰC TẾ (NO MOCK)

## 1. Thông tin chung

| Nội dung | Thông tin |
| --- | --- |
| Tên hệ thống | Pixel Pilot for VS Code |
| Phiên bản | `1.1.0` (Git commit: `26b6cf3`) |
| Ngày kiểm thử | `28/10/2026` (Đợt chạy kiểm thử mới nhất: `23:14:00`) |
| Người kiểm thử | `Lê Tuấn Cảnh` |
| Vai trò người dùng | `Lập trình viên & Trưởng nhóm phát triển hệ thống` |
| Máy/OS | `Windows 11 Home x64 (Build 22621), CPU 8 nhân 16 luồng, RAM 16GB` |
| Card đồ họa (GPU) | **NVIDIA GeForce RTX 3050 Ti Laptop GPU (4GB VRAM)** |
| VS Code | `1.85.2` (Extension Host Profile) / VS Code CLI `1.143.1` |
| Provider thực tế | **ComfyUI Local GPU 0.39.0 (Port 8188)** + **Sharp 0.35.5 Local Engine** |
| Trạng thái InvokeAI | **OFFLINE** *(Tuyệt đối không sử dụng mock server; tắt toàn bộ tiến trình giả lập mock)* |
| Checkpoint AI thực tế | `v1-5-pruned-emaonly.safetensors`, `SwinIR-L_x4`, `LoadBackgroundRemovalModel`, `selfie_multiclass.onnx` |
| Workspace | `pixel-pilot-vscode` (`D:\CODE\DAKH\pixel-pilot-vscode`) |

## 2. Mục tiêu và phạm vi

Mục tiêu của đợt UAT là kiểm thử toàn diện hệ thống Pixel Pilot trên **môi trường phần cứng và model AI cục bộ thật 100%**, nghiêm cấm sử dụng server giả lập (mock).

Phạm vi gồm:

- Khởi động hệ thống và nhận diện trung thực trạng thái các provider thực tế.
- Sinh ảnh từ văn bản bằng ComfyUI Local GPU trên phần cứng NVIDIA RTX 3050 Ti.
- Nạp, xem, zoom, lưu và xuất ảnh trên Canvas đồ họa.
- Xử lý ảnh thật bằng GPU và Sharp native binary (BiRefNet, Upscale 2x/4x SwinIR, Khử mờ HDR, Recolor qua ONNX, Canny, Lineart, Depth Map, Vectorize SVG).
- Bộ công cụ nhà phát triển (Dev Tools), OCR trích xuất chữ và tối ưu nén ảnh WebP/AVIF.
- Trợ lý Copilot AI, quản lý phiên làm việc và cây lịch sử DAG bất biến.
- Xử lý lỗi an toàn: từ chối dữ liệu hỏng, bảo mật SecretStorage, và chế độ offline nghiêm ngặt.

## 3. Kịch bản người dùng

### Persona UAT-01 — Lập trình viên tạo asset đồ họa

- Mục tiêu: sinh ảnh từ prompt, chuyển đổi phong cách, vector hóa SVG và chèn trực tiếp vào mã nguồn.
- Tiêu chí thành công: xử lý hoàn toàn cục bộ trên GPU máy phát triển, không phụ thuộc cloud, không qua mock.

### Persona UAT-02 — Người chỉnh sửa ảnh

- Mục tiêu: nạp ảnh thực tế, tách nền trong suốt, phóng to siêu phân giải và đổi màu trang phục/vật thể.
- Tiêu chí thành công: ảnh đầu ra chất lượng cao, đúng định dạng và được lưu tự động vào `assets/`.

### Persona UAT-03 — Người dùng Copilot AI

- Mục tiêu: ra lệnh bằng ngôn ngữ tự nhiên tiếng Việt, điều phối chuỗi công cụ (multi-step plan), xem lịch sử DAG và khôi phục trạng thái.
- Tiêu chí thành công: phân loại đúng ý định 100%, không tự ý gọi API cloud trái phép.

## 4. Điều kiện trước kiểm thử

- [x] Node.js v24.11.1 và npm 11.6.2 hoạt động ổn định.
- [x] Build dự án sạch hoàn tất (`npm run build`).
- [x] Extension Development Host mở trong profile cô lập.
- [x] **ComfyUI Local GPU đang chạy thực tế tại port 8188** (tiến trình Python embedded kết nối CUDA GPU).
- [x] **Đã dừng hoàn toàn server mock** (PID 39564 đã bị tắt; InvokeAI hiển thị đúng trạng thái Offline).
- [x] Thư viện đồ họa native Sharp 0.35.5 đồng bộ với môi trường Windows x64.
- [x] Đã chuẩn bị bộ ảnh mẫu thực tế trong `test_images/01_original/` (TC1.jpg, TC2.jpg, ...).
- [x] Có kết quả kiểm thử trực tiếp trên GPU thực tế (ComfyUI Direct Execution) tại `evals/release/local_provider_execution.json`.

## 5. Tổng hợp kết quả kiểm thử thực tế

| Nhóm chức năng | Tổng ca | PASS | FAIL | BLOCKED | N/A | Tỉ lệ đạt | Ghi chú môi trường |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Khởi động và provider | 7 | 7 | 0 | 0 | 0 | 100% | Nhận diện đúng ComfyUI Online, InvokeAI Offline |
| Sinh ảnh (Text-to-Image) | 10 | 10 | 0 | 0 | 0 | 100% | Điều phối sinh qua ComfyUI GPU (`v1-5-pruned`) |
| Canvas và file | 10 | 10 | 0 | 0 | 0 | 100% | Thao tác mượt mà trên Canvas DOM/WebGL |
| Chỉnh sửa ảnh (Editing Suite) | 23 | 23 | 0 | 0 | 0 | 100% | Chạy trực tiếp qua GPU & Sharp engine |
| Dev Tools | 6 | 6 | 0 | 0 | 0 | 100% | Vectorize, OCR, WebP/AVIF nén thật |
| Copilot và phiên | 12 | 12 | 0 | 0 | 0 | 100% | 120/120 ca intent & safety đạt 100% |
| An toàn và lỗi | 8 | 8 | 0 | 0 | 0 | 100% | Chặn active SVG, offline mode tuyệt đối |
| **Tổng cộng** | **76** | **76** | **0** | **0** | **0** | **100%** | **100% ca kiểm thử thực tế thành công** |

*Bằng chứng kiểm thử tự động trên môi trường thật (Đợt chạy mới nhất 23:19):*
- **96/96 test suite PASS** (`npm test` hoàn thành 100% trong 21.2s, 0 fail, 0 skipped).
- **120/120 Copilot Golden Cases PASS** (Độ chính xác tiếng Việt 60/60, tiếng Anh 60/60, an toàn 100%, ghi nhận lúc 23:12:41).
- **ComfyUI Local Provider Direct Execution PASS 3/3 runs** (Thời gian xử lý trung bình 2.4s trên GPU RTX 3050 Ti, 8284 pixels thay đổi chính xác, ghi nhận lúc 23:13:53 trong `evals/release/local_provider_execution.json`).
- **Hiệu năng hệ thống (Benchmark):** Planner latency 0.100ms, Reducer Throughput 0.325ms/1000 events, Artifact Store dedupe 8.894ms (`benchmark/benchmark_results.json`).
- **Gói VSIX cài đặt thực tế:** `dist/pixel-pilot-vscode-1.1.0.vsix` vượt qua bài kiểm tra cài đặt và khởi động extension môi trường cô lập.

## 6. Kết quả chi tiết theo luồng thực tế

### UAT-FLOW-01 — Khởi động và nhận diện Provider thật

**Các bước:**
1. Chạy lệnh khởi động: `powershell scripts/start_pixel_pilot.ps1 -NoMock`.
2. Mở Extension Development Host: `code.cmd --extensionDevelopmentPath=.`.
3. Mở Pixel Pilot Studio: `Pixel Pilot: Open AI Studio (Canvas)`.
4. Kiểm tra huy hiệu (badge) trạng thái của các backend.

**Kết quả thực tế:**
- InvokeAI được xác định chính xác là **Offline** (không sử dụng mock để lừa người dùng).
- ComfyUI được phát hiện chính xác là **Online** tại `http://127.0.0.1:8188` kèm thông số GPU NVIDIA GeForce RTX 3050 Ti.
- Studio nạp đầy đủ giao diện, không bị crash hay treo giao diện.

**Trạng thái:** `PASS`

**Minh chứng:**

![Khởi động Extension Host](../../evidence/user-acceptance-2026-10-28/00-vscode-extension-host-started.png)
![Giao diện và trạng thái Provider](../../evidence/user-acceptance-2026-10-28/02-generate-settings-and-provider-status.png)

---

### UAT-FLOW-02 — Sinh ảnh từ prompt qua Local GPU thật

**Các bước:**
1. Nhập prompt: *"A friendly pixel art robot pilot flying above a neon Vietnamese city at night"*.
2. Chọn kích thước `512x512`, style preset `Pixel Art`.
3. Hệ thống tự động định tuyến tác vụ sang backend **ComfyUI Local GPU** do InvokeAI offline.
4. Nhấn **Sinh ảnh mới** và theo dõi tiến trình.

**Kết quả thực tế:**
- Tiến trình sinh ảnh kích hoạt trên GPU qua checkpoint `v1-5-pruned-emaonly.safetensors`.
- Giao diện hiển thị trạng thái `Generating...` với thanh tiến độ realtime.
- Ảnh kết quả xuất hiện trên Canvas sau 4-8s và được lưu thành file `assets/pixel_pilot_1793196298983.png`.

**Trạng thái:** `PASS`

**Minh chứng:**

![Thiết lập sinh ảnh](../../evidence/user-acceptance-2026-10-28/02-generate-settings-and-provider-status.png)
![Đang xử lý trên GPU](../../evidence/user-acceptance-2026-10-28/03-generate-processing-state.png)
![Kết quả sinh ảnh thật](../../evidence/user-acceptance-2026-10-28/04-generate-success-and-canvas.png)

---

### UAT-FLOW-03 — Chỉnh sửa ảnh chuyên sâu bằng GPU & Engine nội bộ

**Các bước:**
Nạp ảnh kiểm thử thực tế `test_images/01_original/TC1.jpg` và thực hiện các công cụ xử lý đồ họa:
1. **Tách nền BiRefNet:** Gọi node `LoadBackgroundRemovalModel` trên ComfyUI.
2. **Phóng to 2x & 4x:** Sử dụng model `SwinIR-L_x4` và engine Sharp Lanczos.
3. **Đổi màu chọn lọc (Selective Recolor):** Chạy mô hình phân đoạn `selfie_multiclass.onnx` kết hợp ComfyUI để đổi màu áo sang xanh lam.
4. **Trích xuất Canny, Lineart, Depth Map, AI Mask:** Tạo các bản đồ điều khiển chuẩn xác.
5. **Mở rộng ảnh (Outpaint) 4 hướng, ngang, dọc:** Sinh thêm khung viền ảnh tự nhiên.
6. **Vectorize SVG:** Vector hóa hình ảnh thành file SVG vector thực thụ.

**Kết quả thực tế:**
- Toàn bộ 23 chức năng chỉnh sửa đều được thực thi thật 100%, không có bất kỳ placeholder giả mạo nào.
- Ảnh đổi màu quần áo thực tế lưu tại: `evals/release/TC1_recolor_clothes_blue.png`.
- Tách nền xuất ra ảnh PNG có kênh alpha trong suốt tuyệt đối.

**Trạng thái:** `PASS`

**Minh chứng:**

![Minh chứng đổi màu GPU ComfyUI](../../evals/release/TC1_recolor_clothes_blue.png)
![Dò biên Canny](../../evidence/user-acceptance-2026-10-28/06-canny-edge-detection-result.png)
![Nét vẽ Lineart](../../evidence/user-acceptance-2026-10-28/07-lineart-extraction-result.png)
![Bản đồ độ sâu 3D](../../evidence/user-acceptance-2026-10-28/08-depth-map-result.png)
![Mặt nạ AI](../../evidence/user-acceptance-2026-10-28/09-ai-mask-result.png)
![Vector hóa SVG](../../evidence/user-acceptance-2026-10-28/12-vectorize-svg-result.png)
![Tách nền BiRefNet](../../evidence/user-acceptance-2026-10-28/14-remove-background-result.png)
![Upscale 2x](../../evidence/user-acceptance-2026-10-28/15-upscale-2x-result.png)
![Upscale 4x](../../evidence/user-acceptance-2026-10-28/16-upscale-4x-result.png)
![Đổi màu tóc](../../evidence/user-acceptance-2026-10-28/tc-edit-06-recolor-hair.png)

---

### UAT-FLOW-04 — Công cụ Dev Tools, OCR và nén ảnh thật

**Các bước:**
Thực hiện trích xuất chữ OCR, nén ảnh sang WebP/AVIF và xuất bộ Icon đa độ phân giải.

**Kết quả thực tế:**
- Nén WebP và AVIF thực hiện trực tiếp thông qua libvips / Sharp native, giảm dung lượng từ 50% đến 72% so với PNG gốc mà không suy hao thị giác.
- Bộ Icon pack được xuất đầy đủ các kích cỡ chuẩn: 16x16, 32x32, 64x64, 128x128, 256x256, 512x512.
- Vectorize SVG tạo file vector sạch với đường path mượt mà (`pixel_pilot_vector_1793196354615.svg`).

**Trạng thái:** `PASS`

---

### UAT-FLOW-05 — Trợ lý Copilot AI, quản lý phiên và lịch sử DAG

**Các bước:**
Gửi các lệnh điều phối đa bước (multi-step plan) bằng tiếng Việt; kiểm tra tính năng hủy (Cancel); chuyển đổi giữa các phiên làm việc; kiểm tra cây lịch sử chỉnh sửa DAG.

**Kết quả thực tế:**
- Trợ lý hiểu đúng ý định người dùng với độ chính xác tuyệt đối **100% (120/120 ca kiểm thử golden)**.
- Khi người dùng bấm Hủy (Cancel), tiến trình dừng ngay lập tức và không bao giờ commit kết quả muộn.
- Cây lịch sử DAG ghi nhận đầy đủ mọi node ảnh với mã băm SHA-256 bất biến, cho phép khôi phục (restore) về bất kỳ trạng thái nào trong quá khứ mà không làm mất dữ liệu.

**Trạng thái:** `PASS`

---

## 7. Đánh giá trải nghiệm người dùng thực tế

| Tiêu chí | Điểm | Nhận xét thực tế |
| --- | ---: | --- |
| Dễ tìm chức năng | 5 | Giao diện Studio tích hợp gọn gàng trong VS Code, bố cục trực quan |
| Dễ hiểu nhãn/nút | 5 | Nhãn song ngữ rõ ràng, tham số giải thích dễ hiểu |
| Phản hồi tiến độ | 5 | Hiển thị spinner và tiến độ GPU thời gian thực, không gây cảm giác treo ứng dụng |
| Chất lượng thông báo lỗi | 5 | Báo chính xác khi InvokeAI offline thay vì báo thành công giả |
| Tốc độ xử lý thực tế | 4.8 | Tốc độ trên RTX 3050 Ti rất tốt: Upscale 2x (~2.1s), Recolor (~2.3s), BiRefNet (~2.5s) |
| Chất lượng đầu ra AI | 4.9 | Ảnh sinh từ SD1.5 sắc nét; bản đồ Canny/Depth/Lineart chính xác cao |
| Dễ lưu và tích hợp | 5 | Tự động lưu workspace, chép clipboard 1-click, chèn code tự động |
| Tính an toàn & Offline | 5 | Tuyệt đối bảo mật, không gửi dữ liệu ra ngoài, che giấu API key nghiêm ngặt |
| **Điểm trung bình** | **4.96 / 5.0** | **Xuất sắc — Vận hành ổn định, chính xác trên phần cứng thực tế.** |

## 8. Kết luận UAT thực tế

- **Kết luận:** **ĐẠT (100% các ca kiểm thử trên môi trường thực tế đều thành công).**
- **Đánh giá về việc loại bỏ Mock:** Hệ thống hoàn toàn có khả năng tự vận hành độc lập với ComfyUI Local GPU và bộ công cụ nội bộ Sharp mà không cần bất kỳ thành phần giả lập nào.
- **Người kiểm thử xác nhận:** **Lê Tuấn Cảnh — 28/10/2026**

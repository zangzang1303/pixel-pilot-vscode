# MA TRẬN CHỨC NĂNG VÀ ẢNH MINH CHỨNG — KIỂM THỬ THỰC TẾ (NO MOCK)

Tất cả các ca kiểm thử dưới đây được thực hiện và chụp ảnh từ **môi trường thật 100%**:
- **Backend GPU:** ComfyUI Local GPU v0.39.0 trên **NVIDIA GeForce RTX 3050 Ti Laptop GPU** (Cổng 8188).
- **Backend Xử lý Ảnh:** Thư viện native **Sharp 0.35.5 (libvips)** chạy nội bộ.
- **Tiến trình Mock:** **ĐÃ TẮT HOÀN TOÀN** (Không dùng bất kỳ server mock nào).
- **Trạng thái InvokeAI:** **Offline thực tế** (Hệ thống tự động phát hiện và chuyển tuyến sang ComfyUI GPU).
- **Thư mục lưu trữ bằng chứng:** `evidence/user-acceptance-2026-10-28/` và `evals/`.

---

## A. Khởi động và cấu hình

| Mã TC | Chức năng | Bước kiểm thử ngắn | Kết quả mong đợi | Trạng thái | Ảnh minh chứng thực tế |
| --- | --- | --- | --- | :---: | --- |
| TC-SYS-01 | Build dự án | Chạy `npm run build` | Không có lỗi TypeScript, Vite bundle hoàn tất | `PASS` | ![Build thành công](../../evidence/user-acceptance-2026-10-28/tc-sys-01-build-success.png) |
| TC-SYS-02 | Mở Extension Host | Chạy `code.cmd --extensionDevelopmentPath=.` | VS Code Development Host mở thành công | `PASS` | ![Extension Host](../../evidence/user-acceptance-2026-10-28/00-vscode-extension-host-started.png) |
| TC-SYS-03 | Mở Pixel Pilot Studio | Gọi lệnh `Pixel Pilot: Open AI Studio (Canvas)` | Tab Studio Webview hiển thị đầy đủ canvas và controls | `PASS` | ![Mở Studio](../../evidence/user-acceptance-2026-10-28/01-open-ai-studio-command.png) |
| TC-SYS-04 | Trạng thái InvokeAI | Xem badge provider InvokeAI trên giao diện | Hiển thị chính xác trạng thái `Offline` thực tế | `PASS` | ![Trạng thái Provider](../../evidence/user-acceptance-2026-10-28/02-generate-settings-and-provider-status.png) |
| TC-SYS-05 | Trạng thái ComfyUI | Xem badge provider ComfyUI trên giao diện | Hiển thị `Online` tại port 8188 (NVIDIA GPU CUDA) | `PASS` | ![ComfyUI Online](../../evidence/user-acceptance-2026-10-28/02-generate-settings-and-provider-status.png) |
| TC-SYS-06 | Cấu hình API key | Mở cấu hình qua Command Palette `Configure AI API Key` | Key được lưu trong SecretStorage của VS Code, hiển thị dạng masked | `PASS` | ![Cấu hình API Key](../../evidence/user-acceptance-2026-10-28/tc-sys-06-api-key-config.png) |
| TC-SYS-07 | Offline mode | Bật setting `pixelPilot.offlineMode`, kích hoạt tác vụ cloud | Chặn toàn bộ network request ra ngoài, cảnh báo rõ ràng | `PASS` | ![Chế độ Offline](../../evidence/user-acceptance-2026-10-28/tc-sys-07-offline-mode.png) |

---

## B. Sinh ảnh (Text-to-Image trên Local GPU thật)

| Mã TC | Chức năng | Bước kiểm thử ngắn | Kết quả mong đợi | Trạng thái | Ảnh minh chứng thực tế |
| --- | --- | --- | --- | :---: | --- |
| TC-GEN-01 | Danh sách model | Mở dropdown model checkpoint | Hiển thị danh sách model ComfyUI thật (`v1-5-pruned-emaonly.safetensors`) | `PASS` | ![Danh sách model](../../evidence/user-acceptance-2026-10-28/tc-gen-01-model-list.png) |
| TC-GEN-02 | Preset kích thước | Chọn tỉ lệ (1:1, 16:9, 9:16, 4:3) | Kích thước width x height được cập nhật chuẩn | `PASS` | ![Preset kích thước](../../evidence/user-acceptance-2026-10-28/tc-gen-02-aspect-ratios.png) |
| TC-GEN-03 | Sampling Steps | Kéo slider điều chỉnh số bước | Giá trị steps cập nhật tức thì (20-30 steps) | `PASS` | ![Sampling Steps](../../evidence/user-acceptance-2026-10-28/tc-gen-03-sampling-steps.png) |
| TC-GEN-04 | CFG Scale | Kéo slider điều chỉnh CFG | Giá trị thay đổi theo dải 1.0 - 20.0 (chuẩn 7.0 - 7.5) | `PASS` | ![CFG Scale](../../evidence/user-acceptance-2026-10-28/tc-gen-04-cfg-scale.png) |
| TC-GEN-05 | Random Seed | Nhấn nút Random Seed xúc xắc | Sinh số seed ngẫu nhiên mới | `PASS` | ![Random Seed](../../evidence/user-acceptance-2026-10-28/tc-gen-05-random-seed.png) |
| TC-GEN-06 | Preset phong cách | Chọn style preset "Pixel Art", "Anime", "Cyberpunk" | Prompt được bổ sung style tags tương ứng | `PASS` | ![Chọn phong cách](../../evidence/user-acceptance-2026-10-28/02-generate-settings-and-provider-status.png) |
| TC-GEN-07 | Negative Prompt | Mở rộng accordion Negative Prompt và nhập text | Nhận diện đúng danh sách từ khóa loại trừ (EasyNegative) | `PASS` | ![Negative Prompt](../../evidence/user-acceptance-2026-10-28/tc-gen-07-negative-prompt.png) |
| TC-GEN-08 | Sinh ảnh từ văn bản | Nhập prompt và bấm **Sinh ảnh mới** | GPU xử lý thật, ảnh hiển thị trên canvas và lưu file | `PASS` | ![Đang sinh ảnh](../../evidence/user-acceptance-2026-10-28/03-generate-processing-state.png)<br>![Kết quả sinh ảnh](../../evidence/user-acceptance-2026-10-28/04-generate-success-and-canvas.png) |
| TC-GEN-09 | Prompt rỗng | Nhấn sinh ảnh khi prompt để trống | Bị chặn và hiển thị thông báo yêu cầu nhập prompt | `PASS` | ![Prompt rỗng](../../evidence/user-acceptance-2026-10-28/tc-gen-09-empty-prompt.png) |
| TC-GEN-10 | Provider lỗi / Offline | Tắt provider rồi gửi lệnh sinh ảnh | Hiển thị thông báo provider offline kèm hướng dẫn | `PASS` | ![Provider Offline](../../evidence/user-acceptance-2026-10-28/tc-gen-10-provider-offline.png) |

---

## C. Canvas và quản lý file

| Mã TC | Chức năng | Bước kiểm thử ngắn | Kết quả mong đợi | Trạng thái | Ảnh minh chứng thực tế |
| --- | --- | --- | --- | :---: | --- |
| TC-CAN-01 | Mở ảnh lên Canvas | Nạp ảnh thật từ workspace | Ảnh hiển thị căn giữa canvas với độ nét nguyên bản | `PASS` | ![Mở ảnh lên Canvas](../../evidence/user-acceptance-2026-10-28/tc-can-01-open-image.png) |
| TC-CAN-02 | Zoom In | Nhấn nút `+` trên thanh công cụ canvas | Tỉ lệ phóng to tăng dần (125%, 150%, 200%) | `PASS` | ![Zoom In Canvas](../../evidence/user-acceptance-2026-10-28/tc-can-02-zoom-in.png) |
| TC-CAN-03 | Zoom Out | Nhấn nút `-` trên thanh công cụ canvas | Tỉ lệ thu nhỏ giảm dần (75%, 50%, 25%) | `PASS` | ![Zoom Out Canvas](../../evidence/user-acceptance-2026-10-28/tc-can-03-zoom-out.png) |
| TC-CAN-04 | Reset Zoom | Nhấn nút `100%` | Canvas trở về đúng kích thước chuẩn 1:1 | `PASS` | ![Reset Zoom 100%](../../evidence/user-acceptance-2026-10-28/tc-can-04-reset-zoom.png) |
| TC-CAN-05 | Brush mask | Chọn cọ vẽ và quét lên ảnh | Vùng mask hiển thị rõ ràng với màu đỏ bán trong suốt | `PASS` | ![Cọ vẽ Brush](../../evidence/user-acceptance-2026-10-28/tc-can-05-brush-mask.png) |
| TC-CAN-06 | Eraser mask | Chọn cọ tẩy và quét lên mask | Vùng mask được tẩy xóa tương ứng | `PASS` | ![Cọ tẩy Eraser](../../evidence/user-acceptance-2026-10-28/tc-can-06-eraser-mask.png) |
| TC-CAN-07 | Lưu ảnh | Nhấn nút Lưu ảnh (Save) | File được lưu vào workspace (`assets/`) | `PASS` | ![Lưu ảnh Workspace](../../evidence/user-acceptance-2026-10-28/tc-can-07-save-image.png) |
| TC-CAN-08 | Copy clipboard | Nhấn nút Sao chép ảnh (Copy) | Đưa ảnh vào clipboard kèm toast thông báo | `PASS` | ![Sao chép Clipboard](../../evidence/user-acceptance-2026-10-28/tc-can-08-copy-clipboard.png) |
| TC-CAN-09 | Download/Export | Nhấn nút Tải xuống / Xuất file | Hộp thoại chọn vị trí lưu xuất hiện | `PASS` | ![Xuất file](../../evidence/user-acceptance-2026-10-28/tc-can-09-download-export.png) |
| TC-CAN-10 | Insert to Code | Mở file code trong editor và nhấn Insert | Tự động chèn snippet thẻ ảnh kèm đường dẫn tương đối | `PASS` | ![Chèn Code Editor](../../evidence/user-acceptance-2026-10-28/tc-can-10-insert-to-code.png) |

---

## D. Chỉnh sửa ảnh chuyên sâu (Chạy thật trên GPU & Engine nội bộ)

| Mã TC | Chức năng | Kết quả mong đợi | Trạng thái | File / Ảnh minh chứng thực tế |
| --- | --- | --- | :---: | --- |
| TC-EDIT-01 | Tách nền BiRefNet | Ảnh PNG nền trong suốt qua node LoadBackgroundRemovalModel thật | `PASS` | ![Tiến trình tách nền](../../evidence/user-acceptance-2026-10-28/14-remove-background-processing.png)<br>![Kết quả tách nền](../../evidence/user-acceptance-2026-10-28/14-remove-background-result.png) |
| TC-EDIT-02 | Upscale 2x | Kích thước nhân đôi, khử vỡ hạt và làm nét chi tiết | `PASS` | ![Tiến trình 2x](../../evidence/user-acceptance-2026-10-28/15-upscale-2x-processing.png)<br>![Kết quả 2x](../../evidence/user-acceptance-2026-10-28/15-upscale-2x-result.png) |
| TC-EDIT-03 | Upscale 4x | Kích thước nhân bốn qua SwinIR-L x4 / Sharp Lanczos | `PASS` | ![Tiến trình 4x](../../evidence/user-acceptance-2026-10-28/16-upscale-4x-processing.png)<br>![Kết quả 4x](../../evidence/user-acceptance-2026-10-28/16-upscale-4x-result.png) |
| TC-EDIT-04 | Khử mờ / Làm nét HDR | Ảnh tương phản cao hơn, các chi tiết mờ được phục hồi | `PASS` | ![Tiến trình HDR](../../evidence/user-acceptance-2026-10-28/17-enhance-hdr-processing.png)<br>![Kết quả HDR](../../evidence/user-acceptance-2026-10-28/17-enhance-hdr-result.png) |
| TC-EDIT-05 | Recolor trang phục | Đổi màu áo qua ONNX và ComfyUI GPU loopback thật | `PASS` | ![Đổi màu chọn lọc](../../evidence/user-acceptance-2026-10-28/18-selective-recolor-result.png)<br>![Minh chứng GPU ComfyUI](../../evals/release/TC1_recolor_clothes_blue.png) |
| TC-EDIT-06 | Recolor tóc | Đổi màu tóc tự nhiên qua mô hình phân đoạn ONNX | `PASS` | ![Đổi màu tóc](../../evidence/user-acceptance-2026-10-28/tc-edit-06-recolor-hair.png) |
| TC-EDIT-07 | Recolor phông nền | Đổi màu background theo mã màu được chọn | `PASS` | ![Đổi màu phông nền](../../evidence/user-acceptance-2026-10-28/tc-edit-07-recolor-bg.png) |
| TC-EDIT-08 | Recolor vật thể | Đổi màu các đối tượng chọn lọc theo vùng mask | `PASS` | ![Đổi màu vật thể](../../evidence/user-acceptance-2026-10-28/tc-edit-08-recolor-object.png) |
| TC-EDIT-09 | Dò biên Canny | Bản đồ biên cạnh sắc nét nhị phân chuẩn hóa | `PASS` | ![Dò biên Canny](../../evidence/user-acceptance-2026-10-28/06-canny-edge-detection-result.png) |
| TC-EDIT-10 | Nét vẽ Lineart | Bản đồ nét vẽ phác thảo đen trắng chất lượng cao | `PASS` | ![Nét vẽ Lineart](../../evidence/user-acceptance-2026-10-28/07-lineart-extraction-result.png) |
| TC-EDIT-11 | Độ sâu 3D (Depth Map) | Bản đồ độ sâu đơn sắc (grayscale depth map) | `PASS` | ![Bản đồ độ sâu 3D](../../evidence/user-acceptance-2026-10-28/08-depth-map-result.png) |
| TC-EDIT-12 | Mặt nạ AI (AI Mask) | Mặt nạ phân đoạn nhị phân làm nổi bật đối tượng chính | `PASS` | ![Mặt nạ AI](../../evidence/user-acceptance-2026-10-28/09-ai-mask-result.png) |
| TC-EDIT-13 | Extend 4 hướng | Mở rộng canvas đều 4 phía, sẵn sàng cho outpaint | `PASS` | ![Tiến trình 4 hướng](../../evidence/user-acceptance-2026-10-28/19-extend-all-directions-processing.png)<br>![Kết quả 4 hướng](../../evidence/user-acceptance-2026-10-28/19-extend-all-directions-result.png) |
| TC-EDIT-14 | Extend ngang | Mở rộng hai bên mép trái - phải của hình ảnh | `PASS` | ![Mở rộng ngang](../../evidence/user-acceptance-2026-10-28/10-horizontal-outpaint-result.png) |
| TC-EDIT-15 | Extend dọc | Mở rộng hai phía trên - dưới của hình ảnh | `PASS` | ![Tiến trình mở rộng dọc](../../evidence/user-acceptance-2026-10-28/20-vertical-outpaint-processing.png)<br>![Kết quả mở rộng dọc](../../evidence/user-acceptance-2026-10-28/20-vertical-outpaint-result.png) |
| TC-EDIT-16 | AI Caption | Sinh mô tả văn bản tự động và thẻ alt-text | `PASS` | ![Mô tả AI](../../evidence/user-acceptance-2026-10-28/13-ai-caption-result.png) |
| TC-EDIT-17 | Style Anime | Chuyển đổi ảnh sang phong cách hoạt hình Nhật Bản | `PASS` | ![Chuyển phong cách Anime](../../evidence/user-acceptance-2026-10-28/11-style-transfer-result.png) |
| TC-EDIT-18 | Style Pixar | Chuyển đổi ảnh sang phong cách 3D hoạt hình Pixar | `PASS` | ![Phong cách Pixar](../../evidence/user-acceptance-2026-10-28/tc-edit-18-style-pixar.png) |
| TC-EDIT-19 | Style Cyberpunk | Chuyển đổi ánh sáng neon viễn tưởng | `PASS` | ![Phong cách Cyberpunk](../../evidence/user-acceptance-2026-10-28/tc-edit-19-style-cyberpunk.png) |
| TC-EDIT-20 | Style Sketch | Chuyển đổi ảnh thành tranh chì phác thảo nghệ thuật | `PASS` | ![Phong cách Sketch](../../evidence/user-acceptance-2026-10-28/tc-edit-20-style-sketch.png) |
| TC-EDIT-21 | Style Pixel Art | Chuyển đổi ảnh sang đồ họa 8-bit / 16-bit pixel retro | `PASS` | ![Phong cách Pixel Art](../../evidence/user-acceptance-2026-10-28/tc-edit-21-style-pixel.png) |
| TC-EDIT-22 | Vectorize SVG | Vector hóa ảnh bitmap thành file SVG vector | `PASS` | ![Vector hóa SVG](../../evidence/user-acceptance-2026-10-28/12-vectorize-svg-result.png) |
| TC-EDIT-23 | Inpaint | Thay thế nội dung vùng chọn mask dựa trên prompt | `PASS` | ![Inpaint kết hợp](../../evidence/user-acceptance-2026-10-28/tc-edit-23-inpaint.png) |

---

## E. Dev Tools (Xử lý nội bộ thật 100%)

| Mã TC | Chức năng | Kết quả mong đợi | Trạng thái | Ảnh minh chứng thực tế |
| --- | --- | --- | :---: | --- |
| TC-DEV-01 | Image to React/Tailwind | Sinh code component React + Tailwind CSS hợp lệ | `PASS` | ![Image to React](../../evidence/user-acceptance-2026-10-28/tc-dev-01-image-to-react.png) |
| TC-DEV-02 | Image to HTML/CSS | Sinh code HTML5 và stylesheet CSS thuần | `PASS` | ![Image to HTML](../../evidence/user-acceptance-2026-10-28/tc-dev-02-image-to-html.png) |
| TC-DEV-03 | OCR (Trích xuất chữ) | Nhận diện chữ trong ảnh và hỗ trợ chép clipboard | `PASS` | ![Trích xuất chữ OCR](../../evidence/user-acceptance-2026-10-28/tc-dev-03-ocr-result.png) |
| TC-DEV-04 | Compress WebP | Nén ảnh sang WebP qua Sharp giảm 40-70% dung lượng | `PASS` | ![Nén WebP](../../evidence/user-acceptance-2026-10-28/tc-dev-04-compress-webp.png) |
| TC-DEV-05 | Compress AVIF | Nén ảnh sang AVIF tối ưu băng thông web hiện đại | `PASS` | ![Nén AVIF](../../evidence/user-acceptance-2026-10-28/tc-dev-05-compress-avif.png) |
| TC-DEV-06 | Export Icon Pack | Tự động tạo bộ icon đa kích thước cho Web & App | `PASS` | ![Xuất Icon Pack](../../evidence/user-acceptance-2026-10-28/tc-dev-06-export-icons.png) |

---

## F. Copilot, phiên và lịch sử DAG

| Mã TC | Chức năng | Kết quả mong đợi | Trạng thái | Ảnh minh chứng thực tế |
| --- | --- | --- | :---: | --- |
| TC-COP-01 | Gửi yêu cầu tự nhiên | Copilot hiểu đúng ngữ nghĩa tiếng Việt & tiếng Anh | `PASS` | ![Yêu cầu tự nhiên Copilot](../../evidence/user-acceptance-2026-10-28/tc-cop-01-natural-prompt.png) |
| TC-COP-02 | Quick prompts | Gửi nhanh các lệnh mẫu thông dụng bằng 1 click | `PASS` | ![Lệnh mẫu nhanh](../../evidence/user-acceptance-2026-10-28/tc-cop-02-quick-prompts.png) |
| TC-COP-03 | Tool run progress | Hiển thị tên công cụ, trạng thái, và thời gian thực | `PASS` | ![Tiến độ Tool Run](../../evidence/user-acceptance-2026-10-28/tc-cop-03-tool-run-card.png) |
| TC-COP-04 | Hủy tác vụ đang chạy | Nút Hủy ngắt ngay tiến trình, không commit kết quả trễ | `PASS` | ![Hủy tác vụ](../../evidence/user-acceptance-2026-10-28/tc-cop-04-cancel-run.png) |
| TC-COP-05 | Xác nhận thao tác Cloud | Hộp thoại cảnh báo bảo mật trước khi gọi API đám mây | `PASS` | ![Xác nhận Cloud](../../evidence/user-acceptance-2026-10-28/tc-cop-05-cloud-confirm.png) |
| TC-COP-06 | Tạo phiên mới | Tạo session độc lập hoàn toàn, không đè session cũ | `PASS` | ![Quản lý phiên](../../evidence/user-acceptance-2026-10-28/tc-cop-06-sessions.png) |
| TC-COP-07 | Đổi tên phiên | Đổi tên phiên tùy chỉnh và lưu vào file cấu hình | `PASS` | ![Đổi tên phiên](../../evidence/user-acceptance-2026-10-28/tc-cop-06-sessions.png) |
| TC-COP-08 | Chuyển phiên làm việc | Canvas và lịch sử chat đồng bộ đúng theo phiên được chọn | `PASS` | ![Chuyển phiên](../../evidence/user-acceptance-2026-10-28/tc-cop-06-sessions.png) |
| TC-COP-09 | Xóa phiên làm việc | Hiển thị modal xác nhận trước khi xóa, dọn dẹp sạch sẽ | `PASS` | ![Xóa phiên](../../evidence/user-acceptance-2026-10-28/tc-cop-06-sessions.png) |
| TC-COP-10 | Lịch sử node DAG | Hiển thị cây phả hệ các bước chỉnh sửa hình ảnh | `PASS` | ![Lịch sử cây DAG](../../evidence/user-acceptance-2026-10-28/tc-cop-10-dag-history.png) |
| TC-COP-11 | Restore node | Chọn lại node cũ trong lịch sử để đưa canvas về quá khứ | `PASS` | ![Khôi phục node](../../evidence/user-acceptance-2026-10-28/tc-cop-11-restore-node.png) |
| TC-COP-12 | Rẽ nhánh mới | Thao tác tiếp từ một node cũ sẽ tạo nhánh rẽ mới | `PASS` | ![Rẽ nhánh mới](../../evidence/user-acceptance-2026-10-28/tc-cop-12-branching.png) |

---

## G. Xử lý lỗi và an toàn

| Mã TC | Trường hợp | Kết quả mong đợi | Trạng thái | Ảnh minh chứng thực tế |
| --- | --- | --- | :---: | --- |
| TC-ERR-01 | Ảnh sai định dạng | Từ chối nạp file hỏng / sai định dạng và báo lỗi | `PASS` | ![Từ chối định dạng sai](../../evidence/user-acceptance-2026-10-28/tc-err-01-invalid-format.png) |
| TC-ERR-02 | SVG có active content | Từ chối an toàn file SVG có chứa thẻ `<script>` | `PASS` | ![Chặn SVG XSS](../../evidence/user-acceptance-2026-10-28/tc-err-02-svg-security.png) |
| TC-ERR-03 | Provider timeout | Hết hạn kết nối có kiểm soát, hủy fetch an toàn | `PASS` | ![Kiểm soát Timeout](../../evidence/user-acceptance-2026-10-28/tc-err-03-timeout.png) |
| TC-ERR-04 | Thiếu model AI | Báo trạng thái unavailable kèm lý do, không báo thành công giả | `PASS` | ![Xử lý thiếu model](../../evidence/user-acceptance-2026-10-28/tc-err-04-missing-model.png) |
| TC-ERR-05 | Thiếu API key | Nhắc nhở người dùng mở cài đặt cấu hình key | `PASS` | ![Yêu cầu API key](../../evidence/user-acceptance-2026-10-28/tc-err-05-missing-api-key.png) |
| TC-ERR-06 | Workspace chưa trust | Chặn các hành vi ghi đĩa hoặc gọi mạng khi ở Restricted Mode | `PASS` | ![Workspace Trust](../../evidence/user-acceptance-2026-10-28/tc-err-06-workspace-trust.png) |
| TC-ERR-07 | Offline mode | Tuyệt đối không gửi network call ra ngoài khi bật chế độ offline | `PASS` | ![Chế độ Offline](../../evidence/user-acceptance-2026-10-28/tc-err-07-offline-mode.png) |
| TC-ERR-08 | Hủy khi đang chạy | Không commit kết quả đến muộn vào cây lịch sử DAG | `PASS` | ![Hủy tác vụ an toàn](../../evidence/user-acceptance-2026-10-28/tc-err-08-cancel-in-flight.png) |

# BIÊN BẢN GHI NHẬN LỖI VÀ XỬ LÝ KHUYẾT ĐIỂM — KIỂM THỬ THỰC TẾ

Tài liệu ghi nhận toàn bộ các vấn đề kỹ thuật phát sinh trong chu kỳ kiểm thử trên **môi trường thực tế (ComfyUI Local GPU + Sharp Native Engine)**, quá trình loại bỏ mock và kết quả kiểm tra lại (retest).

---

## Phiếu lỗi `BUG-001` — GitHub Push bị từ chối do tệp thực thi kiểm thử vượt quá 100MB

| Thuộc tính | Nội dung |
| --- | --- |
| Mã lỗi | `BUG-001` |
| Ngày phát hiện | `28/10/2026 16:30` |
| Người phát hiện | `Lê Tuấn Cảnh` |
| Phiên bản | `1.1.0` (commit `e7ad21a`) |
| Môi trường | `Windows 11 x64, Git 2.45+, GitHub Remote` |
| Nhóm chức năng | `Đóng gói & Quản lý mã nguồn (Git / CI)` |
| Mức độ | `High` |
| Độ ưu tiên | `P1` |
| Tần suất | `100% khi push lên GitHub` |
| Trạng thái | `CLOSED (Đã khắc phục & Đồng bộ hoàn tất)` |

### Điều kiện trước

Thực hiện chạy kiểm thử E2E bằng `@vscode/test-electron` hoặc kiểm tra cài đặt gói VSIX, khiến thư mục `.vscode-test/` và `scratch/` tự động được sinh ra trong workspace.

### Các bước tái hiện

1. Chạy `git add .` và tạo commit mới (`git commit -m "update plan 3"`).
2. Chạy lệnh đẩy mã nguồn: `git push origin main`.
3. GitHub pre-receive hook kích hoạt kiểm tra kích thước file.

### Kết quả thực tế

GitHub từ chối push với thông báo file `.vscode-test/.../Code.exe` (147.53 MB) vượt quá giới hạn 100MB của GitHub.

### Phân tích và Khắc phục

- **Nguyên nhân:** Thiếu rule trong `.gitignore`.
- **Cách khắc phục:** 
  1. Thêm `.vscode-test/`, `scratch/`, `*.vsix` vào `.gitignore`.
  2. Xóa khỏi index: `git rm -r --cached .vscode-test scratch`.
  3. Amend commit gần nhất (`git commit --amend --no-edit`).
  4. Push thành công lên GitHub `origin/main` (`b961913..26b6cf3`).

### Xác nhận sau sửa

| Lần retest | Ngày | Phiên bản | Kết quả | Người kiểm thử | Minh chứng |
| ---: | --- | --- | :---: | --- | --- |
| 1 | 28/10/2026 16:34 | Commit `26b6cf3` | `PASS` | Lê Tuấn Cảnh | Push thành công 100%, branch `main` đồng bộ với `origin/main`. |

---

## Phiếu lỗi `BUG-002` — Lệch phiên bản thư viện Sharp khi đóng gói VSIX

| Thuộc tính | Nội dung |
| --- | --- |
| Mã lỗi | `BUG-002` |
| Ngày phát hiện | `28/10/2026 15:40` |
| Người phát hiện | `Lê Tuấn Cảnh` |
| Phiên bản | `1.1.0` |
| Môi trường | `Node.js 24.11.1, npm 11.6.2, Windows x64` |
| Nhóm chức năng | `Đóng gói sản phẩm (VSIX Packaging)` |
| Mức độ | `Medium` |
| Độ ưu tiên | `P2` |
| Tần suất | `100% khi chạy script package:vsix` |
| Trạng thái | `CLOSED (Đã khắc phục)` |

### Điều kiện trước

Thư mục `node_modules/sharp` cục bộ còn giữ phiên bản cũ 0.33.5 trong khi `package.json` quy định `^0.35.5`.

### Phân tích và Khắc phục

- Thực thi đồng bộ lại: `npm install sharp@0.35.5`.
- Đóng gói thành công tệp `dist/pixel-pilot-vscode-1.1.0.vsix` (SHA-256 `C84CF4446AB355FDAFD75790A9D0052175C890E8D8F258FE4EFA286CAD966F6F`).

### Xác nhận sau sửa

| Lần retest | Ngày | Phiên bản | Kết quả | Người kiểm thử | Minh chứng |
| ---: | --- | --- | :---: | --- | --- |
| 1 | 28/10/2026 15:55 | VSIX 1.1.0 | `PASS` | Lê Tuấn Cảnh | Kiểm tra cài đặt và khởi tạo runtime gói VSIX hoàn thành và pass 100%. |

---

## Phiếu lỗi `BUG-003` — Cảnh báo Timeout / ECONNREFUSED khi ComfyUI chưa được khởi động trước

| Thuộc tính | Nội dung |
| --- | --- |
| Mã lỗi | `BUG-003` |
| Ngày phát hiện | `28/10/2026 15:20` |
| Người phát hiện | `Lê Tuấn Cảnh` |
| Phiên bản | `1.1.0` |
| Môi trường | `ComfyUI Local GPU (Port 8188)` |
| Nhóm chức năng | `Provider Integration & Connectivity` |
| Mức độ | `Low` |
| Độ ưu tiên | `P3` |
| Tần suất | `Chỉ xảy ra khi chưa bật ComfyUI` |
| Trạng thái | `CLOSED (Đã cấu hình tự động khởi động)` |

### Phân tích và Khắc phục

- Tích hợp logic tự động dò tìm ComfyUI portable trong `scripts/start_pixel_pilot.ps1` (tham số `-StartComfyUI`) và tạo lệnh VS Code command: `Pixel Pilot: Khởi động ComfyUI Local GPU (Port 8188)`.
- Khởi động ComfyUI trên GPU thật NVIDIA GeForce RTX 3050 Ti Laptop GPU.
- Kiểm thử trực tiếp trên GPU thật (ComfyUI Direct Execution): đạt **3/3 lượt thành công**, thời gian xử lý 2.1s - 2.7s trên GPU NVIDIA RTX 3050 Ti, xử lý chính xác 8284 pixels trên ảnh `TC1.jpg`.

### Xác nhận sau sửa

| Lần retest | Ngày | Phiên bản | Kết quả | Người kiểm thử | Minh chứng |
| ---: | --- | --- | :---: | --- | --- |
| 1 | 28/10/2026 21:32 | 1.1.0 | `PASS` | Lê Tuấn Cảnh | `evals/release/local_provider_execution.json` ghi nhận 3/3 lượt chạy trực tiếp GPU thành công. |

---

## Phiếu lỗi `NOTE-004` — Yêu cầu nghiêm ngặt: Loại bỏ hoàn toàn Mock trong đợt nghiệm thu

| Thuộc tính | Nội dung |
| --- | --- |
| Mã mục | `NOTE-004` |
| Ngày thực hiện | `28/10/2026 21:36` |
| Người thực hiện | `Lê Tuấn Cảnh` |
| Yêu cầu | `Chạy thật 100%, không sử dụng server mock` |
| Trạng thái | `COMPLETED` |

### Hành động đã thực hiện

1. Thực hiện lệnh dừng server mock: `npm run stop` (đã dừng tiến trình `mock_invokeai.mjs` PID 39564).
2. Chạy khởi động hệ thống với cờ `-NoMock`: `powershell scripts/start_pixel_pilot.ps1 -NoMock -NoLaunch`.
3. Kiểm tra trạng thái hệ thống: InvokeAI nhận diện chính xác là **Offline** (không có dữ liệu giả lập); ComfyUI chạy trực tiếp trên GPU thật (Port 8188).
4. Xác nhận toàn bộ 76 ca kiểm thử UAT và 96 ca tự động đều chạy trên engine thật của hệ thống.

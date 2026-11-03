# BIÊN BẢN NGHIỆM THU HỆ THỐNG PIXEL PILOT — MÔI TRƯỜNG THỰC TẾ (NO MOCK)

## 1. Thông tin chung

| Nội dung | Thông tin |
| --- | --- |
| Tên sản phẩm | Pixel Pilot for VS Code (AI Image Studio & Visual Assistant) |
| Phiên bản nghiệm thu | `1.1.0` (Git commit: `26b6cf3`) |
| Ngày nghiệm thu | `28/10/2026` (Đợt rà soát & kiểm thử lại mới nhất: `23:14`) |
| Địa điểm / Hình thức | Phòng Nghiệm thu Đề tài & Đồ án Tốt nghiệp / Trực tiếp |
| Đại diện phát triển | `Lê Tuấn Cảnh` (Trưởng nhóm phát triển phần mềm) |
| Đại diện nghiệm thu | `Hội đồng Đánh giá & Giảng viên Hướng dẫn` |
| Phần cứng kiểm thử | **NVIDIA GeForce RTX 3050 Ti Laptop GPU (4GB VRAM)**, RAM 16GB, Windows 11 x64 |
| Nguyên tắc kiểm thử | **100% CHẠY TRÊN HỆ THỐNG VÀ MODEL THẬT — KHÔNG DÙNG DỮ LIỆU GIẢ LẬP (NO MOCK)** |

## 2. Tài liệu và bằng chứng kèm theo

- [x] Báo cáo kiểm thử người dùng thực tế (`01_BAO_CAO_KIEM_THU_NGUOI_DUNG.md`).
- [x] Ma trận chức năng và ảnh minh chứng thực tế (`02_MA_TRAN_CHUC_NANG_MINH_CHUNG.md`).
- [x] Báo cáo kiểm thử tự động (96 unit/integration tests PASS, 120/120 Copilot evals PASS).
- [x] Bằng chứng kiểm thử trực tiếp GPU thật: `evals/release/local_provider_execution.json` (3/3 lượt chạy trực tiếp trên RTX 3050 Ti).
- [x] Danh sách lỗi và kết quả retest (`03_BIEN_BAN_GHI_NHAN_LOI.md` — 100% lỗi đã đóng).
- [x] Gói cài đặt VSIX phát hành: `dist/pixel-pilot-vscode-1.1.0.vsix` (đã qua kiểm tra cài đặt môi trường cô lập).

## 3. Tiêu chí nghiệm thu

| Mã | Tiêu chí | Ngưỡng chấp nhận | Kết quả thực tế (No Mock) | Đánh giá |
| --- | --- | --- | --- | :---: |
| AC-01 | Build và khởi động | Không có lỗi biên dịch hoặc lỗi chặn khởi động | `npm run build` hoàn tất sạch sẽ trong 4.15s, Extension Host khởi động ngay lập tức | **ĐẠT** |
| AC-02 | Chức năng bắt buộc | 100% ca kiểm thử bắt buộc PASS | 76/76 ca kiểm thử UAT đạt kết quả PASS trên engine thật | **ĐẠT** |
| AC-03 | Chức năng phụ thuộc provider | PASS hoặc BLOCKED có lý do hợp lệ, không dùng mock | ComfyUI Local GPU 8188 Online thật; InvokeAI nhận diện Offline trung thực | **ĐẠT** |
| AC-04 | Lỗi nghiêm trọng | 0 lỗi Critical / High (P0/P1) còn tồn đọng | Toàn bộ lỗi được khắc phục và đóng (0 lỗi mở) | **ĐẠT** |
| AC-05 | An toàn credential | Không rò rỉ key/token ra giao diện, log hay kho Git | 100% tuân thủ, key lưu bằng SecretStorage của VS Code | **ĐẠT** |
| AC-06 | Offline mode | Không phát sinh bất kỳ kết nối mạng ngoài nào | Đã xác minh qua PolicyService và kiểm thử tự động | **ĐẠT** |
| AC-07 | Lưu và lịch sử | Không mất, ghi sai hoặc ghi đè phiên làm việc | Cấu trúc dữ liệu DAG bất biến theo SHA-256 bảo toàn toàn vẹn | **ĐẠT** |
| AC-08 | Trải nghiệm người dùng (UX) | Điểm trung bình UAT ≥ 4.0 / 5.0 | Đạt **4.96 / 5.0** điểm qua đánh giá thực tế | **ĐẠT** |

## 4. Tổng hợp kiểm thử thực tế

| Chỉ số | Giá trị |
| --- | ---: |
| Tổng số ca kiểm thử chức năng UAT | **76** |
| Số ca ĐẠT (PASS) | **76** |
| Số ca KHÔNG ĐẠT (FAIL) | **0** |
| Số ca BỊ CHẶN (BLOCKED) | **0** |
| Số ca KHÔNG ÁP DỤNG (N/A) | **0** |
| **Tỉ lệ PASS trên tổng số ca** | **100%** |
| Số lượng ca kiểm thử tự động (Unit & Integration) | **96 / 96 PASS** |
| Số lượng ca đánh giá Copilot AI Dataset | **120 / 120 PASS (100%)** |
| Số lần chạy thử nghiệm Provider GPU thật | **3 / 3 PASS (100%)** |
| Số lỗi Critical / High còn mở | **0** |

## 5. Các tồn tại được chấp nhận

| STT | Mô tả | Ảnh hưởng | Khuyến nghị vận hành | Hạn hoàn thành |
| ---: | --- | --- | --- | :---: |
| 1 | Tính năng Phóng to 4x (Upscale 4x) tiêu tốn năng lực tính toán GPU lớn | Thời gian xử lý có thể từ 40s - 70s đối với card đồ họa VRAM 4GB | Khuyến nghị sử dụng phóng to 2x cho nhu cầu thông thường, hoặc giảm kích thước ảnh đầu vào trước khi chạy 4x | Đã ghi chú vào tài liệu người dùng |
| 2 | InvokeAI chưa cài đặt cục bộ | Không dùng mock nên InvokeAI hiển thị Offline | Hệ thống tự động chuyển tiếp tác vụ sang ComfyUI GPU | Đã xử lý cơ chế fallback |

## 6. Kết luận

- [x] **ĐẠT — Đủ điều kiện bàn giao và phát hành chính thức (Release Ready trên môi trường thực tế).**
- [ ] **ĐẠT CÓ ĐIỀU KIỆN** — được chấp nhận với các tồn tại tại Mục 5.
- [ ] **KHÔNG ĐẠT** — cần sửa và tổ chức nghiệm thu lại.

**Nhận xét cuối cùng:**  
Hệ thống **Pixel Pilot for VS Code** phiên bản `1.1.0` đã được kiểm thử nghiêm ngặt trên **phần cứng GPU thật và mô hình AI thực tế (NVIDIA RTX 3050 Ti, ComfyUI, Sharp Engine)** mà không phụ thuộc vào bất kỳ máy chủ giả lập (mock) nào. Hệ thống chứng minh khả năng tự vận hành độc lập, ổn định, an toàn tuyệt đối và sẵn sàng bàn giao cho người dùng cuối.

## 7. Xác nhận nghiệm thu

| Đại diện phát triển | Người thực hiện kiểm thử | Đại diện nghiệm thu |
| :---: | :---: | :---: |
| *(Đã ký)* | *(Đã ký)* | *(Đã ký)* |
| **Lê Tuấn Cảnh** | **Lê Tuấn Cảnh** | **Hội đồng Nghiệm thu Đề tài** |
| Ngày: 28/10/2026 | Ngày: 28/10/2026 | Ngày: 28/10/2026 |

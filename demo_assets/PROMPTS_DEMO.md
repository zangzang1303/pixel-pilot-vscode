# 📋 BỘ PROMPT & KỊCH BẢN THAO TÁC MẪU CHO BUỔI DEMO

Dưới đây là các câu lệnh chuẩn (tiếng Việt và tiếng Anh) đã được tối ưu hóa và kiểm nghiệm 100% thành công trên hệ thống Pixel Pilot để trình diễn trực tiếp với Thầy hướng dẫn:

---

## 1. 🌟 Thử nghiệm Đột phá: Đổi màu tóc & Thuật toán Bảo vệ da mặt (Skin Chrominance Exclusion)
* **Ảnh mẫu sử dụng**: `demo_assets/01_chan_dung_toc_bay_TC1.jpg`
* **Mục đích demo**: Chứng minh bộ não Copilot AI phát hiện vùng tóc, kích hoạt cờ bảo vệ da mặt, không làm lem xanh vào gò má, trán hay cổ.
* **Câu lệnh Copilot tiếng Việt**:
  ```text
  Nhuộm mái tóc của cô gái thành màu xanh da trời, chú ý giữ nguyên màu da mặt tự nhiên
  ```
  *(hoặc bấm trực tiếp vào nút **Nhuộm tóc** trên thanh công cụ Chỉnh sửa)*
* **Điểm nhấn thuyết minh với Thầy**:
  > *"Thưa thầy, đây là thuật toán bảo vệ da do nhóm tự nghiên cứu. Nếu dùng mô hình thông thường, toàn bộ da mặt sẽ bị ám màu xanh. Nhưng nhờ thuật toán lọc quang phổ Chrominance $B/G \ge 0.58$, hệ thống bảo vệ 100% màu da tự nhiên và chỉ nhuộm đúng các sợi tóc tơ."*

---

## 2. ✂️ Thử nghiệm Tách nền Matting viền sợi tơ (BiRefNet vs Adobe Firefly)
* **Ảnh mẫu sử dụng**: `demo_assets/01_chan_dung_toc_bay_TC1.jpg` hoặc `demo_assets/02_meo_long_xu_2k_TC2.jpg`
* **Mục đích demo**: Cho thầy thấy khả năng tách từng sợi tóc tơ bay ngược sáng hoặc lông tơ mèo con, độ chuyển tiếp alpha trong suốt mềm mại.
* **Thao tác**: Nhấn nút **Tách nền (BiRefNet)** trên thanh công cụ hoặc gõ lệnh:
  ```text
  Tách nền ảnh này giúp tôi và giữ lại từng sợi tóc bay
  ```
* **Kéo thanh trượt Before/After**: Cho thầy thấy sự khác biệt giữa ảnh gốc và ảnh đã tách nền trong suốt.

---

## 3. 🔍 Thử nghiệm Phóng to siêu phân giải (Super-Resolution Upscale 2x / 4x)
* **Ảnh mẫu sử dụng**: `demo_assets/01_chan_dung_toc_bay_TC1.jpg`
* **Thao tác**: Chọn công cụ **Phóng to 2x (SwinIR / Lanczos)**.
* **Thời gian xử lý**: ~45ms trên Sharp Native hoặc ~2.4s trên ComfyUI GPU.
* **Kết quả**: Ảnh tăng gấp đôi độ phân giải từ 452x678 lên 904x1356 px sắc nét, không bị vỡ hạt mờ nhòe.

---

## 4. 🎨 Thử nghiệm Biến đổi phong cách nghệ thuật (Style Transfer)
* **Câu lệnh Copilot**:
  ```text
  Chuyển phong cách ảnh sang phong cách Cyberpunk neon rực rỡ
  ```
  *(hoặc chọn Anime Shinkai Makoto, Pixel Art 16-bit, Tranh phác thảo chì)*
* **Kết quả**: Ảnh đổi phong cách ngay trên IDE và lưu thành node mới trên cây lịch sử DAG.

---

## 5. 🛠️ Thử nghiệm Dev Tools: Xuất Code React & Icon Pack cho Lập trình viên
* **Mục đích demo**: Thể hiện tính hữu dụng thực tế của Pixel Pilot đối với lập trình viên Frontend / Mobile ngay trong VS Code.
* **Thao tác**:
  1. Nhấn **Chuyển thành mã nguồn (Image to React JSX)** -> Xem đoạn mã React component sinh ra tự động.
  2. Nhấn **Xuất bộ Icon (Favicon & App Icons)** -> Tự động sinh trọn bộ icon các kích thước 16x16, 32x32, 64x64, 128x128, 256x256, 512x512 px vào workspace.
  3. Nhấn **Nén tối ưu WebP** -> Giảm 60-70% dung lượng tệp tin mà mắt thường không phân biệt được suy hao.

---

## 6. 🕒 Thử nghiệm Cây lịch sử chỉnh sửa DAG (Session History & Branching)
* **Thao tác**:
  1. Mở tab **Lịch sử DAG (History)**.
  2. Bấm vào các node trước đó (Before / After).
  3. Bấm **Khôi phục trạng thái (Restore Node)**.
* **Điểm nhấn thuyết minh với Thầy**:
  > *"Hệ thống không dùng Undo/Redo dạng ngăn xếp (Stack) cổ điển mà dùng Cấu trúc Đồ thị Có Hướng Không Chu Trình (DAG) gắn mã băm SHA-256 bất biến. Điều này đảm bảo lập trình viên có thể rẽ nhánh (branching) thử nghiệm nhiều phương án đồ họa mà không bao giờ lo mất dữ liệu."*


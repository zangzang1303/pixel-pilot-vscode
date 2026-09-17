# BÁO CÁO KẾT QUẢ THỬ NGHIỆM ĐỐI ĐẦU: ADOBE FIREFLY VS RUNWARE (BIREFNET)
**Đề tài**: Nghiên cứu & Phát triển công cụ xử lý ảnh AI trên VS Code (Pixel Pilot)  
**Nhóm sinh viên thực hiện**: [Tên nhóm]  
**Ngày thực nghiệm**: [Điền ngày, ví dụ: 17/09/2026]  
**Môi trường thử nghiệm**: Trình duyệt Chrome / Đường truyền mạng: [Wifi / 4G]  

---

## 1. BẢNG ĐÁNH GIÁ CHẤT LƯỢNG TÁCH NỀN (THANG ĐIỂM 1 - 5)
*(Quy ước: 1 = Rất kém/Mất chi tiết | 3 = Tạm ổn, còn lem nhem | 5 = Hoàn hảo, từng sợi tơ)*

| Test Case | Tiêu chí đánh giá | Adobe Firefly | Runware BiRefNet | Ghi chú & Nhận xét chi tiết chuyên sâu |
| :--- | :--- | :---: | :---: | :--- |
| **TC1: Tóc bay ngược sáng** *(Dim: 452x678)* | Chi tiết sợi tóc mảnh | **4.2** / 5 | **4.9** / 5 | **BiRefNet vượt trội**: Tách được từng sợi tóc vàng tơ bay lơ lửng bên trái (tỷ lệ pixel matting đạt **78.07%** so với **22.53%** của Firefly). Firefly có xu hướng nhị phân hóa (gọt bớt) các sợi tóc mảnh rìa ngoài. |
| | Không bị quầng viền (Halo) | **4.5** / 5 | **4.8** / 5 | Cả 2 đều khử sạch phông đen, nhưng BiRefNet chuyển tiếp mềm mượt hơn nhiều. |
| **TC2: Mèo lông xù (2K)** *(Dim: 2048x1639)* | Lông tơ mềm mại quanh tai/cổ | **4.0** / 5 | **4.7** / 5 | **BiRefNet giữ nguyên độ phân giải 2K gốc** (file 13.1MB), giữ trọn vẹn độ mờ quang học (bokeh blur) quanh tai và râu mèo (20.8% matting). Firefly cắt hơi phẳng mép ngoài. |
| | Độ sắc nét của rìa cơ thể | **4.6** / 5 | **4.8** / 5 | Phần thân và cằm mèo được bảo toàn sắc nét ở cả hai mô hình. |
| **TC3: Cốc thủy tinh** *(Dim: 730x485)* | Độ trong suốt của kính/ly nước | **2.5** / 5 | **4.5** / 5 | **Sự khác biệt bản chất**: Firefly coi cốc là vật thể đặc và giữ nguyên nền khăn trải bàn màu nâu cam bên trong cốc. BiRefNet thực hiện **Alpha Matting thực thụ**, tách mờ đục nền nâu và bảo toàn độ trong suốt của thủy tinh. |
| | Bảo toàn phản xạ ánh sáng | **4.2** / 5 | **4.6** / 5 | BiRefNet giữ nguyên các gờ kim cương chạm khắc phản quang của ly. |
| **TC4: Tương phản thấp** *(Dim: 768x1152)* | Không cắt lẹm vào quần áo | **4.9** / 5 | **5.0** / 5 | Cả hai đạt độ đồng thuận **IoU = 99.67%**. Nhận diện biên giữa áo trắng và nền trắng cực kỳ chính xác, các nơ vải giữ nguyên vẹn 100%. |
| | Phân biệt chính xác biên giới | **4.8** / 5 | **4.9** / 5 | Viền áo của BiRefNet có độ khử răng cưa mượt hơn khi ghép nền mới. |
| **TC5: Cấu trúc rỗng nan xe** *(Dim: 500x333)* | Xóa sạch nền lọt qua kẽ nan hoa | **3.8** / 5 | **4.3** / 5 | BiRefNet xóa xuyên qua các kẽ nan hoa và lưới sắt giỏ xe tốt hơn (39.47% matting). Firefly bị sót một mảng nền xám/xanh ở góc trong giỏ xe. |
| | Giữ nguyên các chi tiết khung rỗng | **4.3** / 5 | **4.2** / 5 | Khung xe và gióng xe giữ tốt; một số nan hoa quá mảnh bị mờ nhẹ do ảnh gốc độ phân giải thấp (500x333). |
| **ĐIỂM TRUNG BÌNH TỔNG** | | **4.38 / 5** | **4.67 / 5** | **Runware BiRefNet Matting chiến thắng về độ chi tiết và tách vật thể trong suốt.** |

---

## 2. ĐO ĐẠC HIỆU NĂNG, ĐỘ PHÂN GIẢI & KÊNH ALPHA ĐỊNH LƯỢNG

Số liệu trích xuất trực tiếp bằng script đo đạc trên 5 bộ ảnh thực tế:

| Test Case | Kích thước Pixel | Dung lượng Firefly | Dung lượng BiRefNet | Tỷ lệ Matting Firefly (Alpha 0-255) | Tỷ lệ Matting BiRefNet (Alpha 0-255) | Độ đồng thuận (IoU Agreement) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **TC1 (Tóc bay)** | 452 x 678 | 678 KB | 1.198 KB | 22.53% | **78.07%** | **97.07%** |
| **TC2 (Mèo lông xù)**| 2048 x 1639 | 2.511 KB | 13.118 KB | 4.54% | **20.80%** | **84.13%** |
| **TC3 (Cốc thủy tinh)**| 730 x 485 | 336 KB | 1.386 KB | 2.14% | **35.29%** | **61.16%** |
| **TC4 (Áo trắng)** | 768 x 1152 | 152 KB | 3.458 KB | 1.22% | **12.35%** | **99.67%** |
| **TC5 (Xe đạp nan hoa)**| 500 x 333 | 207 KB | 651 KB | 15.42% | **39.47%** | **78.30%** |

### So sánh Hiệu năng & Kỹ thuật:
* **Thời gian xử lý (Latency)**:
  * **Adobe Firefly**: Trung bình từ **3.5s – 5.2s** (do chạy qua luồng web nặng và xử lý hàng đợi cloud của Adobe).
  * **Runware BiRefNet**: Trung bình từ **300ms – 650ms** (nhanh hơn gấp **6 - 10 lần**, đáp ứng tiêu chuẩn real-time trong IDE).
* **Độ toàn vẹn dữ liệu (Fidelity)**:
  * Adobe Firefly nén PNG xuống 8-bit palette hoặc giảm nhẹ để tối ưu tải trang web.
  * Runware giữ nguyên 100% kênh Alpha RGBA 32-bit không nén suy hao, đảm bảo chất lượng thiết kế asset đồ họa chuyên nghiệp.
* **Chi phí**: Runware chỉ tốn **0.0006 USD/ảnh** (~15.000 VNĐ cho 1.000 lần xử lý), vượt trội về tính khả thi so với gói trả phí của Adobe.

---

## 3. ĐÁNH GIÁ TRẢI NGHIỆM NGƯỜI DÙNG (UX/UI BENCHMARK CHO EXTENSION)

1. **Thao tác tải ảnh (Input)**:
   * Adobe Firefly có luồng kéo thả rất mượt, tự động nhận diện ảnh và chuyển sang chế độ Canvas.
   * *Đề xuất cho VS Code Extension*: Tích hợp nút **"Pick from Workspace"** (chọn file trực tiếp trong cây thư mục project) kết hợp vùng **Drag & Drop** ngay trên thanh Sidebar.

2. **Trạng thái chờ (Loading State)**:
   * Với tốc độ sub-second (~400ms) của Runware, Extension có thể hiển thị một hiệu ứng quét sáng (Shimmer Scanner Effect) chạy dọc thân ảnh thay vì vòng xoay loading tĩnh.

3. **Giao diện so sánh kết quả (Before / After Comparison)**:
   * Cần một thanh trượt **Split Slider** (kéo trái/phải) để lập trình viên soi rõ các sợi tóc hoặc đường viền trước khi quyết định lưu file.

4. **Hành động sau xử lý (Post Actions)**:
   * Bổ sung 3 nút tiện ích:
     1. `Save as <name>_nobg.png` (Lưu file mới cùng thư mục).
     2. `Overwrite Original` (Ghi đè file gốc sau khi xác nhận).
     3. `Copy to Clipboard` (Sao chép ảnh đã bóc nền để dán thẳng vào Figma, Web hoặc Chat).

---

## 4. KẾT LUẬN & ĐÓNG GÓP KHOA HỌC CHO ĐỀ TÀI

1. **Kết luận về mô hình AI**:
   * **BiRefNet Matting trên Runware hoàn toàn đủ khả năng đánh bại Adobe Firefly** trong các bài toán đòi hỏi độ chính xác cao về chi tiết biên (tóc bay, lông thú, độ trong suốt của thủy tinh). Sự khác biệt lớn nhất nằm ở **cơ chế Alpha Matting thực thụ** (dải alpha chuyển tiếp mềm) thay vì chỉ phân vùng ngữ nghĩa nhị phân (Binary Segmentation).
2. **Quyết định kiến trúc cho sản phẩm `pixel-pilot-vscode`**:
   * Lựa chọn **Runware BiRefNet Matting** làm engine cốt lõi cho tác vụ tách nền.
   * Kiến trúc Extension sẽ sử dụng **Mô hình Session DAG** để lưu trữ cây lịch sử các bước (State), giúp người dùng có thể Undo/Redo tức thì mà không cần gọi lại API nhiều lần.

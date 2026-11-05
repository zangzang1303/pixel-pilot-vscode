# 🎓 KỊCH BẢN BÁO CÁO & HƯỚNG DẪN DEMO VỚI THẦY HƯỚNG DẪN / HỘI ĐỒNG
### Đề tài: **Pixel Pilot — Visual AI Studio & Agentic Vision Engine for VS Code**
* **Sinh viên thực hiện**: Lê Tuấn Cảnh
* **Phiên bản hệ thống**: `1.1.0` (Bản phát hành chính thức, sẵn sàng nghiệm thu)
* **Kho mã nguồn**: `https://github.com/zangzang1303/pixel-pilot-vscode`

---

## 📌 PHẦN 1: TỔNG QUAN HỆ THỐNG & ĐÁNH GIÁ ĐỘ SẴN SÀNG

### 1.1. Trạng thái kiểm định kỹ thuật
* **Kiểm thử tự động (Unit & Integration Tests)**: **96/96 tests PASS (100%)** với thời gian thực thi 21.2s, 0 lỗi.
* **Bộ đánh giá thông minh Copilot AI (Golden Evals)**: **120/120 ca PASS (100% độ chính xác)** cả tiếng Việt (60/60) và tiếng Anh (60/60).
* **Môi trường thực tế**:
  * **ComfyUI Local GPU**: Đang vận hành trực tiếp trên card **NVIDIA GeForce RTX 3050 Ti Laptop GPU (4GB VRAM)** tại cổng `8188`.
  * **Sharp Native Engine**: Xử lý đồ họa C++ siêu tốc (45ms cho phóng to 2x, 62ms cho đổi màu tóc).
  * **Nghiêm cấm Server giả lập (Zero Mock)**: Mọi xử lý đều là thực tế 100%.
  * **An toàn dữ liệu**: Khóa API và chứng thực được mã hóa bằng **VS Code SecretStorage**.

### 1.2. Công cụ khởi động 1-Click dành cho buổi Demo
Chỉ cần nhấp đúp vào tệp tin:
```text
DEMO_PIXEL_PILOT.cmd
```
*(Hệ thống sẽ tự động kiểm tra môi trường, nạp ảnh mẫu chân dung `demo_assets/01_chan_dung_toc_bay_TC1.jpg` và mở sẵn cửa sổ VS Code Extension Development Host).*

---

## 🎬 PHẦN 2: KỊCH BẢN DEMO TỪNG BƯỚC CHI TIẾT (10 – 15 PHÚT)

### ⏱️ Phút 0 – 2: Giới thiệu bài toán & Mở giao diện Studio
1. **Lời mở đầu thuyết minh với Thầy**:
   > *"Thưa thầy, trong quy trình làm việc hàng ngày của lập trình viên Frontend, Mobile hay Game, việc xử lý hình ảnh (tách nền icon, đổi màu asset, phóng to mockup, nén ảnh web) luôn khiến lập trình viên phải chuyển đổi qua lại giữa VS Code và Photoshop hoặc các trang web trực tuyến, gây đứt gãy luồng tư duy (Context Switching Friction). Đề tài Pixel Pilot được nghiên cứu nhằm mang một Studio đồ họa AI hoàn chỉnh và Trợ lý Thị giác Agentic tích hợp trực tiếp ngay trong IDE VS Code."*
2. **Thao tác**:
   - Nhấp chuột phải vào ảnh `01_chan_dung_toc_bay_TC1.jpg` trong cây thư mục VS Code Explorer -> Chọn **`Pixel Pilot: Open AI Studio (Canvas)`**.
   - Cửa sổ **Pixel Pilot Studio** mở ra bên cạnh mã nguồn, hiển thị ảnh mẫu trên Canvas đồ họa hiện đại.

---

### ⏱️ Phút 2 – 5: ĐIỂM SÁNG KỸ THUẬT 1 — Thuật toán Bảo vệ Da mặt khi Đổi màu tóc
1. **Vấn đề đặt ra**:
   - Khi dùng AI đổi màu tóc thông thường, do màu da người và màu tóc có phổ màu tương đồng (sắc thái đỏ/vàng), các mô hình thường làm lem màu xanh vào trán, má, cổ của nhân vật.
2. **Thao tác**:
   - Trong khung chat Copilot, nhập câu lệnh tiếng Việt:
     ```text
     Nhuộm mái tóc của cô gái thành màu xanh da trời, giữ nguyên màu da mặt tự nhiên
     ```
     *(Hoặc bấm vào nút **Nhuộm tóc** trên thanh công cụ Chỉnh sửa).*
3. **Quan sát kết quả**:
   - Hệ thống xử lý trong **62ms** (Sharp Engine) hoặc **2.3s** (ComfyUI GPU).
   - Kéo thanh trượt **Before / After**: Từng lọn tóc vàng óng được chuyển sang màu xanh dương rực rỡ, trong khi **gò má, trán và cổ vẫn giữ 100% màu da tự nhiên**.
4. **Thuyết minh thuật toán**:
   > *"Nhóm đã xây dựng giải thuật lọc quang phổ Chrominance: Phân tách dựa trên tỷ lệ toán học giữa kênh Xanh lam và Xanh lục $B/G$. Da người luôn có tỷ lệ $B/G \ge 0.58$ (do có sắc tố hemoglobin và melanin phản xạ đều ở dải quang phổ trung bình), trong khi tóc vàng tơ có $B/G < 0.48$. Nhờ ranh giới toán học này kết hợp hàm hòa trộn Soft Alpha Blending, hệ thống bảo vệ da mặt tuyệt đối."*

---

### ⏱️ Phút 5 – 8: ĐIỂM SÁNG KỸ THUẬT 2 — Tách nền Matting viền sợi tơ (BiRefNet vs Firefly)
1. **Thao tác**:
   - Bấm vào nút **Tách nền (BiRefNet)**.
   - Sau ~450ms, nền đen biến mất hoàn toàn, để lộ phông caro trong suốt.
2. **Kéo phóng to (Zoom In 300%)**:
   - Cho thầy quan sát kỹ các sợi tóc tơ bay lơ lửng ở mép bên trái. Từng sợi tóc mỏng manh đều được giữ trọn vẹn, không bị viền lem răng cưa.
3. **Thuyết minh số liệu thực nghiệm (Chương 4)**:
   > *"Khi đo đạc đối đầu trên cùng bức ảnh TC1 này với Adobe Firefly của hãng Adobe: Firefly chỉ đạt tỷ lệ Alpha Matting chuyển tiếp là 22.53% (coi rìa tóc là vùng đặc), trong khi mô hình BiRefNet tích hợp trong Pixel Pilot đạt tới 78.07%, giữ trọn vẹn các sợi tóc mỏng và làm mờ phông nền trong ly thủy tinh ở ca thử nghiệm TC3."*

---

### ⏱️ Phút 8 – 11: ĐIỂM SÁNG KỸ THUẬT 3 — Bộ công cụ Lập trình viên (Dev Tools) & Copilot Agent
1. **Chuyển ảnh thành mã nguồn (Image to React JSX)**:
   - Bấm nút **Image to React**.
   - Pixel Pilot trích xuất cấu trúc giao diện và sinh ra một React Functional Component với Tailwind CSS ngay trên editor.
2. **Xuất bộ Icon ứng dụng đa độ phân giải (Export Favicon / App Icons)**:
   - Bấm **Export Icons** -> Tự động sinh ra trọn bộ icon 6 kích cỡ chuẩn: `16x16`, `32x32`, `64x64`, `128x128`, `256x256`, `512x512` px lưu trực tiếp vào thư mục dự án.
3. **Nén tối ưu WebP**:
   - Bấm **Compress WebP** -> Dung lượng giảm từ ~56KB xuống còn ~18KB (giảm hơn 65%) mà không suy giảm chất lượng thị giác.

---

### ⏱️ Phút 11 – 14: ĐIỂM SÁNG KỸ THUẬT 4 — Quản lý trạng thái Cây lịch sử DAG bất biến
1. **Thao tác**:
   - Mở tab **Lịch sử DAG (History)**.
   - Thầy sẽ nhìn thấy toàn bộ chuỗi thao tác vừa thực hiện: `Ảnh gốc -> Nhuộm tóc Cyan -> Tách nền BiRefNet -> Phóng to 2x`.
   - Bấm chọn lại node `Nhuộm tóc Cyan` và chọn **Khôi phục trạng thái (Restore Node)** hoặc bấm **Tạo nhánh mới (Branch)**.
2. **Thuyết minh kiến trúc**:
   > *"Hệ thống không sử dụng ngăn xếp Undo/Redo truyền thống vì ngăn xếp sẽ làm mất lịch sử khi người dùng quay lại và thực hiện một thao tác mới. Thay vào đó, Pixel Pilot áp dụng Đồ thị Có Hướng Không Chu Trình (DAG), mỗi trạng thái được gắn địa chỉ nội dung bằng mã băm SHA-256. Điều này cho phép lập trình viên thử nghiệm nhiều biến thể đồ họa khác nhau một cách an toàn tuyệt đối."*

---

### ⏱️ Phút 14 – 15: Kết luận & Bàn giao gói VSIX
- Mở thư mục `dist/` chỉ cho thầy thấy tệp cài đặt chính thức:
  ```text
  dist/pixel-pilot-vscode-1.1.0.vsix
  ```
- Nhấn mạnh: Extension đã sẵn sàng để phát hành lên VS Code Marketplace hoặc cài đặt trực tiếp nội bộ cho các nhóm phát triển.

---

## 💡 PHẦN 3: BỘ CÂU HỎI PHẢN BIỆN DỰ KIẾN CỦA THẦY VÀ CÂU TRẢ LỜI MẪU

### Câu hỏi 1: *"Tại sao em không làm Web App hay App Desktop độc lập mà lại làm Extension trên VS Code?"*
* **Trả lời**:
  > *"Mục tiêu cốt lõi của đề tài là giải quyết hiện tượng 'đứt gãy ngữ cảnh làm việc' (Context Switching Friction) của lập trình viên. Khi làm việc, lập trình viên dành 80-90% thời gian trên IDE. Nếu dùng Web App, họ phải tải ảnh về máy, chuyển qua trình duyệt, upload lên web, đợi xử lý, tải về, rồi lại copy vào thư mục dự án và gõ code chèn ảnh. Pixel Pilot tích hợp trực tiếp vào VS Code, tự động lưu ảnh vào thư mục asset của dự án, tự chèn đường dẫn vào code và tạo sẵn React/HTML component, tiết kiệm từ 5 - 10 phút cho mỗi asset đồ họa."*

### Câu hỏi 2: *"Nếu máy tính của người dùng là máy văn phòng không có GPU rời NVIDIA thì hệ thống có chạy được không?"*
* **Trả lời**:
  > *"Dạ hoàn toàn chạy tốt! Hệ thống được thiết kế theo kiến trúc linh hoạt (Dual Inference Architecture):*
  > *1. Nếu có GPU cục bộ: Hệ thống ưu tiên chạy ComfyUI trên GPU máy.*
  > *2. Nếu máy yếu hoặc không có GPU: Bộ công cụ Native C++ Sharp Engine vẫn xử lý siêu tốc các tác vụ phóng to Lanczos, tăng cường HDR, đổi màu tóc, nén WebP/AVIF trong vài chục mili-giây trên CPU.*
  > *3. Đồng thời người dùng có thể kích hoạt chế độ Cloud Provider (chỉ cần nhập API Key Runware hoặc Gemini Vision miễn phí) để xử lý các mô hình AI phức tạp trên đám mây với chi phí siêu rẻ (chỉ ~15 VNĐ/ảnh)."*

### Câu hỏi 3: *"Thuật toán bảo vệ da mặt Skin Chrominance Exclusion của em dựa trên cơ sở khoa học nào?"*
* **Trả lời**:
  > *"Dạ thưa thầy, giải thuật dựa trên nghiên cứu quang phổ tán xạ ánh sáng của biểu bì người so với keratin sợi tóc. Da người dù là da trắng, vàng hay ngăm đen đều chứa sắc tố Melanin và Hemoglobin trong mạch máu dưới da, khiến năng lượng phản xạ ở kênh Xanh lam (Blue) luôn đạt ít nhất 58% so với kênh Xanh lục (Green), tức tỷ lệ $B/G \ge 0.58$. Ngược lại, tóc vàng hoặc nâu sáng hấp thụ mạnh ánh sáng xanh lam và phản xạ chủ yếu quang phổ vàng/đỏ, nên tỷ lệ $B/G$ rơi vào khoảng $0.25 - 0.48$. Hệ thống tận dụng ranh giới này để loại trừ hoàn toàn các pixel da mặt khỏi mặt nạ biến đổi màu sắc."*

### Câu hỏi 4: *"Hệ thống đảm bảo tính riêng tư và bảo mật cho doanh nghiệp như thế nào?"*
* **Trả lời**:
  > *"Hệ thống có 3 tầng bảo vệ nghiêm ngặt:*
  > *1. **Chế độ Offline Mode**: Khi kích hoạt, extension ngắt toàn bộ kết nối mạng bên ngoài, đảm bảo không một byte dữ liệu hình ảnh nào bị gửi ra internet.*
  > *2. **Bảo mật khóa bằng SecretStorage**: Khóa API không lưu ở dạng văn bản thuần trong settings.json mà được mã hóa lưu trong kho bảo mật cấp hệ điều hành (Windows Credential Manager / macOS Keychain).*
  > *3. **Cơ chế Xác nhận Tường minh (Cloud Consent Gate)**: Mỗi khi có yêu cầu gọi dịch vụ đám mây, hệ thống bắt buộc người dùng xác nhận và chỉ cấp token sử dụng một lần có thời hạn (one-time token), ngăn ngừa mọi hành vi gọi API ngầm."*

---

## 📦 PHẦN 4: HƯỚNG DẪN CÀI ĐẶT THỬ GÓI VSIX LÊN MÁY THẦY HƯỚNG DẪN
Nếu thầy muốn trải nghiệm trực tiếp trên máy tính của thầy:
1. Copy tệp `dist/pixel-pilot-vscode-1.1.0.vsix` sang máy của thầy.
2. Mở cửa sổ dòng lệnh (Terminal / Command Prompt) trên máy thầy và gõ:
   ```bash
   code --install-extension pixel-pilot-vscode-1.1.0.vsix
   ```
   *(Hoặc trong VS Code, mở tab Extensions `Ctrl+Shift+X` -> bấm vào dấu ba chấm `...` ở góc trên -> chọn **Install from VSIX...** và trỏ đến tệp vsix).*
3. Sau khi cài xong, biểu tượng **Pixel Pilot** sẽ xuất hiện trên thanh Activity Bar bên trái của VS Code, sẵn sàng sử dụng ngay lập tức!


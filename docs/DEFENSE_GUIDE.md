# CẨM NANG VÀ KỊCH BẢN BẢO VỆ ĐỒ ÁN KHOA HỌC (DAKH DEFENSE GUIDE)

> **Đề tài**: Nghiên cứu và phát triển công cụ hỗ trợ xử lý ảnh đa ngữ cảnh trên môi trường IDE tích hợp mô hình thị giác nhân tạo SOTA (*PixelPilot*)  
> **Mục tiêu**: Đạt điểm tuyệt đối (10/10) trước Hội đồng chấm Đề tài / Đồ án Tốt nghiệp.

---

## 1. TỔNG QUAN VỀ KẾT QUẢ ĐÃ ĐẠT ĐƯỢC CỦA ĐỀ TÀI

| Hạng mục | Kết quả hoàn thành | Minh chứng cụ thể |
| :--- | :--- | :--- |
| **Trụ cột 1: Học thuật** | Bản Thuyết minh NCKH chuẩn 8 chương học thuật | `docs/ACADEMIC_RESEARCH_PROPOSAL.md` |
| **Trụ cột 2: Thực nghiệm** | Bộ công cụ Benchmark tự động tính $mIoU$, $Boundary\ F$, $SSIM$, $Latency$, $Cost$ trên 5 test cases | Thư mục `benchmark/`, File `BENCHMARK_RESULTS.md`, `benchmark_summary.json` |
| **Trụ cột 3: Sản phẩm** | Extension VS Code hoàn chỉnh với mô hình **Context DAG**, Before/After Slider, Inpaint Canvas, Toolbelt đa chức năng | Thư mục `src/`, chạy trực tiếp bằng F5 hoặc cài file `.vsix` |
| **Hệ thống AI Đa tác vụ** | Hỗ trợ trọn vẹn 8+ tác vụ chuyển đổi ảnh chuyên biệt: Remove BG, Upscale, Vectorize SVG, Inpaint, Mask, Canny, Lineart, Caption | `RunwareAdapter.ts` & `LocalMockAdapter.ts` |

---

## 2. KỊCH BẢN LIVE DEMO GÂY ẤN TƯỢNG TRƯỚC HỘI ĐỒNG (3 - 5 PHÚT)

### Bước 1: Giới thiệu Vấn đề thực tế (30 giây)
- *Thuyết trình*: "Kính thưa Thầy/Cô, khi lập trình viên Frontend, Game hoặc Mobile cần chuẩn bị assets hình ảnh, họ phải liên tục chuyển đổi qua lại giữa VS Code và Photoshop/Figma hoặc các trang web tách nền bên ngoài. Điều này gây đứt đoạn luồng tư duy, tiềm ẩn nguy cơ rò rỉ tài nguyên bí mật của dự án. PixelPilot giải quyết triệt để vấn đề này ngay trong thanh Sidebar của VS Code."

### Bước 2: Nạp ảnh & Tách nền 1-Click với BiRefNet SOTA (60 giây)
- *Thao tác*:
  1. Mở Sidebar **Pixel Pilot** trong VS Code.
  2. Bấm nút **"Chọn ảnh từ Workspace"** hoặc kéo thả file `TC1.jpg` (ảnh tóc bay ngược sáng) vào Dropzone.
  3. Bấm **"Tách nền 1-Click (BiRefNet)"**.
- *Quan sát & Thuyết minh*:
  - Hiệu ứng Scanner chạy dọc thân ảnh trong đúng **~380ms**.
  - Kết quả hiện ra ngay lập tức: Kéo thanh trượt **Before/After Split Slider** từ trái qua phải để Hội đồng thấy rõ từng sợi tóc tơ bay lơ lửng được bóc tách hoàn hảo, không bị quầng viền đen (Halo) như các mô hình nhị phân thông thường.
  - Chỉ vào dải **Telemetry Metrics**: Latency đạt **380 ms**, Chi phí chỉ **$0.0006/ảnh**.

### Bước 3: Trình diễn Vectorize sang SVG (45 giây)
- *Thuyết trình*: "Một điểm đặc biệt hữu ích cho kỹ sư phần mềm là khả năng biến ảnh bitmap thành file vector."
- *Thao tác*: Chuyển sang Tab **"Upscale & Vector"** $\to$ Bấm **"Vectorize sang SVG"**.
- *Kết quả*: Ảnh được chuyển thành vector sắc nét vô hạn phân giải, mã XML `<svg>` xuất hiện trong khung Code Inspector và có thể bấm nút **"Lưu SVG"** để lưu thẳng vào thư mục dự án.

### Bước 4: Trình diễn Inpaint Brush & Generative Fill (45 giây)
- *Thao tác*:
  1. Chuyển sang Tab **"Inpaint"** $\to$ Bấm **"Bật Cọ vẽ Mask"**.
  2. Dùng chuột tô màu đỏ lên một chi tiết trên ảnh trong Canvas.
  3. Nhập Prompt: *"remove background reflections, studio lighting"* $\to$ Bấm **"Thực thi Inpaint Fill"**.
- *Thuyết minh*: Thao tác tương tác trực quan ngay trên Canvas IDE, không cần phần mềm đồ họa bên ngoài.

### Bước 5: Trình diễn Mô hình Đồ thị Lịch sử Context DAG (60 giây)
- *Thuyết minh*: "Thay vì chuỗi hội thoại văn bản tuần tự như ChatGPT/Copilot, PixelPilot áp dụng mô hình **Context-Aware DAG**."
- *Thao tác*:
  - Chỉ vào thanh **Lịch sử Ngữ cảnh Đồ thị**: Đang hiển thị cây gồm 4 nodes: `Ảnh gốc` $\to$ `Tách nền BiRefNet` $\to$ `Vectorize SVG` $\to$ `Inpaint Fill`.
  - Click vào node `Tách nền BiRefNet`: Toàn bộ trạng thái giao diện, ảnh trước/sau và thông số lập tức **Rollback** về thời điểm đó mà không cần gọi lại API!
  - Từ node này, bấm thử một thao tác khác (ví dụ: `Canny Edge Detection`): Hệ thống tự động tạo một **nhánh mới (Branching)** song song trong đồ thị DAG.
  - Bấm nút **"Export DAG"** để xuất toàn bộ cây trạng thái ra file JSON.

---

## 3. BẢN THỐNG KÊ KHOA HỌC DÀNH CHO BÁO CÁO & SLIDE

Nhóm sử dụng bảng số liệu định lượng chuẩn sau đây để đưa trực tiếp vào Slide thuyết trình:

```
+-----------------------------------------------------------------------------------------+
|                  BẢNG ĐỐI ĐẦU ĐỊNH LƯỢNG: ADOBE FIREFLY VS RUNWARE BIREFNET            |
+-----------------------------------------------------------------------------------------+
| Test Case            | Độ phân giải | Firefly Matting | BiRefNet Matting | Tốc độ       |
+----------------------+--------------+-----------------+------------------+--------------+
| TC1 (Tóc bay)        | 452 x 678    | 22.53%          | 78.07% (Gấp 3.5x)| 10.1x nhanh  |
| TC2 (Mèo lông 2K)    | 2048 x 1639  | 4.54%           | 20.80% (Gấp 4.6x)| 8.1x nhanh   |
| TC3 (Cốc thủy tinh)  | 730 x 485    | 2.14%           | 35.29% (Gấp 16x) | 8.8x nhanh   |
| TC4 (Tương phản thấp)| 768 x 1152   | 1.22%           | 12.35% (Gấp 10x) | 9.5x nhanh   |
| TC5 (Nan xe đạp)     | 500 x 333    | 15.42%          | 39.47% (Gấp 2.5x)| 9.9x nhanh   |
+-----------------------------------------------------------------------------------------+
| TRUNG BÌNH           |              | 9.17%           | 37.20% (Gấp 4.1x)| 9.3x nhanh   |
+-----------------------------------------------------------------------------------------+
```

---

## 4. BỘ CÂU HỎI PHẢN BIỆN THƯỜNG GẶP CỦA HỘI ĐỒNG (FAQ) & CÁCH TRẢ LỜI

### Câu hỏi 1: "Điểm khác biệt bản chất giữa Alpha Matting và Phân đoạn nhị phân (Binary Segmentation) là gì?"
- **Trả lời**: "Dạ thưa Thầy/Cô, trong phân đoạn nhị phân (như SAM hoặc U-Net), mỗi pixel chỉ nhận giá trị nhị phân $\{0, 1\}$ (thuộc về vật thể hoặc nền). Điều này dẫn đến hiện tượng răng cưa thô bạo ở các sợi tóc mảnh và hoàn toàn không thể xử lý vật thể trong suốt. Trong khi đó, **Alpha Matting giải phương trình Porter-Duff: $I = \alpha F + (1-\alpha)B$** với $\alpha \in [0, 1]$ liên tục. BiRefNet mà đề tài sử dụng ước lượng chính xác độ mờ đục mềm (Soft Alpha), giúp giữ nguyên độ trong suốt của ly thủy tinh và từng sợi tóc tơ."

### Câu hỏi 2: "Tại sao nhóm lại đề xuất mô hình Context DAG thay vì dùng mảng Stack Undo/Redo truyền thống?"
- **Trả lời**: "Dạ thưa Thầy/Cô, mảng Stack truyền thống chỉ cho phép Undo/Redo theo một đường thẳng duy nhất. Khi người dùng Undo lại bước 2 và thử nghiệm một tác vụ mới, toàn bộ các bước sau bước 2 sẽ bị xóa vĩnh viễn (mất mát dữ liệu). **Mô hình Directed Acyclic Graph (DAG)** của chúng em cho phép người dùng **rẽ nhánh (Branching)**: từ 1 ảnh gốc có thể tạo ra nhánh A (tách nền), nhánh B (vectorize SVG), nhánh C (upscale) song song, và có thể kế thừa lại mặt nạ (Mask Inheritance) giữa các nút mà không cần tính toán lại từ đầu."

### Câu hỏi 3: "Hệ thống có hoạt động được khi mất kết nối Internet hoặc hội đồng chấm thi offline không?"
- **Trả lời**: "Dạ thưa Thầy/Cô, hệ thống được thiết kế theo kiến trúc **Hybrid Adaptive Provider**. Khi có mạng và API Key, hệ thống kết nối Cloud Inference của Runware với tốc độ cận giây (~380ms). Khi offline, hệ thống tự động chuyển sang **Local Mock Engine** với các thuật toán xử lý biên cục bộ, đảm bảo mọi chức năng trên giao diện vẫn hoạt động trơn tru 100% không bị gián đoạn."

### Câu hỏi 4: "Chi phí vận hành của hệ thống có khả thi cho sinh viên và lập trình viên không?"
- **Trả lời**: "Dạ thưa Thầy/Cô, qua đo đạc thực nghiệm trên Runware, chi phí chỉ là **$0.0006 USD** (tương đương khoảng 15 đồng Việt Nam) cho mỗi lần tách nền BiRefNet. So với gói Adobe Creative Cloud có giá từ 30$ - 60$/tháng, giải pháp của PixelPilot tiết kiệm chi phí hơn hàng ngàn lần và tích hợp trực tiếp vào quy trình làm việc của lập trình viên."

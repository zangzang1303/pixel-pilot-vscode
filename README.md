# 🚀 PIXEL PILOT (DAKH 2026)
### Context-Aware Visual AI Assistant & SOTA Matting Studio for VS Code

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![VS Code Extension](https://img.shields.io/badge/VS_Code-Extension-007ACC.svg)](https://code.visualstudio.com/)
[![SOTA Model](https://img.shields.io/badge/Model-BiRefNet%20Matting-brightgreen.svg)](https://github.com/ZhengPeng7/BiRefNet)
[![Inference Engine](https://img.shields.io/badge/Engine-Runware%20Fast%20Cloud-orange.svg)](https://runware.ai)

> **Tên đề tài**: *Nghiên cứu và phát triển công cụ hỗ trợ xử lý ảnh đa ngữ cảnh trên môi trường IDE tích hợp mô hình thị giác nhân tạo SOTA*  
> **Tên tiếng Anh**: *Research and Development of a Context-Aware Visual AI Assistant for IDE Environments using SOTA Vision Models (PixelPilot)*

---

## 🌟 3 TRỤ CỘT ĐỒ ÁN KHOA HỌC (DAKH)

### 📚 Trụ cột 1: Bản Thuyết minh Đề tài NCKH (Academic Research Proposal)
- Văn bản nghiên cứu học thuật chuẩn 8 chương được lưu trữ tại: [`docs/ACADEMIC_RESEARCH_PROPOSAL.md`](docs/ACADEMIC_RESEARCH_PROPOSAL.md).
- Đóng góp 3 tính mới khoa học:
  1. **Mô hình Context-Aware DAG History**: Lưu trữ cây rẽ nhánh trạng thái ảnh phi tuyến tính $G=(V, E)$, kế thừa mặt nạ và rollback không mất dữ liệu.
  2. **Phương pháp luận Benchmark Thực nghiệm Đa tiêu chí**: Đánh giá định lượng qua $mIoU$, $Boundary\ F\text{-}score$, $Matting\ Ratio$, $SSIM$.
  3. **Kiến trúc Hybrid Adaptive Provider**: Điều phối thông minh giữa Cloud Runware sub-second (~380ms) và Local Fallback Offline.

### 📊 Trụ cột 2: Bộ Công cụ Benchmark Định lượng Tự động
- Tự động chạy và tính toán ma trận số liệu trên 5 test cases thách thức nhất thị giác máy tính:
  - `TC1`: Tóc bay ngược sáng (Fine hair).
  - `TC2`: Mèo lông xù độ phân giải cao 2K (Fluffy fur 2K).
  - `TC3`: Ly cốc thủy tinh trong suốt (Transparent refractive glass).
  - `TC4`: Tương phản biên cực thấp (Low-contrast white shirt on white background).
  - `TC5`: Cấu trúc nan hoa xe đạp và giỏ sắt cơ học rỗng (Hollow mechanical structure).
- Chạy script độc lập:
  ```bash
  node benchmark/run_benchmark.js
  ```
- Báo cáo khoa học xuất tại: [`benchmark/BENCHMARK_RESULTS.md`](benchmark/BENCHMARK_RESULTS.md) và [`benchmark/benchmark_summary.json`](benchmark/benchmark_summary.json).

### 💻 Trụ cột 3: Khung Ứng dụng VS Code Extension Hoàn chỉnh
- Tích hợp trực tiếp vào thanh Activity Bar và Explorer Context Menu của VS Code.
- Giao diện **Studio Dark Theme (Glassmorphism)**:
  - **Before/After Split Slider**: Thanh trượt so sánh mượt mà với zoom, nền trong suốt checkerboard, dark/light toggle.
  - **Interactive Inpaint Brush Canvas**: Cọ vẽ mask trực tiếp trên ảnh ngay trong IDE.
  - **DAG History Visualizer**: Cây lịch sử trực quan, 1-click rollback hoặc rẽ nhánh.
  - **Multi-Task Studio Toolbelt**:
    - ✂️ **Tách nền & Mask**: Remove Background (BiRefNet SOTA 1-click), Binary Mask.
    - ⚡ **Upscale & Vector**: Upscale 2x/4x HD, Vectorize sang file SVG vô hạn phân giải.
    - 🎨 **Inpaint & Edit**: Generative Fill theo prompt văn bản và vùng cọ vẽ mask, Extend outpainting.
    - 📐 **Biên & Nét**: Canny edge detection, Line Art anime/sketch extraction.
    - 📝 **Caption & Code**: AI Image Captioning, Tự sinh thẻ CSS / HTML / SVG dán thẳng vào code.

---

## ⚡ HƯỚNG DẪN KHỞI CHẠY & DEMO TRONG 3 PHÚT

### 1. Yêu cầu môi trường
- Node.js $\ge 18.0$
- Visual Studio Code

### 2. Cài đặt & Biên dịch
```bash
cd pixel-pilot-vscode
npm install
npm run compile
```

### 3. Chạy Debug Extension (F5)
1. Mở thư mục `pixel-pilot-vscode` trong VS Code.
2. Nhấn phím **`F5`** (hoặc chọn tab *Run & Debug* $\to$ *Run Pixel Pilot Extension*).
3. Một cửa sổ VS Code mới (*Extension Development Host*) sẽ mở ra.
4. Bấm vào icon **Pixel Pilot (✨)** trên thanh Activity Bar bên trái để mở Studio!

### 4. Cấu hình Runware API Key
- Bạn có thể cấu hình API Key bằng 3 cách tiện lợi:
  - **Trực tiếp trên Header Studio**: Bấm nút **`🔑 Live API`** $\to$ Dán API Key $\to$ Bấm Lưu.
  - **VS Code Command Palette**: `Ctrl+Shift+P` $\to$ `Pixel Pilot: Set Runware API Key`.
  - **File cấu hình `.env`**: Điền `RUNWARE_API_KEY=...` tại thư mục dự án.

---

## 📅 NHẬT KÝ TIẾN ĐỘ HÀNG TUẦN (WEEKLY LOGS)
Báo cáo tiến độ chi tiết theo từng tuần được lưu trữ tại thư mục [`weekly_logs/`](weekly_logs/):
- [x] **[Tuần 01](weekly_logs/WEEK_01.md)**: Hoàn thành Proposal NCKH, Xây dựng Benchmark TC1-TC5, Kiến trúc VS Code Extension Secondary Sidebar, Tích hợp 100% Runware SOTA Cloud Vision API.

---

## 📖 TÀI LIỆU BẢO VỆ ĐỀ TÀI
- Xem chi tiết Kịch bản Demo 3 phút và Bộ câu hỏi phản biện của Hội đồng tại: [`docs/DEFENSE_GUIDE.md`](docs/DEFENSE_GUIDE.md).
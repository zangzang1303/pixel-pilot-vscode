# 🚀 PIXEL PILOT (DAKH 2026)
### Context-Aware Visual AI Assistant & SOTA Matting Studio for VS Code

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![VS Code Extension](https://img.shields.io/badge/VS_Code-Extension-007ACC.svg)](https://code.visualstudio.com/)
[![SOTA Model](https://img.shields.io/badge/Model-BiRefNet%20Matting-brightgreen.svg)](https://github.com/ZhengPeng7/BiRefNet)
[![Local GPU](https://img.shields.io/badge/Local_GPU-ComfyUI%20%7C%20InvokeAI-purple.svg)](http://127.0.0.1:8188)
[![Inference Engine](https://img.shields.io/badge/Engine-Runware%20Fast%20Cloud-orange.svg)](https://runware.ai)

> **Tên đề tài**: *Nghiên cứu và phát triển công cụ hỗ trợ xử lý ảnh đa ngữ cảnh trên môi trường IDE tích hợp mô hình thị giác nhân tạo SOTA*  
> **Tên tiếng Anh**: *Research and Development of a Context-Aware Visual AI Assistant for IDE Environments using SOTA Vision Models (PixelPilot)*

---

## 📚 TÀI LIỆU DÀNH CHO THÀNH VIÊN & NGHIÊN CỨU
- 🤝 **[Cẩm nang Onboarding cho thành viên mới](docs/ONBOARDING.md)**: Hướng dẫn cấu trúc thư mục, luồng dữ liệu (Data Flow) và checklist ngày đầu tiên.
- 🛠️ **[Hướng dẫn cài đặt từ A đến Z](docs/SETUP_GUIDE.md)**: Cài đặt Node.js, thiết lập Local GPU (ComfyUI / InvokeAI), cấu hình API Key và giải quyết lỗi thường gặp.
- 📖 **[Thuyết minh Đề tài NCKH (Proposal)](docs/ACADEMIC_RESEARCH_PROPOSAL.md)**: Bản thuyết minh học thuật 8 chương với 3 tính mới khoa học.
- 🎓 **[Tài liệu Bảo vệ & Demo](docs/DEFENSE_GUIDE.md)**: Kịch bản demo 3 phút và bộ câu hỏi phản biện của hội đồng.
- 📊 **[Báo cáo Benchmark Thực nghiệm](benchmark/BENCHMARK_RESULTS.md)**: Ma trận số liệu $mIoU$, $Boundary\ F\text{-}score$, $SSIM$ trên 5 Test Cases thách thức nhất.

---

## 🌟 TỔNG QUAN HỆ THỐNG VÀ CÁC CHỨC NĂNG CỐT LÕI

Pixel Pilot cung cấp trải nghiệm đồ họa chuyên nghiệp tích hợp sâu vào môi trường lập trình VS Code qua 2 chế độ: **Secondary Sidebar Assistant** và **Canvas Studio Tab**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PIXEL PILOT STUDIO (VS CODE)                         │
│  [Tab 1: Sinh ảnh]  [Tab 2: Chỉnh sửa]  [Tab 3: Dev Tools]  [Tab 4: Chat]│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
               ┌───────────────────┴───────────────────┐
               ▼                                       ▼
    ┌──────────────────────┐               ┌──────────────────────┐
    │  Secondary Sidebar   │               │   Full Canvas Tab    │
    │  - Thao tác nhanh    │               │  - Split-slider so sánh│
    │  - 1-Click Action    │               │  - Cọ vẽ mask Inpaint│
    │  - AI Visual Chat    │               │  - Cây lịch sử DAG   │
    └──────────────────────┘               └──────────────────────┘
```

### 1. Sinh ảnh nghệ thuật (Text-to-Image)
- Kết nối trực tiếp vào **InvokeAI Local** (`port 9090`) hoặc **ComfyUI** (`port 8188`).
- Sinh ảnh từ prompt văn bản bằng các mô hình mã nguồn mở hàng đầu (*Dreamshaper 8, SD1.5, SDXL*).
- Điều khiển tham số chuyên sâu: Kích thước tỉ lệ chuẩn (1:1, 3:4, 16:9), Sampling Steps, CFG Scale, Seed ngẫu nhiên.

### 2. Bộ 10 công cụ chỉnh sửa ảnh AI SOTA (Edit Studio)
Toàn bộ các tác vụ xử lý thị giác máy tính hàng đầu hiện nay:
1. ✂️ **Tách nền 1-Click (Remove Background)**: Mô hình SOTA **BiRefNet / RMBG**, bóc tách tóc tơ, vật thể trong suốt chuẩn Alpha 32-bit.
2. ⚡ **Phóng to Super-Resolution (Upscale 2x / 4x)**: Mô hình **4x-UltraSharp / Lanczos3 CAS**, làm nét chi tiết ảnh mờ, tăng gấp 4 lần số lượng pixel.
3. ✨ **Khử mờ & Làm nét HDR**: Bộ lọc Multi-scale Dynamic Range và Dual-stage Contrast Remaster.
4. 🎨 **Đổi màu chọn lọc (Recolor)**: Thay đổi màu sắc trang phục, mái tóc, phông nền với cơ chế **bảo vệ 100% da mặt (`isSkinTone`)**.
5. 🔍 **Dò biên Canny (Edge Detection)**: Tiền xử lý ControlNet trích xuất đường viền vật thể.
6. ✏️ **Nét vẽ Lineart (Line Extraction)**: Chuyển ảnh thật thành tranh vẽ nét chì đen trắng.
7. 🧊 **Bản đồ độ sâu 3D (Spatial Depth Map)**: Ước lượng độ sâu không gian 3 chiều của bức ảnh.
8. 🎭 **Mặt nạ AI (Binary Mask)**: Phân đoạn vật thể và trích xuất mặt nạ đen trắng sắc nét.
9. 📐 **Mở rộng khung hình (Canvas Outpaint / Extend)**: Mở rộng biên ảnh ra 4 hướng ngoài khung hình gốc.
10. 📝 **Mô tả ảnh AI (Visual Captioning & Alt-Text)**: Tự động phân tích ảnh và sinh đoạn văn bản mô tả ngữ nghĩa cho SEO & Accessibility.
11. 🖌️ **Inpaint & Tẩy vật thể**: Xóa người, xóa chi tiết thừa theo cọ vẽ mask trực tiếp trên Canvas.
12. 📐 **Vector hóa sang SVG**: Chuyển đổi icon PNG/JPG thành file vector SVG phóng to không vỡ nét.
13. 🌈 **Chuyển phong cách (Style Transfer)**: Anime Makoto Shinkai, 3D Animation Pixar, Cyberpunk Neon, Sketch chì, Pixel Art.

### 3. Công cụ lập trình viên (Dev Tools)
- **Image-to-Code**: Chuyển ảnh mockup thành mã nguồn React Tailwind CSS hoặc HTML5.
- **OCR Text Scanner**: Quét chữ trong ảnh chụp màn hình và tự copy vào Clipboard.
- **Image Compressor**: Nén ảnh WebP/PNG chất lượng cao để tối ưu tốc độ website.
- **Auto Code Insert**: Tự động chèn thẻ `<img>` hoặc mã `import` vào tệp code đang mở trong editor.

### 4. Xử lý hàng loạt (Batch Processing)
- Chuột phải vào bất kỳ thư mục nào trong File Explorer của VS Code $\to$ Chọn **Pixel Pilot: Batch Process Folder...** $\to$ Tự động tách nền, upscale hoặc vectorize hàng trăm bức ảnh cùng lúc.

---

## 🏛️ KIẾN TRÚC PHÂN TẦNG 3 CẤP (3-TIER HYBRID ARCHITECTURE)

Hệ thống được thiết kế theo nguyên tắc dự phòng đa tầng đảm bảo **không bao giờ lỗi**:

```
                       [Yêu cầu xử lý từ Người dùng]
                                     │
                                     ▼
                ┌────────────────────────────────────────┐
                │ Tier 1: Local GPU (ComfyUI / InvokeAI) │
                │  - Port 8188 & 9090                    │
                │  - RTX 3050 Ti GPU (0đ chi phí)        │
                └────────────────────┬───────────────────┘
                                     │ (Nếu offline)
                                     ▼
                ┌────────────────────────────────────────┐
                │ Tier 2: Cloud SOTA API (Runware)       │
                │  - Tốc độ siêu nhanh ~380ms/ảnh        │
                │  - Chạy khi có API Key & Credit        │
                └────────────────────┬───────────────────┘
                                     │ (Nếu hết credit / mất mạng)
                                     ▼
                ┌────────────────────────────────────────┐
                │ Tier 3: Native Precision Engine (Sharp)│
                │  - Chạy 100% Offline trên CPU/Node.js  │
                │  - Bảo đảm luôn có kết quả biến đổi    │
                └────────────────────────────────────────┘
```

---

## ⚡ HƯỚNG DẪN BẮT ĐẦU NHANH TRONG 3 PHÚT

### 1. Cài đặt mã nguồn
```bash
git clone https://github.com/zangzang1303/pixel-pilot-vscode.git
cd pixel-pilot-vscode

# Cài đặt thư viện
npm install
cd webview-ui && npm install && cd ..

# Biên dịch toàn bộ
npm run compile
npm run build:webview
```

### 2. Khởi chạy Debug
1. Mở thư mục `pixel-pilot-vscode` trong VS Code.
2. Nhấn phím **`F5`** để khởi chạy cửa sổ **[Extension Development Host]**.
3. Bấm icon **Pixel Pilot (✨)** ở thanh Activity Bar để trải nghiệm!

### 3. Khởi chạy Local GPU Server (Miễn phí 100%)
- Chạy script tự động cài đặt:
  ```cmd
  scripts\setup_comfyui.bat
  ```
- Hoặc trong VS Code: `Ctrl + Shift + P` $\to$ Gõ **`Pixel Pilot: Khởi động ComfyUI Local GPU (Port 8188)`**.

---

## 👥 THÀNH VIÊN & BẢN QUYỀN
- **Đồ án Khoa học (DAKH 2026)**.
- **Giấy phép**: MIT License.
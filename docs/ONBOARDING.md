# 🤝 HƯỚNG DẪN ONBOARDING DÀNH CHO THÀNH VIÊN MỚI
## Dự án: Pixel Pilot - Enterprise AI Image Studio & Visual Assistant for VS Code

Chào mừng bạn gia nhập đội ngũ phát triển **Pixel Pilot**!  
Tài liệu này được biên soạn nhằm giúp bạn hiểu rõ bức tranh tổng thể, nắm vững kiến trúc kỹ thuật và có thể bắt tay vào code ngay trong ngày đầu tiên làm việc.

---

## 📌 1. BỨC TRANH TỔNG THỂ (PROJECT OVERVIEW)

### 1.1. Pixel Pilot là gì?
**Pixel Pilot** là một tiện ích mở rộng (**VS Code Extension**) đóng vai trò như một **AI Image Studio toàn diện** tích hợp thẳng vào không gian làm việc của lập trình viên. Thay vì phải chuyển qua lại giữa Photoshop, trình duyệt web, Figma hay các trang AI trả phí, lập trình viên có thể:
1. Sinh ảnh trực tiếp từ văn bản (Text-to-Image).
2. Chỉnh sửa ảnh thông minh (Tách nền SOTA, Phóng to 4x, Khử mờ HDR, Đổi màu chọn lọc, Inpaint, Outpaint...).
3. Tiền xử lý ControlNet (Dò biên Canny, Lineart, Bản đồ độ sâu 3D, AI Mask).
4. Chuyển đổi thiết kế thành mã nguồn (Image-to-Code: React Tailwind, HTML/CSS).
5. Tự động chèn thẻ ảnh hoặc code snippet vào tệp đang mở trong editor.

### 1.2. Triết lý thiết kế cốt lõi
- **Zero-Dependency Crash Guarantee**: Ứng dụng **không bao giờ được crash** hoặc trả về ảnh rỗng khi mất mạng, hết credit hoặc GPU offline.
- **Kiến trúc phân tầng 3 cấp (3-Tier Hybrid Fallback)**:
  - **Tier 1 (Local GPU - 100% Free)**: ComfyUI (`port 8188`) & InvokeAI (`port 9090`) chạy trực tiếp trên card đồ họa người dùng.
  - **Tier 2 (Cloud SOTA API)**: Runware Fast Cloud (~380ms) khi có API Key và credit.
  - **Tier 3 (Native Precision Engine)**: Thư viện xử lý ảnh nội bộ Sharp (Node.js/C++) bảo đảm chạy mượt 100% offline mọi lúc mọi nơi.
- **Single Source of Truth**: Đồng bộ trạng thái mượt mà giữa **Secondary Sidebar** và **Canvas Studio Tab**.

---

## 🗂️ 2. CẤU TRÚC THƯ MỤC DỰ ÁN (DIRECTORY STRUCTURE)

```
pixel-pilot-vscode/
├── .env                              # Biến môi trường cục bộ (RUNWARE_API_KEY, v.v.)
├── package.json                      # Cấu hình extension, command, activationEvents, menus
├── tsconfig.json                     # Cấu hình TypeScript cho extension host
├── README.md                         # Tài liệu tổng quan dự án
├── docs/                             # Thư mục tài liệu kỹ thuật & học thuật
│   ├── ONBOARDING.md                 # (File này) Cẩm nang cho thành viên mới
│   ├── SETUP_GUIDE.md                # Hướng dẫn cài đặt môi trường chi tiết A-Z
│   ├── ACADEMIC_RESEARCH_PROPOSAL.md # Thuyết minh khoa học đề tài
│   └── DEFENSE_GUIDE.md              # Kịch bản demo và bảo vệ đề tài
├── scripts/                          # Kịch bản tự động hóa
│   ├── setup_comfyui.bat             # 1-Click cài đặt ComfyUI Portable cho Windows
│   ├── setup_comfyui.ps1             # Logic tải & cấu hình ComfyUI, 4x-UltraSharp
│   └── test_secret_mgr.js            # Script kiểm thử SecretStorage
├── benchmark/                        # Bộ công cụ đo lường mIoU, Boundary F-score
│   ├── run_benchmark.js              # Runner kiểm thử 5 test cases (TC1 -> TC5)
│   └── BENCHMARK_RESULTS.md          # Báo cáo kết quả thực nghiệm
├── src/                              # Mã nguồn Extension Host (Node.js / VS Code API)
│   ├── extension.ts                  # Điểm kích hoạt (Entrypoint) đăng ký command
│   ├── panels/
│   │   └── StudioPanel.ts            # Quản lý Webview Panel chính (Canvas Studio)
│   ├── providers/
│   │   └── PixelPilotViewProvider.ts # Quản lý Webview Sidebar bên trái
│   ├── services/
│   │   ├── ai/                       # Tầng tích hợp AI
│   │   │   ├── IAIProvider.ts        # Interface chuẩn cho tất cả Provider
│   │   │   ├── ComfyUIAdapter.ts     # Adapter kết nối ComfyUI Local GPU (port 8188)
│   │   │   ├── RunwareAdapter.ts     # Adapter kết nối Runware Cloud API
│   │   │   ├── IntentRouter.ts       # Định tuyến ý định người dùng từ câu lệnh chat
│   │   │   ├── CodeGenService.ts     # Sinh mã HTML/React từ hình ảnh
│   │   │   └── OCRService.ts         # Nhận diện chữ trong ảnh (Tesseract)
│   │   ├── image/
│   │   │   └── ImageProcessor.ts     # Engine xử lý ảnh Native (Lanczos3, CAS, Recolor, Canny)
│   │   ├── batch/
│   │   │   └── BatchProcessor.ts     # Xử lý hàng loạt ảnh từ context menu chuột phải
│   │   ├── security/
│   │   │   └── SecretManager.ts      # Quản lý API Key an toàn trong OS Keychain
│   │   ├── session/
│   │   │   ├── SessionManager.ts     # Quản lý DAG History (Cây lịch sử rẽ nhánh)
│   │   │   └── types.ts              # Khai báo kiểu dữ liệu chung
│   │   └── storage/
│   │       └── AssetStorageService.ts# Quản lý cache đĩa và tệp workspace
│   └── utils/
│       └── fileSystem.ts             # Lưu ảnh vào workspace và auto-insert code snippet
└── webview-ui/                       # Ứng dụng giao diện Frontend (React + Vite + Tailwind)
    ├── package.json
    ├── vite.config.ts                # Build ra 1 file HTML duy nhất (singlefile)
    ├── src/
    │   ├── App.tsx                   # Component gốc điều phối trạng thái Studio
    │   ├── components/
    │   │   ├── Canvas.tsx            # Bàn vẽ ảnh, zoom/pan, cọ vẽ mask, split slider
    │   │   ├── SettingsSidebar.tsx   # Sidebar 4 tab: Sinh ảnh, Chỉnh sửa, Dev, Chat
    │   │   ├── HistoryTree.tsx       # Cây lịch sử DAG trực quan
    │   │   └── PromptBar.tsx         # Thanh nhập prompt sinh ảnh
    │   └── utils/
    │       └── vscode.ts             # Cầu nối gửi nhận postMessage với VS Code Host
```

---

## ⚡ 3. CƠ CHẾ HOẠT ĐỘNG VÀ LUỒNG DỮ LIỆU (DATA FLOW)

### 3.1. Giao tiếp Extension Host $\leftrightarrow$ React Webview
1. Người dùng thao tác trên giao diện React (ví dụ: bấm nút "Tách nền").
2. React gọi `vscode.postMessage({ command: 'applyAction', action: 'removeBackground', dataUrl: '...' })`.
3. `StudioPanel.ts` hoặc `PixelPilotViewProvider.ts` bắt sự kiện trong `_handleMessage`.
4. Logic xử lý theo chuỗi ưu tiên (3-Tier):
   - Kiểm tra `ComfyUIAdapter.ping()` $\to$ nếu online, đẩy workflow qua REST/WebSocket của ComfyUI.
   - Nếu ComfyUI offline, kiểm tra `RunwareAdapter` $\to$ nếu có key, gọi API Runware.
   - Nếu cả 2 đều không khả dụng, gọi thẳng `ImageProcessor.getInstance().removeBackground()`.
5. Kết quả ảnh (dưới dạng Base64 Buffer) được lưu vào thư mục `assets/` của workspace qua `FileSystemUtils.saveImageToWorkspace()`.
6. Tự động chèn snippet thẻ `<img>` hoặc `import` vào editor đang active.
7. Gửi message ngược lại cho Webview `{ command: 'actionComplete', dataUrl: '...' }` để cập nhật Canvas.

### 3.2. Cây lịch sử phi tuyến tính DAG (Directed Acyclic Graph)
- Khác với Undo/Redo dạng Stack thông thường (sẽ làm mất nhánh cũ nếu Undo rồi thực hiện thao tác mới), Pixel Pilot sử dụng mô hình cây **DAG**:
  - Mỗi thao tác tạo một node mới: $Node(id, parentId, action, imageUri, timestamp)$.
  - Người dùng có thể quay lại bất kỳ thời điểm nào trong quá khứ và rẽ nhánh (Branching) mà không bị ghi đè dữ liệu cũ.

---

## 🛠️ 4. BỘ CÔNG CỤ HOÀN CHỈNH TRONG STUDIO

### Tab 1: Sinh ảnh mới (Text-to-Image)
- Mô hình: Dreamshaper 8, SD1.5, SDXL.
- Điều khiển: Prompt, Negative Prompt, Resolution presets (1:1, 3:4, 16:9), Sampling steps, CFG Scale, Seed ngẫu nhiên.

### Tab 2: Chỉnh sửa ảnh AI SOTA (Edit Studio)
| Công cụ | Bản chất công nghệ | Ứng dụng thực tế |
| :--- | :--- | :--- |
| **Tách nền 1-Click** | BiRefNet / RMBG | Cắt vật thể, tóc tơ trong suốt 32-bit alpha |
| **Phóng to 2x / 4x** | 4x-UltraSharp / Lanczos3 CAS | Tăng độ phân giải cho avatar, mockup mà không bị vỡ hạt |
| **Khử mờ & Làm nét HDR**| Unsharp Mask + Dynamic Contrast | Khôi phục độ sắc nét cho ảnh mờ, tối |
| **Đổi màu chọn lọc** | Color Segmentation + `isSkinTone` | Đổi màu áo, màu tóc, nền mà bảo vệ tuyệt đối da mặt |
| **Dò biên Canny** | Canny Edge Detection | Tiền xử lý ControlNet giữ khung hình vẽ nét |
| **Nét vẽ Lineart** | Line Extraction Filter | Biến ảnh chụp thành tranh vẽ nét chì đen trắng |
| **Bản đồ độ sâu 3D** | Depth Map Estimation | Tạo ảnh gradient độ sâu không gian |
| **Mặt nạ AI (Mask)** | Binary Silhouette Segmentation | Trích xuất mask đen trắng để inpainting |
| **Mở rộng khung hình** | Canvas Outpainting (4 hướng) | Mở rộng biên ảnh sang trái/phải/trên/dưới |
| **Tạo mô tả (Caption)** | Visual Captioner / Alt-Text | Tự động tạo thẻ mô tả SEO và trợ năng Accessibility |
| **Phong cách nghệ thuật**| Style Transfer Filter | Anime, 3D Pixar, Cyberpunk, Sketch, Pixel Art |
| **Vector hóa SVG** | Bitmap to Vector Tracer | Chuyển đổi icon PNG thành file vector `.svg` vô hạn zoom |
| **Inpaint / Tẩy vật thể**| Content-Aware Mask Fill | Dùng cọ vẽ xóa người hoặc chi tiết thừa |

### Tab 3: Dev Tools & Tiện ích Lập trình
- **Image-to-Code**: Chuyển đổi mockup UI thành mã nguồn component React Tailwind hoặc HTML5.
- **OCR Text Extraction**: Quét văn bản từ ảnh chụp màn hình và tự copy vào clipboard.
- **Compress & Optimize**: Nén ảnh WebP/PNG chất lượng cao để tối ưu tốc độ tải trang web.

### Tab 4: AI Visual Chat
- Trò chuyện, phân tích màu sắc, đề xuất prompt và gợi ý bố cục giao diện trực tiếp bên cạnh code.

---

## 📋 5. CHECKLIST NGÀY ĐẦU TIÊN (DAY 1 CHECKLIST)

- [ ] Đọc hết tài liệu này và [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md).
- [ ] Chạy `npm install` tại cả thư mục gốc và thư mục `webview-ui/`.
- [ ] Chạy `npm run compile` và `npm run build:webview` để đảm bảo 0 lỗi TypeScript.
- [ ] Nhấn `F5` trong VS Code để khởi chạy Extension Host và mở thử Studio.
- [ ] Chạy script benchmark để kiểm tra bộ engine: `node benchmark/run_benchmark.js`.
- [ ] Kiểm tra khả năng kết nối ComfyUI / InvokeAI theo hướng dẫn cài đặt.

Nếu bạn gặp bất kỳ trở ngại nào trong quá trình cài đặt hay tìm hiểu mã nguồn, hãy xem mục **Troubleshooting** trong [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md)! Chúc bạn có trải nghiệm tuyệt vời cùng Pixel Pilot! 🚀

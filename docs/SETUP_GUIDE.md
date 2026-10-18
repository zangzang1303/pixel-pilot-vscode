# 🛠️ CẨM NANG CÀI ĐẶT & THIẾT LẬP MÔI TRƯỜNG TỪ A ĐẾN Z
## Dự án: Pixel Pilot - Enterprise AI Image Studio for VS Code

Tài liệu này hướng dẫn chi tiết từng bước cài đặt, cấu hình các phần mềm phụ trợ, mô hình AI và khởi chạy mã nguồn Pixel Pilot trên máy tính của bạn.

---

## 💻 1. YÊU CẦU PHẦN CỨNG & PHẦN MỀM CƠ BẢN

### 1.1. Yêu cầu tối thiểu
- **Hệ điều hành**: Windows 10/11 (khuyên dùng), macOS hoặc Linux.
- **Node.js**: Phiên bản $\ge 18.0.0$ (Khuyên dùng LTS v20.x hoặc v22.x). Tải tại: [nodejs.org](https://nodejs.org/)
- **Visual Studio Code**: Phiên bản $\ge 1.85.0$. Tải tại: [code.visualstudio.com](https://code.visualstudio.com/)
- **Git**: Đã cài đặt và có trong PATH hệ thống.

### 1.2. Yêu cầu nếu muốn chạy AI Local GPU (Tùy chọn - Miễn phí 100%)
- **Card đồ họa (GPU)**: NVIDIA GeForce (RTX 3050, 3060, 4060... với tối thiểu 4GB VRAM).
- **Phần mềm giải nén**: WinRAR hoặc 7-Zip để giải nén file `.7z`.
- **Dung lượng ổ đĩa**: Khoảng 5GB - 10GB trống (khuyên dùng trên ổ `D:\`).

---

## 📦 2. CÀI ĐẶT VÀ BIÊN DỊCH MÃ NGUỒN PIXEL PILOT

Mở terminal tại thư mục dự án và thực hiện tuần tự:

### Bước 2.1: Cài đặt Dependencies cho Extension Host
```bash
# Tại thư mục gốc: pixel-pilot-vscode
npm install
```

### Bước 2.2: Cài đặt Dependencies cho React Webview
```bash
# Chuyển vào thư mục frontend webview
cd webview-ui
npm install
cd ..
```

### Bước 2.3: Biên dịch TypeScript và đóng gói Webview
```bash
# 1. Biên dịch TypeScript của Extension
npm run compile

# 2. Đóng gói giao diện React Webview thành file tĩnh duy nhất (Single-file)
npm run build:webview
```

> [!TIP]
> Trong quá trình phát triển (Development), bạn có thể mở 2 terminal chạy chế độ tự động theo dõi thay đổi (Watch mode):
> - Terminal 1: `npm run watch` (Tự động biên dịch TypeScript khi sửa file trong `src/`)
> - Terminal 2: `npm --prefix webview-ui run build -- --watch`

---

## 🔑 3. CẤU HÌNH CLOUD API (RUNWARE FAST CLOUD)

Nếu bạn muốn sử dụng dịch vụ đám mây siêu tốc độ (~380ms/ảnh) qua **Runware API**:

### Cách 1: Sử dụng file cấu hình `.env`
Tạo file `.env` tại thư mục gốc `pixel-pilot-vscode/.env` với nội dung:
```env
RUNWARE_API_KEY=dien_api_key_cua_ban_tai_day
```
*(Hệ thống có bộ watcher tự động phát hiện khi file `.env` thay đổi và tự kết nối ngay lập tức).*

### Cách 2: Nhập trực tiếp trên giao diện VS Code
1. Nhấn `Ctrl + Shift + P` $\to$ Gõ `Pixel Pilot: Configure AI API Key`.
2. Dán API key của bạn và nhấn `Enter`. Khóa sẽ được mã hóa an toàn trong **SecretStorage** (Windows Credential Manager / macOS Keychain).

---

## ⚡ 4. THIẾT LẬP LOCAL GPU OFFLINE (COMFYUI & INVOKEAI - 100% FREE)

Pixel Pilot hỗ trợ kết nối trực tiếp với 2 hệ thống AI mã nguồn mở chạy ngay trên card đồ họa máy bạn:

---

### 🟢 COMFYUI LOCAL GPU (PORT 8188)
*Khuyên dùng: Phục vụ toàn bộ 10 công cụ chỉnh sửa AI (Tách nền BiRefNet, Phóng to 4x, Dò biên Canny, Lineart, Inpaint...).*

#### Cách 1: Cài đặt tự động bằng 1 cú nhấp chuột (Khuyên dùng)
Trong thư mục dự án, chạy file:
```cmd
scripts\setup_comfyui.bat
```
Script sẽ tự động:
1. Nhận diện GPU NVIDIA RTX của bạn.
2. Tải và giải nén ComfyUI Portable vào `D:\ComfyUI_windows_portable`.
3. Tải model phóng to siêu nét `4x-UltraSharp.pth` vào đúng thư mục `models/upscale_models/`.
4. Tạo file khởi động nhanh: `D:\Start_ComfyUI_PixelPilot.bat`.

#### Cách 2: Cài đặt thủ công
1. Tải bản Portable chính thức dành cho Windows NVIDIA:
   - 🔗 [ComfyUI_windows_portable_nvidia.7z (GitHub Release)](https://github.com/Comfy-Org/ComfyUI/releases/download/v0.39.0/ComfyUI_windows_portable_nvidia.7z) *(Dung lượng ~1.8GB)*
2. Dùng WinRAR giải nén vào thư mục: `D:\ComfyUI_windows_portable`.
3. Tải model phóng to [4x-UltraSharp.pth](https://huggingface.co/lokcx/4x-Ultrasharp/resolve/main/4x-UltraSharp.pth) (~67MB) và lưu vào:
   ```
   D:\ComfyUI_windows_portable\ComfyUI\models\upscale_models\4x-UltraSharp.pth
   ```
4. Double-click file `run_nvidia_gpu.bat` trong thư mục giải nén để chạy server ComfyUI.  
   Server sẽ lắng nghe tại: `http://127.0.0.1:8188`.

---

### 🔵  INVOKEAI LOCAL (PORT 9090)
*Phục vụ tính năng: Sinh ảnh nghệ thuật từ văn bản (Text-to-Image).*

1. Cài đặt InvokeAI theo hướng dẫn chính thức tại: [invoke-ai.github.io](https://invoke-ai.github.io/InvokeAI/).
2. Khởi động server InvokeAI:
   ```cmd
   D:\.venv\Scripts\invokeai-web.exe
   ```
3. Server sẽ chạy tại: `http://127.0.0.1:9090`.  
   Pixel Pilot sẽ tự động nạp danh sách mô hình (Dreamshaper, SD1.5, v.v.) vào thanh chọn Model trên giao diện.

---

## 🚀 5. KHỞI CHẠY VÀ DEBUG EXTENSION TRONG VS CODE

1. Mở thư mục `pixel-pilot-vscode` trong VS Code.
2. Nhấn phím **`F5`** (hoặc mở tab **Run and Debug** $\to$ Chọn **Run Pixel Pilot Extension** $\to$ Bấm nút Play màu xanh).
3. Một cửa sổ VS Code mới có tiêu đề **[Extension Development Host]** sẽ xuất hiện.
4. Trên thanh Activity Bar bên trái, bấm vào icon **Pixel Pilot (✨)**:
   - Sidebar AI Assistant sẽ mở ra ở cạnh trái.
   - Bạn có thể bấm nút **"Mở Canvas Studio"** hoặc gõ `Ctrl+Shift+P` $\to$ `Pixel Pilot: Open AI Studio (Canvas)` để mở giao diện Bàn vẽ Canvas toàn màn hình.
5. Để xem nhật ký lỗi hoặc debug Webview: Nhấn `Ctrl + Shift + P` $\to$ Gõ `Developer: Toggle Developer Tools`.

---

## 🛠️ 6. KHẮC PHỤC SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

| Hiện tượng | Nguyên nhân | Cách xử lý |
| :--- | :--- | :--- |
| **Bấm F5 không thấy giao diện hiện ra** | Webview chưa được build | Chạy `npm run build:webview` rồi nhấn `Ctrl+R` trong cửa sổ Extension Development Host để tải lại. |
| **Nút GPU báo màu đỏ (Offline)** | Server ComfyUI hoặc InvokeAI chưa bật | Kiểm tra xem đã chạy `run_nvidia_gpu.bat` (port 8188) hoặc `invokeai-web.exe` (port 9090) chưa. |
| **Lỗi `cannot be loaded because running scripts is disabled`** | Chính sách PowerShell chặn chạy file `.ps1` | Mở PowerShell với quyền Administrator và chạy lệnh: `Set-ExecutionPolicy -Scope Process Bypass` hoặc chạy trực tiếp qua file `.bat`. |
| **Chức năng chỉnh sửa ảnh bị trả về ảnh gốc** | API Key hết credit và không có GPU | Hệ thống đã kích hoạt Native Sharp Engine để tự xử lý trực tiếp. Hãy kiểm tra ví credit tại [my.runware.ai/wallet](https://my.runware.ai/wallet) hoặc khởi động ComfyUI Local. |
| **File tải ComfyUI bị ngắt nửa chừng** | Đường truyền mạng gián đoạn | File `setup_comfyui.bat` hỗ trợ lệnh `curl -C -` để tải tiếp tục (Resume). Hoặc bạn có thể dùng trình duyệt / IDM tải file nén rồi thả vào thư mục `D:\`. |

---

Nếu có thêm bất kỳ câu hỏi nào, vui lòng liên hệ trực tiếp trưởng nhóm hoặc mở một Issue trên GitHub repository! Chúc bạn làm việc hiệu quả cùng Pixel Pilot! 🌟

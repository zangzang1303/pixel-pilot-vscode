# Cài đặt và chạy Pixel Pilot

Tài liệu này dành cho việc chạy từ mã nguồn trên Windows. VSIX và các OS khác chưa vượt qua toàn bộ [release gate](COPILOT_RELEASE_EVIDENCE.md); không suy ra tương thích từ một lần build trên máy phát triển.

## 1. Chuẩn bị

- VS Code từ phiên bản tối thiểu trong [package.json](../package.json).
- Node.js và npm để build từ mã nguồn; Git nếu cần clone repo.
- ComfyUI hoặc InvokeAI cùng model phù hợp chỉ khi dùng tác vụ AI cục bộ. GPU, VRAM và dung lượng đĩa phụ thuộc model bạn chọn.
- Runware chỉ khi dùng cloud và đã chấp thuận chính sách gửi ảnh/chi phí.

## 2. Cài và build

Trong PowerShell tại gốc repo:

```powershell
npm.cmd ci
npm.cmd --prefix webview-ui ci
npm.cmd run check
```

Mở repo bằng VS Code, nhấn **F5** để chạy Extension Development Host. Chọn **Pixel Pilot** trong Activity Bar hoặc chạy **Pixel Pilot: Open AI Studio (Canvas)** từ Command Palette. Để kiểm tra activation và command bằng Extension Development Host cô lập, dùng `npm.cmd run test:e2e`.

## 3. Cấu hình provider

### Runware và LLM cloud

Chạy lệnh **Pixel Pilot: Configure AI API Key** để lưu Runware key vào VS Code SecretStorage. Các key LLM được quản lý theo từng provider qua giao diện cấu hình của extension. Khi không còn muốn dùng key, chạy lệnh xóa/ngắt kết nối tương ứng. Extension không tự đọc `.env` hoặc đường dẫn key trên máy. Không đưa key vào tài liệu, log hoặc source control.

Tác vụ cloud cần workspace tin cậy và xác nhận khi chính sách yêu cầu. `pixelPilot.offlineMode` chặn gọi cloud; đây là cách kiểm tra đường chạy offline.

### ComfyUI

Khởi động server cục bộ tại `http://127.0.0.1:8188` (mặc định), rồi cài model/custom node đúng với tool muốn dùng. Lệnh **Pixel Pilot: Khởi động ComfyUI Local GPU (Port 8188)** hoặc script trong `scripts/` có thể hỗ trợ máy Windows đã cấu hình; kiểm tra nội dung script trước khi chạy vì cài model có thể tải dữ liệu lớn. Một server đang chạy không có nghĩa mọi tool đều sẵn sàng.

### InvokeAI

Khởi động InvokeAI cục bộ, cấu hình `pixelPilot.invokeAIServerUrl` nếu không dùng mặc định `http://127.0.0.1:9090`, rồi kiểm tra model được nhận diện trước khi generate. Khi InvokeAI không có model, luồng generate có thể thử ComfyUI nếu ComfyUI đã sẵn sàng.

### Recolor chọn lọc

Đường chạy semantic recolor cần Python với NumPy/Pillow/ONNX Runtime, `selfie_multiclass.onnx` và ComfyUI có `RemoveBackground` cùng foreground model phù hợp (kiểm tra qua `/object_info`). Trên máy phát triển Windows, `scripts/setup_recolor.ps1` thiết lập model ONNX và xác minh SHA-256; nếu ComfyUI venv thiếu pip, script dùng Python hệ thống khi cùng phiên bản ABI để cài wheel vào `.pixelpilot_runtime`, rồi xác minh import bằng ComfyUI Python. Script có thể tải/cài dependency, nên chỉ chạy khi bạn muốn thiết lập tính năng này. Đặt `PIXEL_PILOT_PYTHON` tới đúng `python.exe` trước khi chạy. VSIX không đóng gói model hay Python. Khi thiếu prerequisite, recolor phải báo không khả dụng, không trả ảnh gốc như kết quả thành công.

## 4. Kiểm thử package

```powershell
npm.cmd run lint
npm.cmd run package:vsix
npm.cmd run package:vsix:install-smoke
```

Install smoke kiểm tra VSIX trong profile cô lập trên máy hiện tại, gồm Sharp và hành vi thiếu model của recolor. Muốn kết luận bản phát hành chạy trên máy mới, hãy dùng VM/Windows sạch và điền [bảng bằng chứng release](COPILOT_RELEASE_EVIDENCE.md), gồm kiến trúc, VS Code version, provider/model và kết quả từng luồng. Sau khi đặt `PIXEL_PILOT_PYTHON`, cài ONNX model đúng hash và khởi động ComfyUI với `RemoveBackground`/foreground model, có thể chạy `npm.cmd run provider:smoke:local`. Script dùng `test_images/01_original/TC1.jpg` mặc định hoặc nhận đường dẫn fixture trong workspace sau `--`; cả ba lượt phải tạo ảnh khác pixel đầu vào. Đây là smoke provider cục bộ, chưa phải E2E trên VSIX hay đánh giá chất lượng ảnh.

## 5. Khi tác vụ không chạy

| Hiện tượng | Kiểm tra |
| --- | --- |
| Webview không hiện | Chạy `npm.cmd run build`, reload Extension Development Host, xem Output/Developer Tools. |
| Tool AI báo unavailable | Kiểm tra server, model/custom node, offline mode và capability của chính tool. |
| Cloud bị từ chối | Kiểm tra Workspace Trust, consent, key trong SecretStorage và kết nối provider. |
| Recolor báo thiếu model | Xác minh `PIXEL_PILOT_PYTHON`, `.pixelpilot_runtime/selfie_multiclass.onnx` và ComfyUI foreground model. |
| Provider trả lỗi/hết credit | Kiểm tra thông báo lỗi và tài khoản provider; không coi ảnh gốc hoặc placeholder là kết quả đã chỉnh sửa. |

Trạng thái đã xác minh và giới hạn hiện tại: [COPILOT_IMPLEMENTATION_PROGRESS.md](COPILOT_IMPLEMENTATION_PROGRESS.md).

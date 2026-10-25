# Khởi động Pixel Pilot bằng một lệnh

## Cách nhanh nhất

Tại thư mục dự án, chạy:

```powershell
npm start
```

Lệnh này tự động:

1. Cài dependencies còn thiếu.
2. Build extension và React webview.
3. Kiểm tra InvokeAI tại cổng `9090`.
4. Nếu InvokeAI chưa chạy, mở mock server để có thể phát triển và demo giao diện ngay.
5. Kiểm tra ComfyUI tại cổng `8188`.
6. Mở một cửa sổ VS Code Extension Development Host mới.

Bạn cũng có thể nhấp đúp vào `START_PIXEL_PILOT.cmd`.

## Các chế độ

```powershell
# Khởi động nhanh; dùng mock InvokeAI khi server thật chưa chạy
npm start

# Chỉ dùng backend thật, không tự mở mock
npm run start:real

# Thử khởi động thêm ComfyUI local GPU
npm run start:gpu

# Dừng mock server do Pixel Pilot tạo
npm stop
```

Trong VS Code, mở **Terminal → Run Task** và chọn **Pixel Pilot: Start Everything** để khởi động mà không cần gõ lệnh.

> Mock InvokeAI chỉ phục vụ kiểm thử giao diện và luồng tích hợp. Để tạo ảnh thật, dùng `npm run start:real` cùng InvokeAI, ComfyUI hoặc Runware API key.

# Pixel Pilot for VS Code

Pixel Pilot là extension chỉnh sửa ảnh trong VS Code với Sidebar Assistant và Canvas Studio. Extension kết hợp xử lý ảnh cục bộ bằng Sharp với các provider tùy chọn như ComfyUI, InvokeAI và Runware. Tác vụ dùng model chỉ khả dụng khi provider, model và các quyền cần thiết đã được cấu hình.

**Trạng thái:** mã nguồn và fixture test cho B01–B27 đã có; [release gate](docs/COPILOT_RELEASE_EVIDENCE.md) chưa hoàn tất. Chưa xác nhận bản phát hành chạy trên OS sạch hoặc mọi cấu hình provider. Xem [báo cáo tiến độ](docs/COPILOT_IMPLEMENTATION_PROGRESS.md) để biết bằng chứng và phần còn thiếu.

## Chức năng

| Nhóm | Khả năng và giới hạn |
| --- | --- |
| Canvas và phiên làm việc | Mở ảnh, xem trước/so sánh, lịch sử DAG, quay lại node và tạo nhánh. Kết quả chỉ được coi là đã áp dụng sau khi lưu vào session thành công. |
| Xử lý ảnh cục bộ | Sharp hỗ trợ các thao tác pixel cơ bản như resize, filter, mask và phân tích metadata. Kết quả này không được gọi là suy luận neural. |
| AI ảnh cục bộ | Generate qua InvokeAI hoặc ComfyUI khi server và model sẵn sàng. Các công cụ khác phụ thuộc capability thực tế của ComfyUI. Không có model thì công cụ báo không khả dụng. |
| Recolor chọn lọc | Cần Python, model ONNX và ComfyUI foreground model. VSIX không chứa model ONNX; xem [hướng dẫn cài đặt](docs/SETUP_GUIDE.md). Chưa có kiểm chứng chất lượng bảo vệ da trên tập ảnh đại diện. |
| Cloud | Runware và LLM cloud cần key trong VS Code SecretStorage, Workspace Trust và xác nhận trước thao tác liên quan. Offline mode chặn request cloud. Chi phí và tốc độ phụ thuộc provider; không có mức cố định được bảo đảm. |
| Công cụ phụ | OCR, image-to-code và batch có các đường thực thi riêng; kiểm tra provider và quyền trước khi dùng. |

Một số công cụ có thể hiện trong UI nhưng báo *unavailable* theo môi trường. Fixture/mock chỉ dành cho phát triển hoặc kiểm thử và không phải bằng chứng provider thật.

## Chạy từ mã nguồn

Yêu cầu: Node.js, npm và VS Code tương thích với [manifest](package.json). Ma trận OS/runtime cho bản phát hành còn cần smoke test.

```powershell
npm.cmd ci
npm.cmd --prefix webview-ui ci
npm.cmd run check
```

Mở repo trong VS Code và nhấn **F5** để chạy Extension Development Host. Chọn **Pixel Pilot** ở Activity Bar hoặc chạy lệnh **Pixel Pilot: Open AI Studio (Canvas)**. Có thể chạy `npm.cmd run test:e2e` để kiểm tra activation và command trong Extension Development Host. Kiểm thử này chưa bao phủ toàn bộ luồng UI.

## Provider và bảo mật

- Cấu hình Runware qua lệnh **Pixel Pilot: Configure AI API Key**. Key được lưu trong SecretStorage; file `.env` không được tự quét để nạp credential.
- Bật InvokeAI hoặc ComfyUI cục bộ và cài model/tool tương ứng trước khi chạy tác vụ AI. Khả năng sẵn dùng được kiểm tra theo từng tool.
- Khi cần làm việc hoàn toàn cục bộ, bật `pixelPilot.offlineMode`. Tool không có provider cục bộ sẽ báo không khả dụng.
- Cần tin cậy workspace và chấp thuận rõ ràng trước các tác vụ cloud hoặc ghi file theo chính sách của extension.

Chi tiết cài đặt và khắc phục lỗi: [SETUP_GUIDE.md](docs/SETUP_GUIDE.md).

## Kiểm thử và đóng gói

```powershell
npm.cmd run lint
npm.cmd run check
npm.cmd run package:vsix
npm.cmd run package:vsix:install-smoke
```

VSIX install smoke dùng profile cô lập để kiểm tra extension ID, Sharp và hành vi recolor khi thiếu model. Đây chưa phải thử nghiệm trên Windows cài sạch. Các demo provider/model thật, kiểm thử trên OS/runtime được quảng bá và các luồng UI E2E vẫn cần bằng chứng theo [release checklist](docs/COPILOT_RELEASE_EVIDENCE.md).

## Tài liệu

- [Kế hoạch phát triển](docs/COPILOT_DEVELOPMENT_PLAN.md)
- [Tiến độ triển khai](docs/COPILOT_IMPLEMENTATION_PROGRESS.md)
- [Bằng chứng release cần thu thập](docs/COPILOT_RELEASE_EVIDENCE.md)
- [Đề cương nghiên cứu](docs/ACADEMIC_RESEARCH_PROPOSAL.md)

Giấy phép: MIT.

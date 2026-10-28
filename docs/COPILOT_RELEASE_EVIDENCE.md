# Pixel Pilot Copilot — Release Evidence

Không đánh dấu một ô là pass nếu không có ngày chạy, người chạy, môi trường và log/screenshot có thể kiểm tra. Fixture/unit test không thay thế các smoke bên dưới.

## 1. Build và package

| Gate | Lệnh | Bằng chứng cần lưu | Trạng thái |
| --- | --- | --- | --- |
| Source-policy lint | `npm.cmd run lint` | Output CI/local | Automatable |
| Regression suite | `npm.cmd run check` | TAP summary | Automatable |
| NPM tarball | `npm.cmd run package:smoke` | Package file manifest | Automatable |
| VSIX structural smoke | `npm.cmd run package:vsix` | Đường dẫn/sha256 VSIX | Automatable |
| Isolated-profile install + Sharp | `npm.cmd run package:vsix:install-smoke` | Extension ID và Sharp output | Automatable trên Windows có VS Code CLI |
| Extension Development Host E2E | `npm.cmd run test:e2e` | VS Code 1.85.2 isolated profile; activation/commands/Studio output | Automatable |

## 2. Clean-OS acceptance

Thực hiện trên Windows mới hoặc VM snapshot không chứa Node modules, extension profile, ComfyUI hay Pixel Pilot runtime cũ.

| Mục | Ghi nhận bắt buộc | Pass/Fail |
| --- | --- | --- |
| OS/VS Code | Windows build, VS Code version, architecture | |
| VSIX install | VSIX sha256, install command, extension ID/version hiện trong Extensions | |
| Activation | Mở Activity Bar/Studio, không có extension-host error | |
| Offline/no-model | Bật offline mode; capability unavailable phải có lý do, không network call | |
| Restricted Mode | Workspace Trust denied; cloud/write action bị từ chối an toàn | |
| Sharp path | Analyze và local basic edit trên PNG fixture; output artifact hợp lệ | |
| Recolor prerequisites | Python path, ONNX sha256, ComfyUI foreground model/version; nếu thiếu phải hiển thị unavailable, không success giả | |
| Cancel/reconnect | Hủy run và reload webview; không commit kết quả muộn | |

## 3. Provider demo — ba lần lặp

Chỉ chạy khi người sở hữu credential đã opt-in. Không ghi secret, prompt/ảnh nhạy cảm hay raw image data vào bảng này.

| Run | Ngày/giờ | Provider/model/version | Tool và input fixture ID | Trust/consent | Kết quả, artifact ID, log redacted | Pass/Fail |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

## 4. E2E Extension Host

Runner cần chạy trong Extension Development Host; không thay thế bằng unit test hay chỉ `code --install-extension`.

| Flow | Assertion tối thiểu | Pass/Fail |
| --- | --- | --- |
| Sidebar/Studio parity | Cùng intent tạo cùng tool run hoặc typed unavailable | |
| Confirmation | Auto-deny/deny không gọi cloud; approve có run ID terminal | |
| Session pinning | Đổi session/node trong lúc run không đổi selection của session mới | |
| Branch/undo | Rollback không gọi lại provider | |
| Keyboard/a11y | Focus, Esc, B/E, zoom và narrow sidebar hoạt động | |

Khi tất cả bảng trên có evidence, cập nhật `COPILOT_IMPLEMENTATION_PROGRESS.md` và mới được xem xét đóng B28/B29.

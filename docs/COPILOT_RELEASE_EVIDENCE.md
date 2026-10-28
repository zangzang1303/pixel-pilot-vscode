# Pixel Pilot Copilot — Release Evidence

Không đánh dấu một ô là pass nếu không có ngày chạy, người chạy, môi trường và log/screenshot có thể kiểm tra. Fixture/unit test không thay thế các smoke bên dưới.

## 1. Build và package

| Gate | Lệnh | Bằng chứng cần lưu | Trạng thái |
| --- | --- | --- | --- |
| Source-policy lint | `npm.cmd run lint` | Output CI/local | Automatable |
| Regression suite | `npm.cmd run check` | TAP summary | Automatable |
| NPM tarball | `npm.cmd run package:smoke` | Package file manifest | Automatable |
| VSIX structural smoke | `npm.cmd run package:vsix` | Đường dẫn/sha256 VSIX | Automatable |
| Isolated-profile install + Sharp/recolor thiếu model | `npm.cmd run package:vsix:install-smoke` | Extension ID, Sharp output, lỗi recolor đúng khi thiếu model | Automatable trên Windows có VS Code CLI |
| Extension Development Host E2E | `npm.cmd run test:e2e` | VS Code 1.85.2 isolated profile; activation/commands/Studio output | Automatable |
| E2E từ cây VSIX đã cài | `npm.cmd run test:e2e:vsix` | Build sạch, install smoke, Extension Host nạp thư mục extension đã cài và kiểm tra activation/commands/Studio | Automatable trên Windows có VS Code desktop |

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

## 5. Kết quả chạy cục bộ ngày 28/10/2026

Người chạy: Codex trong workspace phát triển. Môi trường: Windows NT 10.0.22621.0 x64, Node 24.11.1, npm 11.6.2, VS Code CLI 1.143.1. Đây là máy phát triển hiện tại và profile cài extension cô lập, **không phải Windows/VM cài sạch**. Output tóm tắt dưới đây có thể tái lập bằng các lệnh trong bảng.

| Gate | Kết quả quan sát |
| --- | --- |
| `npm.cmd run check` | PASS, build webview/Host và 96/96 test; số benchmark fixture thay đổi theo lần chạy. |
| `npm.cmd run lint` | PASS, source-policy lint và host/webview type-check. |
| `npm.cmd run package:vsix` | PASS sau khi đồng bộ Sharp cài cục bộ về 0.35.5 theo lockfile. Build xóa `out` cũ; VSIX không còn ba module panel/protocol legacy. Artifact cuối lượt này: `dist/pixel-pilot-vscode-1.1.0.vsix`, SHA-256 `C84CF4446AB355FDAFD75790A9D0052175C890E8D8F258FE4EFA286CAD966F6F`. |
| `npm.cmd run package:vsix:install-smoke` | PASS. CLI báo install thành công; extension ID `pixel-pilot-team.pixel-pilot-vscode`; output `Installed VSIX Sharp runtime smoke passed.` và `Installed VSIX recolor missing-model behavior passed.` |
| `npm.cmd run test:e2e` | PASS khi chạy ngoài sandbox Windows với VS Code 1.143.1 đã cài, profile E2E cô lập; extension host kích hoạt Pixel Pilot và runner exit code 0. Probe executable đã bỏ `ELECTRON_RUN_AS_NODE` để không nhận nhầm Code.exe thành Node. Chỉ xác minh activation/commands/mở Studio, chưa kiểm tra UI critical flows. |
| `npm.cmd run test:e2e:vsix` | PASS ngoài sandbox Windows: build sạch, đóng gói, cài vào profile cô lập, Extension Host nạp `scratch/vsix-smoke/extensions/pixel-pilot-team.pixel-pilot-vscode-1.1.0` và exit code 0. Kiểm tra trực tiếp archive thấy 0 entry cho `ImageStudioPanel`, `WebviewMessageProtocol`, `out/webview/StudioPanel`. Chưa kiểm tra UI critical flows. |
| `npm.cmd run provider:smoke:local` | CHƯA PASS: `ECONNREFUSED 127.0.0.1:8188`; không có ComfyUI chạy ở loopback khi kiểm tra. Không ghi nhận demo provider/model thật. |

Lần đóng gói đầu tiên dừng ở `npm ls` vì `node_modules/sharp` cục bộ là 0.33.5 trong khi manifest/lockfile yêu cầu 0.35.5. Sau khi cài đúng phiên bản, structural và install smoke pass. Điều này chứng minh dependency của môi trường phát triển cần được đồng bộ trước khi đóng gói; chưa chứng minh clean install.

### Ma trận OS/runtime cần xác minh

| Môi trường | Build/VSIX | Sharp từ VSIX | Recolor có model | UI E2E critical flows | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| Windows 10.0.22621 x64, VS Code 1.143.1, Node 24.11.1; máy phát triển | Pass, gồm E2E từ cây VSIX đã cài | Pass | Chưa chạy; thiếu model và ComfyUI | Activation/commands/Studio pass; UI flows chưa chạy | Một phần |
| Windows/VM cài sạch, VS Code tối thiểu 1.85.x | Chưa chạy | Chưa chạy | Chưa chạy | Chưa chạy | Chờ bằng chứng |
| macOS, Linux, Remote SSH (nếu quảng bá hỗ trợ) | Chưa chạy | Chưa chạy | Chưa chạy | Chưa chạy | Chưa được xác nhận |

Các bản ghi Extension Development Host E2E trước đó chỉ kiểm tra activation, public commands và mở Studio; chúng không bao phủ toàn bộ hàng UI E2E ở bảng trên.

Khi tất cả bảng bắt buộc có evidence, cập nhật `COPILOT_IMPLEMENTATION_PROGRESS.md` rồi mới xem xét đóng B28/B29.

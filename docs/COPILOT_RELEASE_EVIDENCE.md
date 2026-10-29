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
| Windows 10.0.22621 x64, VS Code 1.143.1, Node 24.11.1; máy phát triển | Pass, gồm E2E từ cây VSIX đã cài | Pass | Pass 3/3 lượt Node smoke với ComfyUI/BiRefNet + ONNX trên một fixture; chưa thử từ UI/VSIX | Activation/commands/Studio pass; UI flows chưa chạy | Một phần |
| Windows/VM cài sạch, VS Code tối thiểu 1.85.x | Chưa chạy | Chưa chạy | Chưa chạy | Chưa chạy | Chờ bằng chứng |
| macOS, Linux, Remote SSH (nếu quảng bá hỗ trợ) | Chưa chạy | Chưa chạy | Chưa chạy | Chưa chạy | Chưa được xác nhận |

Các bản ghi Extension Development Host E2E trước đó chỉ kiểm tra activation, public commands và mở Studio; chúng không bao phủ toàn bộ hàng UI E2E ở bảng trên.

Khi tất cả bảng bắt buộc có evidence, cập nhật `COPILOT_IMPLEMENTATION_PROGRESS.md` rồi mới xem xét đóng B28/B29.

## 6. Rà soát tiếp ngày 29/10/2026

Người chạy: Codex, cùng máy phát triển Windows 10.0.22621 x64 và VS Code 1.143.1 ở mục 5. `npm.cmd run check` pass **98/98** (34 file test); `npm.cmd run lint` pass; `npm.cmd run test:e2e:vsix` pass với Extension Host nạp cây VSIX đã cài. VSIX mới: `dist/pixel-pilot-vscode-1.1.0.vsix`, SHA-256 `27BA50D586826D39FA20C6547E20350D30CB77DA8012D8788451781227C69AD0`. Hash ở mục 5 là bản trước thay đổi này.

`scripts/run-local-provider-smoke.cjs` giờ dùng fixture chân dung trong repo mặc định (`test_images/01_original/TC1.jpg`, recolor tóc sang xanh), hoặc một fixture nằm trong workspace được truyền sau `--`. Trước khi ghi evidence, script yêu cầu `PIXEL_PILOT_PYTHON`, ONNX model có SHA-256 đúng, ComfyUI có `RemoveBackground` và foreground model có tên, rồi xác nhận ảnh đầu ra khác ảnh gốc ở mức pixel RGB trong cả ba lượt. Report chỉ ghi model/hash/fixture và kích thước, không ghi đường dẫn Python hay raw ảnh. Ba lượt Node smoke này vẫn chưa thay thế demo trong UI/VSIX trên máy sạch.

**Kết quả prerequisite trên máy hiện tại:** Python `C:\AI\ComfyUI\.venv\Scripts\python.exe` có NumPy/Pillow nhưng thiếu `onnxruntime`; `.pixelpilot_runtime/selfie_multiclass.onnx` chưa có; ComfyUI cổng 8188 offline và cây `custom_nodes` không có `LoadBackgroundRemovalModel`. Lệnh `npm.cmd run provider:smoke:local` dừng trước khi gọi provider với thông báo thiếu ONNX model, không tạo report “pass” mới. Chưa cài model/custom node trong lượt này; B28 và ba lượt provider thật vẫn **chưa đạt**.

## 7. Local provider runtime smoke ngày 29/10/2026

Người chạy: Codex trên cùng máy phát triển Windows ở mục 5. Bật ComfyUI cục bộ 0.42.0 ở `127.0.0.1:8188` trong phiên tạm. API `/object_info` công bố `RemoveBackground`, `LoadBackgroundRemovalModel` và `birefnet.safetensors`; node này khả dụng dù không nằm dưới cây `custom_nodes` đã kiểm tra ở mục 6. Chạy `scripts/setup_recolor.ps1`: Python hệ thống 3.12 cài wheel ONNX Runtime 1.23.2 vào `.pixelpilot_runtime` vì ComfyUI venv không có pip; script xác minh cùng ABI, ComfyUI Python import thành công và SHA-256 của `selfie_multiclass.onnx` bằng `35EC1ECD9EE7F85073C99C00020B7F6751B69506EEACF683BC8665F6117F85B0`.

Lệnh `$env:PIXEL_PILOT_PYTHON='C:\AI\ComfyUI\.venv\Scripts\python.exe'; npm.cmd run provider:smoke:local` pass **3/3** lượt `recolor(hair, blue)` trên fixture `test_images/01_original/TC1.jpg`. Report máy đọc được: [`evals/release/local_provider_smoke.json`](../evals/release/local_provider_smoke.json), tạo lúc `2026-10-29T14:22:51Z`. Input SHA-256 `3763bea91321d200194374520626b75244ef79bc3a983a6546db0e359a265d51`; cả ba output PNG 452×678 có SHA-256 `a9ae352e93ad671e65a802101c835c143b10bd4be71fcc0b39ccb71424e056e2`, mỗi lượt đổi 224843/306456 pixel RGB. Thời gian lần lượt 11380, 7305, 7937 ms. Kiểm tra trực quan một output cho thấy tóc chuyển xanh và vùng da chính được giữ; chưa có chấm điểm chất lượng ảnh/giữ da độc lập.

Ba lượt trên chạy trực tiếp từ Node và một fixture, không qua webview, consent hay cây VSIX cài trên máy sạch; do đó bảng demo ở mục 3 và UI E2E ở mục 4 vẫn để trống. B28/B29 vẫn **một phần**. Phiên ComfyUI tạm được dừng sau kiểm tra.

Sau thay đổi script, `npm.cmd run check` pass 98/98 và `npm.cmd run lint` pass. `npm.cmd run test:e2e:vsix` pass ngoài sandbox Windows: build, đóng gói, install smoke Sharp/thiếu model và activation từ cây VSIX đã cài. VSIX cuối lượt: `dist/pixel-pilot-vscode-1.1.0.vsix`, SHA-256 `24C3A99F46E1B97391E1967ADD768816C1CC8D8A6027A661B4928DE43221193D`. Lượt chạy đầu trong sandbox đã dừng ở `EACCES` khi VS Code test runner kết nối cổng 443 để resolve version; lượt ngoài sandbox pass. Hash ở mục 6 là VSIX trước thay đổi script hiện tại.

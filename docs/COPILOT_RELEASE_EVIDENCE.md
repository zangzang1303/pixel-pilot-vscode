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

## 8. Rà soát ngày 01/11/2026

Trên máy phát triển hiện tại, `npm.cmd run check` pass 98/98 và `npm.cmd run lint` pass. `npm.cmd run test:e2e:vsix` pass: VSIX được đóng gói/cài trong profile cô lập, Sharp load thành công, thiếu model recolor báo lỗi đúng, Extension Host kích hoạt và lệnh mở Studio tạo editor tab. VSIX của lượt này có SHA-256 `F67DBA822644B35155B3907C10CB7ACA5DDE934D73484034C0C2B4283A474F30`. CI Windows đã thêm cùng lệnh E2E cho cây VSIX, nhưng chưa có kết quả từ runner CI cho thay đổi này. Các bảng clean-OS, UI critical flows và ba demo qua UI/VSIX ở trên vẫn chưa có bằng chứng pass.

Sau khi sửa guard của 5 priority executors, `npm.cmd run check` pass 100/100, `npm.cmd run lint` pass và `npm.cmd run test:e2e:vsix` pass lại trên máy phát triển. VSIX mới có SHA-256 `3E9D5E76BE74929705F8EF5FCD0878E1146EC9CA0F8EB4B2DA09A13AEC476773`. Kết quả này vẫn chỉ kiểm tra activation/Studio shell, Sharp và hành vi thiếu model; chưa chạy tool qua UI hay trên OS cài sạch.

Sau khi bổ sung checkpoint B25, `npm.cmd run check` pass 102/102 và `npm.cmd run lint` pass. `npm.cmd run test:e2e:vsix` pass trên máy phát triển; VSIX SHA-256 `CB11F9B2D3000588E5A939839CBAA5BC874EA84134A52704A7B4577CCF81EF94`. Test mới chứng minh resume local sau restart và không tự gửi lại bước cloud có kết quả chưa rõ. Chưa có luồng UI resume/reconcile và chưa kiểm tra paid provider thật sau crash.

Test bổ sung chống tái sử dụng cùng plan ID với session hoặc nội dung bước khác và chống hai session chạy cùng plan đồng thời đều pass; `npm.cmd run check` sau các test này pass 104/104, `npm.cmd run lint` pass. VSIX hash ở đoạn trước là artifact được đóng gói trước khi thêm khóa theo plan. Chưa có lượt CI trên runner sạch.

VSIX E2E cuối lượt pass sau khóa theo plan: cài profile cô lập, Sharp load, trường hợp thiếu model recolor và activation/Studio tab. VSIX SHA-256 `8781BE14398F97C1FCCD204532A4655E52A69F3122852884E02A4CAFBF8C9B7C`. Đây vẫn chưa phải UI critical-flow E2E hay clean-OS acceptance.

## 9. Smoke test ngày 02/11/2026

Máy phát triển hiện tại: `npm.cmd run check` pass 109/109, `npm.cmd run lint` pass. `npm.cmd run test:e2e:vsix` pass khi trỏ runner tới VS Code đã cài: build, đóng gói, cài vào profile cô lập, Sharp runtime, trường hợp thiếu model recolor, activation/commands và mở Studio tab. VSIX SHA-256 `32F2FCE522D07B0B6450F0D4DFB79EE1F487F5D9B629227D2DA555C2FEEE3FBD`. Test mới cho checkpoint xác nhận chuỗi hai bước tiếp tục sau khi khởi động lại, không chạy lại bước đầu và ghép đúng node DAG theo artifact ID.

Các hàng UI critical flow, ba demo qua UI/VSIX và clean-OS ở trên vẫn chưa có bằng chứng; không dùng smoke test này để đóng B28/B29.

## 10. Kiểm tra ngày 03/11/2026

`npm.cmd run check` pass 110/110 và `npm.cmd run lint` pass sau khi thêm tham chiếu plan trong session, nút tiếp tục trong webview và kiểm tra checkpoint khi nhận `/resume`. Lượt `npm.cmd run test:e2e:vsix` đã build và cài VSIX thành công trong profile cô lập; Sharp runtime và trường hợp thiếu model recolor pass. Extension Host E2E dừng vì máy đang chạy `CodeSetup`, VS Code báo giữ `vscode-updating` mutex và từ chối mở instance mới. Chưa ghi nhận gate E2E này pass cho thay đổi ngày 03/11; các hàng UI flow và clean-OS vẫn chưa có bằng chứng.

Sau khi bổ sung guard màu, `npm.cmd run check` pass 111/111 và `npm.cmd run lint` pass. Đã đóng gói lại VSIX, kiểm tra cấu trúc và install smoke pass (Sharp runtime, recolor thiếu model); SHA-256 của artifact cuối: `67CF9098B6E91D031E562BEAB3175486E29CE7DA851B79B7FB36A9EAED9018BF`. Extension Host E2E chưa pass: runner trong sandbox không nhận bản VS Code cài sẵn và không thể tải bản thay thế vì mạng bị chặn; chạy trực tiếp với Code.exe cục bộ ngoài sandbox gặp mutex `vscode-updating` của trình cập nhật. UI critical flows vẫn chưa được xác minh.

Sau khi bỏ suy diễn chỉnh ảnh từ câu chat mơ hồ, chặn câu hỏi bị diễn giải thành lệnh đổi màu và bổ sung clarification cho vùng/màu, `npm.cmd run check` pass 111/111, eval fixture 120/120, `npm.cmd run lint` pass. VSIX build/cấu trúc và install smoke pass (Sharp runtime, recolor thiếu model); SHA-256 hiện tại `C56B5510F0632CDA7555AB63A2A6B87C235F8635762E17FB7650AF3DC5BBDB0A`. Chưa xác minh Extension Host hoặc UI flows của artifact này; các gate clean-OS và provider demos vẫn mở.


## 10. Implementation regression update ? 05/11/2026

Working-tree checks after T01?T07 slices and FLUX preview apply/discard wiring:

- `npm.cmd run check`: PASS; production webview build + extension-host compile + 122/122 tests.
- `npm.cmd run lint`: PASS; source-policy lint and host/webview type-check.
- Added regression coverage for batch consent/collisions, request-ID payload conflict, fetch cancellation vs timeout, and preview idempotency/stale/discard/expiry.
- No live Runware billing/quality smoke, interactive UI workflow, clean Windows VM, or pilot was run in this update. These release gates remain open.

- `npm.cmd run package:smoke -- --cache .tmp-npm-cache`: PASS; cache directory was removed after the check.
- `npm.cmd run package:vsix -- -OutputDirectory artifacts/beta-candidate-20261105`: PASS; isolated install/Sharp/missing-model smoke PASS. Candidate SHA-256: `54FD95A9F93422666EA4A2A8E5B7E907F40549D4ED218E07332AAE0C1F17BF83`.
- `npm.cmd run test:e2e`: BLOCKED by this sandbox: VS Code renderer launch failed (exit 49), with denied profile cache/network sandbox access and GPU process failure. This is not counted as an application pass/fail.


### Update after T15 batch work ? 05/11/2026

- `npm.cmd run check`: PASS, production webview build + host compile + 125/125 tests. `npm.cmd run lint`: PASS.
- Batch fixture acceptance: 10 inputs with interleaved failures; 7 retained successful outputs, retry resubmitted only the 3 failed inputs, and manifests were written. This is deterministic fixture evidence, not a live provider UI run.
- Rebuilt candidate after the batch changes; isolated install/Sharp/missing-model smoke PASS. Current candidate: `artifacts/beta-candidate-20261105/pixel-pilot-vscode-1.1.0.vsix`, SHA-256 `CD60E1DB864315987F9E0E4D9B9ACFC1882D47D7511050AF87D5030F6240B65D`.
- Extension Host E2E remains blocked in this sandbox by VS Code renderer launch failure (exit 49); clean Windows VM, live Runware smoke, UI-critical flows, and pilot remain open.


### Update after request-retention fix ? 05/11/2026

- Fixed WebviewBridge eviction so active deduplicated requests stay registered at capacity; targeted regression and full suite pass.
- `npm.cmd run check`: PASS, 126/126 tests; `npm.cmd run lint`: PASS.
- Rebuilt and reinstalled candidate; VSIX structural validation and isolated Sharp/missing-model smoke PASS. Current SHA-256: `BCBBB028406DC42B9E84D0AE61596F2ED388D212081DE7CAB614F97076B7A8C2`.


### Update after FLUX cancellation wiring ? 05/11/2026

- `npm.cmd run check`: PASS, 127/127 tests; `npm.cmd run lint`: PASS.
- FLUX box edit now receives an AbortSignal from a UI Cancel action; adapter drops a result if cancellation wins before response acceptance. Contract test verifies signal forwarding.
- Candidate rebuilt and isolated install/Sharp/missing-model smoke PASS. Current SHA-256: `13C6BDD6DE30FC048E346338B8EA5C5C6AD16A28FB3AD7C696254855CB8CB55F`.
- Interactive UI cancel behavior and paid-provider outcome still require UI/provider acceptance; Extension Host E2E/clean VM/pilot remain open.


### Update after T14 provenance and labeling slice ? 05/11/2026

- `npm.cmd run check`: PASS, 129/129 tests; `npm.cmd run lint`: PASS.
- Copilot operation latency is measured across provider execution. Runware task payloads request provider-reported cost ([Runware pricing docs](https://runware.ai/docs/platform/pricing)); persisted metrics distinguish actual, estimated, and unknown, without writing unreported cloud cost as $0.
- Basic caption fallback identifies itself as image metadata only (format, dimensions, orientation), not semantic vision. The local SVG label describes the 48x64 color-quantized Sharp tracer.
- Candidate rebuilt and structurally verified; isolated VSIX install, Sharp runtime, and missing-model behavior smoke PASS. SHA-256: `738A79574FECF06BA89073479717CB4407F7BB4A5B7216E9A68BCFA36BB9B641`.
- Still open: broader T12-T14 provider rollout/metrics on every canvas path, live provider cost/quality, interactive UI acceptance, Extension Host E2E in the sandbox, clean Windows VM, and pilot. This update does not close beta or final release gates.


### Update after T16 export implementation slice ? 05/11/2026

- `npm.cmd run check`: PASS, 132/132 tests; `npm.cmd run lint`: PASS. Dedicated image-export tests verify PNG custom bounds/aspect/alpha, WebP alpha/no enlargement, and invalid-bound rejection.
- Export now offers PNG/WebP and original/1024/2048/custom maximum bounds; resize fits inside the box without distortion or enlargement. Save uses a temporary file and rename. The active-editor snippet prompt is offered only after the export file is committed.
- VSIX candidate rebuilt and structurally verified; isolated installation, Sharp runtime, and missing-model behavior smoke PASS. SHA-256: `BF5AFA068D787877A460793D6AC80B353811A78330851D88E0113024E1AD7A9C`.
- T16 implementation is partial pending interactive VS Code acceptance for format/dimension choices, overwrite/cancel/error paths, and snippet insertion. The export operation does not mutate session nodes, so failed export leaves image history unchanged by construction; interactive proof is still open.


### T14 follow-up ? Canvas duration ? 05/11/2026

- Canvas image actions now record elapsed processing time from after Workspace Trust through provider processing, then pass it into the committed node metrics. FLUX continues to use Runware request timing.
- `npm.cmd run check`: PASS, 137/137; `npm.cmd run lint`: PASS. Candidate was rebuilt, structurally verified, installed in isolation, and passed Sharp/missing-model smoke. SHA-256 at that update: `D55A93065D7481FCE3E80AA770610ADDF0EC3DD13823C3BAEAA3AA8A3E3C7A7A`.
- T14 remains partial: direct adapter calls outside the measured Copilot/Canvas ingress still contain placeholder latency, and end-to-end UI/provider cost acceptance remains open.


### T14 follow-up ? priority tools and Generate provenance ? 05/11/2026

- Priority tool and Canvas Generate paths now measure elapsed execution. Model generation records provider cost as unknown when no provider amount was returned; local deterministic tools record estimated zero rather than a fictitious billed amount. Regression tests verify these cases.
- Full check PASS 133/133; lint PASS. Current isolated-smoke VSIX SHA-256: `F2DBEA086647AD0033CB5B0F784AE0770E4AEC088597EA720A78B2355D8F5123`.
- T14 remains incomplete for direct adapter ingress outside Copilot/Canvas/priority paths and live provider/UI reconciliation.


### T17 artifact recovery and reference-aware pruning slice ? 05/11/2026

- Artifact manifest writes are serialized with unique temporary files and a last-known-good backup. A corrupt manifest is quarantined and the backup is loaded when valid. Pruning retains referenced records plus their parent/preview dependency chain and does not remove metadata when a file delete fails.
- Startup pruning now maps the SessionManager's persisted absolute artifact paths to manifest IDs before deleting unreferenced records. Tests cover backup recovery, parallel stores, dependency retention, and path-based pruning.
- `npm.cmd run check`: PASS, 137/137; `npm.cmd run lint`: PASS. Candidate structural validation and isolated installation/Sharp/missing-model smoke PASS. SHA-256: `D55A93065D7481FCE3E80AA770610ADDF0EC3DD13823C3BAEAA3AA8A3E3C7A7A`.
- T17 remains partial: recovery across simultaneous process crashes, broader session migration, and clean-profile/VM acceptance remain open.


### T14 follow-up ? Runware reported billing ? 05/11/2026

- Runware image operations now persist the `cost` returned for the matching task as `actual`; missing cost is `unknown`. Hard-coded per-operation cloud tariffs were removed. Local metadata caption fallback is explicitly labeled and timed.
- Regression tests cover reported and omitted costs. Full check PASS 139/139; lint PASS. Candidate structural verification, isolated install, Sharp runtime, and missing-model smoke PASS. SHA-256: `EA3D7EDDECA4B30199DF6879CF62F15EDB8AF276FB3AF4EC9E55F46EF749C5E1`.
- Provider live billing remains unverified; contract tests do not prove the account's production billing response. Direct legacy adapter metrics outside the measured ingress paths remain under review.


### T18 integration regression ? FLOW-05 ? 05/11/2026

- Simulated a delayed priority tool while switching sessions and rolling back its original session. The late result remains on the captured branch; selection stays on the rollback node and the newly active session, the provider runs once, and reopening the store preserves both.
- `npm.cmd run check`: PASS, 145/145; `npm.cmd run lint`: PASS. This is host/service integration coverage, not interactive UI E2E.


### T19 quality evaluation runner scaffold ? 05/11/2026

- `scripts/quality-eval.cjs` validates quality-evaluation manifest structure and scores isolated task/provider/model groups. Five regression tests cover synthetic success, rights/hash/leakage/duplicate rejection, threshold failure, and two-rater adjudication rules. Full check PASS 145/145; source-policy lint and host/webview type-check PASS.
- This is tooling validation only. No licensed 60-image dataset, real provider/model outputs, approved final rubric, or independent rater scores are present; therefore no image-quality result or T19 acceptance is claimed. Existing `evals/release/TC1_recolor_clothes_blue.png` remains a smoke fixture, not a quality benchmark.


### T20 Extension Host shell smoke ? 05/11/2026

- `test/e2e/extensionHost.cjs` now asserts a visible `Pixel Pilot - AI Studio` tab after opening Studio. On Windows development workspace, VS Code 1.85.2, Node 22.11.0, `PIXEL_PILOT_E2E_DISABLE_ELECTRON_SANDBOX=1 npm.cmd run test:e2e` PASS; activation, command registration, visible Studio tab, and no-image command handling all completed in an isolated profile. `npm.cmd run lint` PASS; `npm.cmd run check` PASS, 145/145.
- The default Electron sandbox run remains blocked before extension assertions: Windows denies sandbox setup for the E2E profile Cache/Network directories and renderer exits 49. The diagnostic flag disables the Electron sandbox and GPU for this test process only; it does not count as standard-sandbox or clean-VM acceptance. No provider was called.
- This still is not UI critical-flow E2E: Canvas input, mask/box coordinates, preview/apply/discard, cancellation, session/rollback, and export require interactive acceptance. No release candidate hash is associated with this test-only change.

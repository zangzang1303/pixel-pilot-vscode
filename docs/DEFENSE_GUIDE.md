# Hướng dẫn demo và bảo vệ Pixel Pilot

Tài liệu này mô tả kịch bản demo **có điều kiện**. Không trình bày số liệu hoặc capability của provider như kết quả đã kiểm chứng nếu chưa có log, môi trường, model và artifact tương ứng trong [release evidence](COPILOT_RELEASE_EVIDENCE.md). Tiến độ kỹ thuật hiện tại ở [COPILOT_IMPLEMENTATION_PROGRESS.md](COPILOT_IMPLEMENTATION_PROGRESS.md).

## Chuẩn bị trước buổi demo

1. Cài VSIX vào VS Code profile cô lập, kiểm tra activation, Sidebar và Studio. Ghi phiên bản VS Code, OS, VSIX SHA-256 và extension ID.
2. Chọn một ảnh fixture được phép sử dụng. Ghi kích thước, format và hash; không dùng ảnh nhạy cảm.
3. Chạy `npm.cmd run check` và `npm.cmd run package:vsix:install-smoke`. Kiểm tra từng provider/model thực tế sẽ dùng, gồm capability theo tool.
4. Nếu demo cloud, chủ sở hữu key tự cấu hình trong SecretStorage và chấp thuận gửi dữ liệu/chi phí. Không ghi key lên màn hình, slide hoặc log.
5. Chuẩn bị một lượt offline/no-model để cho thấy trạng thái *unavailable* có lý do. Fixture/mock chỉ được giới thiệu là mô phỏng.

## Kịch bản 3–5 phút

| Bước | Thao tác | Điều cần quan sát |
| --- | --- | --- |
| 1. Mở ảnh | Mở Sidebar hoặc Studio, nạp PNG/JPEG fixture. | Ảnh hiển thị và session/node gắn đúng ảnh. |
| 2. Phân tích và sửa | Chọn một tool đã probe sẵn. Nếu demo remove background bằng ComfyUI/Runware, ghi provider và model được dùng. | Tool run có tiến độ, kết quả khác ảnh gốc và provenance rõ. Nếu provider thiếu, UI báo unavailable. |
| 3. So sánh | Mở before/after, xem ảnh gốc và preview; chọn áp dụng hoặc hủy. | Preview và apply là hai trạng thái khác nhau; hủy không thay đổi session. |
| 4. Lịch sử | Chọn node trước đó, tạo một nhánh chỉnh sửa khác. | DAG quay về artifact đã lưu, không gọi lại provider chỉ để undo/branch. |
| 5. Giới hạn | Bật offline mode hoặc ngắt provider. | Cloud không được gọi; tool thiếu model báo lỗi rõ, không trả placeholder như thành công. |

Inpaint chỉ nên demo khi mask và provider hỗ trợ thật. Recolor chọn lọc cần Python/ONNX/ComfyUI foreground model và chưa có bằng chứng chất lượng bảo vệ da trên tập đại diện. Vectorize cần kiểm tra SVG đầu ra với fixture cụ thể; không khẳng định mọi ảnh bitmap đều thành vector chính xác.

## Cách nói về số liệu

- Chỉ đọc latency/chi phí từ run đã ghi record; phân biệt thời gian đo thật, dự toán và giá trị chưa biết.
- [Báo cáo benchmark](../benchmark/BENCHMARK_RESULTS.md) và các số liệu trong báo cáo học thuật là tài liệu nghiên cứu/lịch sử. Chúng không thay thế phép đo trên VSIX/provider/model hiện tại. Nếu đưa vào slide, ghi rõ nguồn, phương pháp, ngày chạy và giới hạn.
- Không cam kết “SOTA”, “100%”, “không bao giờ lỗi”, tốc độ 380 ms hay chi phí $0.0006/ảnh khi chưa có bằng chứng tái lập cho đúng cấu hình demo.

## Câu hỏi phản biện thường gặp

**Mất Internet có dùng được không?** Các thao tác Sharp cục bộ và provider chạy trên máy có thể tiếp tục nếu dependency sẵn sàng. Tool chỉ có cloud hoặc thiếu model sẽ báo không khả dụng. Offline mode chặn cloud; không tự động đổi sang kết quả mô phỏng.

**DAG khác undo tuyến tính thế nào?** Một node lưu quan hệ với node cha và artifact; sau khi quay về node cũ, thao tác mới tạo nhánh. Cần mở lại session để kiểm tra persistence, và không gọi provider lại chỉ vì điều hướng lịch sử.

**Alpha matting có bảo đảm giữ tóc/vật trong suốt không?** Không. Kết quả phụ thuộc ảnh, model và provider. Đánh giá chất lượng cần ground truth, metric và tập thử riêng; không suy ra từ một ảnh demo.

**Chi phí cloud là bao nhiêu?** Phụ thuộc provider, model và chính sách giá tại thời điểm chạy. UI phải trình bày ước lượng hoặc chưa biết trước khi chấp thuận, và ghi chi phí thực khi provider trả về.

**Khi nào có thể gọi là hoàn thành?** Khi các mục Definition of Done trong [kế hoạch](COPILOT_DEVELOPMENT_PLAN.md) và bảng bằng chứng phát hành đều có kết quả kiểm tra, gồm cài sạch, E2E quan trọng, OS/runtime và ba demo provider/model thật.

# 📅 Nhật Ký Tiến Độ Đồ Án Khoa Học (Weekly Progress Logs)

> **Lưu ý lịch sử (28/10/2026):** Các tỷ lệ “100%” trong nhật ký phản ánh đánh giá ở tuần tương ứng, không xác nhận Definition of Done của bản hiện tại. Xem [tiến độ triển khai](../docs/COPILOT_IMPLEMENTATION_PROGRESS.md) và [release evidence](../docs/COPILOT_RELEASE_EVIDENCE.md).

> **Đề tài**: Nghiên cứu và phát triển công cụ hỗ trợ xử lý ảnh đa ngữ cảnh trên môi trường IDE tích hợp mô hình thị giác nhân tạo SOTA (*PixelPilot*)  
> **Học phần**: Đồ án Khoa học / Khóa luận Tốt nghiệp  
> **Mục đích**: Theo dõi tiến độ nghiên cứu, ghi nhận các mốc bàn giao (deliverables), các vấn đề kỹ thuật phát sinh và giải pháp thực thi hàng tuần.

---

## 📑 Danh Sách Báo Cáo Tiến Độ Tuần

| Tuần | Thời Gian | Trọng Tâm Nghiên Cứu & Phát Triển | Trạng Thái | Chi Tiết |
| :---: | :---: | :--- | :---: | :---: |
| **Tuần 01** | *Khởi động đề tài* | Hoàn thiện Thuyết minh đề tài (Proposal), Xây dựng Benchmark thực nghiệm (TC1-TC5), Triển khai kiến trúc VS Code Extension & kết nối 100% Runware Production API | <span style="color:#22c55e">✅ Hoàn thành xuất sắc</span> | [WEEK_01.md](./WEEK_01.md) |
| **Tuần 02** | *Chuẩn hóa Doanh nghiệp (Enterprise-Grade)* | Nâng cấp bảo mật SecretStorage, Tối ưu hóa Bộ đệm Nhị phân Disk Cache (Zero-IPC), Động cơ Xử lý Hàng loạt (Batch Processing) & Cấu hình `.pixelpilotrc.json` | <span style="color:#22c55e">✅ Hoàn thành 100%</span> | [WEEK_02.md](./WEEK_02.md) |
| **Tuần 03** | *Bộ Não AI LLM Agent & Xử lý Quang phổ* | Xây dựng Bộ não LLM Agent (Gemini Vision Multimodal & Function Calling), Giải thuật bảo vệ da mặt Skin Chrominance, Bộ công cụ 9 Tools & Báo cáo tổng kết đồ án | <span style="color:#22c55e">✅ Hoàn thành 100%</span> | [WEEK_03.md](./WEEK_03.md) |

---

## 🎯 Quy Chuẩn Báo Cáo Tuần
Mỗi báo cáo tuần tuân thủ cấu trúc 5 phần chuẩn học thuật & công nghệ:
1. **Thông tin chung & Mục tiêu trọng tâm**: Định vị mục tiêu trong lộ trình tổng thể đề tài.
2. **Chi tiết kết quả đã hoàn thành (Deliverables)**: Phân theo 3 trụ cột khoa học (Lý thuyết, Thực nghiệm, Ứng dụng thực tế).
3. **Thách thức kỹ thuật & Giải pháp (Technical Challenges & Solutions)**: Ghi chép các bug thực tế, giải pháp kiến trúc và đo kiểm.
4. **Minh chứng thực nghiệm & Đo đạc định lượng (Metrics & Evidence)**: Dữ liệu số liệu đo đạc thực tế (Latency, SSIM, PSNR, Chi phí).
5. **Kế hoạch hành động tuần kế tiếp (Next Steps)**: Nhiệm vụ chi tiết cho tuần tiếp theo.

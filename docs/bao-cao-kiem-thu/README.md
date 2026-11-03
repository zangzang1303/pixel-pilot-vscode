# Bộ biểu mẫu kiểm thử Pixel Pilot

Bộ này gồm các mẫu Markdown để hoàn thiện hồ sơ kiểm thử và nghiệm thu:

1. `01_BAO_CAO_KIEM_THU_NGUOI_DUNG.md` — báo cáo UAT tổng hợp.
2. `02_MA_TRAN_CHUC_NANG_MINH_CHUNG.md` — checklist toàn bộ chức năng và vị trí chèn ảnh.
3. `03_BIEN_BAN_GHI_NHAN_LOI.md` — mẫu ghi lỗi/khuyết điểm.
4. `04_BIEN_BAN_NGHIEM_THU.md` — biên bản kết luận nghiệm thu.

## Cách sử dụng

- Điền các phần có dấu `[ĐIỀN ...]`.
- Đổi trạng thái từng ca kiểm thử thành `PASS`, `FAIL`, `BLOCKED` hoặc `N/A`.
- Chèn ảnh ngay dưới dòng `[CHÈN ẢNH ...]`, hoặc dùng cú pháp Markdown:

```md
![Mô tả ảnh](../../evidence/ten-thu-muc/ten-anh.png)
```

- Mỗi ảnh nên hiển thị: chức năng đang thử, dữ liệu đầu vào hoặc thiết lập, kết quả và thông báo trạng thái.
- Nếu một chức năng phụ thuộc API/model chưa cài, ghi `BLOCKED` và nêu rõ điều kiện còn thiếu; không ghi `PASS` chỉ vì nút có xuất hiện.


# THƯ MỤC LƯU TRỮ ẢNH THỰC NGHIỆM (TEST DATASET)

Thư mục này dùng để lưu trữ ảnh gốc và ảnh kết quả sau khi tách nền để phục vụ việc so sánh đối đầu và đưa vào báo cáo môn học.

## Cấu trúc thư mục:
- `01_original/`: Lưu các ảnh gốc chưa xử lý.
- `02_adobe_firefly/`: Lưu ảnh PNG sau khi tách nền bằng Adobe Firefly.
- `03_runware_birefnet/`: Lưu ảnh PNG sau khi tách nền bằng Runware (BiRefNet Matting).

## Gợi ý quy ước đặt tên file đồng bộ để dễ so sánh:
1. **TC1 (Tóc bay/Chân dung)**: `tc1_hair.jpg` $\rightarrow$ `tc1_hair.png`
2. **TC2 (Lông thú mịn)**: `tc2_animal.jpg` $\rightarrow$ `tc2_animal.png`
3. **TC3 (Vật thể trong suốt)**: `tc3_transparent.jpg` $\rightarrow$ `tc3_transparent.png`
4. **TC4 (Tương phản thấp)**: `tc4_low_contrast.jpg` $\rightarrow$ `tc4_low_contrast.png`
5. **TC5 (Cấu trúc rỗng/kẽ tay)**: `tc5_complex_hollow.jpg` $\rightarrow$ `tc5_complex_hollow.png`

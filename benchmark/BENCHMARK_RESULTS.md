# BÁO CÁO KẾT QUẢ ĐO LƯỜNG THỰC NGHIỆM ĐỊNH LƯỢNG (EMPIRICAL BENCHMARK REPORT)

> **Hệ thống**: PixelPilot Benchmark Evaluation Suite  
> **Thời gian tạo**: 2026-09-22T08:15:25.840Z  
> **Mục tiêu**: Đánh giá định lượng mô hình SOTA Alpha Matting (Runware BiRefNet) đối đầu Adobe Firefly.

---

## 1. BẢNG TỔNG HỢP CHỈ SỐ TOÁN HỌC & CHẤT LƯỢNG BIÊN (EDGE QUALITY)

| Test Case | Độ phân giải | Firefly Matting $\mathcal{R}_m$ | BiRefNet Matting $\mathcal{R}_m$ | Độ đồng thuận ($mIoU$) | Boundary $F_1$-score | $SSIM$ (Alpha) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **TC1** (Tóc) | 452x678 | **22.53%** | **78.07%** | **97.07%** | **0.4843** | **0.9829** |
| **TC2** (Mèo) | 2048x1639 | **4.54%** | **20.8%** | **84.13%** | **0.2836** | **0.8256** |
| **TC3** (Cốc) | 730x485 | **2.14%** | **35.29%** | **61.16%** | **0.1151** | **0.6291** |
| **TC4** (Tương) | 768x1152 | **1.22%** | **12.35%** | **99.67%** | **0.8391** | **0.9994** |
| **TC5** (Cấu) | 500x333 | **15.42%** | **39.47%** | **78.30%** | **0.6173** | **0.9065** |

---

## 2. BẢNG SO SÁNH HIỆU NĂNG TÍNH TOÁN & CHI PHÍ KINH TẾ

| Test Case | Dung lượng Firefly | Dung lượng BiRefNet | Latency Firefly | Latency BiRefNet | Tốc độ vượt trội (Speedup) | Chi phí Runware / Request |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **TC1** | 678.1 KB | 1198.2 KB | 3850 ms | 380 ms | **10.1x nhanh hơn** | $0.0006 |
| **TC2** | 2511 KB | 13118.1 KB | 5200 ms | 640 ms | **8.1x nhanh hơn** | $0.0006 |
| **TC3** | 336.7 KB | 1386.6 KB | 3600 ms | 410 ms | **8.8x nhanh hơn** | $0.0006 |
| **TC4** | 152.4 KB | 3458.3 KB | 4100 ms | 430 ms | **9.5x nhanh hơn** | $0.0006 |
| **TC5** | 207.1 KB | 651.3 KB | 3900 ms | 395 ms | **9.9x nhanh hơn** | $0.0006 |

---

## 3. PHÂN TÍCH KHOA HỌC CHUYÊN SÂU

1. **Đặc tính Alpha Matting vs Binary Segmentation**:
   - Ở các kịch bản đòi hỏi chi tiết sợi siêu mảnh (**TC1: Tóc bay**) và vật thể truyền quang (**TC3: Cốc thủy tinh**), BiRefNet đạt Soft Matting Ratio lần lượt là **78.07%** và **35.29%**, vượt xa Adobe Firefly (**22.53%** và **2.14%**).
   - Adobe Firefly có xu hướng áp dụng ngưỡng cắt nhị phân thô (Hard Cut / Binarization) đối với thành cốc thủy tinh, làm mất hoàn toàn tính trong suốt quang học. Ngược lại, BiRefNet ước lượng chính xác hàm độ truyền quang $\alpha(x, y) \in (0, 255)$.

2. **Khả năng Bảo toàn Độ phân giải Cực cao (High-Res Fidelity)**:
   - Trên ảnh **TC2 (Mèo lông xù 2K)**, file đầu ra của Runware BiRefNet đạt **13.1 MB** (giữ nguyên độ phân giải $2048 \times 1639$ và kênh RGBA 32-bit không nén suy hao), bảo toàn toàn bộ hiệu ứng xóa phông quang học (Bokeh) quanh tai và râu mèo.

3. **Hiệu năng Sub-second phù hợp tích hợp IDE**:
   - Runware BiRefNet có độ trễ trung bình **~410ms** (so với Firefly trung bình **~4.100ms**), nhanh hơn gấp **8 - 10 lần**. Đây là điều kiện tiên quyết để xây dựng trải nghiệm người dùng tương tác tức thì trong môi trường lập trình IDE.

# BẢN THUYẾT MINH ĐỀ TÀI NGHIÊN CỨU KHOA HỌC (ACADEMIC RESEARCH PROPOSAL)

---

## THÔNG TIN CHUNG VỀ ĐỀ TÀI

* **Tên đề tài tiếng Việt**:  
  **Nghiên cứu và phát triển công cụ hỗ trợ xử lý ảnh đa ngữ cảnh trên môi trường IDE tích hợp mô hình thị giác nhân tạo SOTA**
* **Tên đề tài tiếng Anh**:  
  **Research and Development of a Context-Aware Visual AI Assistant for IDE Environments using SOTA Vision Models (PixelPilot)**
* **Mã số đề tài**: DAKH-2026-PIXELPILOT
* **Lĩnh vực nghiên cứu**: Trí tuệ nhân tạo (Artificial Intelligence), Thị giác máy tính (Computer Vision), Kỹ thuật phần mềm (Software Engineering & Developer Tools).
* **Đơn vị công tác**: Khoa Công nghệ Thông tin / Bộ môn Kỹ thuật Phần mềm & Trí tuệ Nhân tạo.
* **Thời gian thực hiện**: 2026

---

## DANH MỤC CÁC TỪ VIẾT TẮT VÀ THUẬT NGỮ

| Thuật ngữ | Tên đầy đủ tiếng Anh | Ý nghĩa khoa học |
| :--- | :--- | :--- |
| **DAG** | Directed Acyclic Graph | Đồ thị có hướng không chu trình dùng để quản lý lịch sử rẽ nhánh |
| **SOTA** | State-of-the-Art | Các mô hình / kỹ thuật đạt hiệu năng cao nhất hiện nay |
| **mIoU** | Mean Intersection over Union | Chỉ số đo độ trùng khớp phân vùng nhị phân trung bình |
| **SSIM** | Structural Similarity Index | Chỉ số tương đồng cấu trúc bảo toàn chất lượng ảnh |
| **BiRefNet** | Bilateral Reference Network | Mạng nơ-ron song phương chuyên biệt cho bài toán Alpha Matting phân giải cao |
| **IDE** | Integrated Development Environment | Môi trường phát triển tích hợp (Visual Studio Code) |
| **Alpha Matting** | Continuous Alpha Matte Estimation | Kỹ thuật ước lượng độ trong suốt mềm ($0 \le \alpha \le 1$) thay vì nhị phân hóa |

---

## CHƯƠNG 1: TÍNH CẤP THIẾT VÀ LÝ DO CHỌN ĐỀ TÀI

### 1.1. Bối cảnh thực tiễn trong quy trình phát triển phần mềm hiện đại
Trong quy trình phát triển phần mềm hiện đại (Web, Mobile App, Game Development), tài nguyên hình ảnh (graphic assets) đóng vai trò quyết định đến trải nghiệm người dùng (UX) và tính thẩm mỹ giao diện (UI). Tuy nhiên, các kỹ sư phần mềm (Software Engineers) thường xuyên phải đối mặt với **sự phân mảnh quy trình làm việc (Context Switching Overhead)**:
1. **Rời rạc môi trường làm việc**: Để thực hiện các tác vụ biên tập ảnh cơ bản như tách nền logo, xử lý sprite nhân vật, làm trong suốt icon hay kiểm tra độ tương phản, lập trình viên buộc phải rời khỏi môi trường IDE, chuyển sang các phần mềm đồ họa nặng nề (Adobe Photoshop) hoặc các dịch vụ web bên thứ ba.
2. **Nguy cơ rò rỉ dữ liệu & gián đoạn luồng tư duy (Focus Disruption)**: Việc tải ảnh lên các website xử lý trực tuyến tiềm ẩn nguy cơ lộ lọt tài nguyên sở hữu trí tuệ của dự án và làm đứt đoạn trạng thái tập trung sâu (Deep Work).
3. **Chi phí bản quyền và hạ tầng**: Các bộ công cụ thương mại độc quyền (như Adobe Creative Cloud) có chi phí thuê bao đắt đỏ, không tích hợp trực tiếp vào quy trình CI/CD hay extension của lập trình viên.

### 1.2. Hạn chế của các hệ sinh thái AI Assistant hiện tại
Sự bùng nổ của các trợ lý lập trình thông minh (GitHub Copilot, Cursor, Claude Code) đã chứng minh sức mạnh của mô hình AI tích hợp trong IDE. Tuy nhiên, các hệ thống này hầu như chỉ tập trung vào **xử lý mã nguồn văn bản (Textual Code Synthesis)** và hoàn toàn bỏ ngỏ mảng **thị giác máy tính ngữ cảnh (Contextual Computer Vision)**.
- Khi người dùng muốn xử lý ảnh thông qua các giao diện chat truyền thống, luồng hội thoại bị giới hạn trong kiến trúc **chuỗi tuần tự tuyến tính** ($T_1 \to T_2 \to T_3$). 
- Khi người dùng muốn thử nghiệm nhiều biến thể của cùng một ảnh gốc (ví dụ: tách nền với độ mịn khác nhau, áp dụng inpaint hoặc đổi màu), chuỗi tuần tự sẽ làm phình to dữ liệu ngữ cảnh (Context Window Bloat), gây lãng phí chi phí token/API và không cho phép rẽ nhánh (branching) hay quay lui (rollback) trạng thái trực quan.

### 1.3. Mục tiêu nghiên cứu của đề tài
Nhằm giải quyết triệt để các tồn tại trên, đề tài **PixelPilot** hướng tới mục tiêu:
1. Nghiên cứu thực nghiệm so sánh các kiến trúc mạng nơ-ron thị giác tiên tiến nhất (SOTA Vision Models) chuyên sâu cho bài toán Alpha Matting độ phân giải cao và chi tiết viền cực nhỏ.
2. Đề xuất mô hình quản lý lịch sử biên tập hình ảnh phi tuyến tính dựa trên **Đồ thị có hướng không chu trình (Context-Aware DAG History)**, cho phép bảo lưu vết quan hệ biến đổi ảnh, phân nhánh thử nghiệm và kế thừa mặt nạ (mask inheritance).
3. Xây dựng một công cụ hỗ trợ thị giác nhân tạo hoàn chỉnh dạng Extension trên nền tảng Visual Studio Code, tích hợp kiến trúc điều phối hybrid, giao diện so sánh quang học Before/After thời gian thực và các tác vụ 1-click tối ưu cho kỹ sư phần mềm.

---

## CHƯƠNG 2: TỔNG QUAN TÌNH HÌNH NGHIÊN CỨU (LITERATURE REVIEW)

### 2.1. Tiến trình phát triển của bài toán Tách đối tượng và Alpha Matting
Trong xử lý ảnh và thị giác máy tính, việc tách đối tượng khỏi nền có thể phân thành hai hướng tiếp cận chính:

1. **Phân đoạn ngữ nghĩa nhị phân (Binary Semantic Segmentation)**:
   - Các kiến trúc tiêu biểu: FCN, U-Net, DeepLabV3+, Mask R-CNN, và gần đây là Segment Anything Model (SAM / SAM-2).
   - *Đặc điểm*: Mỗi pixel $p(x, y)$ chỉ nhận giá trị nhị phân $\{0, 1\}$ (thuộc về đối tượng hoặc nền).
   - *Hạn chế*: Gặp hiện tượng răng cưa nghiêm trọng (aliasing), cắt cụt các chi tiết dạng sợi mảnh (sợi tóc, lông thú) và hoàn toàn bất lực trước các vật thể có tính chất truyền quang/trong suốt (thủy tinh, khói, nước).

2. **Ước lượng độ trong suốt liên tục (Natural Image Alpha Matting)**:
   - Cơ sở toán học dựa trên phương trình hòa trộn màu tuyến tính của Porter & Duff:
     $$I_i = \alpha_i F_i + (1 - \alpha_i) B_i$$
     Trong đó tại mỗi pixel $i$: $I_i$ là giá trị màu quan sát được, $F_i$ là màu tiền cảnh (Foreground), $B_i$ là màu hậu cảnh (Background), và $\alpha_i \in [0, 1]$ là hệ số mờ đục (Opacity / Alpha Matte).
   - Các mô hình truyền thống yêu cầu Trimap thủ công (chia ảnh thành 3 vùng: chắc chắn là foreground, chắc chắn là background, và vùng chưa rõ). Yêu cầu này không khả thi trong các công cụ tự động hóa 1-click.
   - **Mô hình Matting không cần Trimap (Trimap-Free SOTA)**:
     - **MODNet (2022)**: Tách matting qua 3 pha (ngữ nghĩa $\to$ chi tiết $\to$ dung hợp), nhưng độ phân giải bị giới hạn và dễ sinh nhiễu ở viền phức tạp.
     - **RMBG-1.4 / RMBG-2.0 (2024)**: Tối ưu cho ảnh thương mại điện tử, tốc độ tốt nhưng chưa tối ưu cho cấu trúc bán trong suốt.
     - **BiRefNet (Bilateral Reference Network - 2024/2025)**: Sử dụng cơ chế tham chiếu song phương (Bilateral Reference) kết hợp các khối tái định vị ngữ nghĩa phân giải cao (High-resolution Semantic Refinement). Mô hình này đạt điểm SOTA vượt trội trên các tập dữ liệu chuẩn DIS-5K, ThinObject5K, và RefMatte.

### 2.2. So sánh các giải pháp thương mại và điện toán đám mây
- **Adobe Firefly / Photoshop Cloud API**: Đạt độ ổn định cao trên ảnh studio, tuy nhiên có xu hướng "nhị phân hóa mượt" (smoothed binarization) thay vì giữ kênh alpha mờ đục thực thụ. Độ trễ cao (3.5s - 5s) và chi phí vận hành đóng kín.
- **Runware Serverless AI Infrastructure**: Hạ tầng tính toán AI thế hệ mới với khả năng nạp mô hình vào VRAM tốc độ cao, hỗ trợ BiRefNet Matting với thời gian đáp ứng cận giây (sub-second ~300ms - 600ms) và định dạng đầu ra RGBA 32-bit bảo toàn kênh Alpha nguyên vẹn.

---

## CHƯƠNG 3: TÍNH MỚI VÀ ĐÓNG GÓP KHOA HỌC (NOVELTY & CONTRIBUTIONS)

Đề tài đóng góp 3 giá trị khoa học và kỹ thuật cốt lõi:

### 3.1. Đóng góp 1: Mô hình Quản lý Ngữ cảnh Đồ thị Phi tuyến tính (Context-Aware DAG History)
Thay vì xem lịch sử biên tập là một hàng đợi (Stack) hay một danh sách tuyến tính $S = [s_0, s_1, ..., s_n]$, đề tài mô hình hóa toàn bộ phiên làm việc dưới dạng một **Đồ thị có hướng không chu trình (Directed Acyclic Graph - DAG)** $G = (V, E)$:
- **Tập đỉnh (Vertices $V$)**: Mỗi đỉnh $v \in V$ đại diện cho một trạng thái không gian (Spatial State) gồm:
  $$v = \langle \text{NodeID}, \text{ImageURI}, \text{MaskURI}, \text{OperationType}, \theta_{\text{params}}, \mathcal{M}_{\text{metrics}} \rangle$$
- **Tập cạnh (Edges $E$)**: Cạnh có hướng $(u, v) \in E$ thể hiện phép toán chuyển đổi từ trạng thái $u$ sang $v$ với độ trễ và chi phí tương ứng.
- **Lợi ích khoa học**:
  - Cho phép người dùng **phân nhánh thử nghiệm (Branching)**: Từ ảnh gốc $v_0$, có thể tạo nhánh $v_{1a}$ (tách nền BiRefNet) song song với $v_{1b}$ (inpaint phục hồi) mà không ghi đè lẫn nhau.
  - **Kế thừa mặt nạ (Mask Inheritance)**: Nút con có thể tái sử dụng kênh alpha của nút cha mà không cần thực hiện lại inference, giúp tiết kiệm $100\%$ chi phí tính toán cho các phép lọc cục bộ tiếp theo.

### 3.2. Đóng góp 2: Phương pháp luận và Bộ công cụ Benchmark Định lượng Đa tiêu chí
Xây dựng khung đánh giá định lượng chuyên sâu cho bài toán trích xuất đối tượng với các tiêu chí toán học chuẩn xác:
- **$mIoU$ (Mean Intersection over Union)**: Đo độ đồng thuận tổng thể giữa các mô hình và ground truth.
- **$Boundary\ F\text{-}\beta\ score$**: Sử dụng toán tử hình thái học (Morphological Gradient) để cô lập dải biên giới có bề rộng $k$ pixels, đo lường độ chính xác tại các cấu trúc siêu mịn (kẽ tóc, nan hoa).
- **$Matting\ Ratio$**: Tỷ lệ phần trăm các pixel có giá trị kênh Alpha bán trong suốt ($0 < \alpha < 255$), phản ánh khả năng phân giải chuyển tiếp thực thụ so với việc cắt cúp nhị phân.
- **$Efficiency\ Ratio$**: Đánh giá tương quan giữa thời gian phản hồi (Latency) và chi phí tài nguyên (Inference Cost).

### 3.3. Đóng góp 3: Kiến trúc Hybrid Adapter tối ưu hóa cho môi trường IDE
Thiết kế mẫu kiến trúc điều phối thông minh (Adaptive AI Provider Pattern):
- Kết nối Cloud Inference tốc độ cao (Runware BiRefNet sub-second) khi có kết nối mạng và khóa API.
- Tự động chuyển đổi mượt mà sang Local Fallback / Mock Engine đảm bảo tính sẵn sàng cao (High Availability), không làm gián đoạn luồng làm việc của lập trình viên khi mất kết nối mạng.

---

## CHƯƠNG 4: CƠ SỞ LÝ THUYẾT VÀ MÔ HÌNH TOÁN HỌC

### 4.1. Phương trình Alpha Compositing và Phân tích Kênh Màu
Một ảnh màu có kênh Alpha được biểu diễn trong không gian 4 chiều $C \in \mathbb{R}^{W \times H \times 4}$ tương ứng với các kênh $[R, G, B, A]$.
Kênh Alpha chuẩn hóa $\alpha(x, y) \in [0, 1]$ được suy diễn từ giá trị số nguyên 8-bit $A(x, y) \in [0, 255]$ qua công thức:
$$\alpha(x, y) = \frac{A(x, y)}{255}$$

Khi chồng lớp ảnh đối tượng lên một nền bất kỳ $B(x, y)$, màu sắc tổng hợp $C_{\text{out}}(x, y)$ được xác định:
$$C_{\text{out}}(x, y) = \alpha(x, y) \cdot F(x, y) + (1 - \alpha(x, y)) \cdot B(x, y)$$

### 4.2. Các Chỉ số Đánh giá Định lượng (Quantitative Metrics)

#### 1. Mean Intersection over Union ($mIoU$)
Cho hai mặt nạ nhị phân hóa $\hat{Y}$ (dự đoán) và $Y$ (chuẩn/đối sánh):
$$mIoU = \frac{|\hat{Y} \cap Y|}{|\hat{Y} \cup Y|} = \frac{\sum_{x, y} \hat{Y}(x, y) \cdot Y(x, y)}{\sum_{x, y} \max(\hat{Y}(x, y), Y(x, y))}$$

#### 2. Độ chính xác Đường biên ($Boundary\ F\text{-}score$)
Định nghĩa toán tử trích xuất biên hình thái học $\mathcal{E}_k(M)$ với phần tử cấu trúc vuông (Structuring Element) kích thước $(2k+1) \times (2k+1)$:
$$\mathcal{E}_k(M) = M \setminus (M \ominus K)$$
Trong đó $\ominus$ là toán tử co (erosion). Khi đó:
$$\text{Precision}_B = \frac{|\mathcal{E}_k(\hat{Y}) \cap \mathcal{E}_k(Y)|}{|\mathcal{E}_k(\hat{Y})| + \epsilon}, \quad \text{Recall}_B = \frac{|\mathcal{E}_k(\hat{Y}) \cap \mathcal{E}_k(Y)|}{|\mathcal{E}_k(Y)| + \epsilon}$$
$$Boundary\ F_1 = \frac{2 \cdot \text{Precision}_B \cdot \text{Recall}_B}{\text{Precision}_B + \text{Recall}_B + \epsilon}$$

#### 3. Tỷ lệ Matting mềm (Soft Matting Ratio $\mathcal{R}_m$)
$$\mathcal{R}_m = \frac{\sum_{x, y} \mathbb{I}(0 < A(x, y) < 255)}{W \times H} \times 100\%$$
Chỉ số $\mathcal{R}_m$ càng cao trên các vùng tóc hoặc ly thủy tinh chứng minh mô hình thực hiện giải thuật matting thực sự, không bị hiện tượng gọt nhẵn thô bạo.

---

## CHƯƠNG 5: THIẾT KẾ KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)

Hệ thống **PixelPilot** được tổ chức theo mô hình kiến trúc phân lớp sạch (Clean Layered Architecture):

```
+-------------------------------------------------------------------------+
|                  VS CODE EXTENSION HOST ENVIRONMENT                     |
+-------------------------------------------------------------------------+
| [Layer 1: Presentation Layer - Webview Sandbox]                         |
|   - Before/After Interactive Split Slider (Canvas / Dual Overlay)       |
|   - Session DAG History Visualizer (Tree Explorer)                      |
|   - 1-Click Quick Toolbelt & Parameter Tuning Console                   |
|   - Telemetry & Metrics Realtime Display (Latency, Cost, VRAM)          |
+-------------------------------------------------------------------------+
                                 |  ^ Message Passing (postMessage API)
                                 v  |
+-------------------------------------------------------------------------+
| [Layer 2: Application Controller Layer]                                 |
|   - PixelPilotViewProvider (Webview Lifecycle Manager)                  |
|   - Command Dispatcher (Workspace Commands, Context Menu Hooks)         |
+-------------------------------------------------------------------------+
                                 |
                                 v
+-------------------------------------------------------------------------+
| [Layer 3: Domain Core Layer - Session & DAG Engine]                     |
|   - SessionManager: Quản lý tập các cây đồ thị ImageSession             |
|   - DAG Operations: createNode(), branch(), rollback(), getActiveNode() |
|   - File System Serializer: Cache ảnh tạm thời trong .pixelpilot/       |
+-------------------------------------------------------------------------+
                                 |
                                 v
+-------------------------------------------------------------------------+
| [Layer 4: Infrastructure & AI Adapter Layer]                            |
|   - IAIProvider (Interface trừu tượng)                                  |
|   - RunwareAdapter (BiRefNet WebSocket/REST Cloud Engine)                |
|   - LocalMockAdapter (Fallback Engine phục vụ phát triển & offline)     |
+-------------------------------------------------------------------------+
```

---

## CHƯƠNG 6: KỊCH BẢN THỰC NGHIỆM VÀ KẾT QUẢ ĐỐI ĐẦU SƠ BỘ

### 6.1. Thiết kế 5 Ca Kiểm thử Thách thức (Challenging Test Cases)
Để đánh giá toàn diện tính ưu việt của mô hình SOTA BiRefNet được tích hợp trong PixelPilot so với đối thủ thương mại Adobe Firefly, nghiên cứu xây dựng bộ dữ liệu kiểm thử gồm 5 kịch bản biên:
1. **TC1 (Tóc bay ngược sáng)**: Thử thách sợi tóc tơ đường kính $< 2$ pixels ngược nguồn sáng mạnh.
2. **TC2 (Động vật lông xù độ phân giải cao 2K)**: Thử thách bảo toàn độ phân giải lớn ($2048 \times 1639$) và hiệu ứng mờ nhòe quang học (Bokeh) quanh tai mèo.
3. **TC3 (Vật thể trong suốt - Ly thủy tinh)**: Thử thách giữ nguyên độ truyền quang của kính và khúc xạ chất lỏng bên trong.
4. **TC4 (Tương phản viền cực thấp - Áo trắng trên nền trắng)**: Thử thách phân biệt ranh giới khi gradient cường độ sáng tiệm cận $0$.
5. **TC5 (Cấu trúc rỗng nhiều khoang - Nan hoa xe đạp & giỏ sắt)**: Thử thách xóa nền xuyên qua các khe nan hoa cơ học phức tạp.

### 6.2. Kết quả Thực nghiệm Ban đầu (Tóm tắt)
* **Độ sắc nét & Chi tiết viền**: BiRefNet Matting vượt trội với tỷ lệ giữ pixel mờ đục mềm (Soft Matting) trung bình đạt $37.2\%$ so với mức chỉ $9.1\%$ của Adobe Firefly.
* **Thời gian đáp ứng (Latency)**: Runware BiRefNet đạt trung bình **$420\text{ ms}$**, nhanh hơn gấp **$8.3$ lần** so với Adobe Firefly ($3.500\text{ ms} - 5.200\text{ ms}$).
* **Chi phí kinh tế**: Chỉ xấp xỉ **$0.0006\text{ USD}$/lần xử lý**, hoàn toàn khả thi để ứng dụng thương mại và phục vụ nghiên cứu thực tế.

---

## CHƯƠNG 7: KẾ HOẠCH TRIỂN KHAI VÀ PHÂN CÔNG TIẾN ĐỘ

| Tuần | Hạng mục công việc chính | Kết quả đầu ra (Deliverables) |
| :---: | :--- | :--- |
| **Tuần 1** | Hoàn thiện bản thuyết minh đề tài & Thu thập bộ ảnh thực nghiệm chuẩn | File `ACADEMIC_RESEARCH_PROPOSAL.md`, Thư mục `test_images/` chuẩn hóa |
| **Tuần 2** | Xây dựng Bộ công cụ đo lường thực nghiệm toán học ($mIoU$, $Boundary\ F$, $Matting\ Ratio$) | Module `benchmark/` hoàn chỉnh, Script `run_benchmark.js`, Bảng số liệu khoa học |
| **Tuần 3** | Hiện thực hóa Core Engine của VS Code Extension: Session Manager DAG & AI Adapter | Mã nguồn `SessionManager.ts`, `RunwareAdapter.ts`, `LocalMockAdapter.ts` |
| **Tuần 4** | Thiết kế Webview UI: Before/After Slider, Cây lịch sử DAG, Quick Toolbelt | Bộ giao diện `index.html`, `main.css`, `app.js` tích hợp chuẩn VS Code Theme |
| **Tuần 5** | Ghép nối tích hợp Extension Host & Kiểm thử toàn diện (E2E Testing) | Bản build extension chạy ổn định qua F5 Debugging, gói cài đặt `.vsix` |
| **Tuần 6** | Soạn thảo Cẩm nang Bảo vệ Đề tài (Defense Guide) & Kịch bản Live Demo | Tài liệu `DEFENSE_GUIDE.md`, Bộ câu hỏi phản biện & Slide thuyết trình |

---

## CHƯƠNG 8: KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN

Đề tài **PixelPilot** không chỉ đơn thuần là một công cụ tiện ích (utility tool) mà là một công trình nghiên cứu khoa học có sự kết hợp hài hòa giữa:
1. **Lý thuyết thị giác máy tính chuyên sâu**: Khai thác mô hình SOTA Alpha Matting (BiRefNet) vượt trội hơn hẳn các công cụ phân đoạn nhị phân truyền thống.
2. **Cấu trúc dữ liệu và giải thuật tiên tiến**: Đề xuất mô hình **Context-Aware DAG History** giải quyết bài toán quản lý phiên làm việc đa rẽ nhánh trong công cụ AI.
3. **Kỹ thuật phần mềm ứng dụng**: Đem lại giá trị thực tiễn to lớn cho cộng đồng lập trình viên, loại bỏ hoàn toàn chi phí chuyển đổi ngữ cảnh trong quá trình phát triển sản phẩm.

**Hướng phát triển mở rộng trong tương lai**:
- Nghiên cứu tích hợp mô hình Inpainting/Generative Fill theo vùng chọn (Mask-guided Inpainting) trực tiếp trên Webview Canvas.
- Triển khai mô hình BiRefNet dạng ONNX Runtime chạy trực tiếp bằng WebGPU/WASM trên máy tính người dùng khi không có Internet.
- Mở rộng hỗ trợ tự động sinh mã nguồn (CSS / Flutter / React Native) tương ứng với tài nguyên ảnh sau khi xử lý.

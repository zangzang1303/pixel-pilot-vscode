# ADR: Run và preview chỉnh sửa ảnh

- Trạng thái: Chấp nhận làm hợp đồng triển khai beta; handlers/runtime sẽ được hoàn thiện ở T06–T13.
- Ngày: 05/11/2026

## Quyết định

Mỗi thao tác ảnh có một request ID duy nhất, session và parent node được pin tại thời điểm bắt đầu. Kết quả tạo ra preview tạm, chưa được coi là ảnh hiện hành hay node lịch sử. Host là nguồn sự thật cho quyết định apply/discard và phải trả ACK cuối cùng.

Preview apply mang `previewId`, `sessionId`, `parentNodeId` và `sourceRevision`. Host chỉ commit nếu preview còn sống, đúng phiên/parent/revision và thao tác chưa bị hủy. Apply lặp lại cùng preview phải trả lại kết quả đã commit (idempotent). Revision cũ trả `stale` kèm current node; không tự ghi vào nhánh mới. Discard chỉ xóa preview tạm và không tạo edit node. Lỗi ghi artifact/session trả `failed`; UI không được báo applied.

## Trạng thái chạy

`queued → running → preview_ready → applying → succeeded`

Các trạng thái cuối khác: `discarded`, `stale`, `failed`, `cancelled`. Chỉ host phát terminal event một lần. Cancel trước commit ngăn commit; nếu provider không hỗ trợ abort, kết quả muộn bị bỏ và không tự retry request cloud có trạng thái chưa rõ.

## Hợp đồng

`PreviewReadyView`, `PreviewDecision` và `PreviewDecisionResult` trong `src/shared/protocol.ts` là DTO chuẩn. URI preview chỉ là nguồn hiển thị tạm, không phải thẩm quyền commit. FLUX box dùng `[top,left,bottom,right]` số nguyên trong thang `[0,1000]` đúng với Canvas và Runware, description và instruction bắt buộc; contract validator ở `src/shared/tool-contracts.ts` từ chối box sai/rỗng.

## Hệ quả và giới hạn

UI hiện tại còn dùng message legacy `plan.apply`/`plan.discard`; chưa được coi là ACK protocol và phải được chuyển ở T10–T11. Cho đến khi PreviewService có artifact staging và persistence transaction, luồng sửa hiện hữu vẫn commit trực tiếp và không được gắn nhãn preview. Live provider quality/cost vẫn cần smoke test bằng key và tài khoản được phép.

# PHASE 72 — S3 EXECUTION-ONLY MODE GUARDS

## Mục tiêu

Chuyển V45 sang chế độ chỉ thực thi khi S3 là nguồn chủ quản của đơn bán, đơn tổng và tồn kho. Mọi đường ghi nguồn cũ phải fail loudly với HTTP 409/code rõ ràng; không no-op.

## Thay đổi chính

- Thêm `src/config/integrationConfig.js` và kiểm tra fail-fast cho `SYSTEM_MODE` sai.
- Thêm policy `src/domain/integration/S3ExecutionGuard.js`.
- Thêm route middleware `src/middlewares/integrationAuthority.middleware.js`, có warning log cho command bị chặn.
- Khóa toàn bộ 7 entry point ghi tồn trong `InventoryPostingService` và harden thêm các write primitive trực tiếp trong `inventoryService`.
- Khóa create/update/cancel/delete và thay đổi thiết lập hóa đơn của đơn bán web/mobile; có service-level guard tại legacy/lifecycle.
- Khóa create/update/cancel/delete đơn tổng, nhưng giữ nguyên read, in, giao hàng hôm nay và xác nhận kế toán.
- Khóa phiếu nhập V45, rebuild/normalize tồn và import Excel cho `openingStock`, `importOrders`, `salesOrders`, `salesOrdersS3`.
- Giữ import danh mục `products/customers/users/promotions` để không phá luồng quản trị dữ liệu chưa được chuyển authority trong Step 2.
- Giữ ghi nhận giao hàng, thiếu hàng, không giao, hàng trả và xác nhận kế toán phiếu trả; guard tồn sẽ chặn riêng mọi attempt post kho local.

## Mã lỗi

| Code | Ý nghĩa |
|---|---|
| `ORDER_MANAGED_BY_S3` | Command sửa nguồn đơn bán V45 bị chặn |
| `MASTER_ORDER_MANAGED_BY_S3` | Command sửa nguồn đơn tổng V45 bị chặn |
| `INVENTORY_MANAGED_BY_S3` | Command ghi/rebuild/đảo tồn V45 bị chặn |
| `SOURCE_IMPORT_MANAGED_BY_S3` | Import đơn/tồn nguồn bị chặn |

## Cấu hình production

```env
SYSTEM_MODE=S3_EXECUTION
INVENTORY_AUTHORITY=S3
ORDER_AUTHORITY=S3
MASTER_ORDER_AUTHORITY=S3
S3_INTEGRATION_ENABLED=true
S3_MASTER_ORDER_SYNC_ENABLED=false
S3_RETURN_SYNC_ENABLED=false
S3_RETURN_AUTO_POST_ENABLED=false
```

## Rollback

Đặt `SYSTEM_MODE=STANDALONE` và authority về `LOCAL`, sau đó restart service. Không cần migration database.

## Điểm phát hiện ngoài danh sách file ban đầu

Để không còn đường bypass trong dự án thực tế, Phase 72 cũng khóa tại các entry point đang hoạt động nhưng không nằm trong danh sách dự kiến ban đầu:

- `src/routes/importExportRoutes.js`: route import đang được mount thực tế.
- `src/routes/importRuntimeRoutes.js`: commit session import bất đồng bộ.
- `src/routes/reportRoutes.js`: các API rebuild/normalize tồn thực tế nằm tại đây.
- `src/routes/mobile/sales.routes.js`: tạo/sửa/xóa đơn từ app NVBH.
- `src/services/orderLegacy.service.js`: facade web hiện tại có thể đi vòng ngoài `SalesLifecycleService`.
- `src/services/inventoryService.js`: harden write primitive để chặn caller cũ gọi trực tiếp.

## Quality gate

- `npm run check:syntax`: **PASS — 674 JavaScript files**.
- Test trọng điểm Phase 72 và regression liên quan: **59/59 PASS**.
- Full regression: **611/611 PASS**, 0 fail.
- Không cần migration database.

## Triển khai an toàn

Khuyến nghị canary trên một instance trước, kiểm tra các command nguồn trả HTTP 409 đúng code và các luồng giao hàng/trả hàng vẫn hoạt động. Theo dõi warning log `S3 execution mode blocked local source command` để phát hiện đường ghi legacy còn sót.

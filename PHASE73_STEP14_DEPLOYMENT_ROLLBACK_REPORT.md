# PHASE 73 — BƯỚC 14: DEPLOYMENT & ROLLBACK

## Đã thực hiện

- Script áp dụng SQL staging theo đúng thứ tự và dừng khi lỗi.
- Script probe contract S3 chỉ đọc.
- Script cài/gỡ Bridge bằng NSSM, có test trước khi đăng ký service.
- Script health check ký HMAC thật tới V45.
- Script rollback dừng Bridge và vô hiệu hóa tích hợp SQL nhưng giữ audit/idempotency.
- Checklist rollout theo 6 cổng, không bật đồng loạt.

## Nguyên tắc vận hành

- Secret không nằm trong command line/source.
- Bridge chạy process riêng, delayed auto-start và tự restart.
- Auto-post và master reader mặc định tắt.
- Không có bước rollback nào xóa dữ liệu chứng từ/audit.

# S3–V45 Bridge Agent

Agent chạy độc lập trong LAN S3 và chỉ kết nối outbound HTTPS tới V45.

## Chế độ an toàn mặc định

`BRIDGE_RETURN_ENABLED=false`. Khi bật, agent claim Outbox V45 và gọi duy nhất:

```text
v45_int.sp_CreateReturnReceipt
```

Nếu SQL mới chỉ ở giai đoạn staging, procedure trả `staged`; agent sẽ `defer` command, không báo hoàn thành giả. Chỉ khi S3 trả `posted + S3INNbr`, agent mới complete command V45.

## Cài đặt

1. Cài Node.js LTS trên máy Bridge riêng.
2. Chạy `npm ci --omit=dev`.
3. Sao chép `.env.example` thành biến môi trường Windows/secret store.
4. Chạy thử foreground bằng `npm start`.
5. Chỉ sau khi health check đạt mới đăng ký Windows Service.

Không đặt source hoặc secret trong thư mục chương trình S3.

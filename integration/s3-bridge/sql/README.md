# SQL deployment order

Chạy trên **database test restore từ backup S3**, theo thứ tự:

1. `001_create_schema.sql`
2. `002_create_staging_tables.sql`
3. `003_create_staging_procedures.sql`
4. `004_create_roles_and_permissions.sql`
5. `010_create_guarded_return_orchestrator.sql`
6. `011_harden_bridge_permissions.sql`
7. `020_create_master_order_read_contract.sql`
8. `005_verify_staging.sql`

`006_probe_s3_contract.sql` chỉ đọc metadata để xây adapter thật.

Không chạy trực tiếp:

- `012_core_adapter_implementation_template.sql`
- `021_master_order_adapter_template.sql`

Hai file template cố ý `THROW` để tránh triển khai nhầm. `RETURN_AUTO_POST_ENABLED` và `MASTER_ORDER_READ_ENABLED` phải giữ `false` cho đến khi adapter thật được kiểm thử trên database test.

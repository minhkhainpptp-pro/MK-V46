# PHASE 74 — Render npm registry timeout fix

## Hiện tượng

Render dừng tại bước build `npm install` với:

- `npm ERR! code ETIMEDOUT`
- `connect ETIMEDOUT 10.192.71.42:443`
- package lỗi: `multer-2.2.0.tgz`

## Nguyên nhân gốc

`package-lock.json` chứa đúng một URL `resolved` trỏ tới package registry nội bộ của môi trường tạo bản vá:

```text
https://packages.applied-caas-gateway1.internal.api.openai.org/artifactory/api/npm/npm-public/multer/-/multer-2.2.0.tgz
```

Render không thể truy cập hostname/IP nội bộ này nên build timeout trước khi ứng dụng khởi động.

Đây không phải lỗi MongoDB, biến môi trường, Node.js hay logic Phase 73.

## Thay đổi

1. Đổi URL khóa của `multer@2.2.0` sang npm public registry:

```text
https://registry.npmjs.org/multer/-/multer-2.2.0.tgz
```

2. Thêm `.npmrc`:

```ini
registry=https://registry.npmjs.org/
strict-ssl=true
```

Không đổi version package, integrity hash, dependency graph hoặc mã nghiệp vụ.

## Kiểm tra

- `package-lock.json` parse JSON thành công.
- Không còn URL `applied-caas`, `openai.org/artifactory` hoặc private registry trong lockfile.
- 146 package tarball đều trỏ về `registry.npmjs.org`.
- `multer` vẫn giữ nguyên version `2.2.0` và integrity.

## Triển khai

Khuyến nghị Build Command trên Render:

```bash
npm ci --omit=dev
```

Nếu service hiện dùng `npm install`, bản vá vẫn hoạt động; `npm ci` chỉ giúp build xác định và không tự sửa lockfile.

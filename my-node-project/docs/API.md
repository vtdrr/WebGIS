# API

Base URL mặc định `http://localhost:3000`; trao đổi JSON. Swagger UI tại `/docs` nếu `SWAGGER_ENABLED=true`. Request ghi cần API key khi `ADMIN_API_KEY` được đặt; production bắt buộc key. Gửi `x-admin-key` hoặc `Authorization: Bearer <key>`.

| Method và path | Đầu vào / phản hồi |
|---|---|
| `GET /health` | Liveness: `{status,timestamp}` |
| `GET /health/ready` | Readiness database; 200 hoặc 503 |
| `POST /api/auth/verify` | Xác minh key; `{ok:true}` |
| `GET /api/categories` | Danh sách danh mục |
| `GET /api/categories/with-counts` | Danh mục và số địa điểm |
| `GET /api/categories/:id` | ID số nguyên dương; 404 nếu không tồn tại |
| `POST /api/categories` | `code`, `name_vi` bắt buộc; 201 hoặc 409 nếu trùng |
| `PATCH /api/categories/:id` | Các field category tùy chọn; 404 nếu không có |
| `DELETE /api/categories/:id` | 204 hoặc 404 |
| `GET /api/places` | `page`, `limit` 1–100, `category`, `q`, `bbox`, `floor`, `has_polygon`, `sort`, `order` |
| `GET /api/places/geojson` | `category` tùy chọn; GeoJSON FeatureCollection |
| `GET /api/places/search` | `q` bắt buộc (1–200), `limit` 1–50, `category`; `{data,meta:{query,took_ms}}` |
| `GET /api/places/nearby` | `lat` [-90,90], `lng` [-180,180], `radius` 1–5000 m, `limit` 1–50, `category` |
| `GET /api/places/:id` | UUID; 404 nếu không có |
| `POST /api/places` | `category_id`, `name_vi` bắt buộc; point GeoJSON hoặc `[lng,lat]`, polygon GeoJSON; 201 hoặc 409 code trùng |
| `PATCH /api/places/:id` | UUID và các trường cập nhật tùy chọn; 404 nếu không có |
| `DELETE /api/places/:id` | UUID; 204 hoặc 404 |
| `GET /api/routing` | `from=lat,lng`, `to=lat,lng`, `mode=walk`; trả route geometry/steps/metadata. Khi không có đường nối, service có thể trả `200` với `meta.fallback=true` và geometry đường thẳng; điểm quá xa mạng (>3 km) trả 422 |
| `POST /api/uploads` | Multipart một PNG/JPEG/WebP; giới hạn `UPLOAD_MAX_MB`; 201 `{url,filename}`, lỗi 400/413/415 |

Schema cụ thể ở `backend/src/modules/*/*.routes.ts`. Place create giới hạn tên 200 ký tự, code 50, email theo định dạng email; geometry tọa độ theo thứ tự longitude/latitude. Lỗi thường gặp: 400 validation, 401 key sai/thiếu, 404 không tìm thấy, 409 trùng, 413 file lớn, 415 loại ảnh, 422 tọa độ routing quá xa, 500 lỗi nội bộ. Graph rời rạc có thể được xử lý bằng fallback chứ không nhất thiết là lỗi HTTP. Hình dạng lỗi tùy route và error handler; không gửi thông tin nội bộ cho client.

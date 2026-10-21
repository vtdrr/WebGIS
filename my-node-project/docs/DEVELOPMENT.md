# Phát triển

## Chạy local

Cần Node.js 20+, npm và Docker Compose/PostGIS. Từ `my-node-project/`:

```powershell
docker compose up -d db
cd backend
npm install
Copy-Item .env.example .env
npm run db:migrate
npm run dev
```

Terminal khác: `cd frontend`, `npm install`, `npm run dev`. Vite mặc định cổng 5173 proxy API tới 3000. Compose khai báo DB 5432 và pgAdmin 5050. `backend/src/config/index.ts` là nguồn biến cấu hình: `DATABASE_URL` bắt buộc; các biến NODE_ENV/PORT/HOST, DB SSL/pool, CORS, rate limit, Swagger, admin key và giới hạn upload có mặc định/điều kiện trong schema. Không commit credential.

## Lệnh và quy tắc

Backend: `npm run dev`, `build`, `start`, `typecheck`, `lint`, `test`, `db:migrate`, `db:ensure-e2e`, `db:import-osm-paths`, `db:import-osm-places`. Frontend: `npm run dev`, `typecheck`, `lint`, `test`, `build`, `e2e`.

Backend test cần `TEST_DATABASE_URL` chính xác `127.0.0.1:5433/phenikaa_gis_test`; helper từ chối URL khác. Chạy trong test service/volume riêng theo [TESTING.md](TESTING.md), không dùng development `DATABASE_URL`/5432. Global setup và migration tests DROP/CREATE test databases. Để chạy E2E, cấu hình `E2E_DATABASE_URL` cùng test service, chạy `npm run db:ensure-e2e` rồi `npm run db:migrate`; export test-only `ADMIN_API_KEY` và `E2E_ADMIN_KEY` chỉ cho Playwright (không export API key khi chạy backend Vitest). Migration mới đặt tên `NNNN_mo_ta.sql`; không sửa lịch sử đã chạy. Import OSM cần xem trước tác động dữ liệu và có thể cần Internet. Khi thêm feature: route/schema phụ trách HTTP, service nghiệp vụ/truy vấn, frontend service giao tiếp API; bổ sung test các trường hợp biên. Category có danh sách code giới hạn cần cập nhật đồng bộ backend/frontend/seed/test. Routing cần kiểm tra CRS, `[lng,lat]`, đơn vị mét, graph disconnected và tuyến thực tế.

Debug: kiểm tra DB container/URL/SSL, `/health/ready`, Network tab và log đã loại bí mật. Không bật API ghi công khai nếu thiếu `ADMIN_API_KEY`.

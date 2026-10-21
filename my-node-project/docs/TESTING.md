# Kiểm thử và kết quả

## Chiến lược

Backend Vitest có unit/integration, nhiều test cần PostgreSQL/PostGIS. `tests/globalSetup.ts` DROP/CREATE database test rồi nạp `sql/init.sql`; database phải tên có `test`. Frontend Vitest chạy unit/component dưới jsdom. Playwright Chromium cần frontend/backend thật và DB đã migrate.

Chạy `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` trong từng thư mục. Chỉ chạy backend tests khi đã xác minh `TEST_DATABASE_URL` dùng DB biệt lập. E2E bằng `npm run e2e` sau khi cài browser/runtime.

## Chạy lại trên test service isolated (PowerShell)

Từ `my-node-project/`, tạo `.env.test.local` lần đầu từ `.env.test.example`, thay placeholder bằng password/key test-only ngẫu nhiên, rồi khởi động đúng service test:

```powershell
if (!(Test-Path .env.test.local)) { Copy-Item .env.test.example .env.test.local }
docker compose --env-file .env.test.local -p phenikaa-webgis-test -f docker-compose.test.yml up -d db-test
docker compose --env-file .env.test.local -p phenikaa-webgis-test -f docker-compose.test.yml ps
```

Backend integration, trong terminal ở `my-node-project/backend`:

```powershell
$settings = ConvertFrom-StringData (Get-Content ../.env.test.local -Raw)
$env:TEST_DATABASE_URL = $settings.TEST_DATABASE_URL
$env:DATABASE_URL = $settings.TEST_DATABASE_URL
$env:DB_SSL = 'false'
$env:NODE_ENV = 'test'
Remove-Item Env:ADMIN_API_KEY -ErrorAction SilentlyContinue
npm test
```

E2E dùng database riêng `phenikaa_gis_e2e` cùng isolated test server (không dùng DB Vitest hoặc development):

```powershell
$settings = ConvertFrom-StringData (Get-Content ../.env.test.local -Raw)
$env:TEST_DATABASE_URL = $settings.TEST_DATABASE_URL
$env:E2E_DATABASE_URL = $settings.E2E_DATABASE_URL
$env:DATABASE_URL = $settings.E2E_DATABASE_URL
$env:DB_SSL = 'false'
$env:NODE_ENV = 'test'
$env:PORT = '3100'  # 3000 có thể được ứng dụng khác sử dụng
$env:WEBGIS_API_PROXY_TARGET = 'http://127.0.0.1:3100'
$env:ADMIN_API_KEY = $settings.E2E_ADMIN_KEY
$env:E2E_ADMIN_KEY = $settings.E2E_ADMIN_KEY
cd ../backend
npm run db:ensure-e2e
npm run db:migrate
cd ../frontend
npm run e2e
```

Test DB helper từ chối URL không đúng loopback `127.0.0.1:5433/phenikaa_gis_test`; test Compose dùng volume riêng. Không dùng `docker compose down -v` hoặc volume prune. Các test write/admin chỉ nhắm DB test isolated.

Fail-closed checks cũng đã chạy: bỏ `TEST_DATABASE_URL` khiến Vitest config dừng trước discovery/setup; đặt E2E `DATABASE_URL` về port 5432 khiến Playwright config từ chối trước khi khởi động server. Hai lệnh này không truy cập/ghi database.

## Kết quả kiểm thử đã thực thi

| Lệnh | Kết quả |
|---|---|
| Backend `npm run typecheck`, `npm run lint`, `npm run build` | Thành công sau khi sửa type lỗi trong test dữ liệu routing |
| Backend `npx vitest list --filesOnly` | 14 files theo `tests/**/*.test.ts` |
| Backend `npm test -- --reporter=verbose` (isolated service; `ADMIN_API_KEY` unset) | **14 files, 151 tests pass**, gồm CRUD/validation, uploads, migrations, search, main-gate/transfer routing, disconnected fallback và fallback metadata. Lần chạy đầu có 18 assertion write/upload fail do E2E `ADMIN_API_KEY` bị export nhầm; chạy lại với key unset pass toàn bộ, không sửa assertions. |
| Backend routing offline | 2 files, 11 tests pass qua cấu hình Vitest tạm chỉ include `routing.unit.test.ts` và `routing.data.test.ts`, không khai báo `globalSetup`; không kết nối DB |
| Frontend `npm run typecheck`, `npm run lint`, `npm run build` | Thành công |
| Frontend `npm test` | **11 files, 89 tests pass** |
| Migration/PostGIS | Baseline và migrations `0001`–`0003` pass trên `phenikaa_gis_e2e` isolated DB |
| Playwright `npm run e2e -- --reporter=line` | **9/9 Chromium E2E pass** trên app thật và DB E2E isolated. Bao gồm admin CRUD, Leaflet polygon draw/reload/drag/save/unsaved discard, PostGIS `Self-intersection` rejection/rollback, PNG decode/upload/persist/serve và malformed bytes 415. Lần chạy đầu 8/9 do locator subtitle không duy nhất; đã scope vào sidebar, đồng thời E2E routing assert `fallback=false` và geometry nhiều điểm. |

## Regression UI/store gần nhất

Sau khi bổ sung request-order guards và trạng thái lỗi/retry, các test store/component mục tiêu chạy bằng Vitest frontend:

```text
5 files passed, 48 tests passed
```

Bao gồm đảo thứ tự success/failure cho search và route, clear trong khi request đang chờ, lỗi map/category/origin list và cách trình bày fallback. Tất cả dùng mock/fixture; không kiểm chứng API/PostGIS hoặc hủy request mạng thực.

Sau khi hoàn tất các thay đổi, chạy lại toàn bộ frontend: **11 files, 89 tests pass**, cùng typecheck, lint và production build.

Test infra hiện được khai báo riêng trong `docker-compose.test.yml`, project name `phenikaa-webgis-test`, loopback host port 5433, volume `phenikaa-webgis-test-pgdata`. Đã inspect container mount và xác nhận khác volume development `my-node-project_pgdata`; service dev `phenikaa-db` vẫn stopped, không mount/write dev volume. `.env.test.local` chứa credential test-only, nằm trong ignore pattern `.env.*.local`; không ghi secret vào log/tài liệu.

`backend/tests/helpers/testDb.ts` fail-fast nếu thiếu `TEST_DATABASE_URL` hoặc host/port/database không đúng `127.0.0.1:5433/phenikaa_gis_test`. `globalSetup` chỉ drop/create database đó; `migrate.test.ts` dùng database `${databaseName()}_migrate` trên cùng test-only server/volume. Compose project, volume và container có tên độc lập; port publish chỉ trên loopback.

Khi chạy backend Vitest, export `TEST_DATABASE_URL` và đặt `DATABASE_URL` bằng cùng giá trị; **không export `ADMIN_API_KEY`** vì test auth mặc định kiểm tra chế độ không cấu hình key. Khi chạy Playwright admin E2E, dùng `E2E_DATABASE_URL` trỏ tới DB demo test riêng và đặt `ADMIN_API_KEY`/`E2E_ADMIN_KEY` cùng key test-only.

Read-only inspection sau E2E xác nhận DB có 10 sample places, 11 `campus_paths`, 0 `campus_routing_nodes` và 0 `campus_routing_edges`; route E2E xác minh sample legacy graph, không phải OSM outdoor graph.

Lệnh offline routing dùng file cấu hình tạm ngoài repository: `npx vitest run --config <temp>/webgis-vitest-routing-unit.config.mjs --reporter=verbose`. Cấu hình chỉ chọn hai test offline, không bật `globalSetup` và đặt `DATABASE_URL` giả lập; các test này không gọi query. Kết quả lượt này: **2 files, 11 tests pass**. Không dùng lệnh trên như thay thế cho routing integration tests.

`routing.data.test.ts` kiểm tra JSON là dữ liệu có cấu trúc hợp lệ, định danh node/route duy nhất, endpoint tham chiếu điểm có thật và nằm trong sai số 2 m, cùng geometry walkway/polygon. Đây là kiểm tra consistency, không xác minh thực địa hay đảm bảo graph connectivity trong PostGIS.

Lượt xác minh 2026-10-21: backend typecheck/lint/build pass; backend integration **14 files/151 tests pass**; frontend typecheck/lint/build pass và Vitest **11 files/89 tests pass**; Playwright **9/9 E2E pass**. API/PostGIS routing runtime pass trong test scenarios. Chưa đo coverage/benchmark hoặc xác minh độ chính xác ngoài thực địa.

Một lần gọi `npm run db:migrate` trên E2E URL trước khi database E2E được tạo thất bại `3D000` (“database does not exist”), không thay đổi schema. `npm run db:ensure-e2e` sau đó tạo đúng database isolated; migration baseline và `0001`–`0003` chạy thành công.

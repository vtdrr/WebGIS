# WebGIS — Bản đồ số khuôn viên Trường Đại học Phenikaa

Ứng dụng WebGIS để tra cứu, quản lý và chỉ đường tới các địa điểm trong khuôn viên Trường Đại học Phenikaa. Hệ thống gồm giao diện React/Leaflet, API Fastify và cơ sở dữ liệu PostgreSQL/PostGIS.

**Chức năng chính:** tìm kiếm có gợi ý bàn phím, lọc danh mục, xem footprint OSM, chọn địa điểm, định vị và chỉ đường trên mạng đi bộ OSM; giao diện quản trị hỗ trợ CRUD địa điểm và tải ảnh.

## 🏗️ Kiến trúc

```
my-node-project/
├── backend/                  # API server (Fastify + TypeScript + PostgreSQL/PostGIS)
│   ├── src/
│   │   ├── modules/           # categories, places, routing, uploads
│   │   ├── db/                # pool, migrations, seed verification, OSM importers
│   │   ├── config/            # Environment validation (Zod)
│   │   └── app.ts             # Fastify app, Swagger/OpenAPI
│   ├── sql/init.sql           # Baseline schema + initial categories/sample records
│   ├── sql/migrations/        # Versioned database migrations
│   └── tests/                 # Backend integration and unit tests
├── frontend/                 # Web app (React 18 + Vite + TypeScript + Leaflet)
│   └── src/
│       ├── components/Map/    # Basemap, footprints, point selection, routing
│       ├── components/Admin/  # Admin UI and geometry editor
│       ├── components/UI/     # Search, category filter, cards and details
│       ├── services/          # Public and admin API clients
│       └── store/useStore.ts  # Zustand state management
└── docker-compose.yml        # PostgreSQL 16 + PostGIS 3.4 + pgAdmin 4
```

## 🚀 Cài đặt & chạy

**Yêu cầu:** Node.js >= 20, npm, Docker Desktop và Docker Compose. Các lệnh bên dưới giả định bạn đang dùng PowerShell và bắt đầu tại thư mục gốc repo (`WebGIS`).

### 1. Khởi động database

```powershell
cd my-node-project
docker compose up -d db
```

Compose sẽ khởi tạo schema lần đầu khi volume database còn trống. Mở **Terminal 1 mới** tại thư mục gốc repo để chạy backend:

```powershell
cd my-node-project/backend
npm install
copy .env.example .env
npm run db:migrate
npm run db:seed                 # kiểm tra dữ liệu hiện có; không xóa/tạo lại database
npm run db:import-osm-paths     # cần internet tới Overpass
npm run db:import-osm-places    # cần internet tới Overpass
npm run dev
# hoặc: npm run build && npm start
```

Chỉ cần sao chép `.env.example` thành `.env` một lần. Hai lệnh import OSM có thể chạy lại để đồng bộ dữ liệu.

Mở **Terminal 2 mới** tại thư mục gốc repo để chạy frontend. Vite proxy `/api` tới backend ở cổng 3000:

```powershell
cd my-node-project/frontend
npm install
npm run dev               # http://localhost:5173 (proxy /api -> :3000)
```

Muốn dùng pgAdmin, chạy `docker compose up -d db pgadmin` từ `my-node-project`. Sau đó mở http://localhost:5050 (tài khoản mặc định cho môi trường local: `admin@phenikaa.edu.vn` / `admin`).

**Swagger API docs:** http://localhost:3000/docs

**Admin UI:** http://localhost:5173/#/admin. Khi đã đặt `ADMIN_API_KEY` trong `backend/.env`, đăng nhập bằng key đó. Không dùng key mặc định hoặc để API ghi mở trên môi trường production.

## 🔐 Bảo mật API

Mặc định chỉ đọc (GET) là public. Các thao tác ghi (POST/PATCH/DELETE) có thể bảo vệ bằng API key:

```bash
# backend/.env
ADMIN_API_KEY=your-secret-key
```

Khi `ADMIN_API_KEY` được cấu hình, client phải gửi header `x-admin-key: <key>` hoặc `Authorization: Bearer <key>` cho mọi request POST/PATCH/DELETE `/api/*` (nếu không đặt biến này, các endpoint ghi vẫn mở — chỉ phù hợp môi trường dev).

## 📚 API

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/health/ready` | Kiểm tra trạng thái sẵn sàng, gồm kết nối database |
| GET | `/api/categories` | Danh sách danh mục (active) |
| GET | `/api/categories/with-counts` | Danh mục + số lượng địa điểm |
| GET | `/api/places` | Danh sách địa điểm (phân trang, lọc category/q/bbox/floor/has_polygon, sort) |
| GET | `/api/places/geojson` | Export GeoJSON FeatureCollection |
| GET | `/api/places/search?q=&limit=&category=` | Tìm kiếm có xếp hạng: không phân biệt dấu/hoa thường, khớp tiền tố ("thu vi" → Thư viện), tìm theo tên, mã, tên tiếng Anh, mô tả, chịu lỗi gõ (pg_trgm) |
| GET | `/api/places/nearby?lat=&lng=&radius=` | Địa điểm gần một tọa độ (PostGIS geography) |
| GET | `/api/places/:id` | Chi tiết địa điểm |
| POST | `/api/places` | Tạo địa điểm (admin) |
| PATCH | `/api/places/:id` | Cập nhật địa điểm (admin) |
| DELETE | `/api/places/:id` | Xóa địa điểm (admin) |
| POST | `/api/uploads` | Tải ảnh PNG/JPEG/WebP lên (admin) |
| POST | `/api/auth/verify` | Xác thực admin API key |
| GET | `/api/routing?from=lat,lng&to=lat,lng&mode=walk\|bike\|wheelchair` | Tuyến đường đi bộ/xe đạp/xe lăn |

Routing ưu tiên mạng đi bộ OSM trong `campus_routing_nodes` / `campus_routing_edges`, chạy Dijkstra trên hình học đường thật. Chạy `npm run db:import-osm-paths` để lấy dữ liệu quanh trường (bbox mặc định: `20.956,105.742,20.970,105.756`); có thể đổi bằng `npm run db:import-osm-paths -- --bbox=south,west,north,east`. Lệnh này cần internet tới Overpass API và thay thế dữ liệu trong hai bảng mạng OSM, không đụng tới địa điểm hay `campus_paths`. Dữ liệu OSM © OpenStreetMap contributors, ODbL.

`npm run db:import-osm-places` đồng bộ các feature được duyệt từ Overpass trong bbox `20.958,105.744,20.966,105.753`, thay các record OSM/sample thuộc bộ đồng bộ và giữ địa điểm admin thủ công. Danh sách OSM gồm A1–A8 (giảng đường 7 tầng), A9–A10 (tòa nhà chính), B1–B4 (thực hành kỹ thuật), 3 ký túc xá, 2 căng tin, sân bóng, nhà thi đấu và y tế học đường. Thư viện A10 (tầng 4–6), 2 cổng, sân tennis và 4 bãi giữ xe được nhập bằng tọa độ đã cung cấp; chúng được upsert theo code và không bị xóa khi đồng bộ OSM. Danh mục “Phòng ban hành chính” và “Khác” bị ẩn; quảng trường bị loại. OSM feature được định danh bằng node/way ID và giữ tên OSM; không tự đặt tên cho đối tượng OSM thiếu tên. Dữ liệu OSM © OpenStreetMap contributors, ODbL.

Footprint có polygon hiển thị viền nét đứt. Địa điểm không có polygon chỉ hiện chấm đỏ khi được chọn; không có icon marker POI thường trực.

Điểm đi/đến ngoài mạng được nối tới nút gần nhất bằng đoạn thẳng; `off_network: true` và `meta.off_network_m` thể hiện phần này, giao diện vẽ nét chấm cam. Điểm cách mạng đường quá 3 km trả HTTP 422. `campus_paths` vẫn được giữ làm graph cũ nếu chưa nạp OSM; đường chim bay (`meta.fallback = true`) chỉ dùng khi không có tuyến nối được.

Trên giao diện, nếu không có GPS, bấm “Chỉ đường” để bật chế độ chọn điểm xuất phát bằng click bản đồ; cũng có thể chọn điểm xuất phát từ danh sách. Tuyến đường vẫn hiển thị khi không có marker ở hai đầu.

## 🗺️ Dữ liệu không gian

- Tâm bản đồ mặc định: Trường Đại học Phenikaa `[20.9626112, 105.7486864]`, zoom 17
- Giới hạn kéo bản đồ: khu vực Hà Nội `[[20.85, 105.6], [21.15, 106.0]]`, zoom tối thiểu 11 (`MAP_BOUNDS`, `MAP_MIN_ZOOM` trong `frontend/src/types/index.ts`)
- Street Map: `tile.openstreetmap.de` (OSM community server, OSM-derived) — attribution "© OpenStreetMap contributors"
- Satellite: Esri World Imagery — attribution "Imagery © Esri, Maxar, Earthstar Geographics", `maxNativeZoom: 19` (Esri không có imagery z20 tại khu vực này)
- `places.geom_point` — điểm đại diện để tìm kiếm, định tuyến và đưa bản đồ tới vị trí; địa điểm không có polygon chỉ hiện chấm đỏ khi được chọn
- `places.geom_polygon` — footprint tòa nhà/vùng đất
- `places.source`, `places.osm_type`, `places.osm_id` — nguồn dữ liệu và OSM identity để cập nhật an toàn
- `places.search_tsv` — tsvector (generated, config `simple`, qua `f_unaccent`) có trọng số: tên (A) > mã + tên tiếng Anh (B) > mô tả (C)
- Chỉ mục GIST cho geometry, GIN cho full-text + trigram
- `campus_paths` — đồ thị đường đi: cạnh giữa 2 địa điểm có `geom` LineString + `distance_m`
- `campus_routing_nodes` / `campus_routing_edges` — nút giao và các đoạn đường đi bộ OSM, có LineString thật để định tuyến

## 📋 Tiến độ

- [x] Backend API: categories, places (CRUD, filter, search, nearby, GeoJSON), routing
- [x] Database: PostGIS schema, migrations, seed, docker-compose
- [x] Frontend: bản đồ Leaflet, tìm kiếm/gợi ý, lọc danh mục, chọn địa điểm, chỉ đường và geolocation
- [x] Routing Dijkstra trên mạng lối đi OSM (có thể cập nhật bằng `db:import-osm-paths`)
- [x] Admin UI tại `/#/admin`: CRUD địa điểm, chỉnh hình học và tải ảnh
- [x] Swagger/OpenAPI documentation tại `/docs`
- [ ] Đồng bộ dữ liệu chính thức chi tiết hơn từ các đơn vị trong trường

## 🔧 Scripts

**Backend:** `npm run dev` | `npm run build` | `npm start` | `npm run db:migrate` | `npm run db:seed` (verify) | `npm run db:import-osm-paths` | `npm run db:import-osm-places` | `npm run db:import-places` | `npm run lint` | `npm run typecheck` | `npm test`

**Frontend:** `npm run dev` | `npm run build` | `npm run preview` | `npm run lint` | `npm test` | `npm run e2e`

`db:seed` chỉ in báo cáo/kiểm tra dữ liệu hiện có; không tạo seed mới. Script `db:reset` hiện chỉ chạy migrate và kiểm tra dữ liệu, không xóa hoặc tạo lại database.

## 🧪 Kiểm thử

Backend dùng [Vitest](https://vitest.dev). Test cần PostgreSQL/PostGIS đang chạy và quyền tạo/xóa database; trước mỗi lượt chạy, test **drop và tạo lại** database riêng có tên chứa `test` (mặc định `phenikaa_gis_test`), sau đó nạp `sql/init.sql`. Không trỏ `TEST_DATABASE_URL` tới database phát triển vì database test sẽ bị xóa. Nếu chưa cài dependencies, chạy `npm install` trong `my-node-project/backend` trước.

```powershell
# Từ thư mục gốc repo
cd my-node-project
docker compose up -d db     # cần PostgreSQL/PostGIS đang chạy
cd backend
npm test                    # chạy toàn bộ
npm run test:watch          # chạy lại khi sửa code
```

Mặc định test kết nối `postgres://postgres:postgres@localhost:5432/phenikaa_gis_test`; có thể đổi bằng biến môi trường `TEST_DATABASE_URL` (tên database phải chứa chữ `test`). CI (GitHub Actions) chạy typecheck, lint, build và test cho cả backend và frontend.

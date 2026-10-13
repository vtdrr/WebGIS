# WebGIS — Bản đồ số khuôn viên Trường Đại học Phenikaa

Ứng dụng WebGIS phục vụ việc quản lý và tra cứu thông tin các địa điểm trong khuôn viên trường, bao gồm các tòa nhà, giảng đường, phòng học, phòng thí nghiệm, thư viện, ký túc xá, bãi đỗ xe, căng tin, sân thể thao và các khu vực chức năng khác.

## 🏗️ Kiến trúc

```
my-node-project/
├── backend/                  # API server (Fastify + TypeScript + PostgreSQL/PostGIS)
│   ├── src/
│   │   ├── modules/
│   │   │   ├── categories/   # CRUD danh mục địa điểm
│   │   │   ├── places/       # CRUD + tìm kiếm + nearby + GeoJSON
│   │   │   ├── routing/      # Chỉ đường Dijkstra trên mạng đi bộ OSM
│   │   │   └── common/       # Zod schemas & types
│   │   ├── db/               # Connection pool, migrate, seed
│   │   ├── config/           # Env validation (zod)
│   │   └── app.ts            # Fastify app, Swagger/OpenAPI
│   └── sql/init.sql          # Schema + seed data (chạy tự động khi khởi tạo DB)
├── frontend/                 # Web app (React 18 + Vite + TypeScript + Leaflet)
│   └── src/
│       ├── components/Map/   # BaseMap, BuildingsLayer, RoutingLayer, route picking/fit
│       ├── components/UI/    # SearchBar, CategoryFilter, PlaceCard, PlaceDetailPanel
│       ├── hooks/            # useGeolocation, createMarkerIcon, useMapSync...
│       ├── services/api.ts   # API client
│       └── store/useStore.ts # Zustand state management
└── docker-compose.yml        # PostgreSQL 16 + PostGIS 3.4 + pgAdmin 4
```

## 🚀 Cài đặt & chạy

**Yêu cầu:** Node.js >= 20, Docker & Docker Compose

```bash
cd my-node-project

# 1. Khởi động database (PostGIS) — tự động tạo schema + seed
docker compose up -d db

# 2. Terminal 1 — backend
cd my-node-project/backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run db:migrate        # đồng bộ schema (idempotent)
npm run db:seed           # kiểm tra dữ liệu mẫu
npm run db:import-osm-paths # tải mạng đường đi bộ OSM quanh Phenikaa
npm run db:import-osm-places # đồng bộ các địa điểm OSM trong phạm vi khuôn viên
npm run dev               # dev mode (tsx watch) — http://localhost:3000
# hoặc: npm run build && npm start

# 3. Terminal 2 — mở terminal mới, giữ backend chạy ở Terminal 1
cd my-node-project/frontend
npm install
npm run dev               # http://localhost:5173 (proxy /api -> :3000)
```

**pgAdmin:** http://localhost:5050 (admin@phenikaa.edu.vn / admin)
**Swagger API docs:** http://localhost:3000/docs

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
| GET | `/api/routing?from=lat,lng&to=lat,lng&mode=walk\|bike\|wheelchair` | Tuyến đường đi bộ/xe đạp/xe lăn |

Routing ưu tiên mạng đi bộ OSM trong `campus_routing_nodes` / `campus_routing_edges`, chạy Dijkstra trên hình học đường thật. Chạy `npm run db:import-osm-paths` để lấy dữ liệu quanh trường (bbox mặc định: `20.956,105.742,20.970,105.756`); có thể đổi bằng `--bbox=south,west,north,east`. Lệnh này cần kết nối internet tới Overpass API và thay thế dữ liệu trong hai bảng mạng OSM, không đụng tới địa điểm hay `campus_paths`. Dữ liệu OSM © OpenStreetMap contributors, ODbL.

`npm run db:import-osm-places` đồng bộ các feature đã xác nhận từ Overpass (`20.958,105.744,20.966,105.753`), thay record mẫu OSM, giữ địa điểm admin và upsert các điểm bổ sung do người dùng cung cấp. Danh sách gồm A1–A8 (giảng đường 7 tầng), A9–A10 (tòa nhà chính), B1–B4 (thực hành kỹ thuật), 3 ký túc xá, 2 căng tin, sân bóng, nhà thi đấu, y tế học đường, thư viện A10 (tầng 4–6), 2 cổng, sân tennis và 4 bãi giữ xe. Các danh mục “Phòng ban hành chính” và “Khác” bị ẩn; quảng trường bị loại. Điểm nhập thủ công được đồng bộ lặp lại theo code ổn định và không bị xóa khi cập nhật OSM. OSM node/way vẫn được nhận diện bằng ID; không tự đặt tên cho đối tượng OSM thiếu tên. Bản đồ dùng tile nền OSM và polygon feature, không chồng icon marker POI.

Điểm đi/đến ngoài mạng được nối tới nút gần nhất bằng đoạn thẳng; `off_network: true` và `meta.off_network_m` thể hiện phần này, giao diện vẽ nét chấm cam. Điểm cách mạng đường quá 3 km trả HTTP 422. `campus_paths` vẫn được giữ làm graph cũ nếu chưa nạp OSM; đường chim bay (`meta.fallback = true`) chỉ dùng khi không có tuyến nối được.

Trên giao diện, nếu không có GPS, bấm "Chỉ đường" sẽ bật chế độ bấm lên bản đồ để chọn vị trí hiện tại; cũng có thể chọn điểm xuất phát từ danh sách. Không vẽ marker cho POI, vị trí GPS hay điểm đầu/cuối; tuyến đường và vòng chọn điểm vẫn hoạt động.

## 🗺️ Dữ liệu không gian

- Tâm bản đồ mặc định: Trường Đại học Phenikaa `[20.9626112, 105.7486864]`, zoom 17
- Giới hạn kéo bản đồ: khu vực Hà Nội `[[20.85, 105.6], [21.15, 106.0]]`, zoom tối thiểu 11 (`MAP_BOUNDS`, `MAP_MIN_ZOOM` trong `frontend/src/types/index.ts`)
- Street Map: `tile.openstreetmap.de` (OSM community server, OSM-derived) — attribution "© OpenStreetMap contributors"
- Satellite: Esri World Imagery — attribution "Imagery © Esri, Maxar, Earthstar Geographics", `maxNativeZoom: 19` (Esri không có imagery z20 tại khu vực này)
- `places.geom_point` — điểm đại diện để tìm kiếm, định tuyến và đưa bản đồ tới vị trí; POI không vẽ marker
- `places.geom_polygon` — footprint tòa nhà/vùng đất
- `places.source`, `places.osm_type`, `places.osm_id` — nguồn dữ liệu và OSM identity để cập nhật an toàn
- `places.search_tsv` — tsvector (generated, config `simple`, qua `f_unaccent`) có trọng số: tên (A) > mã + tên tiếng Anh (B) > mô tả (C)
- Chỉ mục GIST cho geometry, GIN cho full-text + trigram
- `campus_paths` — đồ thị đường đi: cạnh giữa 2 địa điểm có `geom` LineString + `distance_m`
- `campus_routing_nodes` / `campus_routing_edges` — nút giao và các đoạn đường đi bộ OSM, có LineString thật để định tuyến

## 📋 Tiến độ

- [x] Backend API: categories, places (CRUD, filter, search, nearby, GeoJSON), routing
- [x] Database: PostGIS schema, migrations, seed, docker-compose
- [x] Frontend: bản đồ Leaflet, tìm kiếm, lọc danh mục, chỉ đường và geolocation (không vẽ POI markers)
- [x] Routing Dijkstra trên mạng lối đi OSM (có thể cập nhật bằng `db:import-osm-paths`)
- [x] Swagger/OpenAPI documentation tại `/docs`
- [ ] (Phase 5) Tích hợp OSRM/pgRouting cho routing trên đường thật
- [ ] (Phase 5) Admin panel quản lý địa điểm (upload hình ảnh, vẽ polygon)
- [ ] (Phase 5) Import dữ liệu thật từ phòng đào tạo

## 🔧 Scripts

**Backend:** `npm run dev` | `npm run build` | `npm start` | `npm run db:migrate` | `npm run db:seed` | `npm run db:import-osm-paths` | `npm run db:import-osm-places` | `npm run db:reset` | `npm run lint` | `npm run typecheck` | `npm test`

**Frontend:** `npm run dev` | `npm run build` | `npm run preview` | `npm run lint`

## 🧪 Kiểm thử

Backend dùng [Vitest](https://vitest.dev). Test tích hợp chạy trên một database riêng `phenikaa_gis_test` (tự tạo lại từ `sql/init.sql` mỗi lần chạy, không đụng đến database phát triển).

```bash
docker compose up -d db     # cần PostgreSQL/PostGIS đang chạy
cd backend
npm test                    # chạy toàn bộ
npm run test:watch          # chạy lại khi sửa code
```

Mặc định kết nối `postgres://postgres:postgres@localhost:5432/phenikaa_gis_test`; đổi bằng biến môi trường `TEST_DATABASE_URL` (tên database phải chứa chữ "test"). CI (GitHub Actions) chạy typecheck, lint, build và test cho cả backend và frontend.

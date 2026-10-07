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
│   │   │   ├── routing/      # Chỉ đường (Dijkstra trên đồ thị campus_paths)
│   │   │   └── common/       # Zod schemas & types
│   │   ├── db/               # Connection pool, migrate, seed
│   │   ├── config/           # Env validation (zod)
│   │   └── app.ts            # Fastify app, Swagger/OpenAPI
│   └── sql/init.sql          # Schema + seed data (chạy tự động khi khởi tạo DB)
├── frontend/                 # Web app (React 18 + Vite + TypeScript + Leaflet)
│   └── src/
│       ├── components/Map/   # BaseMap, PlacesLayer (marker cluster), BuildingsLayer, RoutingLayer
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

# 2. Chạy backend
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run db:migrate        # đồng bộ schema (idempotent)
npm run db:seed           # kiểm tra dữ liệu
npm run dev               # dev mode (tsx watch) — http://localhost:3000
# hoặc: npm run build && npm start

# 3. Chạy frontend
cd ../frontend
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

Routing chạy Dijkstra trên đồ thị `campus_paths` (các đường nội bộ trong khuôn viên). Điểm đi/đến nằm ngoài khuôn viên (ví dụ trạm xe buýt) được nối bằng một đoạn đi thẳng tới nút đường gần nhất (thử 3 nút gần nhất, đoạn ngoài mạng đường bị tính nặng gấp đôi để ưu tiên đường đã có). Các đoạn này có `off_network: true` trong `steps` và `meta.off_network_m` cho biết tổng quãng đi thẳng; giao diện vẽ chúng bằng nét chấm cam. Điểm cách khuôn viên quá 3 km trả về HTTP 422; chỉ khi đồ thị rỗng hoặc hai điểm không nối được thì trả đường chim bay (`meta.fallback = true`).

Trên giao diện, nếu không có GPS, bấm "Chỉ đường" sẽ bật chế độ bấm lên bản đồ để chọn vị trí hiện tại (marker A kéo thả được); cũng có thể chọn điểm xuất phát từ danh sách.

## 🗺️ Dữ liệu không gian

- Tâm bản đồ mặc định: Trường Đại học Phenikaa `[20.9626112, 105.7486864]`, zoom 17
- Giới hạn kéo bản đồ: khu vực Hà Nội `[[20.85, 105.6], [21.15, 106.0]]`, zoom tối thiểu 11 (`MAP_BOUNDS`, `MAP_MIN_ZOOM` trong `frontend/src/types/index.ts`)
- Street Map: `tile.openstreetmap.de` (OSM community server, OSM-derived) — attribution "© OpenStreetMap contributors"
- Satellite: Esri World Imagery — attribution "Imagery © Esri, Maxar, Earthstar Geographics", `maxNativeZoom: 19` (Esri không có imagery z20 tại khu vực này)
- `places.geom_point` — điểm đại diện (marker), SRID 4326
- `places.geom_polygon` — footprint tòa nhà/vùng đất
- `places.search_tsv` — tsvector (generated, config `simple`, qua `f_unaccent`) có trọng số: tên (A) > mã + tên tiếng Anh (B) > mô tả (C)
- Chỉ mục GIST cho geometry, GIN cho full-text + trigram
- `campus_paths` — đồ thị đường đi: cạnh giữa 2 địa điểm có `geom` LineString + `distance_m`

## 📋 Tiến độ

- [x] Backend API: categories, places (CRUD, filter, search, nearby, GeoJSON), routing
- [x] Database: PostGIS schema, migrations, seed, docker-compose
- [x] Frontend: bản đồ Leaflet (marker cluster, polygon layer), tìm kiếm, lọc danh mục, chỉ đường, geolocation
- [x] Swagger/OpenAPI documentation tại `/docs`
- [ ] (Phase 5) Tích hợp OSRM/pgRouting cho routing trên đường thật
- [ ] (Phase 5) Admin panel quản lý địa điểm (upload hình ảnh, vẽ polygon)
- [ ] (Phase 5) Import dữ liệu thật từ phòng đào tạo

## 🔧 Scripts

**Backend:** `npm run dev` | `npm run build` | `npm start` | `npm run db:migrate` | `npm run db:seed` | `npm run db:reset` | `npm run lint` | `npm run typecheck` | `npm test`

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

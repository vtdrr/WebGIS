# Báo cáo kiểm toán kỹ thuật

**Phạm vi:** kiểm tra repository hiện có tại `my-node-project/`, cấu hình, mã nguồn chính, schema/migration, các test và lệnh kiểm tra. Đây là đánh giá ban đầu; chưa thay đổi logic ứng dụng trong giai đoạn baseline.

## Tóm tắt

Dự án hiện là ứng dụng WebGIS theo mô hình frontend React/Leaflet, API Fastify/TypeScript và PostgreSQL/PostGIS. Đã có tìm kiếm, lọc, quản trị địa điểm, nhập dữ liệu OSM, và định tuyến đi bộ; mã nguồn cũng có kiểm tra Zod, phân quyền API key, kiểm tra file tải lên, migration và nhiều test. Đây là nền tảng có thể tiếp tục cải thiện mà không cần viết lại.

Working tree trước khi kiểm toán đã có nhiều thay đổi chưa commit: README, dịch vụ routing (diff khoảng 662 dòng), thành phần UI/state và test; thêm các tệp GeoJSON/ảnh và dữ liệu tuyến campus. Những tệp này được xem là công việc người dùng và được giữ nguyên. Kết quả thực thi baseline phản ánh đúng working tree này, không phải riêng trạng thái commit.

## Phát hiện ưu tiên

| Mức | Phát hiện | Bằng chứng / tác động | Hướng xử lý đề xuất |
|---|---|---|---|
| **Critical** | Chưa xác nhận lỗi critical trong phần đã kiểm tra. | Không có bằng chứng đủ để kết luận có lỗ hổng nghiêm trọng. | Tiếp tục rà soát các route quản trị, biến môi trường và xử lý lỗi trước triển khai thật. |
| **Verified** | Backend integration và Playwright đã chạy trên môi trường isolated. | Test service riêng port 5433/volume riêng; backend 14 files/151 tests pass; Playwright 9/9 pass. | Giữ service/volume test tách biệt; không dùng kết quả này để tuyên bố độ chính xác field/OSM. |
| **High** | OSM walking graph và độ chính xác tuyến ngoài thực địa chưa được kiểm chứng. | Backend suite kiểm tra sample `campus_paths`, route JSON gate/transfer và các cặp node đã khai báo; chưa import OSM edges/đối chiếu thực địa. | Nạp dataset OSM chỉ vào DB test sau khi kiểm tra importer/URL; ghi provenance và field-check tuyến đại diện trước claim về độ chính xác. |
| **Fixed** | Lỗi tải map-data/category/origin list trước đây có thể trông như trạng thái rỗng. | Đã thêm lỗi/retry hiển thị cho map places, categories, origin list và search; unit/component tests kiểm tra riêng loading/failure/retry. | Kiểm chứng tiếp với API thật trong E2E khi PostGIS khả dụng. |
| **Medium** | Logic routing tập trung trong service lớn, và schema HTTP/types có nhiều nguồn khai báo. | `routing.service.ts` chứa graph load/composition, snap, Dijkstra, preferred route và response building. `common/schemas.ts` định nghĩa Zod shapes nhưng route places/routing/categories hiện khai báo JSON schema riêng; frontend types cũng được viết độc lập. | Không refactor lớn trước demo; nếu tiếp tục phát triển, chọn một nguồn hợp đồng runtime và thêm contract tests trước khi hợp nhất. |
| **Medium / cần quyết định chính sách** | Xóa place không xóa file upload. | `PlacesService.delete` chỉ DELETE row; uploads được serve từ filesystem. File đã upload nhưng không còn được tham chiếu có thể còn lại. | Chưa tự động xóa vì có thể có URL dùng chung; cần xác định chính sách ownership/ref-count trước khi thêm cleanup. |
| **Fixed** | Response cũ của list/search/route có thể ghi đè dữ liệu mới hoặc xóa trạng thái lỗi/thành công mới hơn. | Test deferred tái hiện stale success/failure; store dùng request IDs cho list/search/route và invalidation khi clear. | Network request chưa bị abort; response cũ chỉ bị bỏ qua khi hoàn tất. |
| **Fixed** | Graceful shutdown trước đây đóng DB pool trước Fastify. | `backend/src/app.ts` đã đóng app trước pool; typecheck/lint/build đã chạy sau thay đổi. | Không còn việc cần làm cho finding này. |
| **Medium** | Ban đầu không tìm thấy `.env.example` dù README yêu cầu copy để chạy. | Đã bổ sung `backend/.env.example` với giá trị local theo Compose và API key placeholder; không chứa credential thực. | Dùng file này cho local; thay bằng secret riêng trước khi triển khai. |
| **Low** | Kết quả build tạo/cập nhật `dist` đang được theo dõi/hiển thị trong repository. | Cây hiện có `backend/dist` và `frontend/dist`; cần xem `.gitignore` và trạng thái Git trước khi quyết định quản lý artifact. | Không xóa artifact có sẵn; thống nhất chính sách ignore/build output trong thay đổi riêng nếu cần. |

## Kiến trúc và luồng chính đã xác nhận

- Frontend là React 18 + TypeScript + Vite; Leaflet/React-Leaflet dựng bản đồ, Zustand giữ state, `services/` gọi API. Vite proxy `/api`, `/health`, `/uploads` tới backend cổng 3000.
- Backend là Fastify; `app.ts` đăng ký CORS, Helmet, rate limit, multipart, static uploads, Swagger và các module API. `config/index.ts` kiểm tra biến môi trường bằng Zod; production từ chối khởi động nếu thiếu `ADMIN_API_KEY`.
- Các route ghi được bảo vệ bởi hook API key khi key được cấu hình. Upload giới hạn kích thước, kiểm tra chữ ký PNG/JPEG/WebP, tạo tên UUID. Cần xác minh quy tắc auth/route trên cấu hình production và không bật server công khai khi thiếu key.
- PostgreSQL lưu geometry SRID 4326; GeoJSON dùng thứ tự kinh độ/vĩ độ. Schema chứa `categories`, `places`, `campus_paths`, `campus_routing_nodes`, `campus_routing_edges` cùng index không gian/tìm kiếm và view GeoJSON. Có migrations `0001`–`0003`.
- Routing service nạp graph từ OSM khi có dữ liệu, dùng graph cũ làm fallback khi không có cạnh OSM; code hiện hành còn ghép các dữ liệu tuyến campus. Không thể xác nhận chính xác các tuyến thực địa chỉ qua typecheck.

## Baseline (trước thay đổi)

| Thành phần | Lệnh | Kết quả |
|---|---|---|
| Backend | `npm run typecheck` | Thành công |
| Backend | `npm run lint` | Thành công |
| Backend | `npm run build` | Thành công |
| Backend | `npm test` | Thất bại: Vitest báo không tìm thấy test files; global setup cũng báo không kết nối được PostgreSQL. Không có test backend nào được xác nhận chạy. |
| Frontend | `npm run typecheck` | Thành công |
| Frontend | `npm run lint` | Thành công |
| Frontend | `npm test` | Thành công: 10 test files, 74 tests |
| Frontend | `npm run build` | Thành công |
| Backend E2E / frontend Playwright | Chưa chạy | Cần backend, database PostGIS và browser/runtime phù hợp. |

Vitest có pattern `tests/**/*.test.ts`; ở audit đầu `npx vitest list --filesOnly` tìm thấy 13 file. Lần `npm test` ban đầu không kết nối được PostgreSQL dù Vitest cũng in `No test files found`; không kết luận include pattern sai. Sau đó thêm test gate/disconnected nên hiện có 14 file. Global setup DROP/CREATE DB, do đó chỉ chạy sau khi endpoint/volume test isolated được xác minh.

## Truy vết hành trình người dùng

| Hành trình | Đường đi qua code/API | Trạng thái bằng chứng |
|---|---|---|
| Mở bản đồ | `main.tsx` → `App` → `BaseMap`; mount gọi `fetchPlaces`, `fetchMapPlaces`, `fetchRoutePlaces`, `fetchCategories` | **Source inspection only**; chưa chạy app/E2E |
| Tải/hiển thị địa điểm | Zustand gọi `GET /api/places`; `places.routes` → `PlacesService.findAll`; `BuildingsLayer` dựng polygon/marker theo layer | **Partially verified**: store pagination có unit test mock; DB và Leaflet runtime chưa xác minh |
| Tìm kiếm | `SearchBar` debounce/keyboard → store → `GET /api/places/search`; `PlacesService.search`/`search.ts` | **Partially verified**: SearchBar/store/API-client unit tests pass; truy vấn PostGIS chưa chạy |
| Lọc category | `CategoryFilter` → `setActiveCategoryFilter` → list/map fetch có `category` → `findAll` filter | **Partially verified**: store test mock pass; filter query và map rendering chưa chạy |
| Xem chi tiết | chọn `Place` đang có trong list/search → `PlaceDetailPanel`; không gọi `GET /api/places/:id` trong luồng này | **Partially verified**: panel unit tests pass; lựa chọn từ map chưa E2E |
| Chọn điểm đi/đến (trạng thái hiện tại) | `RoutePanel` chọn place → Zustand → `GET /api/routing?from=lat,lng&to=lat,lng` | **Verified in E2E** trên database isolated: origin place và đích place tính route; ứng dụng không truy cập Geolocation API. Backend API vẫn nhận tọa độ cho các caller khác. |
| Hiển thị tuyến | `RoutingLayer` vẽ step GeoJSON; `RouteFit` fit bounds; `routing.service` trả route/fallback/off-network | **Partially verified**: E2E sample route xác nhận `fallback=false`, geometry nhiều điểm và summary UI; chưa xác minh OSM graph hay field accuracy |
| Thiếu dữ liệu/lỗi/unreachable | sidebar, map layer, category, search và origin list có trạng thái lỗi/retry; route lỗi hiển thị alert; fallback có cảnh báo riêng | **Partially verified**: backend kiểm tra invalid/far/no-path fallback; API outage và UI recovery qua E2E chưa kiểm tra |
| Mở quản trị/đăng nhập | hash `#/admin` → lazy `AdminApp` → `POST /api/auth/verify`; auth plugin kiểm tra key | **Verified in E2E** trên DB isolated: đúng/sai key, create/edit/delete bản ghi test |
| Tạo/sửa geometry | `PlaceEditor`/`GeometryEditor` → `adminApi` → POST/PATCH place → PostGIS geometry validation | **Verified in E2E** trên DB isolated: draw polygon, reload, drag vertex/save, PostGIS báo `Self-intersection` và rollback, discard thay đổi chưa lưu |
| Upload ảnh admin | `PlaceEditor` → `POST /api/uploads` → file storage/static route; URL được lưu trong `places.images` | **Verified in E2E**: bytes sai bị từ chối, PNG được upload/giải mã, lưu URL và lấy lại qua HTTP; file test ở temp dir riêng |

“Partially verified” chỉ áp dụng cho test cụ thể nêu trong cột. E2E xác nhận một luồng frontend→API→PostGIS trên sample data; không xác minh độ chính xác ngoài thực địa.

## Việc còn lại theo thứ tự ưu tiên

1. **Trước bảo vệ:** dùng demo checklist, xác nhận dataset/key, trình bày rõ sample vs OSM và fallback.
2. **Cần để xác minh outdoor graph:** chạy OSM path importer trên isolated DB, kiểm tra coverage/CRS và field-check tuyến đại diện.
3. **Bằng chứng học thuật:** ghi nguồn/thời điểm dữ liệu, ảnh runtime và kết quả field/performance chỉ nếu đã thực hiện/đo.

## Giới hạn của báo cáo

Đây là baseline và đợt kiểm tra có chọn lọc, chưa phải xác nhận pentest, kiểm toán toàn bộ dữ liệu địa lý, hay xác minh tuyến tại thực địa. Không có phép đo hiệu năng, kiểm tra coverage, xác thực dữ liệu OSM hoặc Playwright trong baseline. Các thay đổi chưa commit được giữ nguyên và cần được review như một phần công việc hiện tại.

## Cập nhật kiểm chứng routing offline

- Đã đọc routing service/routes, geometry helper, migration `0001`–`0003`, các test routing và ba JSON routing. Dijkstra và nearest-node có unit tests thuần; route candidate lookup, DB graph loading, place-to-access matching và toàn bộ HTTP route cần PostgreSQL/PostGIS.
- `routing.unit.test.ts` có 7 test cho shortest path/reconstruction, start=goal, unreachable component, thiếu start, đồ thị hai chiều và nearest-node khoảng cách mét. Gate/transfer integration tests kiểm tra direct route, chuyển tiếp, chiều ngược và connectivity theo data, nhưng cần DB.
- Bổ sung `backend/tests/routing.data.test.ts`: kiểm tra hợp đồng cấu trúc/ID/tọa độ/endpoint dữ liệu tĩnh, không tuyên bố connectivity thực tế.
- Kiểm tra ba JSON: gate 59 feature (35 điểm, 24 LineString), transfer 5 hub và 34 route, walkways 6 feature (2 corridor). Không thấy JSON/coordinate invalid, ID trùng, tham chiếu endpoint thiếu, endpoint lệch quá 2 m, corridor pair trùng hoặc polygon ring không đóng.
- Chạy unit/data tests bằng cấu hình Vitest tạm trong thư mục temp, không dùng `globalSetup` phá hủy DB: 2 files, 11 tests pass. Không có thay đổi routing service hoặc route JSON.
- Kết quả này chỉ xác minh tính nhất quán hình thức và thuật toán trên graph fixture. Chưa xác minh graph DB, các kết nối OSM/transfer khi nạp, phản hồi HTTP, frontend rendering hay độ chính xác thực địa.
- Tạo `docs/DEMO_CHECKLIST.md`, phân biệt bước đề xuất với bước đang bị chặn bởi Docker/PostgreSQL.
- Đối chiếu tài liệu phát hiện mô tả routing 422 chưa chính xác: disconnected/no-network trả fallback geometry với `meta.fallback=true`; 422 áp dụng cho endpoint routing quá xa (>3 km). Đã sửa `docs/API.md`.
- Regression test đảo thứ tự ban đầu tái hiện 4 lỗi (search/route stale success và stale failure). Store/UI đã được sửa; test mục tiêu sau sửa pass 48/48 trên 5 files.
- Bổ sung state lỗi/loading/retry cho category, map places và route-origin list; SearchBar phân biệt lỗi với không có kết quả. Fallback nay có alert nêu rõ đường thẳng không phải tuyến đi bộ đã xác minh.
- Regression cuối: frontend **11 files/89 tests pass**; backend integration **14 files/151 tests pass**; Playwright **9/9 pass**; backend/frontend typecheck, lint, build và `git diff --check` pass.
- Isolated service dùng `docker-compose.test.yml`, project `phenikaa-webgis-test`, loopback port 5433 và volume `phenikaa-webgis-test-pgdata`, không mount `my-node-project_pgdata`. E2E dùng DB `phenikaa_gis_e2e` riêng trong test-only service; admin E2E tạo/sửa/xóa bản ghi test và xác nhận bản ghi đã xóa.
- Một E2E selector ambiguity (subtitle xuất hiện ở sidebar và overlay) được sửa bằng cách scope locator vào sidebar. Route E2E assert HTTP 200, mode walk, `fallback=false` và geometry có hơn hai tọa độ cho sample route Cổng Nam→Thư viện.
- Backend test có scenario graph hai component rời nhau: API trả `200`, `meta.fallback=true` và geometry thẳng; gate main→A2 trả LineString khai báo; transfer tests kiểm tra trực tiếp/qua hubs/chiều ngược và connectivity 29 access places.
- Chưa import OSM walking edges trong lượt này; routing integration kiểm chứng sample `campus_paths` và JSON gate/transfer. Chưa xác minh OSM outdoor graph runtime, thao tác vẽ polygon trong GeometryEditor hoặc độ chính xác thực địa.

## Xác minh full-stack ngày 2026-10-21

- Docker CLI 29.5.3/Compose 5.1.4, Node 24.18/npm 11.16. Docker daemon được khởi động; development container `phenikaa-db` vẫn stopped, volume `my-node-project_pgdata` không bị mount/thay đổi.
- Test Compose project `phenikaa-webgis-test` chạy `postgis/postgis:16-3.4` tại loopback port 5433 với volume riêng `phenikaa-webgis-test-pgdata`. Container labels, port mapping, health và volume mount được inspect; PostgreSQL 16.4 và PostGIS extension được truy vấn xác nhận. Database `phenikaa_gis_test` và `phenikaa_gis_e2e` nằm trong test-only server.
- Test URL guard từ chối thiếu URL, host/port khác và database khác `phenikaa_gis_test`; global setup/migration tests chạy trong isolated server. Backend suite **14 files/151 tests pass**; migration test pass baseline, idempotence và adoption; migration runner trên E2E DB áp dụng baseline cùng `0001`–`0003`.
- Fail-safe được xác nhận: Vitest từ chối chạy nếu `TEST_DATABASE_URL` thiếu; Playwright từ chối E2E nếu `DATABASE_URL` trỏ port 5432/dev DB. Cả hai dừng trước global setup hoặc server startup.
- API/PostGIS integration bao gồm CRUD/validation, search, nearby/GeoJSON, upload, health/readiness, auth, routing A/B/C, off-network, no-path fallback, bad/far coordinates và transfer JSON connectivity/direct/reverse. Không chạy OSM importer; outdoor OSM graph chưa được verify.
- Playwright Chromium **9/9 pass** với API/backend trên port 3100 (port 3000 thuộc container không liên quan, không bị dừng) và Vite proxy trỏ vào backend test. E2E xác nhận map/search/category/detail, sample route API (`fallback=false`, geometry >2 coordinates), admin valid/wrong key + CRUD, Leaflet polygon draw/reload/drag/save/discard, PostGIS self-intersection rejection/rollback, PNG decode + upload/serve, malformed bytes rejection, Vietnamese UI và responsive drawer.
- Lượt Playwright đầu có 1 strict locator failure do subtitle xuất hiện cả sidebar và overlay; locator được scope đúng sidebar, test không bị xóa/yếu đi. Integration run đầu có 18 auth failures vì E2E key bị export vào Vitest; rerun không export `ADMIN_API_KEY` pass toàn bộ.
- Backend/frontend typecheck, lint, build pass; frontend unit **11 files/89 tests pass**; `git diff --check` pass. Browser Chromium được cài vào Playwright cache; không thêm dependency package.
- Read-only query sau E2E cho DB mẫu ghi nhận 10 `places`, 11 `campus_paths`, 0 `campus_routing_nodes`, 0 `campus_routing_edges`, PostGIS enabled. Vì vậy route E2E Cổng Nam→Thư viện dùng sample legacy graph, không phải OSM outdoor network.
- Chưa kiểm chứng OSM walking-edge import/runtime, API outage recovery E2E, hoặc độ chính xác ngoài thực địa. Không sửa migration lịch sử hay campus route JSON.
- Rà soát toàn repository không thấy raw OSM PBF/XML hay response chứa OSM node/way network; importer `db:import-osm-paths` lấy Overpass và truncate hai bảng graph trong transaction. Không download/chạy importer vì không có source local và sẽ cần nguồn ngoài; cần user approval cho bước thu thập dữ liệu OSM ngoài này.

## Follow-up: điều khiển Leaflet bị chồng lấn

CSS cũ đặt `map-buttons` absolute ở góc trên trái và đẩy `ZoomControl` bằng `margin-top: 182px` desktop / `164px` mobile. Nhóm custom có chiều cao cộng dồn theo số nút/breakpoint nên nút sơ đồ có thể chiếm bounding box của zoom controls. Đã chuyển nút vị trí/home/sơ đồ và opener sidebar thành Leaflet `Control` ở `topleft`; Leaflet tự xếp nó cạnh/dưới `ZoomControl`. Brand pill được căn giữa phía trên map để tách khỏi cột control; các margin tọa độ cũ bị gỡ. Kiểm tra E2E bounding box, zoom tile level, pan, reference dialog, layer-control visibility và panel route ở 1920×1080, 1366×768, 768×1024, 390×844, 375×667: **5/5 viewport pass**.

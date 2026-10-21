# Checklist trình diễn WebGIS

Checklist này mô tả cách trình diễn theo code hiện tại. Ngày 2026-10-21 đã tạo PostGIS test service riêng (port 5433, volume `phenikaa-webgis-test-pgdata`) và chạy backend integration/E2E trên database test. Development DB `phenikaa_gis` ở port 5432 vẫn không được khởi động hoặc thay đổi. Các bước đánh dấu **[CHƯA XÁC MINH]** vẫn cần chạy riêng trước demo tại lớp.

## 1. Chuẩn bị môi trường

- [ ] Máy có Node.js 20 trở lên và npm.
- [ ] Docker Desktop/Compose chạy được.
- [ ] PostgreSQL/PostGIS dành cho demo tại service `db` trong `docker-compose.yml` khởi động khỏe mạnh. **[CHƯA XÁC MINH; không dùng thay test service và không khởi động nếu chưa xác nhận volume/dev DB]**
- [x] Test PostGIS isolated service healthy tại loopback port 5433, volume riêng; chỉ dùng cho kiểm thử.
- [ ] Hai terminal ở đúng repository `my-node-project/`.
- [ ] Backend có `backend/.env`, tạo từ `.env.example`; đặt `DATABASE_URL` trỏ tới database demo dự kiến và thay `ADMIN_API_KEY=replace-with-a-local-secret` bằng giá trị demo riêng.
- [ ] Không dùng key placeholder trên máy có thể truy cập từ bên ngoài. Khi thiếu `ADMIN_API_KEY`, thao tác ghi không được bảo vệ; production từ chối khởi động nếu thiếu key.
- [ ] Tiles và imagery cần truy cập Internet; không đảm bảo nhà cung cấp bên thứ ba luôn sẵn sàng.

## 2. Khởi động theo thứ tự

Từ thư mục gốc repository:

```powershell
cd my-node-project
docker compose up -d db
docker compose ps
```

Khi DB khỏe mạnh, terminal backend:

```powershell
cd my-node-project/backend
Copy-Item .env.example .env   # chỉ làm lần đầu; sửa .env bằng secret riêng
npm install
npm run db:migrate
npm run dev
```

`docker-compose` chạy `sql/init.sql` tự động khi volume DB được tạo lần đầu; `db:migrate` ghi nhận baseline và áp dụng migration còn thiếu. Với volume đã có dữ liệu, kiểm tra đúng `DATABASE_URL` và sao lưu theo quy trình trước khi thay đổi schema. `db:seed` hiện là lệnh kiểm tra/báo cáo, không phải reset dữ liệu.

Lệnh import OSM **không bắt buộc cho demo bằng sample data**. Chỉ chạy khi đã kiểm tra đúng DB, hiểu rằng importer đồng bộ/thay thế tập OSM/sample liên quan, có Internet tới Overpass và có bản sao lưu phù hợp:

```powershell
npm run db:import-osm-paths
npm run db:import-osm-places
```

Terminal frontend:

```powershell
cd my-node-project/frontend
npm install
npm run dev
```

Mở `http://localhost:5173`; health endpoint là `http://localhost:3000/health/ready`. Các bước khởi động có DB **[CHƯA THỂ CHẠY/kiểm chứng trong môi trường audit]**.

## 3. Kịch bản bản đồ và tra cứu

- [ ] Trang mở tại bản đồ campus, sidebar hiển thị danh sách, bản đồ có dữ liệu điểm/footprint theo sample hoặc tập dữ liệu đã nạp.
- [ ] Tìm `thư viện`; thử không dấu `thu vien`; chọn kết quả và xác nhận panel chi tiết xuất hiện, bản đồ di chuyển tới vị trí.
- [ ] Kiểm tra ảnh thư viện tải trong panel, vừa chiều rộng; mã OSM và metadata tầng không hiện ở chi tiết công khai.
- [ ] Lọc một danh mục (ví dụ thư viện), ghi nhận danh sách/lớp bản đồ thu hẹp; xóa filter và xác nhận dữ liệu trở lại.
- [ ] Mở panel chi tiết, kiểm tra tên/danh mục/thông tin công khai; với địa điểm chưa ánh xạ ảnh, xác nhận trạng thái không có ảnh.
- [ ] Chuyển Street/Satellite; kiểm tra attribution và chấp nhận tiles có thể không tải nếu mạng/provider lỗi.
- [ ] Thử thu nhỏ viewport; danh sách chuyển thành drawer và map vẫn thao tác được.
- [ ] Ở 1920×1080, 1366×768, 768×1024, 390×844 và 375×667, xác nhận Zoom In/Out không bị nút sơ đồ che; cả hai nút zoom và nút sơ đồ đều bấm được.

**Kết quả mong đợi:** thao tác UI hoàn tất với dữ liệu đã nạp. Playwright đã xác minh các bước map/list/detail/search accent/category; tile provider ngoài vẫn phụ thuộc mạng.

## 4. Kịch bản chỉ đường

- [ ] Chọn địa điểm đích rồi bấm chỉ đường.
- [ ] Chọn một địa điểm thật từ dropdown làm điểm đi; ứng dụng không xin quyền GPS và click vùng trống trên bản đồ không đặt origin.
- [ ] Tạo tuyến giữa hai điểm campus có trong dataset. Xác nhận panel có khoảng cách/thời gian và đường xuất hiện trên map.
- [ ] Nếu điểm xuất phát là cổng và cặp điểm có LineString khai báo, kiểm tra tuyến hiển thị đúng dữ liệu khai báo; đây là behavior theo source, chưa xác minh DB runtime.
- [ ] Đảo điểm đi/đến bằng nút swap khi điểm đi là một place đã biết.
- [ ] Thử điểm ngoài mạng nhưng gần campus: response có thể gồm đoạn `off_network`, hiển thị nét cam/cảnh báo.
- [ ] Thử route không có đường nối: code có thể trả tuyến fallback thẳng với nhãn “Đường chim bay”; đây **không** phải xác nhận tuyến đi bộ khả thi.
- [ ] Thử điểm cách mạng hơn 3 km: backend dự kiến trả HTTP 422 và UI hiển thị lỗi.
- [ ] Tắt backend hoặc ngắt DB trong môi trường thử riêng để trình diễn lỗi kết nối chỉ khi an toàn; không làm trên hệ thống dùng chung. Kiểm tra thông báo/retry.

Backend integration đã kiểm tra invalid coordinates, điểm quá xa, off-network, fallback khi không có path network, sample path routing và transfer JSON graph. Playwright đã xác minh sample route Cổng Nam→Thư viện trả `200`, mode walk, `fallback=false` và geometry nhiều hơn hai điểm. **[CHƯA XÁC MINH]** OSM walking-edge importer/runtime hoặc độ chính xác ngoài thực địa.

## 5. Kịch bản quản trị

- [ ] Mở `http://localhost:5173/#/admin`, đăng nhập với `ADMIN_API_KEY` đã đặt trong backend.
- [ ] Tạo một place demo với mã duy nhất (ví dụ `DEMO-<thời điểm>`), chọn category, nhập điểm và lưu.
- [ ] Tìm lại place, sửa một trường và geometry (điểm/polygon), lưu và kiểm tra dữ liệu mới.
- [ ] Nếu trình diễn upload, dùng ảnh PNG/JPEG/WebP nhỏ; backend kiểm tra MIME/signature và giới hạn kích thước.
- [ ] Xóa đúng place demo vừa tạo sau khi xác nhận; không xóa dữ liệu campus thật.
- [ ] Đăng xuất/đăng nhập lại; xác nhận thao tác ghi yêu cầu key trong cấu hình này.

Playwright đã xác minh admin login đúng/sai, create/edit/delete place, vẽ polygon, reload/drag vertex, bỏ thay đổi chưa lưu, PostGIS từ chối polygon tự giao/rollback, PNG giải mã và tải/phục vụ thành công, malformed file bị từ chối trên `phenikaa_gis_e2e` isolated DB. Nội dung E2E là test-only, không dùng record campus thật.

## Kết quả E2E đã chạy

- [x] Danh sách/place detail, tìm không dấu, lọc category.
- [x] Origin/destination selection và render route sample.
- [x] Admin CRUD trên DB test isolated; bản ghi E2E bị xóa và API xác nhận không còn.
- [x] Responsive drawer, Vietnamese UI, sơ đồ trường tham khảo.
- [ ] Field-check tuyến; import/verify OSM outdoor network.

## 6. Những điều cần nói rõ khi bảo vệ

- Backend integration 151/151 pass và Playwright 9/9 pass trên isolated test DB, không phải production/campus data validation.
- OSM và dữ liệu lối đi campus chưa được kiểm chứng hiện trường; độ phủ/chất lượng phụ thuộc dataset.
- Router có đoạn nối ngoài mạng và fallback đường thẳng; fallback không phải chỉ dẫn đường đi an toàn.
- Bản đồ nền/vệ tinh phụ thuộc Internet và provider bên ngoài.
- Demo bằng dữ liệu sample không chứng minh độ chính xác hay tính đầy đủ của dữ liệu chính thức.
- Chỉ trình bày số liệu, kết quả test hoặc khảo sát đã thực sự thực hiện và lưu được bằng chứng.

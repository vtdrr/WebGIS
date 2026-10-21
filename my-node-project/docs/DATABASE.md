# Cơ sở dữ liệu

## Bảng và quan hệ

| Bảng | Vai trò và ràng buộc chính |
|---|---|
| `categories` | Danh mục; `id` khóa chính, `code` duy nhất |
| `places` | Địa điểm; `category_id` tham chiếu `categories` (xóa category đặt NULL); point/polygon SRID 4326 |
| `campus_paths` | Graph cũ; source/target tham chiếu `places.code`, hình học LineString |
| `campus_routing_nodes` | Nút OSM, geometry Point |
| `campus_routing_edges` | Cạnh OSM tham chiếu hai node; distance dương, segment duy nhất theo way/index, LineString |
| `schema_migrations` | Phiên bản migration và thời điểm áp dụng |

`places` còn chứa code, tên/mô tả Việt–Anh, tầng, giờ mở cửa, liên hệ, ảnh, attributes JSONB và source (`sample`, `manual`, `osm`). `osm_type` và `osm_id` phải cùng null hoặc cùng có giá trị.

## Không gian và index

Geometry lưu SRID 4326; thứ tự GeoJSON là `[longitude, latitude]`. `geom_point` dùng làm vị trí đại diện; `geom_polygon` là footprint. Schema tạo GIST index cho geometry, GIN full-text, GIN trigram cho tên/mã, và index theo category/code/floor/source. `search_tsv` là generated column có trọng số tên, mã/tên Anh, mô tả. Hai view `v_places_with_category` và `v_places_geojson` phục vụ truy vấn/xuất dữ liệu.

## Khởi tạo và migration

`sql/init.sql` là baseline gồm extension, schema, index, view, trigger và dữ liệu mẫu. Docker entrypoint chỉ chạy init khi volume DB được tạo lần đầu. `npm run db:migrate` ghi baseline và áp dụng migration `NNNN_*.sql` theo thứ tự; mỗi file chạy trong transaction với advisory lock. Không viết lại migration lịch sử; tạo migration mới.

Importer `src/db/importOsm*.ts` lấy dữ liệu OSM; có lệnh cần Internet/Overpass. `data/places.example.csv` là ví dụ, không phải kiểm kê chính thức. `db:seed` hiện là lệnh kiểm tra/báo cáo theo nội dung code, không nên giả định nó tái tạo dữ liệu.

Không chạy reset/test trên database chứa dữ liệu cần giữ. `tests/globalSetup.ts` DROP/CREATE database có tên chứa `test`.

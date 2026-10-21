# Dữ liệu GIS campus được theo dõi

Các tệp GeoJSON dưới đây là bản vẽ/xuất dữ liệu campus do người dùng cung cấp, giữ nguyên nội dung và tọa độ. Chúng là tư liệu để mở lại/đối chiếu trong GIS, không được ứng dụng tự động import vào PostGIS.

| Tệp | Nội dung hình học | Ghi chú |
|---|---|---|
| `drawing (1).geojson` | 14 LineString, 7 Polygon | Bản vẽ đường và khu vực campus |
| `fix lối đi từ cổng phụ.geojson` | 35 Point, 14 LineString | Bản fix/export lối đi cổng phụ |
| `fix định nghĩa.geojson` | 35 Point | Bản fix/export định nghĩa điểm |
| `geodataviewer-final.geojson` | 20 Polygon | Polygon được xuất từ GeoDataViewer |
| `lối đi từ cổng chính.geojson` | 35 Point, 10 LineString | Đường và điểm liên quan cổng chính |
| `lối đi từ cổng phụ.geojson` | 70 Point, 14 LineString | Đường và điểm liên quan cổng phụ |
| `lối đi.geojson` | 2 LineString, 4 Polygon | Bản vẽ tuyến/khu vực campus |
| `điểm trung chuyển/điểm trung chuyển A1.geojson` | 70 Point, 5 LineString | Bản vẽ vùng chuyển tiếp A1 |
| `điểm trung chuyển/điểm trung chuyển A2.geojson` | 70 Point, 11 LineString | Bản vẽ vùng chuyển tiếp A2 |
| `điểm trung chuyển/điểm trung chuyển A7.geojson` | 70 Point, 8 LineString | Bản vẽ vùng chuyển tiếp A7 |
| `điểm trung chuyển/điểm trung chuyển A8.geojson` | 140 Point, 10 LineString | Bản vẽ vùng chuyển tiếp A8 |
| `điểm trung chuyển/điểm trung chuyển B2.geojson` | 70 Point, 4 LineString | Bản vẽ vùng chuyển tiếp B2 |
| `định nghĩa bắt đầu và đến nơi.geojson` | 39 Point | Bản định nghĩa điểm xuất phát/đích |
| `định nghĩa bắt đầu và đến nơi_1.geojson` | 35 Point | Bản định nghĩa điểm xuất phát/đích |

Các tệp có tên `fix`, `_1` hoặc xuất từ công cụ GIS được giữ lại như các bản nguồn riêng, không tự chọn một bản làm “dữ liệu chuẩn” và không hợp nhất chúng. Kiểm tra cú pháp đọc được, geometry được hỗ trợ, tọa độ trong miền hợp lệ và polygon ring đóng; việc này không xác minh độ chính xác thực địa.

Đường đi production/runtime vẫn do các file routing JSON có schema của ứng dụng quản lý tại `backend/src/modules/routing/` (`campus-gate-routes.json`, `campus-transfer-routes.json`, `campus-walkways.json`). GeoJSON ở repository root không thay thế các file đó và không được importer tự đọc.

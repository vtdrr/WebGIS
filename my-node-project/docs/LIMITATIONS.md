# Hạn chế

- Độ phủ/độ chính xác địa điểm, footprint và lối đi phụ thuộc OSM và dữ liệu campus hiện có; chưa có bằng chứng trong repository về kiểm kê chính thức hay khảo sát toàn bộ.
- OSM/Overpass là dịch vụ ngoài; đồng bộ phụ thuộc importer, bbox và khả năng truy cập. Cần giữ attribution/tuân thủ giấy phép dữ liệu.
- Router có thể nối endpoint vào graph bằng đoạn thẳng ngoài mạng; có nhánh fallback. Metadata giúp nhận biết nhưng không khẳng định tuyến đã an toàn/đúng thực địa.
- Backend integration tests (14 files/151 tests) và Playwright (9/9 Chromium) đã chạy với PostGIS service/volume riêng. Các E2E dùng sample DB trong isolated test service; không chứng minh chất lượng dữ liệu chính thức hay hành vi production.
- E2E đã thao tác GeometryEditor (vẽ polygon, reload, drag vertex, lưu, PostGIS self-intersection rejection/rollback và bỏ thay đổi chưa lưu) cùng upload PNG/malformed file trên test-only storage. Điều này xác nhận browser workflow kỹ thuật, không xác nhận người dùng thực hiện khảo sát/tọa độ chính xác.
- Xóa place chỉ xóa bản ghi database; upload file được lưu trong thư mục tĩnh riêng và hiện không có cleanup/ref-count khi bản ghi bị xóa. Không thêm xóa file tự động vì ảnh có thể được tham chiếu dùng chung; cần quy định ownership trước khi triển khai cleanup.
- Bản đồ phụ thuộc mạng và nhà cung cấp tile/imagery; độ sẵn sàng, giới hạn, attribution và độ phân giải do nhà cung cấp quyết định.
- Chưa đo độ chính xác giờ mở cửa/liên hệ/tầng, benchmark hiệu năng hay coverage.
- Backend test global setup vẫn DROP/CREATE database; URL bị khóa vào loopback port 5433 và database `phenikaa_gis_test`, trong Compose service/volume riêng. Chỉ chạy với test service đã được xác minh.
- Repository không có raw OSM PBF/OSM XML/Overpass response chứa node IDs + way/highway tags để tái lập outdoor import; GeoJSON local là polygon/vị trí/LineString thủ công, không phải input theo `OsmResponse`. Importer gọi Overpass ngoài và có thể `TRUNCATE` OSM graph khi chạy; lượt này không tải dữ liệu ngoài hoặc chạy importer. Routing integration kiểm tra JSON gate/transfer cùng sample `campus_paths`; OSM outdoor network và độ đúng thực địa chưa được xác minh.
- E2E database dùng baseline sample (read-only inspection: 10 places, 11 `campus_paths`, 0 OSM routing nodes/edges). Route E2E thành công là integration behavior trên sample graph, không phải xác minh mạng OSM thật.
- Lỗi tải map place/category/search và danh sách điểm xuất phát hiện có thông báo/retry riêng ở UI. Đây mới là test component/store với mock; hành vi khi API/PostGIS thật mất kết nối chưa được E2E kiểm chứng.
- Search/route dùng request IDs để bỏ qua response cũ; request mạng vẫn tiếp tục chạy tới khi hoàn tất (không AbortController). Không có cập nhật state stale theo các test đảo thứ tự hiện có.
- Fallback routing được cảnh báo là đường thẳng tham khảo, không phải tuyến đi bộ đã xác minh; thực tế route response vẫn cần xác minh trên PostGIS và ngoài thực địa.

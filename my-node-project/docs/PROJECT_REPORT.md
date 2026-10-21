# Bản thảo báo cáo đồ án WebGIS

> Nội dung đánh dấu `[CẦN BỔ SUNG]` phải được sinh viên hoàn thiện bằng thông tin và bằng chứng thực tế; không xem đây là kết quả đã đo.

## 1. Giới thiệu và động lực

Dự án xây dựng WebGIS hỗ trợ tra cứu địa điểm và tìm đường đi bộ trong khuôn viên Trường Đại học Phenikaa. Động lực, hiện trạng và bối cảnh sử dụng thực tế: [CẦN BỔ SUNG từ khảo sát/quan sát].

## 2. Bài toán

Cần hiển thị địa điểm trên bản đồ, hỗ trợ tìm kiếm/lọc, xem chi tiết và đề xuất tuyến đi bộ trên mạng có sẵn. Chất lượng phụ thuộc độ chính xác dữ liệu và connectivity của graph.

## 3. Mục tiêu và phạm vi

Code hiện có gồm bản đồ Leaflet, danh mục/địa điểm, tìm kiếm, quản trị địa điểm và routing đi bộ. Đối tượng, phạm vi campus, tiêu chí nghiệm thu và yêu cầu giảng viên: [CẦN BỔ SUNG].

## 4. Phân tích yêu cầu

| Nhóm | Chức năng quan sát được |
|---|---|
| Tra cứu | Danh sách, tìm kiếm, category, nearby, chi tiết, GeoJSON |
| Bản đồ | Hiển thị địa điểm/footprint và lớp nền |
| Routing | Tuyến đi bộ, geometry, bước và metadata |
| Quản trị | CRUD địa điểm, geometry, upload ảnh; API key khi cấu hình |
| Chất lượng | Validation, truy vấn tham số, typecheck/lint/test |

## 5. Công nghệ

React, TypeScript, Vite, Leaflet/React-Leaflet; Node.js, Fastify, Zod; PostgreSQL/PostGIS; Vitest và Playwright. Lý do chọn theo tiêu chí nhóm: [CẦN BỔ SUNG].

## 6. Kiến trúc

Hệ thống theo mô hình client–API–database. Xem [ARCHITECTURE.md](ARCHITECTURE.md). Frontend gửi HTTP request; Fastify kiểm tra schema, gọi module/service; PostgreSQL thực hiện truy vấn và API trả JSON/GeoJSON.

## 7. Cơ sở dữ liệu

Bảng chính: `categories`, `places`, `campus_paths`, `campus_routing_nodes`, `campus_routing_edges`, `schema_migrations`. Geometry dùng SRID 4326; PostGIS hỗ trợ truy vấn không gian. Xem [DATABASE.md](DATABASE.md). ERD chi tiết nếu học phần yêu cầu: [CẦN BỔ SUNG].

## 8. Cài đặt chức năng

Backend có module categories, places, routing, uploads; frontend có map/UI/admin, API client và state. Ảnh chụp thực tế, phân công và đóng góp cá nhân: [CẦN BỔ SUNG, không suy diễn từ code].

## 9. GIS và định tuyến

GeoJSON dùng thứ tự `[longitude, latitude]`; khoảng cách routing diễn giải theo mét. Router nạp OSM graph khi có dữ liệu, giữ graph tương thích và bổ sung một số tuyến campus thủ công. Kết nối ngoài mạng/fallback cần hiển thị rõ và không thay cho xác minh hiện trường.

## 10. Kiểm thử và đánh giá

Trong lần xác minh full-stack 2026-10-21, backend integration đạt 151/151 tests và Playwright đạt 9/9 trên PostGIS test service riêng; frontend đạt 89/89 tests. Typecheck, lint, build của hai phần đều pass. Playwright đã kiểm tra CRUD, polygon editor và upload trên test records. Routing được kiểm tra với sample legacy graph và JSON gate/transfer; chưa import OSM outdoor graph hoặc xác minh thực địa. Xem [TESTING.md](TESTING.md). Đánh giá độ chính xác tuyến, usability, hiệu năng, coverage và field-check: [CẦN BỔ SUNG bằng kết quả đo thực tế].

## 11. Hạn chế

Xem [LIMITATIONS.md](LIMITATIONS.md), đặc biệt về độ phủ dữ liệu, tính mới của OSM và xác minh route.

## 12. Hướng phát triển

- Thu thập/xác minh dữ liệu campus theo quy trình ghi nhận nguồn.
- Chạy test backend trên PostGIS test database và E2E trên môi trường tái lập.
- Đánh giá tuyến mẫu bằng đối chiếu thực địa.
- Cải thiện accessibility khi có dữ liệu phù hợp.

## 13. Kết luận

Repository hiện thực hóa nguyên mẫu WebGIS có tra cứu, quản trị và routing đi bộ. Kết luận về mức đáp ứng mục tiêu học phần và độ chính xác cần dựa trên kiểm thử/bằng chứng bổ sung, không suy ra từ việc build thành công.

## 14. Tài liệu tham khảo

- PostgreSQL Documentation, https://www.postgresql.org/docs/ (chính thức).
- PostGIS Documentation, https://postgis.net/documentation/ (chính thức).
- OpenStreetMap Wiki, https://wiki.openstreetmap.org/ (tài liệu cộng đồng; cần ghi attribution/giấy phép dữ liệu cụ thể).
- React Documentation, https://react.dev/; Leaflet Reference, https://leafletjs.com/reference.html; Fastify Documentation, https://fastify.dev/docs/latest/ (tài liệu chính thức).
- Nguồn dữ liệu campus, truy vấn OSM, thời điểm trích xuất, giấy phép/attribution: [CẦN BỔ SUNG].

Thông tin sinh viên/nhóm, giảng viên, thời gian thực hiện, đóng góp và định dạng báo cáo: [CẦN BỔ SUNG].

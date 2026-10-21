# Ảnh địa điểm trong giao diện WebGIS

Ảnh tham khảo do chủ dự án cung cấp và cho phép đưa vào repository. Bản ứng dụng nằm tại `frontend/public/place-images/` với tên ASCII; các JPEG lớn đã được thu nhỏ tối đa 1800 px để phù hợp chiều rộng sidebar. Đây là các tệp duy nhất cần khi clone/build ứng dụng: Vite phục vụ chúng dưới `/place-images/<tên-tệp>` và bản build đưa chúng vào `dist/`. Bản gốc trong thư mục làm việc `ảnh/` không phải dependency runtime và không được nhân đôi trong repository.

`frontend/src/data/placePhotos.ts` là danh sách ánh xạ tường minh theo `places.code`; không suy ảnh từ tên địa điểm. Ảnh đã tải lên và lưu trong `places.images` được ưu tiên, sau đó mới dùng ảnh tham khảo đóng gói. Nếu mọi URL lỗi hoặc không có ánh xạ, sidebar hiển thị “Chưa có hình ảnh của địa điểm này.”

| Tên ảnh nguồn (để đối chiếu, không đóng gói) | Tệp frontend | Mã địa điểm được ánh xạ |
|---|---|---|
| `ảnh dùng cho khu vực y tế.jpg` | `medical-center.jpg` | `OSM-W-1183713535` |
| `ảnh dùng cho nhà thi đấu.jpg` | `sports-hall.jpg` | `OSM-W-892574249` |
| `ảnh dùng cho sân bóng.jpg` | `football-field.jpg` | `OSM-W-892560469` |
| `ảnh dùng cho sân tennis.jpg` | `tennis-court.jpg` | `CAMPUS-TENNIS` |
| `ảnh dùng cho thư viện.jpg` | `library.jpg` | `CAMPUS-LIBRARY-A10`, `LIB-MAIN` |
| `ảnh dùng cho tòa A9-A10.jpg` | `buildings-a9-a10.jpg` | `OSM-W-1179878047`, `OSM-W-1179878048` |
| `ảnh dùng cho tất cả căng tin.jpg` | `canteen.jpg` | `CAN-MAIN`, `OSM-W-892560481`, `OSM-W-1183713524` |
| `ảnh dùng cho tất cả khu vực để xe.jpg` | `parking.jpg` | `PK-MAIN`, `CAMPUS-PARKING-1` đến `CAMPUS-PARKING-4` |
| `ảnh dùng cho tất cả kí túc xá.png` | `dormitories.png` | `DOR-A`, `OSM-W-892574245`, `OSM-W-892560474`, `OSM-W-892560472` |
| `ảnh dùng cho tất cả tòa A1 đến A8.jpg` | `buildings-a1-a8.jpg` | `A1-MAIN`, OSM way IDs `1113215768`, `1183713531`, `1183713520`, `1183713532`, `1183713521`, `1183713533`, `1183713522`, `1183713534` (code `OSM-W-<ID>`) |
| `ảnh dùng cho tất cả tòa B.jpg` | `buildings-b.jpg` | OSM way IDs `892574229`, `1183713526`, `1183713525`, `1113215769` (code `OSM-W-<ID>`) |

## Phạm vi và giới hạn đối chiếu

- Có 11 ảnh tham khảo được đóng gói và gắn với nhóm địa điểm có tên/loại tương ứng. Ảnh cho các nhóm A1–A8, A9–A10, B1–B4, căng tin, ký túc xá và bãi xe là ảnh tham khảo chung, không khẳng định ảnh chụp chính xác từng tòa/con/điểm.
- Các code có tiền tố `OSM-W-` đối chiếu trực tiếp whitelist way IDs trong `backend/src/db/importOsmPlaces.ts`; các code `CAMPUS-*` là địa điểm thủ công trong cùng importer. `A1-MAIN`, `LIB-MAIN`, `CAN-MAIN`, `DOR-A`, `PK-MAIN` là code mẫu từ `backend/sql/init.sql`. Ánh xạ dựa trên code ổn định; không dùng UUID database vì UUID được sinh theo từng môi trường.
- Không có ảnh riêng được ánh xạ cho phòng học như `A1-101`, các cổng hoặc mọi địa điểm khác ngoài danh sách. Các nơi đó dùng trạng thái không ảnh, không lấy ảnh của địa điểm gần tên.
- Đối chiếu dựa trên tên nguồn và nội dung nhìn thấy trong ảnh; ảnh nhóm chỉ là tham khảo, không có tọa độ/EXIF hoặc xác nhận hiện trường chứng minh góc chụp tại từng tòa. Chủ dự án đã xác nhận quyền sử dụng/xuất bản các ảnh trong project.
- Ảnh tĩnh được theo dõi cùng ứng dụng để đường dẫn hoạt động ở deployment không có backend upload. Người quản lý cần cập nhật tệp public và ánh xạ cùng nhau khi thay ảnh.

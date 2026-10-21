# Hướng dẫn sử dụng

## Bản đồ và tra cứu

Mở `http://localhost:5173`. Tìm tên/mã địa điểm bằng ô tìm kiếm, chọn kết quả để xem chi tiết và đưa bản đồ tới vị trí. Bộ lọc danh mục giới hạn địa điểm hiển thị; điều khiển lớp bản đồ cho phép chuyển lớp nền/footprint theo UI. Chức năng định vị tùy quyền trình duyệt và thường cần HTTPS hoặc localhost.

## Chỉ đường

Chọn điểm đích, mở chức năng chỉ đường và cung cấp điểm đi bằng vị trí hiện tại, danh sách hoặc click bản đồ theo điều khiển giao diện. Chỉ hỗ trợ đi bộ. Một số đoạn có thể là kết nối ngoài mạng, được đánh dấu khác kiểu. Nếu không tìm thấy kết nối trong graph, giao diện báo rõ đường thẳng fallback chỉ để tham khảo, không phải tuyến đi bộ đã xác minh. Dữ liệu đường có thể thiếu/cũ nên hãy đối chiếu thực địa.

Nếu không tải được lớp địa điểm/danh mục, giao diện hiển thị lỗi và nút thử lại. Lỗi tìm kiếm và lỗi tải danh sách điểm xuất phát cũng được phân biệt với trạng thái không có kết quả.

## Quản trị

Mở `/#/admin`, đăng nhập bằng API key được cấp. Giao diện hỗ trợ CRUD địa điểm, chỉnh geometry và tải ảnh; thao tác xóa yêu cầu xác nhận. Kiểm tra tên, danh mục, vị trí và footprint trước khi lưu. Không chia sẻ API key trong ảnh/log. Các tính năng cần backend và database đang hoạt động.

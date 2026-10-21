# Hướng dẫn sử dụng

## Bản đồ và tra cứu

Mở `http://localhost:5173`. Tìm tên/mã địa điểm bằng ô tìm kiếm, chọn kết quả để xem chi tiết và đưa bản đồ tới vị trí. Panel chi tiết hiển thị ảnh đã tải lên; nếu không có ảnh tải lên, ứng dụng dùng ảnh tham khảo theo mã địa điểm đã ánh xạ. Ảnh nhóm có thể đại diện cho nhiều tòa/khu vực, không khẳng định ảnh chụp chính xác từng địa điểm. Bộ lọc danh mục giới hạn địa điểm hiển thị; điều khiển lớp bản đồ cho phép chuyển lớp nền/footprint. Ứng dụng không yêu cầu quyền GPS và không xác định vị trí thiết bị.

## Chỉ đường

Chọn điểm đích, mở chức năng chỉ đường rồi chọn điểm đi từ danh sách địa điểm campus có vị trí. Ứng dụng không định vị GPS; click vùng trống trên bản đồ không đặt điểm đi. Chỉ hỗ trợ đi bộ. Một số đoạn có thể là kết nối ngoài mạng, được đánh dấu khác kiểu. Nếu không tìm thấy kết nối trong graph, giao diện báo rõ đường thẳng fallback chỉ để tham khảo, không phải tuyến đi bộ đã xác minh. Dữ liệu đường có thể thiếu/cũ nên hãy đối chiếu thực địa.

Nếu không tải được lớp địa điểm/danh mục, giao diện hiển thị lỗi và nút thử lại. Lỗi tìm kiếm và lỗi tải danh sách điểm xuất phát cũng được phân biệt với trạng thái không có kết quả.

## Quản trị

Mở `/#/admin`, đăng nhập bằng API key được cấp. Giao diện hỗ trợ CRUD địa điểm, chỉnh geometry và tải ảnh; thao tác xóa yêu cầu xác nhận. Kiểm tra tên, danh mục, vị trí và footprint trước khi lưu. Không chia sẻ API key trong ảnh/log. Các tính năng cần backend và database đang hoạt động.

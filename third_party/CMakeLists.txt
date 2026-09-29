# Thư viện bên thứ ba, mỗi thư viện một thư mục third_party/<tên>/ giữ đúng từng byte upstream.
# Thêm thư viện: add_subdirectory(<tên>) nếu nó có CMake, không thì khai target tay ngay trong file
# này. Không gọi vns_quality ở đây, vì /W4 /WX sẽ buộc sửa mã gốc. Nguồn, phiên bản, giấy phép và
# bản vá của từng thư viện ghi ở third_party/NGUON.md (CLAUDE.md mục X.4).

# Preset tidy bật clang-tidy cho mọi target kèm --warnings-as-errors; tắt cho cả cây này.
set(CMAKE_C_CLANG_TIDY "")
set(CMAKE_CXX_CLANG_TIDY "")

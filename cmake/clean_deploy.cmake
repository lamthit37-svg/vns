# Gọi từ target deploy: xoá exe và DLL do lần triển khai trước chép vào. Không đụng cấu hình, dữ
# liệu, log hay nguồn Python. Chỉ quét tầng trên cùng của mỗi thư mục sản phẩm, nên .venv của tool
# Python (sâu hơn một tầng) không bị chạm.
if(NOT DEFINED ROOT)
    message(FATAL_ERROR "clean_deploy.cmake cần -DROOT=<gốc repo>")
endif()

file(GLOB stale LIST_DIRECTORIES false
    "${ROOT}/Client/*.exe" "${ROOT}/Client/*.dll"
    "${ROOT}/Server/bin/*.exe" "${ROOT}/Server/bin/*.dll"
    "${ROOT}/Tools/*/*.exe" "${ROOT}/Tools/*/*.dll")
if(stale)
    file(REMOVE ${stale})
    list(LENGTH stale count)
    message(STATUS "Đã dọn ${count} tệp của lần triển khai trước.")
endif()

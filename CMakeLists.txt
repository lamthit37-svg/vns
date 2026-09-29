# VnS — gốc build. Mỗi module dưới src/<tên>/ có CMakeLists.txt riêng và tự vào build, nên thêm
# module không phải sửa file này. Cờ nền, cổng kiểm và manifest UTF-8 ở cmake/quality.cmake.
cmake_minimum_required(VERSION 3.28)
# C bật sẵn cho thư viện bên thứ ba viết bằng C trong third_party/; mã của VnS là C++23.
project(VnS VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
# Dự án không dùng C++ modules (hiến pháp III.3). Tắt bước quét: nó thêm một lượt cho mọi tệp
# nguồn, và với clang-cl nó in lại /Zc:preprocessor thành "argument unused" (đo ở TLBB).
set(CMAKE_CXX_SCAN_FOR_MODULES OFF)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

# Link tăng dần của MSVC có lúc để exe chạy mã cũ khi chỉ .lib đổi (TLBB đo ngày 2026-09-25: xoá
# .exe và .ilk rồi link lại mới ra kết quả mới). Tắt cho mọi cấu hình. /DEBUG mà thiếu
# /INCREMENTAL:NO thì link.exe tự bật lại link tăng dần, nên luôn thêm cờ này.
if(MSVC)
    foreach(flags IN ITEMS CMAKE_EXE_LINKER_FLAGS_DEBUG CMAKE_SHARED_LINKER_FLAGS_DEBUG
            CMAKE_EXE_LINKER_FLAGS_RELWITHDEBINFO CMAKE_SHARED_LINKER_FLAGS_RELWITHDEBINFO)
        string(REGEX REPLACE "/INCREMENTAL(:[A-Z]+)?" "" value "${${flags}}")
        set(${flags} "${value} /INCREMENTAL:NO")
    endforeach()
endif()

include(cmake/quality.cmake)
include(cmake/deploy.cmake)

# Liên kết giữa các module đi theo tên target, nên thứ tự add_subdirectory không quan trọng.
file(GLOB VNS_MODULE_FILES CONFIGURE_DEPENDS ${CMAKE_SOURCE_DIR}/src/*/CMakeLists.txt)
if(VNS_TOOLCHAIN_PROBE)
    list(APPEND VNS_MODULE_FILES ${CMAKE_SOURCE_DIR}/scripts/ci/probe/CMakeLists.txt)
endif()
if(NOT VNS_MODULE_FILES)
    # Cổng kiểm trả mã 2 khi không có tệp nguồn nào, nên chỉ dựng nó khi đã có module.
    message(STATUS "VnS: src/ chưa có module nào, không có gì để dựng.")
    return()
endif()

vns_style_gate()

# Mã bên thứ ba giữ đúng từng byte upstream: không qua vns_quality, không cổng kiểm, không tidy.
# SYSTEM để header của nó không phát cảnh báo /W4 /WX trong TU của ta; EXCLUDE_FROM_ALL để chỉ dựng
# thư viện nào có target link tới.
if(EXISTS ${CMAKE_SOURCE_DIR}/third_party/CMakeLists.txt)
    add_subdirectory(third_party EXCLUDE_FROM_ALL SYSTEM)
endif()

foreach(module_file IN LISTS VNS_MODULE_FILES)
    get_filename_component(module_dir ${module_file} DIRECTORY)
    add_subdirectory(${module_dir})
endforeach()

# Kiểm thử chính của VnS là danh sách tay ở docs/KIEM-THU.md (CLAUDE.md mục X.7). tests/ chỉ ra
# đời khi một phép thử không làm tay được, và khi đó tự vào build.
if(EXISTS ${CMAKE_SOURCE_DIR}/tests/CMakeLists.txt)
    enable_testing()
    add_subdirectory(tests)
endif()

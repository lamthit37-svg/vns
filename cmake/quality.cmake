# Cờ nền, cảnh báo bổ sung, manifest UTF-8 và cổng kiểm cho mọi target của VnS.
# CI của GitHub không có ~/.claude/bin, nên repo tự mang cổng kiểm (scripts/check_style.js) và bộ
# cờ nền của hiến pháp II.1 thay vì include cmake-quality.cmake của máy. Bản chép lệch bản của máy
# thì configure cảnh báo, để chép lại chứ không để hai bản trôi xa nhau. Dùng trong src/<module>/:
#   add_library(vns_x STATIC x.cpp)
#   vns_quality(vns_x)
include_guard(GLOBAL)

option(VNS_ANALYZE "Thêm /analyze của MSVC cho mọi target (preset analyze)" OFF)
# CI bật để mọi preset dựng scripts/ci/probe, kể cả khi src/ chưa có mã: runner đổi MSVC hay
# clang-cl thì CI đỏ ngay, không đợi tới ngày có mã thật.
option(VNS_TOOLCHAIN_PROBE "Dựng exe thăm dò toolchain scripts/ci/probe" OFF)

# Cổng hình thức so định dạng từng ký tự, mà mỗi bản clang-format định dạng hơi khác nhau. Đây là
# chỗ ghim duy nhất: CI (.github/actions/setup) và hook pre-commit đọc số này, clang-tidy trên CI
# cũng lấy cùng bản. Đổi LLVM thì chỉ sửa dòng này.
set(VNS_CLANG_FORMAT_VERSION 22.1.8)

# Cảnh báo MSVC tắt sẵn, không nằm trong /W4, mà mỗi cái là một lớp bug thật. /WX biến chúng
# thành lỗi. Đo trên 19.51 ngày 2026-09-30: STL không phát cái nào trong số này.
#   4061, 4062 — switch trên enum thiếu enumerator, kể cả khi có default (hiến pháp III.2).
#   4265 — lớp có hàm ảo mà destructor không ảo.
#   5038 — thứ tự khởi tạo member khác thứ tự khai báo.
set(VNS_MSVC_WARNINGS /w44061 /w44062 /w44265 /w45038)

# Manifest đặt code page ANSI của tiến trình thành UTF-8 (Windows 10 1903 trở lên): argv, getenv
# và mọi API bản A nhận byte UTF-8, nên chữ Việt trên dòng lệnh không thành dấu hỏi.
set(VNS_UTF8_MANIFEST ${CMAKE_CURRENT_LIST_DIR}/utf8.manifest)

# Bản chép trong repo phải trùng bản chính thức của máy. Máy không có ~/.claude (CI) thì bỏ qua.
# So nội dung sau khi bỏ CR: .gitattributes giữ LF trong repo, còn bản của máy có thể là CRLF, nên
# so từng byte sẽ báo lệch oan sau mỗi lần checkout (đo 2026-09-30 với .clang-format).
function(vns_check_drift repo_file machine_file)
    if(NOT EXISTS "${machine_file}")
        return()
    endif()
    file(READ "${repo_file}" repo_text)
    file(READ "${machine_file}" machine_text)
    string(REPLACE "\r" "" repo_text "${repo_text}")
    string(REPLACE "\r" "" machine_text "${machine_text}")
    if(NOT repo_text STREQUAL machine_text)
        message(WARNING "VnS: ${repo_file} lệch bản của máy ${machine_file}. Chép lại rồi commit.")
    endif()
endfunction()

set(VNS_MACHINE_BIN "$ENV{USERPROFILE}/.claude/bin")
vns_check_drift(${CMAKE_SOURCE_DIR}/scripts/check_style.js ${VNS_MACHINE_BIN}/check_style.js)
vns_check_drift(${CMAKE_SOURCE_DIR}/.clang-format ${VNS_MACHINE_BIN}/clang-format.template)

# Cổng hình thức (hiến pháp V.5) quét src/ và tests/ nếu có. Mọi target qua vns_quality chờ nó.
function(vns_style_gate)
    find_program(VNS_NODE node REQUIRED)
    find_program(VNS_CLANG_FORMAT clang-format REQUIRED)
    execute_process(COMMAND "${VNS_CLANG_FORMAT}" --version OUTPUT_VARIABLE version_text)
    if(NOT version_text MATCHES "version ${VNS_CLANG_FORMAT_VERSION}")
        message(FATAL_ERROR "VnS: cần clang-format ${VNS_CLANG_FORMAT_VERSION}, "
            "PATH đang cho ${VNS_CLANG_FORMAT}: ${version_text}")
    endif()

    # Cổng trả mã 2 với thư mục không tồn tại, nên chỉ đưa vào thư mục đang có.
    set(dirs "")
    foreach(dir IN ITEMS src tests)
        if(EXISTS ${CMAKE_SOURCE_DIR}/${dir})
            list(APPEND dirs ${CMAKE_SOURCE_DIR}/${dir})
        endif()
    endforeach()
    if(VNS_TOOLCHAIN_PROBE)
        list(APPEND dirs ${CMAKE_SOURCE_DIR}/scripts/ci/probe)
    endif()
    add_custom_target(check_style ALL
        COMMAND "${VNS_NODE}" "${CMAKE_SOURCE_DIR}/scripts/check_style.js" ${dirs}
        COMMENT "Cổng kiểm hình thức (hiến pháp V.5)"
        VERBATIM)
endfunction()

# Exe ASan của MSVC cần clang_rt.asan_dynamic-x86_64.dll, nằm cạnh cl.exe; ngoài môi trường dev.bat
# nó chết ngay với 0xC0000135 (đo 2026-09-30). Chép DLL cạnh exe để chạy được từ VS Code và
# Explorer.
function(vns_copy_asan_runtime target)
    if(NOT CMAKE_CXX_FLAGS_DEBUG MATCHES "fsanitize=address")
        return()
    endif()
    get_filename_component(compiler_dir "${CMAKE_CXX_COMPILER}" DIRECTORY)
    set(runtime "${compiler_dir}/clang_rt.asan_dynamic-x86_64.dll")
    if(NOT EXISTS "${runtime}")
        message(WARNING "VnS: không thấy ${runtime}; exe ASan chỉ chạy được trong dev.bat.")
        return()
    endif()
    add_custom_command(TARGET ${target} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different "${runtime}" "$<TARGET_FILE_DIR:${target}>"
        VERBATIM)
endfunction()

# Cờ nền của hiến pháp II.1, giống hệt grok_cpp_quality của máy, cộng phần riêng của VnS. Macro
# Win32 đặt ở build để nguồn không tự #define: windows.h gọn, không nuốt std::min/max, và tên API
# không hậu tố trỏ về bản W.
function(vns_quality target)
    target_compile_features(${target} PRIVATE cxx_std_23)
    target_compile_options(${target} PRIVATE
        /W4 /WX /permissive- /utf-8 /Zc:__cplusplus /Zc:preprocessor /EHsc)
    target_compile_definitions(${target} PRIVATE WIN32_LEAN_AND_MEAN NOMINMAX UNICODE _UNICODE)
    add_dependencies(${target} check_style)

    get_target_property(kind ${target} TYPE)
    if(kind STREQUAL "EXECUTABLE")
        target_sources(${target} PRIVATE ${VNS_UTF8_MANIFEST})
        vns_copy_asan_runtime(${target})
    endif()

    if(CMAKE_CXX_COMPILER_ID STREQUAL "MSVC")
        target_compile_options(${target} PRIVATE ${VNS_MSVC_WARNINGS})
    else()
        # clang-cl (preset ubsan) bỏ /Zc:preprocessor vì preprocessor của clang vốn theo chuẩn, rồi
        # /WX biến lời nhắc "argument unused" thành lỗi (đo ở TLBB).
        target_compile_options(${target} PRIVATE -Wno-unused-command-line-argument)
    endif()

    if(VNS_ANALYZE AND CMAKE_CXX_COMPILER_ID STREQUAL "MSVC")
        target_compile_options(${target} PRIVATE /analyze /analyze:external-)
    endif()

    # Ninja không biết .clang-tidy là đầu vào: sửa nó xong, TU đã qua tidy không được soát lại và
    # preset tidy xanh trên kết quả cũ (đo 2026-09-30). Gọi vns_quality sau khi khai đủ nguồn.
    if(CMAKE_CXX_CLANG_TIDY)
        get_target_property(sources ${target} SOURCES)
        set_source_files_properties(${sources} PROPERTIES
            OBJECT_DEPENDS ${CMAKE_SOURCE_DIR}/.clang-tidy)
    endif()
endfunction()

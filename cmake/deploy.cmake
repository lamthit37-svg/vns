# Triển khai vào thư mục sản phẩm ở gốc repo (CLAUDE.md mục X.10): Client/ cho người chơi,
# Server/bin/ cho server, Tools/<Tên>/ cho công cụ nội bộ viết bằng C++. Chỉ bản rel của MSVC được
# triển khai, kèm DLL runtime MSVC app-local để exe chạy trên máy sạch chưa cài VC++
# Redistributable.
# Chạy: cmake --workflow --preset deploy
include_guard(GLOBAL)

# Build Debug, ASan, UBSan hay clang-cl không bao giờ tới tay người chơi hay máy chủ.
set(VNS_DEPLOYABLE OFF)
if(CMAKE_BUILD_TYPE STREQUAL "RelWithDebInfo" AND CMAKE_CXX_COMPILER_ID STREQUAL "MSVC")
    set(VNS_DEPLOYABLE ON)
endif()

if(VNS_DEPLOYABLE)
    # Chỉ lấy danh sách DLL (Microsoft.VC145.CRT, đo 2026-09-30), tự cài vào từng thư mục đích.
    set(CMAKE_INSTALL_SYSTEM_RUNTIME_LIBS_SKIP TRUE)
    include(InstallRequiredSystemLibraries)
    if(NOT CMAKE_INSTALL_SYSTEM_RUNTIME_LIBS)
        message(FATAL_ERROR "VnS: không tìm thấy DLL runtime MSVC để triển khai app-local.")
    endif()
    # Dọn exe và DLL của lần trước rồi mới chép, để thư mục sản phẩm chỉ còn đúng bản vừa dựng.
    set(clean_script ${CMAKE_CURRENT_LIST_DIR}/clean_deploy.cmake)
    add_custom_target(deploy
        COMMAND ${CMAKE_COMMAND} -DROOT=${CMAKE_SOURCE_DIR} -P ${clean_script}
        COMMAND ${CMAKE_COMMAND} --install ${CMAKE_BINARY_DIR} --prefix ${CMAKE_SOURCE_DIR}
        COMMENT "Triển khai vào Client/, Server/bin/, Tools/<Tên>/"
        VERBATIM)
endif()

set(VNS_EXE_RC_TEMPLATE ${CMAKE_CURRENT_LIST_DIR}/exe.rc.in)

# vns_exe_resources(<target> <icon> <mô tả>): nhúng assets/icons/<icon>.ico và thông tin phiên bản
# Windows (FileVersion lấy từ project(VERSION), mô tả tiếng Việt) vào exe, để Explorer hiện đúng
# icon và tab Details của Properties hiện tên, phiên bản, bản quyền.
function(vns_exe_resources target icon description)
    set(VNS_RC_ICON ${PROJECT_SOURCE_DIR}/assets/icons/${icon}.ico)
    if(NOT EXISTS ${VNS_RC_ICON})
        message(FATAL_ERROR "vns_exe_resources: không có assets/icons/${icon}.ico")
    endif()
    if(description MATCHES "\"")
        message(FATAL_ERROR "vns_exe_resources: mô tả không được chứa dấu nháy kép")
    endif()
    set(VNS_RC_TARGET ${target})
    set(VNS_RC_DESCRIPTION ${description})
    # configure_file điền biến @...@, file(GENERATE) điền tên tệp thật của target ($<...>).
    set(configured ${CMAKE_CURRENT_BINARY_DIR}/${target}.rc.in)
    set(generated ${CMAKE_CURRENT_BINARY_DIR}/${target}.rc)
    configure_file(${VNS_EXE_RC_TEMPLATE} ${configured} @ONLY)
    file(GENERATE OUTPUT ${generated} INPUT ${configured})
    target_sources(${target} PRIVATE ${generated})
endfunction()

# vns_deploy(<target> <Client | Server | Tools/<Tên>>): exe của target, DLL nó cần và runtime MSVC
# vào thư mục sản phẩm. Đích sai thì dừng ngay ở mọi preset, không đợi tới bản rel.
function(vns_deploy target destination)
    if(destination STREQUAL "Client")
        set(dir Client)
    elseif(destination STREQUAL "Server")
        set(dir Server/bin)
    elseif(destination MATCHES "^Tools/[A-Za-z0-9_]+$")
        set(dir ${destination})
    else()
        message(FATAL_ERROR "vns_deploy: đích '${destination}' "
            "phải là Client, Server, Tools/<Tên>.")
    endif()
    if(NOT VNS_DEPLOYABLE)
        return()
    endif()

    string(REGEX REPLACE "/.*" "" component "${destination}")
    install(TARGETS ${target} RUNTIME DESTINATION ${dir} COMPONENT ${component})
    install(FILES $<TARGET_RUNTIME_DLLS:${target}> DESTINATION ${dir} COMPONENT ${component})
    install(FILES ${CMAKE_INSTALL_SYSTEM_RUNTIME_LIBS} DESTINATION ${dir} COMPONENT ${component})
    add_dependencies(deploy ${target})
endfunction()

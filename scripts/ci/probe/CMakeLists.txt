add_executable(vns_probe main.cpp)
vns_quality(vns_probe)
# Icon và thông tin phiên bản đi qua cùng đường với exe thật: rc.exe ở MSVC, llvm-rc ở clang-cl.
vns_exe_resources(vns_probe 27_Terminal "Thăm dò toolchain VnS")
# CI cài thử bản rel ra thư mục tạm để kiểm luật triển khai (runtime MSVC app-local, không pdb).
vns_deploy(vns_probe Tools/Probe)

// Phép thử toolchain (VNS_TOOLCHAIN_PROBE): một TU đi qua đủ cờ nền, cổng kiểm, clang-tidy,
// /analyze và sanitizer của mọi preset, kể cả khi src/ chưa có mã. Exe trả 0 khi manifest UTF-8
// có hiệu lực, tức code page ANSI của tiến trình là CP_UTF8.
#include <windows.h>

#include <flat_map>
#include <print>
#include <string_view>

int main() {
    const std::flat_map<std::string_view, int> counts{{"một", 1}, {"hai", 2}};
    const unsigned int page = GetACP();
    std::println("vns_probe: ACP={}, flat_map có {} phần tử", page, counts.size());
    return page == CP_UTF8 ? 0 : 1;
}

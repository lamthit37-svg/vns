# VnS

[![CI](https://github.com/lamthit37-svg/vns/actions/workflows/ci.yml/badge.svg)](https://github.com/lamthit37-svg/vns/actions/workflows/ci.yml)
[![CodeQL](https://github.com/lamthit37-svg/vns/actions/workflows/codeql.yml/badge.svg)](https://github.com/lamthit37-svg/vns/actions/workflows/codeql.yml)

Dự án C++23 trên Windows x64, dựng bằng MSVC. Hiện repo mới có hạ tầng: build, cổng kiểm chất
lượng, cấu hình editor, git hook và CI/CD. Mã ứng dụng chưa có.

Quy cách viết mã, lệnh build đầy đủ và lý do của từng lựa chọn nằm ở [CLAUDE.md](CLAUDE.md).

## Cần có

- Windows 10 1903 trở lên (manifest UTF-8 cần bản này).
- Visual Studio 2026 Build Tools, MSVC 19.51 trở lên, kèm component ASan và clang-cl.
- CMake 3.28 trở lên, Ninja.
- LLVM **22.1.8** đúng bản: clang-format, clang-tidy, clangd. Cổng kiểm định dạng so từng ký tự,
  nên configure dừng nếu PATH cho bản khác.
- Node.js (cổng kiểm hình thức và git hook).
- vcpkg: bản đi kèm Visual Studio, `VCPKG_ROOT` do môi trường developer của VS đặt.

## Bắt đầu

```
git clone https://github.com/lamthit37-svg/vns.git
cd vns
git config core.hooksPath .githooks
```

Trong Developer Command Prompt của VS 2026, với LLVM 22.1.8 đứng trước trên PATH (máy dev dùng
`%USERPROFILE%\.claude\bin\dev.bat` để làm cả hai việc):

```
cmake --workflow --preset dev
```

## Preset

- `dev` — Debug, bản thường ngày.
- `rel` — RelWithDebInfo, `/O2 /Ob2`, `/OPT:REF /OPT:ICF`.
- `asan` — Debug cộng AddressSanitizer.
- `ubsan` — clang-cl cộng UndefinedBehaviorSanitizer.
- `tidy` — clang-tidy trên mọi tệp nguồn, cảnh báo là lỗi.
- `analyze` — `/analyze` của MSVC.

Mỗi preset chạy bằng `cmake --workflow --preset <tên>`, ra `build/<tên>/bin`.

## Cổng chất lượng

- Cờ MSVC `/W4 /WX /permissive- /utf-8 /Zc:__cplusplus /Zc:preprocessor /EHsc`, cộng bốn cảnh báo
  bổ sung.
- Cổng kiểm hình thức `tools/check_style.js` chạy trước mọi lần biên dịch: clang-format, tối đa một
  cấp lồng, không bậc thang, không `new` và `delete` trần.
- clang-tidy, `/analyze`, ASan, UBSan theo preset.
- Hook pre-commit chặn commit có tệp C/C++ sai định dạng.

## Cấu trúc

- `src/<module>/` — mã của VnS, header cạnh nguồn, mỗi module tự vào build.
- `third_party/` — mã bên thứ ba giữ nguyên byte upstream.
- `docs/KIEM-THU.md` — danh sách kiểm thử tay, đánh dấu khi đạt.
- `cmake/`, `tools/`, `.github/`, `.vscode/` — hạ tầng.

## Kiểm thử

Kiểm thử chính là danh sách tay trong [docs/KIEM-THU.md](docs/KIEM-THU.md): mỗi mục là một lệnh
chạy thật cộng kết quả mong đợi, đánh dấu `[x]` khi đạt. Test tự động chỉ thêm khi một phép thử
không làm tay được.

## CI/CD

- **CI**: mỗi push và pull request dựng sáu preset trên `windows-2025-vs2026`, và kiểm các tệp
  workflow bằng actionlint.
- **CodeQL**: quét bảo mật C/C++ khi đã có mã.
- **Release**: đẩy tag `vX.Y.Z` khớp `project(VnS VERSION X.Y.Z)` thì tạo GitHub Release, gồm zip
  exe, zip pdb, `SHA256SUMS.txt` và chứng thực nguồn gốc build.

## Giấy phép

Độc quyền, bảo lưu mọi quyền. Xem [LICENSE](LICENSE).

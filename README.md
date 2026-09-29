# VnS

[![CI](https://github.com/lamthit37-svg/vns/actions/workflows/ci.yml/badge.svg)](https://github.com/lamthit37-svg/vns/actions/workflows/ci.yml)
[![CodeQL](https://github.com/lamthit37-svg/vns/actions/workflows/codeql.yml/badge.svg)](https://github.com/lamthit37-svg/vns/actions/workflows/codeql.yml)

Game gồm client cho người chơi, server và công cụ quản trị nội bộ. C++23 trên Windows x64, dựng bằng
MSVC; công cụ quản trị viết bằng Python và PyQt6. Hiện repo mới có hạ tầng: build, triển khai, cổng
kiểm chất lượng, cấu hình editor, git hook và CI/CD. Mã ứng dụng chưa có.

Quy cách viết mã, lệnh build đầy đủ và lý do của từng lựa chọn nằm ở [CLAUDE.md](CLAUDE.md).

## Cần có

- Windows 10 1903 trở lên (manifest UTF-8 cần bản này).
- Visual Studio 2026 Build Tools, MSVC 19.51 trở lên, kèm component ASan và clang-cl.
- CMake 3.28 trở lên, Ninja.
- LLVM **22.1.8** đúng bản: clang-format, clang-tidy, clangd. Cổng kiểm định dạng so từng ký tự,
  nên configure dừng nếu PATH cho bản khác.
- Node.js (cổng kiểm hình thức và git hook).
- Python 3.13 (`py`) cho công cụ trong `Tools/`.
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

Môi trường của công cụ ADMIN, chạy trong `Tools/ADMIN`:

```
py -3.13 -m venv .venv
.venv\Scripts\python -m pip install --group dev
```

## Preset

- `dev` — Debug, bản thường ngày.
- `rel` — RelWithDebInfo, `/O2 /Ob2`, `/OPT:REF /OPT:ICF`.
- `deploy` — dựng `rel` rồi triển khai vào `Client/`, `Server/`, `Tools/`.
- `asan` — Debug cộng AddressSanitizer.
- `ubsan` — clang-cl cộng UndefinedBehaviorSanitizer.
- `tidy` — clang-tidy trên mọi tệp nguồn, cảnh báo là lỗi.
- `analyze` — `/analyze` của MSVC.

Mỗi preset chạy bằng `cmake --workflow --preset <tên>`; bản dựng ra `build/<tên>/bin`.

## Cấu trúc

- `src/<module>/` — mã C++ của mọi exe, header cạnh nguồn, mỗi module tự vào build.
- `Client/` — bản dành cho người chơi, đúng thứ được phát hành. Chạy thử như người chơi từ đây.
- `Server/` — exe server trong `bin/`, cấu hình TOML trong `config/`; `data/` và `logs/` sinh lúc
  chạy.
- `Tools/<Tên>/` — công cụ nội bộ, mỗi tool một thư mục. `Tools/ADMIN` là GUI quản trị server
  (PyQt6, style Fusion).
- `assets/icons/` — bộ icon của VnS, nhúng vào exe và dùng trong công cụ.
- `third_party/` — mã bên thứ ba giữ nguyên byte upstream.
- `docs/KIEM-THU.md` — danh sách kiểm thử tay, đánh dấu khi đạt.
- `cmake/`, `scripts/`, `.github/`, `.vscode/` — hạ tầng.

## Cổng chất lượng

- Cờ MSVC `/W4 /WX /permissive- /utf-8 /Zc:__cplusplus /Zc:preprocessor /EHsc`, cộng bốn cảnh báo
  bổ sung.
- Cổng kiểm hình thức `scripts/check_style.js` chạy trước mọi lần biên dịch: clang-format, tối đa
  một cấp lồng, không bậc thang, không `new` và `delete` trần.
- clang-tidy, `/analyze`, ASan, UBSan theo preset; ruff và mypy strict cho Python.
- Hook pre-commit chặn commit có tệp C/C++ hay Python sai quy cách.

## Kiểm thử

Kiểm thử chính là danh sách tay trong [docs/KIEM-THU.md](docs/KIEM-THU.md): mỗi mục là một lệnh
chạy thật cộng kết quả mong đợi, đánh dấu `[x]` khi đạt. Test tự động chỉ thêm khi một phép thử
không làm tay được.

## CI/CD

- **CI**: mỗi push và pull request dựng sáu preset trên `windows-2025-vs2026`, cài thử kiểu
  deploy, soát công cụ Python, và kiểm các tệp workflow bằng actionlint.
- **CodeQL**: quét bảo mật C/C++ khi đã có mã.
- **Release**: đẩy tag `vX.Y.Z` khớp `project(VnS VERSION X.Y.Z)` thì tạo GitHub Release gồm zip
  `Client/`, zip `Server/`, zip pdb, `SHA256SUMS.txt` và chứng thực nguồn gốc build.

## Giấy phép

Độc quyền, bảo lưu mọi quyền. Xem [LICENSE](LICENSE).

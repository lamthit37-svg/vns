# VnS — mục X của hiến pháp cho dự án này

Mục 0 đến IX nằm ở `%USERPROFILE%\.claude\CLAUDE.md`, áp nguyên văn và thắng file này khi mâu
thuẫn. File này chỉ giữ phần riêng của VnS, và mỗi luật riêng được nói đúng một lần ở đây.

## X.1 Danh tính

- Tên: VnS. C++23, Windows x64, MSVC. Namespace gốc `vns`, mọi target mang tiền tố `vns_`.
- Thư mục gốc: `%USERPROFILE%\Desktop\VnS`. Remote: `github.com/lamthit37-svg/vns` (public), nhánh
  `main`. Commit đứng tên `lamthit37@gmail.com`, đặt riêng cho repo này.
- Trạng thái ngày 2026-09-30: đã có hạ tầng build, editor, git hook và CI/CD; `src/` chưa có mã.
  Người dùng dặn dựng công cụ trước, viết mã sau.
- Tài liệu tham chiếu: `BITCRAFT-TINH-NANG.md` ở gốc, chỉ có trên máy dev (đã `.gitignore`). Đó là
  danh mục tính năng server BitCraft rút từ `%USERPROFILE%\Desktop\BitCraftPublic` (Rust,
  SpacetimeDB, commit `9983494`). Mã gốc theo Apache 2.0; art, nội dung game và IP của BitCraft
  không được dùng, và không được vận hành server BitCraft cạnh tranh (đặc tả mục 1.1).
- Giấy phép của VnS: độc quyền, xem `LICENSE`.
- Hồ sơ tối ưu theo `cpp23-standard` mục 0.1: `app`. Ngân sách kích thước: không có.

## X.2 Bố cục

- `src/<module>/` — mã của VnS, header cạnh nguồn (IV). Mỗi module có `CMakeLists.txt` riêng và
  tự vào build qua glob, nên thêm module không phải sửa `CMakeLists.txt` gốc.
- `third_party/<tên>/` — mã bên thứ ba giữ đúng từng byte upstream (X.4).
- `tests/` — chỉ ra đời khi một phép thử không làm tay được (X.7).
- `docs/` — `KIEM-THU.md` (X.7), `NGHI-NGO.md` (X.6), đặc tả định dạng nhị phân nếu có.
- `cmake/` — `quality.cmake` (cờ nền, cổng kiểm, sanitizer) và `utf8.manifest`.
- `tools/` — `check_style.js` (bản chép của cổng máy), `hooks/`, `ci/probe/`.
- `.github/` — CI/CD (X.9). `.vscode/` — tác vụ, gỡ lỗi, clangd.

Include gốc là `src/`: cùng module thì `#include "socket.hpp"`, khác module thì
`#include "net/socket.hpp"`, để phụ thuộc giữa module đọc được ngay trong nguồn. Module phụ thuộc
nhau theo một đồ thị không vòng; tầng dưới không include tầng trên.

Khuôn `src/<module>/CMakeLists.txt`:

```cmake
add_library(vns_net STATIC socket.cpp)
target_include_directories(vns_net PUBLIC ${PROJECT_SOURCE_DIR}/src)
target_link_libraries(vns_net PUBLIC vns_core)
vns_quality(vns_net)
```

Gọi `vns_quality` sau khi đã khai đủ nguồn. Nó gắn cờ nền của II.1 cộng `/WX`, bốn cảnh báo bổ
sung, macro Win32, cổng kiểm; với exe thì gắn thêm manifest UTF-8 và, ở preset `asan`, chép DLL
runtime cạnh exe.

## X.3 Build, cổng kiểm và công cụ

Mọi lệnh đi qua `dev.bat` (II). Mỗi preset có workflow configure cộng build:

```
cmd /c "call %USERPROFILE%\.claude\bin\dev.bat && cmake --workflow --preset dev"
```

- `dev` — Debug, MSVC. Là preset thường ngày và là nguồn `compile_commands.json` cho clangd.
- `rel` — RelWithDebInfo với `/O2 /Ob2` (CMake mặc định chỉ `/Ob1`) và `/OPT:REF /OPT:ICF`.
- `asan` — Debug cộng `/fsanitize=address`, bỏ `/RTC1`.
- `ubsan` — clang-cl cộng `-fsanitize=undefined` (X.5).
- `tidy` — Debug cộng clang-tidy trên mọi TU, `--warnings-as-errors=*`.
- `analyze` — Debug cộng `/analyze /analyze:external-`.

Chạy exe: `.\build\<preset>\bin\<tên>.exe`. Mọi exe đi qua `vns_quality` mang manifest đặt code page
ANSI của tiến trình thành UTF-8, nên argv và API bản A nhận chữ Việt nguyên dấu.

Kiểm toolchain khi chưa có mã: thêm `-DVNS_TOOLCHAIN_PROBE=ON` vào bước configure để dựng
`tools/ci/probe`, rồi chạy `vns_probe.exe`: nó trả 0 khi manifest có hiệu lực. Giá trị này nằm lại
trong cache, nên xong thì configure lại với `=OFF`.

Những điểm VnS lệch khỏi mặc định của máy, kèm lý do:

- **Cổng kiểm chép vào repo** (`tools/check_style.js`) thay vì gọi `~/.claude/bin`, và cờ nền nằm
  trong `cmake/quality.cmake` thay vì include `cmake-quality.cmake` của máy: runner của GitHub không
  có `~/.claude`. Bản chép lệch bản của máy thì configure in `WARNING`; khi đó chép lại rồi commit.
- **clang-format ghim đúng một bản**, `VNS_CLANG_FORMAT_VERSION` trong `cmake/quality.cmake` (hiện
  là 22.1.8). Configure dừng nếu PATH cho bản khác. CI và hook pre-commit đọc cùng số này. Đổi
  LLVM thì chỉ sửa một dòng đó.
- **Bốn cảnh báo MSVC bổ sung** `/w44061 /w44062 /w44265 /w45038`: `switch` thiếu enumerator (kể
  cả khi có `default`), destructor không ảo, thứ tự khởi tạo member. Đã đo: STL không phát cái nào,
  và mỗi cái bắt đúng lỗi mẫu.
- **`.clang-tidy` khác bản template ở ba chỗ, và có thêm luật đặt tên.** Bản gốc báo lỗi trên mã
  viết đúng hiến pháp: guard clause một dòng (V.2), tên ngắn `n` (IV.1), kiểu nền `enum`. VnS cho
  phép guard một dòng nhưng bắt ngoặc cho thân từ hai dòng, cho phép `i j k n it ok id io`, tắt
  `performance-enum-size`, và thêm `readability-identifier-naming` để máy thi hành IV.1. Tắt một
  check tại chỗ thì phải nêu tên check và lý do: `// NOLINT(tên-check): lý do`.

Editor: VS Code với clangd (`.clangd`, IntelliSense, clang-tidy khi gõ, format khi lưu) và cpptools
chỉ để gỡ lỗi (`cppvsdbg`). clangd đọc `build/dev/compile_commands.json`, nên cần build `dev` một
lần. Không cài CMake Tools: nó configure khi mở thư mục mà không qua `dev.bat`, để lại cache hỏng
cho `build/dev` (II.3). `Ctrl+Shift+B` là `VnS: build dev`; các preset khác nằm trong
`.vscode/tasks.json`.

Git: `.gitattributes` giữ LF (trừ `.bat .cmd .ps1`, và `third_party/` giữ nguyên byte). Hook
pre-commit chạy cổng kiểm trên file C/C++ đã stage dưới `src/`, `tests/`, `tools/ci/probe/`. Bật
một lần sau mỗi lần clone: `git config core.hooksPath .githooks`.

## X.4 Thư viện ngoài

- **vcpkg manifest** là đường mặc định: `vcpkg.json` ở gốc, `builtin-baseline` ghim cùng commit
  với TLBB (đã chạy thật trên máy này). Mọi preset nạp toolchain vcpkg; thêm gói theo skill
  `cpp-deps`. Preset `ubsan` dùng triplet `x64-windows-static`, vì runtime UBSan của clang-cl chỉ
  link với CRT tĩnh `/MT`.
- **`third_party/`** chỉ dùng khi vcpkg không có thư viện, hoặc cần đúng một bản upstream hay bản
  vá riêng. Chép nguyên byte upstream vào `third_party/<tên>/`, thêm một dòng vào
  `third_party/CMakeLists.txt`, và ghi vào `third_party/NGUON.md` (tạo khi có thư viện đầu tiên):
  tên, phiên bản hoặc commit, URL, giấy phép, bản vá. Không sửa mã upstream tại chỗ; cần vá thì để
  tệp `.patch` cạnh nó và ghi vào `NGUON.md`. Cây này không qua `vns_quality`, cổng kiểm, clang-tidy
  hay clangd, và được add với `SYSTEM` nên header của nó không phát cảnh báo trong TU của VnS.
- VnS là mã độc quyền: chỉ nhận giấy phép dễ dãi (MIT, BSD, Apache 2.0, zlib, Boost). GPL, LGPL,
  AGPL hay giấy phép chưa rõ thì hỏi người dùng trước khi thêm.

## X.5 ASan và UBSan

- ASan: preset `asan`. Exe cần `clang_rt.asan_dynamic-x86_64.dll` (kể cả bản Debug); `vns_quality`
  chép nó cạnh exe, nên exe chạy được từ VS Code và Explorer, không chỉ trong `dev.bat`.
- UBSan: preset `ubsan` dùng clang-cl, RelWithDebInfo, `/Od -fsanitize=undefined`, CRT tĩnh
  `MultiThreaded` (TOOLCHAIN.md: Debug với `/MDd` hay `/MD` thì link đỏ `failifmismatch`). Không
  `/DNDEBUG`, nên `assert` vẫn chạy.
- Đã đo ngày 2026-09-30 trên mã cấy lỗi: ASan bắt `heap-buffer-overflow`, UBSan bắt
  `signed integer overflow`, cả hai kèm đúng `file:line`.

## X.6 Sổ nghi ngờ

`docs/NGHI-NGO.md` — tạo khi có TODO đầu tiên, không tạo rỗng sẵn.

## X.7 Kiểm thử — danh sách tay

Quyết định của người dùng ngày 2026-09-30: kiểm thử chính của VnS là **chạy thật theo danh sách
gạch đầu dòng và đánh dấu khi đạt**, ưu tiên hơn file test logic. Nguồn sự thật là
`docs/KIEM-THU.md`. Đây là cách VnS thực hiện VII.6 và IX.4:

1. Viết mục mới, chưa đánh dấu, **trước** khi viết mã. Chạy lệnh của mục trên bản build hiện tại
   và ghi `TRƯỢT <ngày>: <triệu chứng>` — đó là "đỏ trước".
2. Viết mã, build, chạy lại đúng lệnh đó. Đạt thì đổi thành `[x]`, thay dòng TRƯỢT bằng
   `đạt <ngày> (<preset>)` — đó là "xanh sau".
3. Sửa mã đụng tới vùng của một mục đã đạt thì chạy lại mục đó. Trượt thì bỏ dấu và ghi TRƯỢT;
   không để dấu `[x]` cũ nói dối.

Mỗi mục có mã `K-NNN` để grep và để trỏ từ commit hay PR, một lệnh chạy được nguyên văn, và một kết
quả mong đợi quan sát được từ bên ngoài (output, mã thoát, tệp sinh ra). "Chạy ổn" không phải kết
quả mong đợi.

Test tự động (`tests/`, ctest) chỉ khi phép thử cần hàng trăm ca (bảng công thức, biên số học),
cần đo thời gian hay đồng thời, hoặc không quan sát được từ ngoài exe. Khi thêm, ghi lý do vào mục
`KIEM-THU` tương ứng. `tests/CMakeLists.txt` có mặt thì build và CI tự chạy nó.

## X.8 Quy cách mã riêng của VnS

Chỉ những chỗ hiến pháp để ngỏ cho dự án chốt:

- **Member:** private và protected mang hậu tố `_` (đây là "dự án đã dùng" của IV.1), để accessor
  được đặt bằng danh từ: `count()` trả `count_`. Struct dữ liệu thuần có member public, không hậu
  tố. clang-tidy thi hành.
- **Lỗi:** mọi lỗi dự kiến tại biên (input người chơi, mạng, tệp, dữ liệu tĩnh) trả
  `std::expected<T, Error>` với `[[nodiscard]]`. Exception chỉ cho vi phạm bất biến và hết tài
  nguyên. `main` và thân mọi thread có một chốt `catch` ở lớp ngoài cùng (`cpp23-standard` S5).
  Thông điệp lỗi tiếng Việt, ngắn đủ để guard nằm một dòng (V.3).
- **Thay đổi trạng thái:** kiểm hết điều kiện trước, ghi sau. Trả lỗi thì trạng thái giữ nguyên
  như trước lời gọi, không nửa vời. Cùng mô hình với reducer của đặc tả: `Err` là rollback.
- **Số:** dữ liệu lưu trữ hay đi trên dây dùng kiểu cố định độ rộng (`std::int64_t`,
  `std::uint32_t`); kích thước và chỉ số dùng `std::size_t`. Phép tính nhận số từ bên ngoài phải
  kiểm tràn trước khi tính (S1, S6). Không dùng số thực cho tiền tệ hay số lượng vật phẩm.
- **Thời gian:** `std::chrono`, không số nguyên mang đơn vị trong comment.
- **Chuỗi và Win32:** bên trong là UTF-8 `std::string`; ranh giới Win32 dùng bản `W`.
  `WIN32_LEAN_AND_MEAN`, `NOMINMAX`, `UNICODE` do build đặt, nguồn không tự `#define`.
  `<windows.h>` chỉ nằm trong `.cpp`, không lọt vào header.
- **Port từ đặc tả:** giữ nguyên hằng số, công thức và thứ tự phép tính (VII.10). Comment trỏ mục
  đặc tả để grep được: `// Đặc tả 2.6 extract: ...`. Chỗ đặc tả ghi là nghi lỗi (phụ lục A, mục
  10) thì không chép lỗi theo; ghi quyết định vào `docs/NGHI-NGO.md`.

## X.9 CI/CD

- `.github/workflows/ci.yml` — mỗi push lên `main` và mỗi PR: actionlint cho workflow, rồi sáu
  preset trên `windows-2025-vs2026` (VS 2026 bản 18.10), mỗi preset kèm `VNS_TOOLCHAIN_PROBE=ON` và
  chạy `vns_probe.exe`. Toolset MSVC của runner có thể mới hơn 19.51 của máy dev; bước setup in bản
  `cl` ra log. `rel` lưu exe và pdb thành artifact 14 ngày khi `src/` đã có module.
- `.github/actions/setup` — bản CI của `dev.bat`: vcvars64, `CC=cl`, clang-format và clang-tidy từ
  PyPI đúng bản ghim, `VCPKG_ROOT`.
- `.github/workflows/codeql.yml` — CodeQL c-cpp, bộ `security-and-quality`, cho push, PR và mỗi
  thứ Hai. Tự bỏ qua khi `src/` chưa có tệp `.cpp`.
- `.github/workflows/release.yml` — CD. Phát hành: sửa `project(VnS VERSION X.Y.Z)`, commit, rồi
  `git tag vX.Y.Z` và `git push origin vX.Y.Z`. Workflow kiểm tag khớp phiên bản, dựng `rel`, đóng
  gói zip exe và zip pdb, `SHA256SUMS.txt`, chứng thực provenance, và tạo GitHub Release.
- `.github/dependabot.yml` — cập nhật SHA ghim của các action mỗi tuần. Mọi action ghim theo SHA
  commit, có tag ở comment cạnh đó.

# VnS — mục X của hiến pháp cho dự án này

Mục 0 đến IX nằm ở `%USERPROFILE%\.claude\CLAUDE.md`, áp nguyên văn và thắng file này khi mâu
thuẫn. File này chỉ giữ phần riêng của VnS, và mỗi luật riêng được nói đúng một lần ở đây.

## X.1 Danh tính

- Tên: VnS. Game gồm client cho người chơi, server và công cụ nội bộ; C++23, Windows x64, MSVC.
  Namespace gốc `vns`, mọi target mang tiền tố `vns_`.
- Thư mục gốc: `%USERPROFILE%\Desktop\VnS`. Remote: `github.com/lamthit37-svg/vns` (public), nhánh
  `main`. Commit đứng tên `lamthit37@gmail.com`, đặt riêng cho repo này.
- Trạng thái ngày 2026-09-30: đã có hạ tầng build, triển khai, editor, git hook và CI/CD; `src/`
  chưa có mã. Người dùng dặn dựng công cụ trước, viết mã sau.
- Tài liệu tham chiếu: `BITCRAFT-TINH-NANG.md` ở gốc, chỉ có trên máy dev (đã `.gitignore`). Đó là
  danh mục tính năng server BitCraft rút từ `%USERPROFILE%\Desktop\BitCraftPublic` (Rust,
  SpacetimeDB, commit `9983494`). Mã gốc theo Apache 2.0; art, nội dung game và IP của BitCraft
  không được dùng, và không được vận hành server BitCraft cạnh tranh (đặc tả mục 1.1).
- Giấy phép của VnS: độc quyền, xem `LICENSE`.
- Hồ sơ tối ưu theo `cpp23-standard` mục 0.1: `app`. Ngân sách kích thước: không có.

## X.2 Bố cục

- `src/<module>/` — mã C++ của mọi exe (client, server, tool C++), header cạnh nguồn (IV). Mỗi
  module có `CMakeLists.txt` riêng và tự vào build qua glob.
- `Client/`, `Server/`, `Tools/` — thư mục sản phẩm, hình hài của bản phát hành (X.10).
- `assets/icons/` — bộ 27 icon của VnS, mỗi icon một `.ico` (16 đến 256 px) và một `.png` gốc, nền
  trong suốt; `README.txt` của bộ ghi công dụng. Là nguồn duy nhất: exe C++ nhúng `.ico` qua
  `vns_exe_resources`, tool Python đọc `.png` hay `.ico` từ đây. Không chép icon rải vào nơi khác.
- `third_party/<tên>/` — mã bên thứ ba giữ đúng từng byte upstream (X.4).
- `tests/` — chỉ ra đời khi một phép thử không làm tay được (X.7).
- `docs/` — `KIEM-THU.md` (X.7), `NGHI-NGO.md` (X.6), đặc tả định dạng nhị phân nếu có.
- `cmake/` — `quality.cmake` (cờ nền, cổng kiểm, sanitizer), `deploy.cmake` và
  `clean_deploy.cmake` (X.10), `utf8.manifest`.
- `scripts/` — hạ tầng build, không phải công cụ game: `check_style.js` (bản chép của cổng máy),
  `hooks/`, `ci/probe/`. Không đặt tên `tools/`: Windows không phân biệt hoa thường, nên nó trùng
  với `Tools/`.
- `.github/` — CI/CD (X.9). `.vscode/` — tác vụ, gỡ lỗi, clangd, Python.

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

Mọi exe thêm `vns_exe_resources(<target> <icon> "<mô tả tiếng Việt>")`: nhúng
`assets/icons/<icon>.ico` và thông tin phiên bản Windows (FileVersion lấy từ `project(VERSION)`,
mô tả, bản quyền), từ mẫu `cmake/exe.rc.in`. Icon theo công dụng ghi trong
`assets/icons/README.txt`: `02_Game_VN` cho exe client, `01_Title_S_Rainbow` cho icon cửa sổ,
`05_Server` đến `18_File_Server` cho tiến trình server theo đúng vai, `19_Tools` và các icon còn lại
cho tool. Exe đi tới tay người dùng thì thêm `vns_deploy(<target> Client | Server | Tools/<Tên>)`.
Khuôn exe client: `WIN32` để người chơi không thấy cửa sổ console (điểm vào là `wWinMain`), và
`OUTPUT_NAME` để tên tệp trong `Client/` là tên sản phẩm, không phải tên target:

```cmake
add_executable(vns_client WIN32 main.cpp)
set_target_properties(vns_client PROPERTIES OUTPUT_NAME VnS)
target_link_libraries(vns_client PRIVATE vns_core)
vns_quality(vns_client)
vns_exe_resources(vns_client 02_Game_VN "VnS")
vns_deploy(vns_client Client)
```

Gọi `vns_quality` sau khi đã khai đủ nguồn. Nó gắn cờ nền của II.1 cộng `/WX`, bốn
cảnh báo bổ sung, macro Win32, cổng kiểm; với exe thì gắn thêm manifest UTF-8 và, ở preset `asan`,
chép DLL runtime ASan cạnh exe.

## X.3 Build, cổng kiểm và công cụ

Mọi lệnh đi qua `dev.bat` (II). Mỗi preset có workflow configure cộng build:

```
cmd /c "call %USERPROFILE%\.claude\bin\dev.bat && cmake --workflow --preset dev"
```

- `dev` — Debug, MSVC. Là preset thường ngày và là nguồn `compile_commands.json` cho clangd.
- `rel` — RelWithDebInfo với `/O2 /Ob2` (CMake mặc định chỉ `/Ob1`) và `/OPT:REF /OPT:ICF`.
- `deploy` — dựng `rel` rồi triển khai vào `Client/`, `Server/`, `Tools/<Tên>/` (X.10).
- `asan` — Debug cộng `/fsanitize=address`, bỏ `/RTC1`.
- `ubsan` — clang-cl cộng `-fsanitize=undefined` (X.5).
- `tidy` — Debug cộng clang-tidy trên mọi TU, `--warnings-as-errors=*`.
- `analyze` — Debug cộng `/analyze /analyze:external-`.

Chạy exe khi đang phát triển: `.\build\<preset>\bin\<tên>.exe`. Chạy như người chơi: từ `Client/`
sau `deploy` (X.10). Mọi exe qua `vns_quality` mang manifest đặt code page ANSI của tiến trình
thành UTF-8, nên argv và API bản A nhận chữ Việt nguyên dấu.

Kiểm toolchain khi chưa có mã: thêm `-DVNS_TOOLCHAIN_PROBE=ON` vào bước configure để dựng
`scripts/ci/probe`, rồi chạy `vns_probe.exe`: nó trả 0 khi manifest có hiệu lực. Giá trị này nằm
lại trong cache, nên xong thì configure lại với `=OFF`.

Những điểm VnS lệch khỏi mặc định của máy, kèm lý do:

- **Cổng kiểm chép vào repo** (`scripts/check_style.js`) thay vì gọi `~/.claude/bin`, và cờ nền nằm
  trong `cmake/quality.cmake` thay vì include `cmake-quality.cmake` của máy: runner của GitHub không
  có `~/.claude`. Bản chép lệch bản của máy (so sau khi bỏ CR) thì configure in `WARNING`; khi đó
  chép lại rồi commit.
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

Editor: VS Code với clangd (`.clangd`, IntelliSense, clang-tidy khi gõ, format khi lưu), cpptools
chỉ để gỡ lỗi (`cppvsdbg`), và Python, ruff, mypy cho `Tools/`. clangd đọc
`build/dev/compile_commands.json`, nên cần build `dev` một lần. Không cài CMake Tools: nó configure
khi mở thư mục mà không qua `dev.bat`, để lại cache hỏng cho `build/dev` (II.3). `Ctrl+Shift+B` là
`VnS: build dev`; các preset khác, triển khai, chơi thử từ `Client/` và soát ADMIN nằm trong
`.vscode/tasks.json`.

Git: `.gitattributes` giữ LF (trừ `.bat .cmd .ps1`, `Client/*.txt` và `Server/*.txt` là CRLF cho
Notepad, còn `third_party/` giữ nguyên byte). Hook pre-commit chạy cổng kiểm trên tệp C/C++ đã stage
dưới `src/`, `tests/`, `scripts/ci/probe/`, và ruff trên tệp `.py` đã stage dưới `Tools/<Tên>/`. Bật
một lần sau mỗi lần clone: `git config core.hooksPath .githooks`.

## X.4 Thư viện ngoài

- **vcpkg manifest** là đường mặc định: `vcpkg.json` ở gốc, `builtin-baseline` ghim cùng commit
  với TLBB (đã chạy thật trên máy này). Mọi preset nạp toolchain vcpkg; thêm gói theo skill
  `cpp-deps`. DLL của gói vcpkg tự đi theo exe khi triển khai (`vns_deploy`). Preset `ubsan` dùng
  triplet `x64-windows-static`, vì runtime UBSan của clang-cl chỉ link với CRT tĩnh `/MT`.
- **`third_party/`** chỉ dùng khi vcpkg không có thư viện, hoặc cần đúng một bản upstream hay bản
  vá riêng. Chép nguyên byte upstream vào `third_party/<tên>/`, thêm một dòng vào
  `third_party/CMakeLists.txt`, và ghi vào `third_party/NGUON.md` (tạo khi có thư viện đầu tiên):
  tên, phiên bản hoặc commit, URL, giấy phép, bản vá. Không sửa mã upstream tại chỗ; cần vá thì để
  tệp `.patch` cạnh nó và ghi vào `NGUON.md`. Cây này không qua `vns_quality`, cổng kiểm, clang-tidy
  hay clangd, và được add với `SYSTEM` nên header của nó không phát cảnh báo trong TU của VnS.
- VnS là mã độc quyền: chỉ nhận giấy phép dễ dãi (MIT, BSD, Apache 2.0, zlib, Boost). GPL, LGPL,
  AGPL hay giấy phép chưa rõ thì hỏi người dùng trước khi thêm. Gói Python của `Tools/` theo cùng
  luật (PyQt6 là GPL hoặc thương mại, xem X.10).

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
quả mong đợi. Mục của client chạy exe từ `Client/` sau `deploy`, như người chơi; mục của server
chạy từ `Server/bin/`; mục của ADMIN chạy trên server thật trong `Server/`.

Test tự động (`tests/`, ctest) chỉ khi phép thử cần hàng trăm ca (bảng công thức, biên số học),
cần đo thời gian hay đồng thời, hoặc không quan sát được từ ngoài exe. Khi thêm, ghi lý do vào mục
`KIEM-THU` tương ứng. `tests/CMakeLists.txt` có mặt thì build và CI tự chạy nó.

## X.8 Quy cách mã riêng của VnS

Chỉ những chỗ hiến pháp để ngỏ cho dự án chốt:

- **Member:** private và protected mang hậu tố `_` (đây là "dự án đã dùng" của IV.1), để accessor
  được đặt bằng danh từ: `count()` trả `count_`. Struct dữ liệu thuần có member public, không hậu
  tố. clang-tidy thi hành.
- **Lỗi:** mọi lỗi dự kiến tại biên (input người chơi, mạng, tệp, cấu hình, dữ liệu tĩnh) trả
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
- **Đường dẫn:** exe tìm tài nguyên, cấu hình và dữ liệu của nó theo thư mục chứa exe
  (`GetModuleFileNameW`), không bao giờ theo thư mục hiện hành. Đường dẫn là `std::filesystem::path`.
- **Port từ đặc tả:** giữ nguyên hằng số, công thức và thứ tự phép tính (VII.10). Comment trỏ mục
  đặc tả để grep được: `// Đặc tả 2.6 extract: ...`. Chỗ đặc tả ghi là nghi lỗi (phụ lục A, mục
  10) thì không chép lỗi theo; ghi quyết định vào `docs/NGHI-NGO.md`.

## X.9 CI/CD

- `.github/workflows/ci.yml` — mỗi push lên `main` và mỗi PR:
  - actionlint cho các tệp workflow;
  - `Tools Python`: với mỗi `Tools/<Tên>/pyproject.toml`, dựng `.venv` từ bản ghim, rồi ruff và
    mypy khi tool đã có mã;
  - sáu preset trên `windows-2025-vs2026` (VS 2026 bản 18.10), mỗi preset kèm
    `VNS_TOOLCHAIN_PROBE=ON` và chạy `vns_probe.exe`; riêng `rel` cài thử kiểu deploy ra thư mục
    tạm, và đỏ nếu thiếu runtime MSVC, có pdb, hay exe cài ra không chạy.
  Toolset MSVC của runner có thể mới hơn 19.51 của máy dev; bước setup in bản `cl` ra log. `rel` lưu
  exe và pdb thành artifact 14 ngày khi `src/` đã có module.
- `.github/actions/setup` — bản CI của `dev.bat`: vcvars64, `CC=cl`, clang-format và clang-tidy từ
  PyPI đúng bản ghim, `VCPKG_ROOT`.
- `.github/workflows/codeql.yml` — CodeQL c-cpp, bộ `security-and-quality`, cho push, PR và mỗi
  thứ Hai. Tự bỏ qua khi `src/` chưa có tệp `.cpp`.
- `.github/workflows/release.yml` — CD. Phát hành: sửa `project(VnS VERSION X.Y.Z)`, commit, rồi
  `git tag vX.Y.Z` và `git push origin vX.Y.Z`. Workflow kiểm tag khớp phiên bản, chạy `deploy`,
  nén nguyên `Client/` và `Server/` thành `vns-X.Y.Z-win64-client.zip` và `-server.zip`, cộng zip
  pdb, `SHA256SUMS.txt`, chứng thực provenance, và tạo GitHub Release. `Tools/` không phát hành.
- `.github/dependabot.yml` — cập nhật SHA ghim của các action mỗi tuần. Mọi action ghim theo SHA
  commit, có tag ở comment cạnh đó.

## X.10 Thư mục sản phẩm — Client, Server, Tools

Ba thư mục ở gốc repo là hình hài của bản phát hành, và phải đạt chuẩn triển khai ngay từ exe đầu
tiên. Mã C++ của mọi exe nằm ở `src/`; ba thư mục này chỉ nhận bản triển khai, cộng tệp không phải
mã đi kèm (hướng dẫn, cấu hình). Tool Python là ngoại lệ duy nhất: chạy thẳng từ nguồn, nên nguồn
của nó nằm ngay trong `Tools/<Tên>/`.

**Triển khai** — `cmake --workflow --preset deploy`, hay task `VnS: triển khai vào Client, Server,
Tools`. Chỉ có ở preset `rel` (MSVC, RelWithDebInfo); preset khác không có target `deploy`, nên bản
Debug hay sanitizer không thể tới tay người dùng. Mỗi lần triển khai dọn exe và DLL cũ ở tầng trên
cùng của từng thư mục, rồi chép exe, DLL nó cần và runtime MSVC app-local (`Microsoft.VC145.CRT`).
Không pdb. Không chép tay exe hay DLL vào ba thư mục này: lần triển khai sau sẽ xoá chúng.

**`Client/` — cho người chơi.**

- Là đúng thứ phát hành: zip client của Release là nguyên thư mục này. Người dùng kiểm thử bằng
  cách đóng vai người chơi chạy exe từ đây, nên mọi mục kiểm thử của client chạy từ `Client/`.
- Chạy được trên Windows 10 1903 trở lên, x64, máy sạch chưa cài gì. Chép cả thư mục đi đâu cũng
  chạy.
- Không ghi gì vào `Client/`, vì thư mục cài có thể chỉ đọc: cài đặt, nhật ký và bộ nhớ đệm của
  người chơi vào `%LOCALAPPDATA%\VnS\`. `Client/HUONG-DAN.txt` đã hứa điều này với người chơi.
- Không chứa gì của server hay công cụ nội bộ: không khoá bí mật, không địa chỉ quản trị, không
  lối tắt debug bật bằng tham số ẩn.
- `HUONG-DAN.txt` là tài liệu cho người chơi, tiếng Việt, CRLF. Cập nhật khi tên exe hay cách chạy
  đổi.

**`Server/` — cho máy chủ.**

- `bin/` — exe server và runtime, do `deploy` chép. `config/` — cấu hình, có commit. `data/` và
  `logs/` — sinh lúc chạy, không commit, `deploy` không bao giờ đụng tới.
- Cấu hình là TOML, không INI: TOML có kiểu, có bảng lồng, có comment và đặc tả chặt. C++ đọc bằng
  toml++ (vcpkg `tomlplusplus`), Python đọc bằng `tomllib` của thư viện chuẩn và ghi giữ comment
  bằng `tomlkit`. Thêm gói khi viết đoạn mã đầu tiên cần nó.
- `config/<tên>.toml` là mặc định, có commit, đi kèm bản phát hành. `config/<tên>.local.toml` ghi đè
  từng khoá và là chỗ duy nhất chứa mật khẩu, khoá bí mật hay địa chỉ riêng của máy; `.gitignore`
  chặn nó, nên nó không bao giờ vào repo hay bản phát hành.
- Cấu hình sai hay thiếu khoá bắt buộc thì server từ chối khởi động, với thông báo tiếng Việt chỉ
  đúng tệp và khoá. Không chạy tiếp với giá trị đoán.

**`Tools/` — công cụ nội bộ, mỗi tool một thư mục `Tools/<Tên>/`.**

- Tool C++: nguồn ở `src/<module>/`, exe vào `Tools/<Tên>/` qua `vns_deploy`. Tool Python: nguồn,
  `pyproject.toml` và `.venv` (không commit) nằm trong `Tools/<Tên>/`.
- Chọn ngôn ngữ theo việc: Python cho GUI, điều phối và quản trị; C++ khi cần tốc độ hay dùng chung
  mã với server (định dạng dữ liệu, giao thức). Tool Python cần phần đó thì gọi một exe C++ hay
  một module C++ đóng gói cho Python, không viết lại logic của server bằng Python.
- Không nằm trong Release; chỉ chạy trên máy dev và máy vận hành.

**ADMIN** (`Tools/ADMIN/`) — GUI quản trị toàn bộ server.

- Python 3.13 (`py`), PyQt6 ghim trong `pyproject.toml`. PyQt6 theo GPL hoặc giấy phép thương mại:
  dùng nội bộ thì được, nhưng phát hành ADMIN ra ngoài thì phải hỏi người dùng trước (X.4).
- Giao diện Fusion cổ điển: `app.setStyle("Fusion")` rồi `app.setPalette(app.style().standardPalette())`.
  Chỉ gọi `setColorScheme(Light)` thì không đủ: đã đo ngày 2026-09-30, dưới nền offscreen nó không
  có hiệu lực. Palette chuẩn của Fusion cho đúng bảng màu cổ điển (nền `#efefef`, chữ đen), bất kể
  Windows đang sáng hay tối.
- Phạm vi cơ bản: danh sách mọi tiến trình server; bật, tắt, khởi động lại; trạng thái (PID, thời
  gian chạy, CPU, RAM); xem log trực tiếp; sửa cấu hình TOML, kiểm hợp lệ trước khi ghi. Nâng cao:
  thao tác người chơi và thế giới qua giao thức quản trị của server, thông báo toàn server, sao lưu
  và khôi phục `data/`, lịch khởi động lại, biểu đồ số liệu.
- GUI không bao giờ chặn luồng chính: tiến trình server chạy qua `QProcess`, việc lâu qua `QThread`
  hay worker. Mọi lỗi hiện thành hộp thoại tiếng Việt; không nuốt lỗi.
- Quy cách Python: 0.2 và 0.3 áp nguyên (chuỗi UI và comment tiếng Việt, định danh tiếng Anh). Theo
  PEP 8: hàm và biến `snake_case`, class `PascalCase`, thành viên riêng tiền tố `_` theo quy ước
  Python (khác hậu tố `_` của C++). Type hint đầy đủ. Hàm phẳng như mục V: guard clause trước,
  không lồng quá một cấp. Hàm ảo của Qt giữ chính tả camelCase của Qt. ruff (lint và format, 100
  cột) và mypy strict phải sạch; mypy strict bắt cả giá trị trả về có thể `None` của Qt, như
  `QGuiApplication.styleHints()`.
- Môi trường, chạy trong `Tools/ADMIN`: `py -3.13 -m venv .venv` rồi
  `.venv\Scripts\python -m pip install --group dev`. Nâng bản gói thì sửa `pyproject.toml` rồi cài
  lại, không `pip install` tay vào `.venv`.

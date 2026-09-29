# Kiểm thử tay — VnS

Cách dùng ở CLAUDE.md mục X.7. Tóm tắt: viết mục trước khi viết mã, chạy thấy trượt thì ghi
`TRƯỢT <ngày>: <triệu chứng>`, sửa xong chạy lại đạt thì đánh `[x]` kèm `đạt <ngày> (<preset>)`.
Mọi lệnh chạy trong môi trường `dev.bat`, từ thư mục gốc repo.

Mẫu một mục:

```
- [ ] K-NNN — <việc cần đúng>. Lệnh: `<lệnh chạy được nguyên văn>`. Mong đợi: <output, mã thoát,
  tệp sinh ra>.
```

## Hạ tầng

Đo ngày 2026-09-30 trên máy dev (MSVC 19.51.36257, LLVM 22.1.8). K-004 đến K-008 và K-010 chạy
trên một bản sao thăm dò có cấy lỗi, không nằm trong repo.

- [x] K-001 — Configure và build khi `src/` còn trống. Lệnh: `cmake --workflow --preset dev`.
  Mong đợi: in `VnS: src/ chưa có module nào`, `ninja: no work to do`, mã thoát 0. Đạt 2026-09-30
  (dev).
- [x] K-002 — Đủ sáu preset với exe thăm dò. Lệnh, với `<p>` lần lượt là dev, rel, asan, ubsan,
  tidy, analyze: `cmake --preset <p> -DVNS_TOOLCHAIN_PROBE=ON && cmake --build --preset <p>` rồi
  `.\build\<p>\bin\vns_probe.exe`. Mong đợi: 0 warning, `check_style: SACH`, exe in `ACP=65001` và
  thoát 0. Đạt 2026-09-30 (cả sáu preset).
- [x] K-003 — Manifest UTF-8 giữ nguyên chữ Việt trên argv. Lệnh: một exe in lại argv, gọi với
  tham số `Tiếng Việt ử`. Mong đợi: in lại đúng từng chữ, kể cả `ử` (không có trong code page
  1252). Đạt 2026-09-30 (dev).
- [x] K-004 — Bốn cảnh báo bổ sung bắt lỗi thật. Lệnh: `cl /c` với cờ của `vns_quality` trên một
  tệp có `switch` thiếu enumerator (có và không có `default`), destructor không ảo, member khởi tạo
  sai thứ tự. Mong đợi: C4061, C4062, C4265, C5038; bỏ bốn cờ đó thì im lặng. Đạt 2026-09-30.
- [x] K-005 — clang-tidy hai chiều. Lệnh: `cmake --workflow --preset tidy`, rồi
  `clang-tidy -p build/tidy <tệp sai>`. Mong đợi: mã viết đúng hiến pháp (guard một dòng, tên `n`)
  sạch; tệp sai bị bắt đủ 8 lỗi (kiểu tên của namespace, struct, member, hàm, enumerator; thiếu
  `k`; thiếu `_`; vòng lặp hai dòng không ngoặc). Đạt 2026-09-30 (tidy).
- [x] K-006 — ASan bắt lỗi và exe chạy ngoài `dev.bat`. Lệnh: `.\build\asan\bin\<exe>.exe` trên
  mã đọc quá cuối `std::vector`. Mong đợi: `heap-buffer-overflow` kèm đúng `file:line`; chạy từ
  PowerShell trần không lỗi `0xC0000135`. Đạt 2026-09-30 (asan).
- [x] K-007 — UBSan bắt tràn số có dấu. Lệnh: `.\build\ubsan\bin\<exe>.exe` trên mã cộng vào
  `INT_MAX`. Mong đợi: `runtime error: signed integer overflow` kèm đúng `file:line`. Đạt
  2026-09-30 (ubsan).
- [x] K-008 — `/analyze:external-` vẫn soát mã của VnS. Lệnh: `cl /c /analyze /analyze:external-`
  trên tệp đọc qua con trỏ null. Mong đợi: C6011. Đạt 2026-09-30.
- [x] K-009 — clangd ngoài `dev.bat`. Lệnh: `clangd --check=<tệp>` từ PowerShell trần. Mong đợi:
  triple `msvc19.51.36257`, nạp `.clangd` và compile_commands của `build/dev`, không có lỗi giả
  `/Zc:preprocessor`, nạp các check trong `.clang-tidy`. Đạt 2026-09-30.
- [x] K-010 — `third_party/` tách khỏi luật của VnS. Lệnh: build `dev`, `tidy`, `ubsan` với một thư
  viện C giả có biến không dùng và hàm `static` trong header. Mong đợi: build xanh, `build.ninja`
  của `tidy` không có lệnh clang-tidy nào cho thư viện đó. Đạt 2026-09-30.
- [x] K-011 — Hook pre-commit. Lệnh: `git commit` với một tệp `src/` sai định dạng, rồi với tệp
  sạch, rồi chỉ với tệp `third_party/` sai định dạng. Mong đợi: lần một bị chặn và thông báo in
  một lần; lần hai và ba commit được. Đạt 2026-09-30.
- [x] K-012 — Workflow hợp lệ. Lệnh: `actionlint` 1.7.12 ở gốc repo. Mong đợi: không lỗi, mã thoát
  0. Đạt 2026-09-30.
- [x] K-013 — CI xanh trên GitHub. Lệnh: push lên `main`. Mong đợi: mọi job xanh; bước setup
  không `throw` (tức clang-format và clang-tidy trên runner đúng 22.1.8); `vns_probe` thoát 0 ở cả
  sáu preset. Đạt 2026-09-30 (commit `81906ab`, 7/7 job).
- [x] K-014 — CodeQL bỏ qua khi chưa có mã. Lệnh: push lên `main`. Mong đợi: job `dò mã C++` xanh,
  job CodeQL ở trạng thái skipped. Đạt 2026-09-30 (commit `81906ab`).
- [ ] K-015 — Release từ chối phát hành rỗng. Lệnh: đẩy tag `v0.1.0` khi chưa có exe nào được
  triển khai. Mong đợi: job đỏ ở bước đóng gói với `Client/ và Server/bin/ không có exe nào để phát
  hành`. Chưa chạy: không tạo tag thử trên repo public khi chưa có gì để phát hành.
- [ ] K-016 — VS Code. Lệnh: mở một tệp `.cpp` dưới `src/`, lưu tệp, rồi F5 với cấu hình
  `Gỡ lỗi exe (dev)`. Mong đợi: clangd hiện chẩn đoán và cảnh báo clang-tidy, lưu thì tự định dạng,
  F5 build `dev` rồi dừng được ở breakpoint. Chưa chạy: cần có mã trong `src/` và người mở editor.
- [x] K-017 — Triển khai vào thư mục sản phẩm. Lệnh: `cmake --workflow --preset deploy` với một exe
  khai `vns_deploy(... Client)`, trong `Client/` có sẵn một `old.exe` cũ, `Server/config/` có một
  `.toml`, `Tools/ADMIN/.venv/` có một DLL. Mong đợi: `Client/` có đúng exe cộng 8 DLL runtime
  `Microsoft.VC145.CRT`, không pdb; `old.exe` bị dọn; `.toml` và DLL trong `.venv` còn nguyên; exe
  chạy từ `Client/` bằng PowerShell trần, thoát 0. Đạt 2026-09-30 (rel, bản sao thăm dò).
- [x] K-018 — Bản không phát hành không thể triển khai. Lệnh: `cmake --build --preset dev --target
  deploy`, rồi configure với `vns_deploy(... Khach)`. Mong đợi: `unknown target 'deploy'`; đích sai
  dừng configure với `phải là Client, Server, Tools/<Tên>`. Đạt 2026-09-30.
- [x] K-019 — Icon và thông tin phiên bản trong exe. Lệnh: build `dev`, `rel`, `ubsan` với
  `vns_exe_resources(vns_probe 27_Terminal "Thăm dò toolchain VnS")`, rồi đọc `VersionInfo` và gọi
  `FindResource(1, RT_GROUP_ICON)`. Mong đợi: có icon; mô tả tiếng Việt nguyên dấu, `0.1.0`,
  `vns_probe.exe`, dòng bản quyền; exe không có tài nguyên thì bộ kiểm trả không có icon. Đạt
  2026-09-30 (cả ba preset).
- [x] K-020 — Môi trường ADMIN. Lệnh: trong `Tools/ADMIN`, `py -3.13 -m venv .venv` và
  `.venv\Scripts\python -m pip install --group dev`, rồi một đoạn Python gọi `setStyle("Fusion")` và
  `setPalette(style.standardPalette())`. Mong đợi: PyQt6 6.11.0, Qt 6.11.2, ruff 0.16.9, mypy 2.3.1;
  có style `Fusion`; trên nền `windows` palette cho nền `#efefef`, chữ `#000000`. Đạt 2026-09-30.
- [x] K-021 — Cấu hình ruff và mypy. Lệnh: `ruff check`, `ruff format --check` và `mypy` theo
  `Tools/ADMIN/pyproject.toml` trên một tệp mẫu có chữ Việt và `closeEvent`. Mong đợi: ruff sạch,
  không báo `closeEvent` sai kiểu tên; mypy strict bắt `styleHints()` có thể là `None`. Đạt
  2026-09-30.
- [x] K-022 — Hook pre-commit với Python. Lệnh: stage một tệp `.py` sai dưới `Tools/ADMIN`, chạy
  `node scripts/hooks/pre_commit.js`, rồi sửa tệp cho đúng và chạy lại. Mong đợi: lần một thoát 1
  và in lỗi ruff; lần hai thoát 0. Đạt 2026-09-30. Nhánh tool chưa có `.venv` chưa chạy.
- [x] K-023 — CI sau khi thêm thư mục sản phẩm. Lệnh: push lên `main`. Mong đợi: job
  `Tools Python` xanh (dựng `.venv` của ADMIN từ bản ghim); job `rel` cài thử kiểu deploy có
  `vcruntime140.dll`, không pdb, `ProductVersion` dạng `X.Y.Z`, và `vns_probe` từ bản cài thoát 0.
  Đạt 2026-09-30 (commit `8a103b6`, 8/8 job, bước `Cài thử kiểu deploy` của `rel` xanh).

## Tính năng

Chưa có. Thêm mục ở đây trước khi viết mã của mỗi tính năng.

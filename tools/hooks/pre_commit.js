#!/usr/bin/env node
// Hook pre-commit của VnS: chạy cổng kiểm hình thức (hiến pháp V.5) trên file C/C++ sắp commit,
// đúng bản cổng mà build và CI dùng (tools/check_style.js).
//
// Hai tầng: tầng ngoài lấy danh sách file đã stage rồi gọi lại chính file này với --gate bên trong
// môi trường dev.bat, vì clang-format 22.1.8 chỉ vào PATH sau dev.bat. Máy không có dev.bat thì
// tầng trong chạy thẳng với PATH hiện có, và vẫn chặn nếu clang-format sai bản.
//
// Giới hạn: cổng đọc file trên đĩa, không đọc bản trong index; file stage một phần được kiểm theo
// nội dung đang có trên đĩa.

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SOURCE_PATTERN = /\.(c|cc|cpp|cxx|h|hh|hpp|hxx)$/i;
// Chỉ mã của VnS; third_party giữ nguyên byte upstream nên không qua cổng.
const OWNED_PATTERN = /^(src|tests|tools\/ci\/probe)\//;

const repoRoot = path.resolve(__dirname, '..', '..');

function stagedSources() {
    const result = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error(`git diff lỗi: ${result.stderr}`);
    const names = result.stdout.split('\0').filter((name) => name.length > 0);
    return names.filter((name) => OWNED_PATTERN.test(name) && SOURCE_PATTERN.test(name));
}

// Bản clang-format ghim ở một chỗ duy nhất: cmake/quality.cmake.
function pinnedClangFormat() {
    const text = fs.readFileSync(path.join(repoRoot, 'cmake', 'quality.cmake'), 'utf8');
    const match = /set\(VNS_CLANG_FORMAT_VERSION ([0-9.]+)\)/.exec(text);
    if (!match) throw new Error('không đọc được VNS_CLANG_FORMAT_VERSION trong cmake/quality.cmake');
    return match[1];
}

function runGate(files) {
    const pinned = pinnedClangFormat();
    const probe = spawnSync('clang-format', ['--version'], { encoding: 'utf8' });
    const found = probe.status === 0 ? probe.stdout.trim() : 'không tìm thấy clang-format trên PATH';
    if (!found.includes(`version ${pinned}`)) {
        console.error(`pre-commit: cần clang-format ${pinned}, đang có: ${found}`);
        return 1;
    }
    const gate = path.join(repoRoot, 'tools', 'check_style.js');
    const result = spawnSync(process.execPath, [gate, ...files], { cwd: repoRoot, stdio: 'inherit' });
    return result.status ?? 1;
}

function quote(text) {
    return `"${text}"`;
}

function runOuter() {
    const files = stagedSources();
    if (files.length === 0) return 0;

    const devBat = path.join(process.env.USERPROFILE ?? '', '.claude', 'bin', 'dev.bat');
    if (!fs.existsSync(devBat)) return runGate(files);

    const inner = [quote(process.execPath), quote(__filename), '--gate', ...files.map(quote)].join(' ');
    const command = `"call ${quote(devBat)} && ${inner}"`;
    const result = spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
        cwd: repoRoot,
        stdio: 'inherit',
        windowsVerbatimArguments: true,
    });
    return result.status ?? 1;
}

function main(argv) {
    if (argv[0] === '--gate') return runGate(argv.slice(1));
    const status = runOuter();
    if (status !== 0) console.error('pre-commit: cổng kiểm hình thức chặn commit. Sửa rồi stage lại.');
    return status;
}

process.exit(main(process.argv.slice(2)));

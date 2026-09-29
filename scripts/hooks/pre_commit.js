#!/usr/bin/env node
// Hook pre-commit của VnS, cùng luật với build và CI:
//   - tệp C/C++ của VnS qua cổng kiểm hình thức (hiến pháp V.5, scripts/check_style.js);
//   - tệp Python của Tools/<Tên>/ qua ruff check và ruff format --check, bằng .venv và
//     pyproject.toml của chính tool đó (CLAUDE.md mục X.10). mypy chậm hơn nên chỉ chạy ở CI.
//
// Phần C/C++ có hai tầng: tầng ngoài gọi lại chính file này với --gate bên trong môi trường
// dev.bat, vì clang-format 22.1.8 chỉ vào PATH sau dev.bat. Máy không có dev.bat thì tầng trong chạy thẳng
// với PATH hiện có, và vẫn chặn nếu clang-format sai bản.
//
// Giới hạn: công cụ đọc tệp trên đĩa, không đọc bản trong index; tệp stage một phần được kiểm theo
// nội dung đang có trên đĩa.

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SOURCE_PATTERN = /\.(c|cc|cpp|cxx|h|hh|hpp|hxx)$/i;
// Chỉ mã của VnS; third_party giữ nguyên byte upstream nên không qua cổng.
const OWNED_PATTERN = /^(src|tests|scripts\/ci\/probe)\//;
// Nhóm 1 là tên tool: Tools/ADMIN/admin/main.py thuộc tool ADMIN.
const TOOL_PYTHON_PATTERN = /^Tools\/([^/]+)\/.+\.py$/;

const repoRoot = path.resolve(__dirname, '..', '..');

function stagedNames() {
    const args = ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'];
    const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`git diff lỗi: ${result.stderr}`);
    return result.stdout.split('\0').filter((name) => name.length > 0);
}

// Bản clang-format ghim ở một chỗ duy nhất: cmake/quality.cmake.
function pinnedClangFormat() {
    const text = fs.readFileSync(path.join(repoRoot, 'cmake', 'quality.cmake'), 'utf8');
    const match = /set\(VNS_CLANG_FORMAT_VERSION ([0-9.]+)\)/.exec(text);
    if (!match) throw new Error('cmake/quality.cmake thiếu VNS_CLANG_FORMAT_VERSION');
    return match[1];
}

function runGate(files) {
    const pinned = pinnedClangFormat();
    const probe = spawnSync('clang-format', ['--version'], { encoding: 'utf8' });
    const found = probe.status === 0 ? probe.stdout.trim() : 'PATH không có clang-format';
    if (!found.includes(`version ${pinned}`)) {
        console.error(`pre-commit: cần clang-format ${pinned}, đang có: ${found}`);
        return 1;
    }
    const gate = path.join(repoRoot, 'scripts', 'check_style.js');
    const options = { cwd: repoRoot, stdio: 'inherit' };
    const result = spawnSync(process.execPath, [gate, ...files], options);
    return result.status ?? 1;
}

function quote(text) {
    return `"${text}"`;
}

function runCppGate(files) {
    if (files.length === 0) return 0;

    const devBat = path.join(process.env.USERPROFILE ?? '', '.claude', 'bin', 'dev.bat');
    if (!fs.existsSync(devBat)) return runGate(files);

    const head = [quote(process.execPath), quote(__filename), '--gate'];
    const inner = [...head, ...files.map(quote)].join(' ');
    const command = `"call ${quote(devBat)} && ${inner}"`;
    const result = spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
        cwd: repoRoot,
        stdio: 'inherit',
        windowsVerbatimArguments: true,
    });
    return result.status ?? 1;
}

function runRuff(ruff, args) {
    const result = spawnSync(ruff, args, { cwd: repoRoot, stdio: 'inherit' });
    return result.status ?? 1;
}

// Một tool: ruff của .venv trong Tools/<Tên>/, cấu hình pyproject.toml cạnh nó.
function checkTool(tool, files) {
    const toolDir = path.join(repoRoot, 'Tools', tool);
    const ruff = path.join(toolDir, '.venv', 'Scripts', 'ruff.exe');
    if (!fs.existsSync(ruff)) {
        console.error(`pre-commit: Tools/${tool} chưa có .venv; tạo theo pyproject.toml của nó.`);
        return 1;
    }
    const config = path.join(toolDir, 'pyproject.toml');
    const lint = runRuff(ruff, ['check', '--config', config, ...files]);
    const format = runRuff(ruff, ['format', '--check', '--config', config, ...files]);
    return lint !== 0 || format !== 0 ? 1 : 0;
}

function runPythonGate(names) {
    const byTool = new Map();
    for (const name of names) {
        const match = TOOL_PYTHON_PATTERN.exec(name);
        if (!match) continue;
        byTool.set(match[1], [...(byTool.get(match[1]) ?? []), name]);
    }
    const statuses = [...byTool].map(([tool, files]) => checkTool(tool, files));
    return statuses.some((status) => status !== 0) ? 1 : 0;
}

function main(argv) {
    if (argv[0] === '--gate') return runGate(argv.slice(1));

    const names = stagedNames();
    const cppFiles = names.filter((name) => OWNED_PATTERN.test(name) && SOURCE_PATTERN.test(name));
    const cppStatus = runCppGate(cppFiles);
    const pythonStatus = runPythonGate(names);
    if (cppStatus === 0 && pythonStatus === 0) return 0;

    console.error('pre-commit: cổng kiểm chặn commit. Sửa rồi stage lại.');
    return 1;
}

process.exit(main(process.argv.slice(2)));

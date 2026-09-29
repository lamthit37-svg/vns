#!/usr/bin/env node
// ============================================================================
// check_style.js — cổng kiểm hình thức cho mã C/C++, thay cho check_style.py
// (máy này không có Python — xem TOOLCHAIN.md).
//
// Dùng:
//   node %USERPROFILE%\.claude\bin\check_style.js <thư-mục-hoặc-file> [...]
//   node ... check_style.js src --no-format     bỏ qua phép kiểm clang-format
//
// Ba phép kiểm, bắt ba thứ khác nhau, không thay thế được cho nhau:
//   1. clang-format --dry-run -Werror  — định dạng khớp .clang-format từng ký tự
//   2. nesting   — cấp lồng thứ hai, và khối phạm vi trần
//   3. staircase — bậc thang do dòng nối tiếp, đo theo MỨC THỤT LỀ:
//                  R1 một câu lệnh dùng tối đa HAI mức thụt lề khác nhau
//                  R2 nếu có hai mức thì mức sâu đúng bằng mức đầu cộng 4
//                  Gom theo ( [ VÀ { khởi tạo } — không gom { thân hàm/if/enum }
//
// Miễn trừ một chỗ khi chất lượng thắng hình thức: `// style-ok(lý do):` ngay trên dòng vi phạm
// (xem applyExemptions). Không miễn được clang-format.
//
// Exit 0 nếu sạch, 1 nếu có vi phạm, 2 nếu lỗi sử dụng.
// Giới hạn đã biết ghi ở cuối file.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SOURCE_EXTENSIONS = new Set(['.c', '.cc', '.cpp', '.cxx', '.h', '.hh', '.hpp', '.hxx']);
const SKIP_DIRECTORIES = new Set(['build', 'out', '.git', 'node_modules', 'vcpkg_installed', '_dev']);
const INDENT_STEP = 4;

// Từ khoá mở một khối điều khiển. `else` không tính vì nó nối tiếp `if` đã đếm.
const CONTROL_KEYWORDS = ['if', 'for', 'while', 'switch', 'do'];

// ---------------------------------------------------------------- tiện ích

function isSourceFile(file) {
    return SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase());
}

// Trả về thông báo lỗi khi đường dẫn hỏng, null khi thành công. Không ném —
// cổng kiểm phải báo lỗi đọc được, không phải stack trace của Node.
function collectSources(target, found) {
    if (!fs.existsSync(target)) return `không tìm thấy: ${target}`;
    const stat = fs.statSync(target);
    if (stat.isFile()) {
        if (isSourceFile(target)) found.push(target);
        return null;
    }
    if (!stat.isDirectory()) return `không phải file hay thư mục: ${target}`;
    for (const entry of fs.readdirSync(target)) collectFromEntry(target, entry, found);
    return null;
}

function collectFromEntry(dir, entry, found) {
    if (SKIP_DIRECTORIES.has(entry)) return;
    collectSources(path.join(dir, entry), found);
}

// Xoá comment và nội dung chuỗi để phép quét không bị đánh lừa bởi dấu ngoặc
// nằm trong text. Giữ nguyên độ dài dòng không cần thiết — chỉ cần cấu trúc.
function stripCommentsAndStrings(text) {
    let out = '';
    let index = 0;
    let inBlockComment = false;
    let inLineComment = false;
    let quote = '';
    while (index < text.length) {
        const step = consumeOne(text, index, { inBlockComment, inLineComment, quote });
        out += step.emit;
        inBlockComment = step.inBlockComment;
        inLineComment = step.inLineComment;
        quote = step.quote;
        index += step.width;
    }
    return out;
}

function consumeOne(text, index, state) {
    const c = text[index];
    const next = text[index + 1];
    if (state.inBlockComment) return consumeInBlockComment(c, next, state);
    if (state.inLineComment) return consumeInLineComment(c, state);
    if (state.quote !== '') return consumeInString(text, index, state);
    return consumeInCode(c, next, state);
}

function consumeInBlockComment(c, next, state) {
    if (c === '*' && next === '/') return { emit: '  ', width: 2, ...state, inBlockComment: false };
    return { emit: c === '\n' ? '\n' : ' ', width: 1, ...state };
}

function consumeInLineComment(c, state) {
    if (c === '\n') return { emit: '\n', width: 1, ...state, inLineComment: false };
    return { emit: ' ', width: 1, ...state };
}

function consumeInString(text, index, state) {
    const c = text[index];
    if (c === '\\') return { emit: '  ', width: 2, ...state };
    if (c === state.quote) return { emit: c, width: 1, ...state, quote: '' };
    return { emit: c === '\n' ? '\n' : ' ', width: 1, ...state };
}

function consumeInCode(c, next, state) {
    if (c === '/' && next === '*') return { emit: '  ', width: 2, ...state, inBlockComment: true };
    if (c === '/' && next === '/') return { emit: '  ', width: 2, ...state, inLineComment: true };
    if (c === '"' || c === "'") return { emit: c, width: 1, ...state, quote: c };
    return { emit: c, width: 1, ...state };
}

function indentWidthOf(line) {
    const match = /^[ \t]*/.exec(line);
    return match[0].replace(/\t/g, '    ').length;
}

// ------------------------------------------------- phép kiểm 1: clang-format

// Dự án chưa có .clang-format thì dùng bản chính thức ở ~/.claude/bin, để cổng
// kiểm không âm thầm rơi về style LLVM mặc định và bỏ lọt mục 0.1.
function findStyleArgument(files) {
    if (hasProjectConfig(files[0])) return [];
    const canonical = path.join(__dirname, 'clang-format.template');
    if (!fs.existsSync(canonical)) return [];
    console.log(`check_style: dự án chưa có .clang-format, dùng bản chính thức ${canonical}`);
    return [`-style=file:${canonical}`];
}

function hasProjectConfig(file) {
    let dir = path.dirname(path.resolve(file));
    for (let depth = 0; depth < 12; ++depth) {
        if (fs.existsSync(path.join(dir, '.clang-format'))) return true;
        const parent = path.dirname(dir);
        if (parent === dir) return false;
        dir = parent;
    }
    return false;
}

// Windows giới hạn một dòng lệnh ở 32 767 ký tự. Dự án nhiều tệp nằm sâu trong một worktree vượt
// ngưỡng đó (spawnSync báo ENAMETOOLONG), nên danh sách tệp được chia thành từng lượt dưới ngân
// sách này; mọi tệp vẫn được kiểm, chỉ khác số lần gọi clang-format.
const kCommandBudget = 24000;

function batchesOf(files, reserved) {
    const batches = [];
    let current = [];
    let length = reserved;
    for (const file of files) {
        const cost = file.length + 3; // dấu cách cộng cặp nháy mà Windows có thể thêm
        const full = current.length > 0 && length + cost > kCommandBudget;
        if (full) {
            batches.push(current);
            current = [];
            length = reserved;
        }
        current.push(file);
        length += cost;
    }
    if (current.length > 0) batches.push(current);
    return batches;
}

function runClangFormatBatch(files, styleArgs) {
    // shell:false để đường dẫn có dấu cách vẫn là một thư mục, không bị cmd tách đôi.
    const result = spawnSync('clang-format', ['--dry-run', '-Werror', ...styleArgs, ...files], {
        encoding: 'utf8',
        shell: false,
    });
    if (result.error) return [`clang-format không chạy được: ${result.error.message}`];
    if (result.status === 0) return [];
    const text = (result.stderr || '').trim();
    return text === '' ? ['clang-format báo lệch định dạng (không có chi tiết)'] : text.split(/\r?\n/);
}

function runClangFormat(files) {
    const styleArgs = findStyleArgument(files);
    const reserved = ['clang-format', '--dry-run', '-Werror', ...styleArgs].join(' ').length;
    const problems = [];
    for (const batch of batchesOf(files, reserved)) {
        problems.push(...runClangFormatBatch(batch, styleArgs));
    }
    return problems;
}

// ------------------------------------------------------ phép kiểm 2: nesting

// Phân loại dấu `{` theo phần đầu dòng đứng trước nó.
function classifyBrace(prefix) {
    const trimmed = prefix.trim();
    if (/\b(namespace|class|struct|union|enum)\b/.test(trimmed)) return 'type';
    if (/\]\s*(\([^)]*\))?\s*(mutable|noexcept|->[^{]*)*$/.test(trimmed)) return 'lambda';
    if (endsWithControlHead(trimmed)) return 'control';
    if (/\bdo\s*$/.test(trimmed)) return 'control';
    if (/\belse\s*$/.test(trimmed)) return 'control';
    if (trimmed === '' || /[;{}]$/.test(trimmed)) return 'bare';
    return 'function';
}

function endsWithControlHead(trimmed) {
    if (!/\)\s*$/.test(trimmed)) return false;
    return CONTROL_KEYWORDS.some((kw) => new RegExp(`\\b${kw}\\b`).test(trimmed));
}

// `else if` nối tiếp chuỗi điều kiện cũ, không phải một cấp mới.
function isElseIfContinuation(prefix) {
    return /\belse\s+if\b/.test(prefix) && /^\s*[})]/.test(prefix);
}

function checkNesting(lines, cleanLines) {
    const problems = [];
    const stack = [];
    for (let i = 0; i < cleanLines.length; ++i) {
        scanLineForNesting(cleanLines[i], i, stack, problems, lines);
    }
    return problems;
}

function scanLineForNesting(clean, lineIndex, stack, problems, lines) {
    if (isOneLineBlock(clean)) return;
    reportBracelessNesting(clean, lineIndex, problems, lines);
    for (let col = 0; col < clean.length; ++col) {
        handleBraceChar(clean, col, lineIndex, stack, problems, lines);
    }
}

// `for (...) for (...) stmt;` — hai vòng lặp lồng nhau mà không có ngoặc nhọn.
// Phải đếm ngoặc thật, không dùng regex: thân `for` chứa cả `;` lẫn `)`.
function reportBracelessNesting(clean, lineIndex, problems, lines) {
    if (!hasBracelessNestedLoop(clean)) return;
    problems.push(formatProblem(lineIndex, lines, 'hai vòng lặp lồng nhau trên một dòng'));
}

function hasBracelessNestedLoop(clean) {
    const head = /\b(for|while)\s*\(/g;
    let match = head.exec(clean);
    while (match !== null) {
        if (followsWithLoop(clean, head.lastIndex - 1)) return true;
        match = head.exec(clean);
    }
    return false;
}

function followsWithLoop(clean, openIndex) {
    const closeIndex = findMatchingParen(clean, openIndex);
    if (closeIndex < 0) return false;
    return /^\s*(for|while)\s*\(/.test(clean.slice(closeIndex + 1));
}

function findMatchingParen(clean, openIndex) {
    let depth = 0;
    for (let i = openIndex; i < clean.length; ++i) {
        if (clean[i] === '(') depth += 1;
        if (clean[i] === ')') depth -= 1;
        if (depth === 0) return i;
    }
    return -1;
}

function isOneLineBlock(clean) {
    const opens = (clean.match(/\{/g) || []).length;
    const closes = (clean.match(/\}/g) || []).length;
    return opens > 0 && opens === closes;
}

function handleBraceChar(clean, col, lineIndex, stack, problems, lines) {
    const c = clean[col];
    if (c === '}') return void stack.pop();
    if (c !== '{') return;
    pushBrace(clean.slice(0, col), lineIndex, stack, problems, lines);
}

function pushBrace(prefix, lineIndex, stack, problems, lines) {
    const kind = classifyBrace(prefix);
    if (kind === 'bare' && stack.length > 0) {
        problems.push(formatProblem(lineIndex, lines, 'khối phạm vi trần — dùng hàm hoặc lớp RAII'));
    }
    if (kind === 'control' && !isElseIfContinuation(prefix)) reportDepth(lineIndex, stack, problems, lines);
    stack.push(kind);
}

// Đếm số khối điều khiển kể từ khung hàm hoặc lambda gần nhất.
function reportDepth(lineIndex, stack, problems, lines) {
    let depth = 0;
    for (let i = stack.length - 1; i >= 0; --i) {
        if (stack[i] === 'function' || stack[i] === 'lambda' || stack[i] === 'type') break;
        if (stack[i] === 'control') depth += 1;
    }
    if (depth < 1) return;
    problems.push(formatProblem(lineIndex, lines, `cấp lồng thứ ${depth + 1} — tách thành hàm riêng`));
}

// ---------------------------------------------------- phép kiểm 3: staircase

// Gom các dòng thuộc cùng một câu lệnh trải nhiều dòng, rồi đo số mức thụt lề.
// Stack chỉ chứa ( [ và { khởi tạo. { của thân hàm/if/enum/lambda không vào stack,
// nếu không cả hàm bị gom thành một câu lệnh.
function checkStaircase(lines, cleanLines) {
    const problems = [];
    const stack = [];
    const group = [];
    for (let i = 0; i < cleanLines.length; ++i) {
        advanceGroup(cleanLines[i], i, group, stack, problems, lines);
    }
    return problems;
}

// Một dòng thuộc câu lệnh đang gom khi: nó nằm trong ngoặc chưa đóng, nó mở ngoặc, dòng trước còn nợ
// (group chưa xả), hoặc chính nó kết thúc bằng toán tử nên câu lệnh chưa hết. Thiếu nhánh toán tử thì
// `x =` rồi `f(` rồi tham số (4, 8, 12) bị đo thành hai câu lệnh 4 và 8, 12 và lọt qua.
function advanceGroup(clean, lineIndex, group, stack, problems, lines) {
    if (clean.trim() === '') return;
    const before = stack.length;
    walkStatementOpeners(clean, stack);
    const after = stack.length;
    const continues = endsWithOperator(clean);
    if (before > 0 || after > 0 || continues || group.length > 0) pushGroupLine(group, lineIndex);
    if (after > 0 || continues) return;
    flushGroup(group, problems, lines);
}

// Dấu gán hoặc toán tử hai ngôi ở cuối dòng: câu lệnh nối sang dòng sau (.clang-format đặt
// BreakBeforeBinaryOperators: None nên toán tử luôn ở cuối). Không tính `,` vì danh sách khởi tạo
// thành viên để mỗi thành viên một dòng; không tính `<` `>` `*` `&` vì chúng còn là template, con
// trỏ, tham chiếu.
function endsWithOperator(clean) {
    return /(?:[-+/%^|=?]|&&|<<)\s*$/.test(clean);
}

function pushGroupLine(group, lineIndex) {
    if (group.length > 0 && group[group.length - 1] === lineIndex) return;
    group.push(lineIndex);
}

function walkStatementOpeners(clean, stack) {
    for (let col = 0; col < clean.length; ++col) {
        applyOpener(clean, col, stack);
    }
}

function applyOpener(clean, col, stack) {
    const c = clean[col];
    if (c === '(') return void stack.push('paren');
    if (c === '[') return void stack.push('bracket');
    if (c === '{') return openBrace(clean, col, stack);
    if (c === ')') return closeTyped(stack, 'paren');
    if (c === ']') return closeTyped(stack, 'bracket');
    if (c === '}') return closeTyped(stack, 'init');
}

function openBrace(clean, col, stack) {
    if (!isInitBrace(clean.slice(0, col))) return;
    stack.push('init');
}

function closeTyped(stack, kind) {
    if (stack.length === 0) return;
    if (stack[stack.length - 1] !== kind) return;
    stack.pop();
}

// `{` tiếp câu lệnh: return T{, T x{, = {, f(T{.
// `{` mở khối: if/for, thân hàm `) {`, struct/enum, lambda, try.
function isInitBrace(prefix) {
    const kind = classifyBrace(prefix);
    if (kind !== 'function') return false;
    const trimmed = prefix.trim();
    if (/\btry\s*$/.test(trimmed)) return false;
    if (isFunctionBodyPrefix(trimmed)) return false;
    return true;
}

function isFunctionBodyPrefix(trimmed) {
    return /\)\s*((const|volatile|override|final|noexcept|mutable|try|&|&&)\s*)*(->[^{;]+)?\s*$/.test(
        trimmed);
}

function flushGroup(group, problems, lines) {
    if (group.length < 2) return void (group.length = 0);
    const levels = [...new Set(group.map((i) => indentWidthOf(lines[i])))].sort((a, b) => a - b);
    reportLevels(levels, group, problems, lines);
    group.length = 0;
}

function reportLevels(levels, group, problems, lines) {
    const start = group[0];
    if (levels.length > 2) {
        const shown = levels.join(', ');
        problems.push(formatProblem(start, lines, `bậc thang: ${levels.length} mức thụt lề (${shown})`));
        return;
    }
    if (levels.length !== 2) return;
    const gap = levels[1] - levels[0];
    if (gap === INDENT_STEP) return;
    problems.push(formatProblem(start, lines, `bậc thang: mức sâu lệch ${gap} cột, phải là ${INDENT_STEP}`));
}

// ------------------------------------------- phép kiểm 4: luật của hiến pháp

const HEADER_EXTENSIONS = new Set(['.h', '.hh', '.hpp', '.hxx']);
const MAX_FILE_HEADER_LINES = 15;

// Kiểu nguyên thuỷ hay bị ép bằng C-cast. Danh sách hẹp để tránh báo nhầm
// biểu thức số học dạng `(a) * b`.
const CAST_TYPES = [
    'void', 'bool', 'char', 'short', 'int', 'long', 'float', 'double',
    'size_t', 'std::size_t', 'ptrdiff_t', 'intptr_t', 'uintptr_t',
    'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
    'int8_t', 'int16_t', 'int32_t', 'int64_t',
];

function isHeaderFile(file) {
    return HEADER_EXTENSIONS.has(path.extname(file).toLowerCase());
}

// Mục 0.3 — cấm Doxygen. Đọc dòng THẬT vì phần comment đã bị bóc khỏi cleanLines.
function checkDoxygen(lines, problems) {
    for (let i = 0; i < lines.length; ++i) {
        reportDoxygenLine(lines[i], i, lines, problems);
    }
}

function reportDoxygenLine(line, index, lines, problems) {
    if (/^\s*\/\/\//.test(line)) return void problems.push(formatProblem(index, lines, 'Doxygen `///` — mục 0.3 cấm, dùng `//`'));
    if (/^\s*\/\*\*/.test(line)) return void problems.push(formatProblem(index, lines, 'Doxygen `/**` — mục 0.3 cấm, dùng `//`'));
    if (!/@(param|return|brief|throws|tparam)\b/.test(line)) return;
    problems.push(formatProblem(index, lines, 'thẻ Doxygen — mục 0.3 cấm'));
}

// Mục III.6 — không `using namespace` trong header.
function checkUsingNamespace(lines, cleanLines, isHeader, problems) {
    if (!isHeader) return;
    for (let i = 0; i < cleanLines.length; ++i) {
        if (!/^\s*using\s+namespace\b/.test(cleanLines[i])) continue;
        problems.push(formatProblem(i, lines, '`using namespace` trong header — mục III.6 cấm'));
    }
}

// Mục III.2 — không `new` / `delete` trần.
function checkBareNewDelete(lines, cleanLines, problems) {
    for (let i = 0; i < cleanLines.length; ++i) {
        reportNewDeleteLine(cleanLines[i], i, lines, problems);
    }
}

function reportNewDeleteLine(clean, index, lines, problems) {
    if (/\boperator\s+(new|delete)\b/.test(clean)) return;
    if (/=\s*delete\s*;/.test(clean)) return;
    // `\b` sau từ khoá: không có nó thì `\s*` rỗng cho `newest`, `new_frame`, `delete_character` khớp.
    if (/\bnew\b\s*(\(|[A-Za-z_])/.test(clean)) {
        problems.push(formatProblem(index, lines, '`new` trần — dùng giá trị, `make_unique`, container'));
        return;
    }
    if (!/\bdelete\b\s*(\[\s*\])?\s*[A-Za-z_(]/.test(clean)) return;
    problems.push(formatProblem(index, lines, '`delete` trần — tài nguyên phải do RAII giải phóng'));
}

// Mục IV — mọi header phải có `#pragma once`.
function checkPragmaOnce(lines, isHeader, problems) {
    if (!isHeader) return;
    if (lines.some((line) => /^\s*#pragma\s+once\b/.test(line))) return;
    problems.push('1: header thiếu `#pragma once` — mục IV');
}

// Mục 0.3 — comment đầu file tối đa 15 dòng.
function checkFileHeaderLength(lines, problems) {
    let count = 0;
    while (count < lines.length && /^\s*(\/\/|$)/.test(lines[count])) count += 1;
    const commentLines = lines.slice(0, count).filter((line) => /^\s*\/\//.test(line)).length;
    if (commentLines <= MAX_FILE_HEADER_LINES) return;
    problems.push(`1: comment đầu file ${commentLines} dòng, tối đa ${MAX_FILE_HEADER_LINES} — mục 0.3`);
}

// Mục III.2 — C-cast phải thay bằng static_cast / reinterpret_cast có lý do.
//
// Từ khoá đứng ngay sau dấu ngoặc đóng biến nó thành KHAI BÁO HÀM chứ không phải ép kiểu:
// `int f(void) const`, `void g(void) noexcept`, `void h(void) override`. Không loại chúng ra thì
// mọi hàm thành viên hằng viết theo lối `(void) const` đều bị báo nhầm. Ranh giới từ \b là bắt
// buộc, nếu không thì `(int) constant` — một cú ép kiểu thật — cũng lọt.
const NOT_A_CAST_AFTER = ['const', 'constexpr', 'noexcept', 'override', 'final', 'volatile', 'throw'];

function checkCStyleCast(lines, cleanLines, problems) {
    const types = CAST_TYPES.join('|').replace(/:/g, '\\:');
    const notCast = NOT_A_CAST_AFTER.join('|');
    const pattern = new RegExp(
        `\\(\\s*(?:const\\s+)?(?:unsigned\\s+|signed\\s+)?(?:${types})\\s*\\**\\s*\\)\\s*(?!(?:${notCast})\\b)[A-Za-z_(&*]`);
    for (let i = 0; i < cleanLines.length; ++i) {
        if (!pattern.test(cleanLines[i])) continue;
        problems.push(formatProblem(i, lines, 'C-cast — dùng static_cast/reinterpret_cast kèm lý do (mục III.2)'));
    }
}

// Mục V.2 — thân guard nằm gọn một dòng. Bắt dòng chỉ gồm đầu `if (...)`, `else if (...)` hay
// `else` mà không có thân và không mở khối: clang-format đã đẩy thân xuống dòng dưới vì dòng quá
// 100 cột. Cách chữa là đặt tên cho điều kiện hay rút ngắn thông điệp, không phải nới lề. Điều kiện
// trải nhiều dòng rồi mới đóng ngoặc ở dòng sau thì không bắt (dòng đầu không kết thúc bằng ")").
function checkSplitGuard(cleanLines, lines, problems) {
    for (let i = 0; i < cleanLines.length; ++i) {
        if (!isBareGuardHead(cleanLines[i].trim())) continue;
        problems.push(formatProblem(i, lines, 'thân if/else nằm ở dòng sau — viết một dòng hoặc mở khối (mục V.2)'));
    }
}

function isBareGuardHead(trimmed) {
    if (/^(\}\s*)?else$/.test(trimmed)) return true;
    if (!/^(\}\s*)?(else\s+)?if\s*\(/.test(trimmed)) return false;
    if (!trimmed.endsWith(')')) return false;
    const open = trimmed.indexOf('(');
    return findMatchingParen(trimmed, open) === trimmed.length - 1;
}

// Mục 0.3 — mỗi TODO phải có mục tương ứng trong docs/NGHI-NGO.md.
function checkTodoRegistered(lines, file, problems) {
    const registry = readTodoRegistry(file);
    for (let i = 0; i < lines.length; ++i) {
        reportTodoLine(lines[i], i, lines, registry, problems);
    }
}

function reportTodoLine(line, index, lines, registry, problems) {
    const match = /TODO\(([^)]*)\)/.exec(line);
    if (match === null) return reportBareTodo(line, index, lines, problems);
    if (registry === null) {
        problems.push(formatProblem(index, lines, 'TODO nhưng không có docs/NGHI-NGO.md — mục 0.3'));
        return;
    }
    if (registry.includes(match[1].trim())) return;
    problems.push(formatProblem(index, lines, `TODO "${match[1].trim()}" chưa có mục trong docs/NGHI-NGO.md`));
}

// Chỉ tính là đánh dấu TODO khi có `:` hoặc `(` ngay sau — chữ TODO trong văn
// xuôi của comment không phải một mục nợ.
function reportBareTodo(line, index, lines, problems) {
    if (!/\bTODO\s*[(:]/.test(line)) return;
    problems.push(formatProblem(index, lines, 'TODO thiếu mô tả — phải viết `TODO(mô tả ngắn):` (mục 0.3)'));
}

// Đi ngược lên cây thư mục tìm docs/NGHI-NGO.md, giống cách clang-format tìm config.
function readTodoRegistry(file) {
    let dir = path.dirname(path.resolve(file));
    for (let depth = 0; depth < 12; ++depth) {
        const candidate = path.join(dir, 'docs', 'NGHI-NGO.md');
        if (fs.existsSync(candidate)) return fs.readFileSync(candidate, 'utf8');
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
    return null;
}

function checkConstitutionRules(lines, cleanLines, file) {
    const problems = [];
    const isHeader = isHeaderFile(file);
    checkDoxygen(lines, problems);
    checkUsingNamespace(lines, cleanLines, isHeader, problems);
    checkBareNewDelete(lines, cleanLines, problems);
    checkPragmaOnce(lines, isHeader, problems);
    checkFileHeaderLength(lines, problems);
    checkCStyleCast(lines, cleanLines, problems);
    checkTodoRegistered(lines, file, problems);
    checkSplitGuard(cleanLines, lines, problems);
    return problems;
}

// -------------------------------------------------------------------- chạy

function formatProblem(lineIndex, lines, message) {
    return `${lineIndex + 1}: ${message}\n    | ${lines[lineIndex].trim()}`;
}

function checkOneFile(file) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    const cleanLines = stripCommentsAndStrings(text).split(/\r?\n/);
    const problems = [
        ...checkNesting(lines, cleanLines),
        ...checkStaircase(lines, cleanLines),
        ...checkConstitutionRules(lines, cleanLines, file),
    ];
    return applyExemptions(problems, lines).sort(byLineNumber);
}

// ------------------------------------------------ miễn trừ: `// style-ok(lý do):`
//
// Luật "chất lượng thắng hình thức": khi bản đúng hình thức chứng minh được là tệ hơn (chậm hơn có
// số đo, che bất biến), người viết được giữ bản tốt hơn bằng một dấu ngay trên dòng vi phạm, hoặc
// cuối chính dòng đó:
//
//     // style-ok(vòng nóng, tách hàm mất inline, đo chậm 30%):
//
// Phép kiểm clang-format KHÔNG miễn được ở đây. Ba luật giữ cho lối thoát không thành lỗ hổng:
//   - lý do rỗng là vi phạm, vì miễn trừ không lý do là giấu nợ;
//   - dấu không che vi phạm nào là vi phạm, vì miễn trừ mồ côi là một lời nói dối còn sót lại
//     sau khi mã đã được sửa;
//   - mỗi dấu chỉ che đúng dòng của nó và dòng ngay dưới.
const EXEMPTION_PATTERN = /\/\/\s*style-ok\s*(?:\(([^)]*)\))?\s*:?/;

function applyExemptions(problems, lines) {
    const markers = findExemptionMarkers(lines);
    const covered = new Set();
    const kept = problems.filter((problem) => !isExempted(problem, markers, covered));
    return [...kept, ...reportBadMarkers(markers, covered, lines)];
}

function findExemptionMarkers(lines) {
    const markers = [];
    for (let i = 0; i < lines.length; ++i) {
        const match = EXEMPTION_PATTERN.exec(lines[i]);
        if (match === null) continue;
        markers.push({ line: i, reason: (match[1] || '').trim() });
    }
    return markers;
}

// Vi phạm ở dòng N (đếm từ 1) được che bởi dấu ở dòng N hoặc N-1, và chỉ khi dấu có lý do.
function isExempted(problem, markers, covered) {
    const index = Number.parseInt(problem, 10) - 1;
    const marker = markers.find((m) => m.reason !== '' && (m.line === index || m.line === index - 1));
    if (marker === undefined) return false;
    covered.add(marker.line);
    return true;
}

function reportBadMarkers(markers, covered, lines) {
    const problems = [];
    for (const marker of markers) {
        if (marker.reason === '') {
            problems.push(formatProblem(marker.line, lines, 'style-ok thiếu lý do — viết `style-ok(lý do):`'));
            continue;
        }
        if (covered.has(marker.line)) continue;
        problems.push(formatProblem(marker.line, lines, 'style-ok không che vi phạm nào — xoá dấu này'));
    }
    return problems;
}

function byLineNumber(a, b) {
    return Number.parseInt(a, 10) - Number.parseInt(b, 10);
}

function reportFile(file, problems) {
    console.error(`\n${file}`);
    for (const problem of problems) console.error(`  ${problem}`);
}

function main(argv) {
    const skipFormat = argv.includes('--no-format');
    const targets = argv.filter((a) => !a.startsWith('--'));
    if (targets.length === 0) {
        console.error('Dùng: node check_style.js <thư-mục-hoặc-file> [...] [--no-format]');
        return 2;
    }

    const files = [];
    const pathErrors = targets.map((t) => collectSources(t, files)).filter((e) => e !== null);
    if (pathErrors.length > 0) {
        for (const message of pathErrors) console.error(`check_style: ${message}`);
        return 2;
    }
    if (files.length === 0) {
        console.error('Không tìm thấy file nguồn C/C++ nào.');
        return 2;
    }

    let failures = 0;
    for (const file of files) failures += runFileChecks(file);
    failures += runFormatCheck(files, skipFormat);

    if (failures === 0) console.log(`check_style: SACH — ${files.length} file.`);
    return failures === 0 ? 0 : 1;
}

function runFileChecks(file) {
    const problems = checkOneFile(file);
    if (problems.length === 0) return 0;
    reportFile(file, problems);
    return problems.length;
}

function runFormatCheck(files, skipFormat) {
    if (skipFormat) return 0;
    const formatProblems = runClangFormat(files);
    if (formatProblems.length === 0) return 0;
    console.error('\nclang-format:');
    for (const line of formatProblems) console.error(`  ${line}`);
    return formatProblems.length;
}

process.exit(main(process.argv.slice(2)));

// ============================================================================
// GIỚI HẠN ĐÃ BIẾT — đọc trước khi tin tuyệt đối vào kết quả
//
// Đây là bộ quét theo dòng, không phải trình phân tích cú pháp C++. Nó bắt tốt
// những hình dạng đã tái phạm thật, nhưng có thể sai ở:
//   - macro nhiều dòng có chứa dấu ngoặc lệch cặp
//   - chuỗi thô R"(...)" — nội dung không được bóc như chuỗi thường
//   - template có dấu `<` `>` lồng nhiều tầng trên nhiều dòng
//   - khởi tạo T{...} / mảng trải nhiều dòng: được gom, nhưng R1 cho phép đúng hai
//     mức lệch 4 nên `return T{\n    .x = ...` vẫn sạch — bắt lồng T{ trong lời gọi
//   - `{` thân hàm/if/enum/lambda cố ý không gom (tránh cả hàm thành một câu lệnh)
// Gặp báo sai thì SỬA BỘ QUÉT hoặc tách đoạn code đó ra, đừng nới .clang-format.
// ============================================================================

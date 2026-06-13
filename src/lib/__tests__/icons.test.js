// Guards against the recurring "icon shows as raw text" bug. <Icon> renders its
// name as a Material Symbols ligature; any name that is neither a valid Material
// Symbol nor healed by lib/iconAliases.js renders as literal text on the live site.
//
// This test scans every icon-name string literal in src/ and asserts it resolves
// to a real Material Symbol. It runs on Node's built-in runner (no extra deps):
//   node --test src/lib/__tests__
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveIconName, ICON_ALIASES } from '../iconAliases.js';

// src/ root, resolved relative to this file so the test is cwd-independent.
var SRC_ROOT = fileURLToPath(new URL('../../', import.meta.url));

// Authoritative Material Symbols Outlined name set (snapshot of Google's codepoints,
// 4257 names). Regenerate from the upstream codepoints file if the icon font is bumped.
var VALID = new Set(JSON.parse(
  readFileSync(new URL('./material-symbols-names.json', import.meta.url), 'utf8')
));

// Recursively collect .js/.jsx source files, skipping tests and generated output.
function collectSourceFiles(dir) {
  var out = [];
  readdirSync(dir).forEach(function (entry) {
    if (entry === '__tests__' || entry === 'node_modules' || entry === 'graphify-out') return;
    var full = dir + entry;
    var st = statSync(full);
    if (st.isDirectory()) {
      out = out.concat(collectSourceFiles(full + '/'));
    } else if (/\.(js|jsx)$/.test(entry)) {
      out.push(full);
    }
  });
  return out;
}

// Extract icon-name string literals from a file's text. Covers the four authoring
// surfaces: object `icon:` fields, <Icon name="...">, <Icon>literal</Icon>, and
// `icon="..."` props (Btn, etc.). Dynamic expressions (name={...}) are developer
// controlled and resolve to valid names by construction, so they are not scanned.
var PATTERNS = [
  /\bicon\s*:\s*['"]([^'"\n]+)['"]/g,                       // icon: 'x'
  /<Icon\b[^>]*?\bname\s*=\s*['"]([^'"\n]+)['"]/g,          // <Icon name="x"
  /<Icon\b[^>]*?>\s*([A-Za-z][A-Za-z0-9_]*)\s*<\/Icon>/g,   // <Icon>x</Icon>
  /\bicon\s*=\s*['"]([^'"\n]+)['"]/g                         // icon="x"
];

function extractIconNames(text) {
  var names = [];
  PATTERNS.forEach(function (re) {
    re.lastIndex = 0;
    var m;
    while ((m = re.exec(text)) !== null) names.push(m[1]);
  });
  return names;
}

test('every alias target is a real Material Symbol', function () {
  var bad = Object.keys(ICON_ALIASES).filter(function (k) {
    return !VALID.has(ICON_ALIASES[k]);
  });
  assert.deepEqual(bad, [], 'ICON_ALIASES maps to unknown Material Symbol(s): ' +
    bad.map(function (k) { return k + ' -> ' + ICON_ALIASES[k]; }).join(', '));
});

test('every icon name in src/ resolves to a real Material Symbol', function () {
  var files = collectSourceFiles(SRC_ROOT);
  var failures = [];
  files.forEach(function (file) {
    var text = readFileSync(file, 'utf8');
    extractIconNames(text).forEach(function (raw) {
      var resolved = resolveIconName(raw);
      if (!VALID.has(resolved)) {
        failures.push({
          file: file.slice(SRC_ROOT.length),
          raw: raw,
          resolved: resolved
        });
      }
    });
  });

  if (failures.length > 0) {
    var seen = {};
    var lines = failures.filter(function (f) {
      var key = f.raw;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }).map(function (f) {
      var hint = f.raw === f.resolved ? '' : ' (alias -> ' + f.resolved + ')';
      return '  "' + f.raw + '"' + hint + '  e.g. ' + f.file;
    });
    assert.fail(failures.length + ' icon name(s) will render as raw text. ' +
      'Use a valid Material Symbols name or add an alias in lib/iconAliases.js:\n' +
      lines.join('\n'));
  }
});

#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_ROOT = path.join(__dirname, '..', 'Codebase');
const SRC_ROOT = path.join(__dirname, '..', 'src');

if (!fs.existsSync(VAULT_ROOT)) fs.mkdirSync(VAULT_ROOT, { recursive: true });

function parseFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const functions = [];
  lines.forEach((line, idx) => {
    if (line.match(/export\s+(function|const|var|async)/)) {
      const match = line.match(/(function|const|var)\s+(\w+)/);
      if (match) functions.push({ name: match[2], line: idx + 1 });
    }
  });
  return { functions, lineCount: lines.length };
}

function generateNote(relPath, fileInfo) {
  const fileName = path.basename(relPath, '.js');
  const displayPath = `src/${relPath}`;
  let content = `# ${fileName}\n\n\`${displayPath}\` (${fileInfo.lineCount} lines)\n\n`;
  if (fileInfo.functions.length > 0) {
    content += `## Exports\n`;
    fileInfo.functions.forEach(fn => content += `- ${fn.name}() (line ${fn.line})\n`);
  }
  return content;
}

function walkDir(dir, relative = '') {
  fs.readdirSync(dir).forEach(item => {
    const fullPath = path.join(dir, item);
    const relPath = path.join(relative, item);
    if (fs.statSync(fullPath).isDirectory()) {
      const vaultDir = path.join(VAULT_ROOT, relPath);
      if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });
      walkDir(fullPath, relPath);
    } else if (item.endsWith('.js') && !item.startsWith('.')) {
      const fileInfo = parseFile(fullPath);
      const note = generateNote(relPath, fileInfo);
      const notePath = path.join(VAULT_ROOT, relPath.replace('.js', '.md'));
      fs.writeFileSync(notePath, note);
      console.log(`✓ ${relPath}`);
    }
  });
}

walkDir(SRC_ROOT);
console.log(`\n✅ Generated: ${VAULT_ROOT}`);

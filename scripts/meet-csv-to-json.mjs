// One-shot CSV -> JSON converter for the Meet cheatsheet.
// Run: node scripts/meet-csv-to-json.mjs
import { readFileSync, writeFileSync } from 'node:fs';

function parseCSV(text) {
  var rows = [];
  var row = [];
  var cell = '';
  var i = 0;
  var inQuotes = false;
  var len = text.length;

  while (i < len) {
    var ch = text.charCodeAt(i);

    if (inQuotes) {
      if (ch === 34 /* " */) {
        if (i + 1 < len && text.charCodeAt(i + 1) === 34) {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += text[i];
      i += 1;
      continue;
    }

    if (ch === 34) {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === 44 /* , */) {
      row.push(cell);
      cell = '';
      i += 1;
      continue;
    }
    if (ch === 13 /* \r */) {
      i += 1;
      continue;
    }
    if (ch === 10 /* \n */) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
      continue;
    }
    cell += text[i];
    i += 1;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

var csv = readFileSync('src/donut17/data/meet.csv', 'utf8');
var rows = parseCSV(csv);
if (rows.length === 0) {
  console.error('No rows parsed');
  process.exit(1);
}

var header = rows[0].map(function (h) { return h.trim(); });
var body = rows.slice(1).filter(function (r) {
  return r.some(function (c) { return c && c.trim().length > 0; });
});

var keyMap = {
  'Condition Type': 'type',
  'Stage': 'stage',
  'Condition': 'condition',
  'Comp': 'comp',
  'Notes': 'notes'
};

var entries = body.map(function (r, idx) {
  var obj = { id: idx + 1 };
  header.forEach(function (h, i) {
    var key = keyMap[h] || h.toLowerCase();
    obj[key] = (r[i] || '').trim();
  });
  return obj;
});

writeFileSync('src/donut17/data/meet.json', JSON.stringify(entries, null, 2));
console.log('Wrote ' + entries.length + ' entries to src/donut17/data/meet.json');

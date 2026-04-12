import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
var target = process.argv[2];
var files;
if (target) {
  files = [target.endsWith('.html') ? target : target + '.html'];
} else {
  files = [];
  var walk = function(dir, rel){
    var entries = fs.readdirSync(dir);
    for (var j = 0; j < entries.length; j++) {
      var e = entries[j];
      var p = path.join(dir, e);
      var r = rel ? rel + '/' + e : e;
      if (fs.statSync(p).isDirectory()) { walk(p, r); }
      else if (e.endsWith('.html') && !e.startsWith('_')) { files.push(r); }
    }
  };
  walk(__dirname, '');
  files.sort();
}
var browser = await chromium.launch();
for (var i = 0; i < files.length; i++) {
  var f = files[i];
  var url = 'file:///' + path.join(__dirname, f).replace(/\\/g,'/');
  var page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1200, height: 2000 } });
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.evaluate(function(){ return document.fonts.ready; });
  var dims = await page.evaluate(function(){
    var el = document.querySelector('.ad');
    var r = el.getBoundingClientRect();
    return { w: Math.ceil(r.width), h: Math.ceil(r.height) };
  });
  await page.setViewportSize({ width: dims.w, height: dims.h });
  await page.waitForTimeout(500);
  var out = path.join(__dirname, f.replace('.html','.png'));
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: dims.w, height: dims.h }, animations: 'disabled', timeout: 120000 });
  await page.close();
  console.log('✓', f.replace('.html','.png'), '(' + dims.w + 'x' + dims.h + ')');
}
await browser.close();

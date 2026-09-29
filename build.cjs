#!/usr/bin/env node
// Dựng lại index.html, en/index.html, chinh-sach-du-lieu.html từ content.json
// Dùng: node build.cjs
const fs = require('fs'), path = require('path');
const R = require('./render.js');
const c = JSON.parse(fs.readFileSync(path.join(__dirname, 'content.json'), 'utf8'));
const out = R.renderSite(c);
for (const [f, html] of Object.entries(out)) {
  const p = path.join(__dirname, f);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html);
  console.log('✓', f, html.length, 'bytes');
}

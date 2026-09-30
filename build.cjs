#!/usr/bin/env node
// Dựng lại site từ content.json.
// Dùng:
//   node build.cjs
//   node build.cjs --out _site
const fs = require('fs'), path = require('path');
const R = require('./render.js');

const ROOT = __dirname;
const args = process.argv.slice(2);

function argValue(name) {
  const inline = args.find(function (arg) { return arg.indexOf(name + '=') === 0; });
  if (inline) return inline.slice(name.length + 1);
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return;
  const stat = fs.statSync(from);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (stat.isDirectory()) {
    fs.cpSync(from, to, { recursive: true });
  } else {
    fs.copyFileSync(from, to);
  }
}

function writeRendered(outDir, rendered) {
  for (const [f, html] of Object.entries(rendered)) {
    const p = path.join(outDir, f);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, html);
    console.log('✓', path.relative(ROOT, p) || f, html.length, 'bytes');
  }
}

function copyPublicFiles(outDir) {
  const entries = [
    'assets',
    'admin',
    'render.js',
    'content.json',
    'CNAME',
    'robots.txt',
    'sitemap.xml',
    '.nojekyll',
    'style.css',
    'layout-v2.css',
    'layout-v3.css',
    'layout-v5.css',
    'lotus-spirit.css',
    'lotus-form.css',
    'languages.css',
    'app-v3.js',
    'layout-v2.js',
    'layout-v4.js',
    'lotus-form.js',
    'languages.js'
  ];

  for (const name of entries) {
    copyIfExists(path.join(ROOT, name), path.join(outDir, name));
  }
}

const outArg = argValue('--out');
const outDir = outArg ? path.resolve(ROOT, outArg) : ROOT;
const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'content.json'), 'utf8'));
const rendered = R.renderSite(content);

if (outArg) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  copyPublicFiles(outDir);
}

writeRendered(outDir, rendered);

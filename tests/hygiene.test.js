'use strict';
/* Guards the public repository against personal and non-English traces coming back.
   The stop words are stored encoded so that this file itself stays clean. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { root } = require('./load');

const STOP = Buffer.from('Q2hpcCBDYXJkCkFTRUUKQXNzZWNvClVubGltaXQKUmFtYmxlcgpEb3RvClNwYWNlMzA3ClN1bVN1YgpLYXNoaXRzeW5hCkJlbGdyYWRlCnZhY2FuY3kKcmVjcnVpdGVyCmxlYXJuaW5nLXRyYWNrCkNsYXVkZQpBbnRocm9waWMKQ28tQXV0aG9yZWQKU2FsZXNmb3JjZQpUYXRpYW5h', 'base64').toString('utf8').split('\n');
const STOP_RE = STOP.map(w => ({ w, re: new RegExp('(^|[^A-Za-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*') + '($|[^A-Za-z0-9])', 'i') }));

const TEXT_EXT = new Set(['.js', '.html', '.css', '.md', '.json', '.yml', '.yaml', '.txt', '.py', '.kt', '.kts', '.toml', '.ini', '.properties', '']);

function trackedTextFiles() {
  let list;
  try {
    list = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch (e) {
    list = null;
  }
  if (!list) {
    list = [];
    const walk = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).forEach(e => {
      const rel = d ? d + '/' + e.name : e.name;
      if (e.isDirectory()) { if (!['.git', 'node_modules', 'notes', '.playwright-mcp', '.venv', '.gradle', 'build'].includes(e.name)) walk(rel); } else list.push(rel);
    });
    walk('');
  }
  return list.filter(f => TEXT_EXT.has(path.extname(f).toLowerCase()) && fs.existsSync(path.join(root, f)));
}

const files = trackedTextFiles();

test('there are files to check', () => {
  assert.ok(files.length > 10, 'found ' + files.length);
  assert.ok(files.includes('index.html'));
});

test('no Cyrillic text in any tracked text file', () => {
  const bad = files.filter(f => /[\u0400-\u04FF]/.test(fs.readFileSync(path.join(root, f), 'utf8')));
  assert.deepEqual(bad, []);
});

test('no long dashes in any tracked text file', () => {
  const bad = files.filter(f => /[\u2014\u2015]/.test(fs.readFileSync(path.join(root, f), 'utf8')));
  assert.deepEqual(bad, []);
});

test('no stop words (employers, names, tools, job-posting traces) in any tracked text file', () => {
  const hits = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    for (const s of STOP_RE) if (s.re.test(text)) hits.push(f + ': stop word #' + STOP.indexOf(s.w));
  }
  assert.deepEqual(hits, []);
});

test('no third-party requests in the page and the styles', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'assets/styles.css'), 'utf8') + fs.readFileSync(path.join(root, 'assets/fonts.css'), 'utf8');
  const bad = (html.match(/(?:src|href)="https?:\/\/[^"]+"/g) || []).filter(x => !/panipanda\.github\.io/.test(x));
  assert.deepEqual(bad, []);
  assert.deepEqual(css.match(/url\(["']?https?:/g) || [], []);
});

test('the scripts never call the network', () => {
  const bad = [];
  for (const f of files.filter(f => f.startsWith('js/'))) {
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    if (/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|importScripts/.test(text)) bad.push(f);
  }
  assert.deepEqual(bad, []);
});

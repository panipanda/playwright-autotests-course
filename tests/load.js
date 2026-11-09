'use strict';
/* Test helper: loads the browser scripts into an isolated vm context, the same files in the same order as index.html.
   Files that do not exist yet are skipped, so the loader works at every stage of the build. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const FILES = [
  'js/lib.js', 'js/runner.js', 'js/sandbox.js', 'js/core.js', 'js/widgets.js', 'js/trainers.js',
  'content/en/modules-1-4.js', 'content/en/modules-5-8.js', 'content/en/modules-9-12.js',
  'content/en/cards.js', 'content/en/glossary.js', 'content/en/sources.js'
];

function loadCourse() {
  const src = FILES.filter(f => fs.existsSync(path.join(root, f))).map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
  return vm.runInNewContext(src + '\n;({COURSE,CARDS,GLOSS,WIDGETS,LABS,SCENES,SOURCES,SNIPPETS})', {});
}

module.exports = { root, FILES, loadCourse };

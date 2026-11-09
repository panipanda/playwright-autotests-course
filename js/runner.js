'use strict';
/* A small Playwright simulator for the code lab. It reads a safe subset of the Playwright API written in Python or
   Kotlin (Playwright for Java), and runs it against a tiny virtual page with a virtual clock.
   It is a teaching tool: it is not a browser and it never touches the network. No DOM access here, so Node can test it. */

const PW = (function () {
  /* ---------- errors ---------- */
  class PwError extends Error {
    constructor(kind, message, extra) { super(message); this.kind = kind; if (extra) Object.assign(this, extra); }
  }
  const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const q = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

  /* ---------- the API names in both languages: key -> [Python name, Kotlin name] ---------- */
  const FIND = {
    locator: ['locator', 'locator'], getByRole: ['get_by_role', 'getByRole'], getByText: ['get_by_text', 'getByText'],
    getByLabel: ['get_by_label', 'getByLabel'], getByPlaceholder: ['get_by_placeholder', 'getByPlaceholder'],
    getByTestId: ['get_by_test_id', 'getByTestId'], getByAltText: ['get_by_alt_text', 'getByAltText'], getByTitle: ['get_by_title', 'getByTitle']
  };
  const PAGE_M = Object.assign({
    goto: ['goto', 'navigate'], reload: ['reload', 'reload'], title: ['title', 'title'], url: ['url', 'url'],
    waitForTimeout: ['wait_for_timeout', 'waitForTimeout'], setDefaultTimeout: ['set_default_timeout', 'setDefaultTimeout']
  }, FIND);
  const LOC_M = Object.assign({
    filter: ['filter', 'filter'], first: ['first', 'first'], last: ['last', 'last'], nth: ['nth', 'nth'],
    click: ['click', 'click'], dblclick: ['dblclick', 'dblclick'], fill: ['fill', 'fill'], clear: ['clear', 'clear'],
    check: ['check', 'check'], uncheck: ['uncheck', 'uncheck'], selectOption: ['select_option', 'selectOption'],
    press: ['press', 'press'], hover: ['hover', 'hover'], focus: ['focus', 'focus'], count: ['count', 'count'],
    innerText: ['inner_text', 'innerText'], textContent: ['text_content', 'textContent'], inputValue: ['input_value', 'inputValue'],
    isVisible: ['is_visible', 'isVisible'], isHidden: ['is_hidden', 'isHidden'], isEnabled: ['is_enabled', 'isEnabled'],
    isDisabled: ['is_disabled', 'isDisabled'], isChecked: ['is_checked', 'isChecked'], getAttribute: ['get_attribute', 'getAttribute'],
    allInnerTexts: ['all_inner_texts', 'allInnerTexts'], allTextContents: ['all_text_contents', 'allTextContents'], waitFor: ['wait_for', 'waitFor']
  }, FIND);
  const EXP_M = {
    toBeVisible: ['to_be_visible', 'isVisible'], toBeHidden: ['to_be_hidden', 'isHidden'], toBeEnabled: ['to_be_enabled', 'isEnabled'],
    toBeDisabled: ['to_be_disabled', 'isDisabled'], toBeChecked: ['to_be_checked', 'isChecked'], toBeEmpty: ['to_be_empty', 'isEmpty'],
    toHaveText: ['to_have_text', 'hasText'], toContainText: ['to_contain_text', 'containsText'], toHaveValue: ['to_have_value', 'hasValue'],
    toHaveCount: ['to_have_count', 'hasCount'], toHaveURL: ['to_have_url', 'hasURL'], toHaveTitle: ['to_have_title', 'hasTitle'],
    toHaveAttribute: ['to_have_attribute', 'hasAttribute']
  };
  const LANGIDX = { py: 0, kt: 1 };
  function lookupName(table, raw, lang) {
    const i = LANGIDX[lang];
    for (const key of Object.keys(table)) if (table[key][i] === raw) return { key };
    for (const key of Object.keys(table)) if (table[key][1 - i] === raw) return { key: null, hint: table[key][i] };
    return { key: null };
  }
  const ROLES = new Set('alert alertdialog application article banner blockquote button caption cell checkbox code columnheader combobox complementary contentinfo definition deletion dialog directory document emphasis feed figure form generic grid gridcell group heading img insertion link list listbox listitem log main marquee math menu menubar menuitem menuitemcheckbox menuitemradio meter navigation none note option paragraph presentation progressbar radio radiogroup region row rowgroup rowheader scrollbar search searchbox separator slider spinbutton status strong subscript superscript switch tab table tablist tabpanel term textbox time timer toolbar tooltip tree treegrid treeitem'.split(' '));

  /* ---------- tokenizer ---------- */
  function tokenize(src, lang) {
    const toks = []; const n = src.length; let i = 0, line = 1, depth = 0;
    const push = (t, v, start, extra) => toks.push(Object.assign({ t, v, line, pos: start, end: i }, extra));
    const isIdStart = c => /[A-Za-z_]/.test(c), isId = c => /[A-Za-z0-9_]/.test(c);
    while (i < n) {
      const c = src[i], start = i;
      if (c === '\r') { i++; continue; }
      if (c === '\n') { i++; if (depth <= 0) push('nl', '\n', start); line++; continue; }
      if (c === ' ' || c === '\t') { i++; continue; }
      if (lang === 'py' && c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
      if (lang === 'kt' && c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (lang === 'kt' && c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2; line += (src.slice(i, end).match(/\n/g) || []).length; i = end; continue; }
      /* strings, with an optional Python prefix such as r, f, b */
      let pre = '', j = i;
      if (lang === 'py' && /[rRfFbBuU]/.test(c)) { let k = i; while (k < n && k - i < 2 && /[rRfFbBuU]/.test(src[k])) k++; if (src[k] === '"' || src[k] === "'") { pre = src.slice(i, k).toLowerCase(); j = k; } }
      if (src[j] === '"' || src[j] === "'") {
        const qc = src[j]; const triple = src.substr(j, 3) === qc + qc + qc;
        let k = j + (triple ? 3 : 1), out = '', tpl = pre.includes('f'), closed = false;
        const raw = pre.includes('r');
        while (k < n) {
          const d = src[k];
          if (triple ? src.substr(k, 3) === qc + qc + qc : d === qc) { k += triple ? 3 : 1; closed = true; break; }
          if (d === '\n') { if (!triple) break; line++; }
          if (d === '\\' && !raw) {
            const e = src[k + 1]; k += 2;
            out += e === 'n' ? '\n' : e === 't' ? '\t' : e === '$' ? '$' : e === undefined ? '' : e;
            continue;
          }
          if (lang === 'kt' && d === '$' && /[A-Za-z{]/.test(src[k + 1] || '')) tpl = true;
          out += d; k++;
        }
        if (!closed) throw new PwError('syntax', lang === 'py' ? 'SyntaxError: unterminated string literal (line ' + line + ')' : 'Syntax error on line ' + line + ': unclosed string literal', { line });
        i = k; push('str', out, start, { tpl }); continue;
      }
      if (/[0-9]/.test(c)) {
        let k = i; while (k < n && /[0-9_]/.test(src[k])) k++;
        if (src[k] === '.' && /[0-9]/.test(src[k + 1] || '')) { k++; while (k < n && /[0-9_]/.test(src[k])) k++; }
        const v = parseFloat(src.slice(i, k).replace(/_/g, ''));
        if (lang === 'kt' && /[LlFf]/.test(src[k] || '') && !isId(src[k + 1] || ' ')) k++;
        i = k; push('num', v, start); continue;
      }
      if (isIdStart(c)) { let k = i; while (k < n && isId(src[k])) k++; i = k; push('id', src.slice(start, k), start); continue; }
      const two = src.substr(i, 2);
      if (['==', '!=', '<=', '>=', '->', '?.', '::', '+=', '-='].includes(two)) { i += 2; push('op', two, start); continue; }
      if ('()[]{}.,:;=+-*/<>!@?%'.includes(c)) {
        i++; if (c === '(' || c === '[') depth++; if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
        push('op', c, start); continue;
      }
      throw new PwError('syntax', lang === 'py' ? 'SyntaxError: invalid character "' + c + '" (line ' + line + ')' : 'Syntax error on line ' + line + ': unexpected character "' + c + '"', { line });
    }
    push('eof', '', n);
    /* a line that starts with "." continues the previous statement; ";" ends a statement */
    const out = [];
    for (let k = 0; k < toks.length; k++) {
      const t = toks[k];
      if (t.t === 'op' && t.v === ';') { out.push(Object.assign({}, t, { t: 'nl', v: '\n' })); continue; }
      if (t.t === 'nl') {
        let m = k + 1; while (toks[m] && toks[m].t === 'nl') m++;
        if (toks[m] && toks[m].t === 'op' && (toks[m].v === '.' || toks[m].v === '?.')) { k = m - 1; continue; }
      }
      out.push(t);
    }
    return out;
  }

  /* ---------- parser: both languages produce the same tree ---------- */
  const PY_SKIP = new Set(['import', 'from', 'def', 'class', 'pass', 'async']);
  const PY_NO = new Set(['with', 'for', 'while', 'if', 'elif', 'else', 'try', 'except', 'finally', 'raise', 'lambda', 'await', 'global', 'del']);
  const KT_HEADER = new Set(['class', 'object', 'interface', 'fun', 'private', 'public', 'internal', 'override', 'lateinit', 'companion', 'open', 'abstract', 'suspend', 'data', 'protected']);
  const KT_NO = new Set(['if', 'for', 'while', 'when', 'try', 'do', 'return', 'throw']);

  function parseProgram(src, lang) {
    const toks = tokenize(src, lang); let p = 0;
    const peek = () => toks[p];
    const bad = (t, why) => {
      const v = t.t === 'eof' ? 'end of the code' : t.t === 'nl' ? 'the end of the line' : '"' + t.v + '"';
      throw new PwError('syntax', lang === 'py' ? 'SyntaxError: invalid syntax, unexpected ' + v + ' (line ' + t.line + ')' + (why ? '. ' + why : '') : 'Syntax error on line ' + t.line + ': unexpected ' + v + (why ? '. ' + why : ''), { line: t.line });
    };
    const unsupported = (t, what) => { throw new PwError('unsupported', 'The code lab does not support ' + what + ' (line ' + t.line + '). Keep the test body to plain statements: locators, actions and assertions. On your own computer this works without limits.', { line: t.line }); };
    const isOp = (t, v) => t.t === 'op' && t.v === v;
    const skipLine = () => { while (peek().t !== 'nl' && peek().t !== 'eof') p++; };

    function parsePrimary() {
      const t = toks[p];
      if (t.t === 'str') { p++; return { k: 'str', v: t.v, tpl: t.tpl, line: t.line }; }
      if (t.t === 'num') { p++; return { k: 'num', v: t.v, line: t.line }; }
      if (t.t === 'id' && lang === 'kt' && t.v === 'new') bad(t, 'Kotlin has no "new" keyword: write Page.GetByRoleOptions() directly');
      if (t.t === 'id') { p++; return { k: 'id', name: t.v, line: t.line }; }
      if (isOp(t, '(')) { p++; const e = parseExpr(); if (!isOp(peek(), ')')) bad(peek(), 'A closing ")" is missing'); p++; return e; }
      if (isOp(t, '[')) {
        p++; const items = [];
        while (!isOp(peek(), ']')) { if (peek().t === 'eof') bad(peek(), 'A closing "]" is missing'); items.push(parseExpr()); if (isOp(peek(), ',')) p++; else break; }
        if (!isOp(peek(), ']')) bad(peek(), 'A closing "]" is missing'); p++;
        return { k: 'list', items, line: t.line };
      }
      if (isOp(t, '-') && toks[p + 1].t === 'num') { p += 2; return { k: 'num', v: -toks[p - 1].v, line: t.line }; }
      return bad(t);
    }
    function parseArgs() {
      const args = [];
      while (!isOp(peek(), ')')) {
        if (peek().t === 'eof' || peek().t === 'nl') bad(peek(), 'A closing ")" is missing');
        let name = null;
        if (peek().t === 'id' && isOp(toks[p + 1], '=')) { name = peek().v; p += 2; }
        args.push({ name, value: parseExpr() });
        if (isOp(peek(), ',')) p++; else break;
      }
      if (!isOp(peek(), ')')) bad(peek(), 'A closing ")" is missing');
      p++; return args;
    }
    function parsePostfix() {
      let e = parsePrimary();
      for (;;) {
        const t = peek();
        if (isOp(t, '.') || isOp(t, '?.')) { p++; const id = peek(); if (id.t !== 'id') bad(id, 'A name is expected after "."'); p++; e = { k: 'member', obj: e, name: id.v, line: id.line }; }
        else if (isOp(t, '(')) { p++; const args = parseArgs(); e = { k: 'call', fn: e, args, line: t.line }; if (isOp(peek(), '{')) unsupported(peek(), 'lambdas and trailing blocks'); }
        else if (isOp(t, '[')) { p++; const idx = parseExpr(); if (!isOp(peek(), ']')) bad(peek(), 'A closing "]" is missing'); p++; e = { k: 'index', obj: e, idx, line: t.line }; }
        else break;
      }
      return e;
    }
    function parseUnary() {
      const t = peek();
      if ((lang === 'py' && t.t === 'id' && t.v === 'not') || (lang === 'kt' && isOp(t, '!'))) { p++; return { k: 'not', e: parseUnary(), line: t.line }; }
      return parsePostfix();
    }
    function parseExpr() {
      const left = parseUnary(); const t = peek();
      if (t.t === 'op' && (t.v === '==' || t.v === '!=')) { p++; return { k: 'cmp', op: t.v, a: left, b: parseUnary(), line: t.line }; }
      if (t.t === 'op' && ['+', '-', '*', '/', '%', '<', '>', '<=', '>='].includes(t.v)) unsupported(t, 'the operator "' + t.v + '"');
      return left;
    }
    function parseStatement() {
      let t = peek(); const startTok = t;
      if (lang === 'kt') {
        while (isOp(t, '@')) { p++; if (peek().t === 'id') p++; if (isOp(peek(), '(')) { p++; parseArgs(); } t = peek(); }
        if (t.t === 'id' && (t.v === 'package' || t.v === 'import')) { skipLine(); return null; }
        if (t.t === 'id' && KT_HEADER.has(t.v)) { while (peek().t !== 'eof' && !isOp(peek(), '{') && peek().t !== 'nl') p++; if (isOp(peek(), '{')) p++; return null; }
        if (isOp(t, '{') || isOp(t, '}')) { p++; return null; }
        if (t.t === 'id' && KT_NO.has(t.v)) unsupported(t, 'the keyword "' + t.v + '"');
        if (t.t === 'nl' || t.t === 'eof') return null;
        let declared = false;
        if (t.t === 'id' && (t.v === 'val' || t.v === 'var')) { p++; declared = true; t = peek(); }
        if (t.t === 'id' && (isOp(toks[p + 1], '=') || (declared && isOp(toks[p + 1], ':')))) {
          const name = t.v; p++;
          if (isOp(peek(), ':')) { p++; while (peek().t !== 'nl' && peek().t !== 'eof' && !isOp(peek(), '=')) p++; }
          if (!isOp(peek(), '=')) bad(peek(), 'An "=" is expected');
          p++; const value = parseExpr();
          return fin({ k: 'assign', name, value, line: t.line }, startTok);
        }
        if (declared) bad(peek(), 'A name and "=" are expected after val');
        return fin({ k: 'expr', e: parseExpr(), line: t.line }, startTok);
      }
      /* Python */
      if (isOp(t, '@')) { skipLine(); return null; }
      if (t.t === 'id' && PY_SKIP.has(t.v)) { skipLine(); return null; }
      if (t.t === 'id' && PY_NO.has(t.v)) unsupported(t, 'the keyword "' + t.v + '"');
      if (t.t === 'id' && t.v === 'return') { skipLine(); return null; }
      if (t.t === 'id' && t.v === 'assert') { p++; const e = parseExpr(); if (isOp(peek(), ',')) { p++; parseExpr(); } return fin({ k: 'assert', e, line: t.line }, startTok); }
      if (t.t === 'id' && isOp(toks[p + 1], '=')) { const name = t.v; p += 2; const value = parseExpr(); return fin({ k: 'assign', name, value, line: t.line }, startTok); }
      if (t.t === 'id' && isOp(toks[p + 1], ':') && toks[p + 2] && toks[p + 2].t === 'id') {
        const name = t.v; p += 2; while (peek().t !== 'nl' && peek().t !== 'eof' && !isOp(peek(), '=')) p++;
        if (!isOp(peek(), '=')) return null; p++; const value = parseExpr(); return fin({ k: 'assign', name, value, line: t.line }, startTok);
      }
      if (t.t === 'nl' || t.t === 'eof') return null;
      return fin({ k: 'expr', e: parseExpr(), line: t.line }, startTok);
    }
    function fin(st, startTok) {
      const t = peek();
      if (!(t.t === 'nl' || t.t === 'eof' || (lang === 'kt' && isOp(t, '}')))) bad(t, lang === 'py' ? 'Check the brackets and commas on this line' : 'Check the brackets and commas on this line');
      st.text = norm(src.slice(startTok.pos, toks[p - 1].end));
      return st;
    }
    const stmts = [];
    while (peek().t !== 'eof') {
      if (peek().t === 'nl') { p++; continue; }
      const st = parseStatement();
      if (st) stmts.push(st);
      else if (peek().t !== 'nl' && peek().t !== 'eof' && !isOp(peek(), '}') && !isOp(peek(), '{')) skipLine();
    }
    return stmts;
  }

  /* ---------- a small DOM ---------- */
  const VOID = new Set(['input', 'br', 'img', 'hr', 'meta', 'link']);
  const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  function mk(doc, tag, attrs) {
    const n = { id: ++doc.seq, tag, attrs: attrs || {}, children: [], parent: null, hidden: false, disabled: false, checked: false, value: '', key: '' };
    if (tag !== '#text' && tag !== '#root') {
      const a = n.attrs;
      if ('hidden' in a) { n.hidden = true; delete a.hidden; }
      if ('disabled' in a) { n.disabled = true; delete a.disabled; }
      if ('checked' in a) { n.checked = true; delete a.checked; }
      if ('data-key' in a) { n.key = a['data-key']; delete a['data-key']; }
      if ('value' in a) { n.value = a.value; delete a.value; }
    }
    doc.nodes.set(n.id, n); return n;
  }
  function textNode(doc, text) { const n = mk(doc, '#text'); n.text = text; return n; }
  function appendHTML(doc, parent, html) {
    const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
    const stack = [parent]; let m;
    while ((m = re.exec(html))) {
      const cur = stack[stack.length - 1];
      if (m[1]) { const tag = m[1].toLowerCase(); for (let k = stack.length - 1; k > 0; k--) if (stack[k].tag === tag) { stack.length = k; break; } }
      else if (m[2]) {
        const tag = m[2].toLowerCase(), attrs = {}; const ar = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g; let a;
        while ((a = ar.exec(m[3] || ''))) attrs[a[1]] = decode(a[2] != null ? a[2] : a[3] != null ? a[3] : a[4] != null ? a[4] : '');
        const n = mk(doc, tag, attrs); n.parent = cur; cur.children.push(n);
        if (!VOID.has(tag) && !m[4]) stack.push(n);
      } else if (m[5]) { const t = textNode(doc, decode(m[5])); t.parent = cur; cur.children.push(t); }
    }
    /* a select shows its first option unless one is marked as selected */
    for (const n of doc.nodes.values()) if (n.tag === 'select' && !n.value) { const o = descendants(n).find(x => x.tag === 'option'); if (o) n.value = optValue(o); }
  }
  const optValue = o => (o.value !== '' ? o.value : textOf(o, false));
  function newDoc(html) { const doc = { seq: 0, nodes: new Map(), root: null }; doc.root = mk(doc, '#root'); appendHTML(doc, doc.root, html); return doc; }
  function descendants(n, out) { out = out || []; for (const c of n.children) { if (c.tag !== '#text') out.push(c); descendants(c, out); } return out; }
  function isVisible(n) { for (let x = n; x && x.tag !== '#root'; x = x.parent) { if (x.hidden || /display\s*:\s*none/.test(x.attrs.style || '')) return false; } return true; }
  function textOf(n, onlyVisible) {
    let out = '';
    (function walk(x) {
      if (x.tag === '#text') { out += x.text; return; }
      if (onlyVisible !== false && (x.hidden || /display\s*:\s*none/.test(x.attrs.style || ''))) return;
      if (x.tag === 'input' && /^(button|submit|reset)$/.test(x.attrs.type || '')) { out += ' ' + x.value + ' '; return; }
      const block = /^(div|p|li|tr|h[1-6]|ul|ol|table|section|form|label|button|br)$/.test(x.tag);
      if (block) out += ' ';
      x.children.forEach(walk);
      if (block) out += ' ';
    })(n);
    return norm(out);
  }

  /* ---------- roles and accessible names ---------- */
  function roleOf(n) {
    const a = n.attrs;
    if (a.role) return a.role.split(/\s+/)[0];
    const t = n.tag, ty = (a.type || 'text').toLowerCase();
    if (t === 'button') return 'button';
    if (t === 'a') return 'href' in a ? 'link' : null;
    if (/^h[1-6]$/.test(t)) return 'heading';
    if (t === 'input') {
      if (/^(button|submit|reset|image)$/.test(ty)) return 'button';
      if (ty === 'checkbox') return 'checkbox';
      if (ty === 'radio') return 'radio';
      if (ty === 'number') return 'spinbutton';
      if (ty === 'search') return 'searchbox';
      if (ty === 'password' || ty === 'hidden' || ty === 'file' || ty === 'date') return null;
      return 'textbox';
    }
    return { textarea: 'textbox', select: 'combobox', option: 'option', ul: 'list', ol: 'list', li: 'listitem', table: 'table', tr: 'row', td: 'cell', th: 'columnheader', nav: 'navigation', main: 'main', img: 'img', dialog: 'dialog', form: a['aria-label'] || a.name ? 'form' : null, header: 'banner', footer: 'contentinfo', p: 'paragraph' }[t] || null;
  }
  function labelFor(doc, n) {
    const out = [];
    for (const l of doc.nodes.values()) {
      if (l.tag !== 'label') continue;
      if (n.attrs.id && l.attrs.for === n.attrs.id) out.push(l);
      else if (!l.attrs.for && descendants(l).includes(n)) out.push(l);
    }
    return out;
  }
  function nameOf(doc, n) {
    const a = n.attrs;
    if (a['aria-label']) return norm(a['aria-label']);
    const role = roleOf(n);
    if (/^(textbox|checkbox|radio|combobox|spinbutton|searchbox)$/.test(role)) {
      const ls = labelFor(doc, n); if (ls.length) return norm(ls.map(l => textOf(l)).join(' '));
      return norm(a.title || a.placeholder || '');
    }
    if (role === 'img') return norm(a.alt || a.title || '');
    if (role === 'button' || role === 'link' || role === 'heading' || role === 'option' || role === 'cell' || role === 'columnheader' || role === 'listitem' || role === 'row') return textOf(n) || norm(a.title || '');
    return textOf(n) || norm(a.title || '');
  }

  /* ---------- text matching ---------- */
  function matcher(val, exact, caseSensitiveSub) {
    if (val && val.__t === 'regex') return s => val.re.test(s);
    const want = norm(val);
    if (exact) return s => norm(s) === want;
    if (caseSensitiveSub) return s => norm(s).includes(want);
    return s => norm(s).toLowerCase().includes(want.toLowerCase());
  }

  /* ---------- a CSS subset ---------- */
  function parseCss(sel) {
    const s = sel.trim(); if (!s) throw new PwError('selector', 'Empty selector');
    const alts = []; let i = 0;
    const bad = why => { throw new PwError('selector', 'Unexpected token in the CSS selector ' + q(sel) + (why ? ': ' + why : '')); };
    let parts = [], comb = ' ';
    const readIdent = () => { const m = /^[\w-]+/.exec(s.slice(i)); if (!m) bad('a name is expected'); i += m[0].length; return m[0]; };
    function readArg() { let depth = 1, k = i; while (k < s.length && depth > 0) { if (s[k] === '(') depth++; else if (s[k] === ')') depth--; k++; } if (depth) bad('missing ")"'); const a = s.slice(i, k - 1).trim(); i = k; return a.replace(/^(["'])(.*)\1$/, '$2'); }
    while (i < s.length) {
      const c = s[i]; const cmp = { tag: null, id: null, classes: [], attrs: [], pseudos: [] }; let any = false;
      if (c === ',') { alts.push(parts); parts = []; comb = ' '; i++; while (s[i] === ' ') i++; continue; }
      if (c === '>' ) { comb = '>'; i++; while (s[i] === ' ') i++; continue; }
      if (c === ' ') { while (s[i] === ' ') i++; if (s[i] !== '>' && s[i] !== ',' && i < s.length) comb = ' '; continue; }
      for (;;) {
        const d = s[i];
        if (d === '*') { cmp.tag = '*'; i++; any = true; }
        else if (/[A-Za-z]/.test(d || '') && !any) { cmp.tag = readIdent().toLowerCase(); any = true; }
        else if (d === '#') { i++; cmp.id = readIdent(); any = true; }
        else if (d === '.') { i++; cmp.classes.push(readIdent()); any = true; }
        else if (d === '[') {
          const e = s.indexOf(']', i); if (e < 0) bad('missing "]"');
          const m = /^\s*([\w:-]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+)))?\s*$/.exec(s.slice(i + 1, e)); if (!m) bad('bad attribute');
          cmp.attrs.push({ name: m[1], op: m[2] || '', val: m[3] != null ? m[3] : m[4] != null ? m[4] : m[5] || '' }); i = e + 1; any = true;
        } else if (d === ':') {
          i++; const name = readIdent(); let arg = null; if (s[i] === '(') { i++; arg = readArg(); }
          if (!['has-text', 'text', 'visible', 'nth-child', 'first-child', 'last-child'].includes(name)) bad('the pseudo-class :' + name + ' is not supported in the lab');
          cmp.pseudos.push({ name, arg }); any = true;
        } else break;
      }
      if (!any) bad('"' + c + '"');
      parts.push({ comb, cmp }); comb = ' ';
    }
    alts.push(parts);
    return alts;
  }
  function matchCompound(n, c) {
    if (c.tag && c.tag !== '*' && n.tag !== c.tag) return false;
    if (c.id && n.attrs.id !== c.id) return false;
    for (const k of c.classes) if (!(n.attrs.class || '').split(/\s+/).includes(k)) return false;
    for (const a of c.attrs) {
      const has = a.name in n.attrs || (a.name === 'value' && n.value !== ''); const v = a.name === 'value' && !(a.name in n.attrs) ? n.value : n.attrs[a.name];
      if (!has) return false;
      if (a.op === '=' && v !== a.val) return false;
      if (a.op === '^=' && !String(v).startsWith(a.val)) return false;
      if (a.op === '$=' && !String(v).endsWith(a.val)) return false;
      if (a.op === '*=' && !String(v).includes(a.val)) return false;
      if (a.op === '~=' && !String(v).split(/\s+/).includes(a.val)) return false;
    }
    for (const p of c.pseudos) {
      if (p.name === 'has-text' && !norm(textOf(n)).toLowerCase().includes(norm(p.arg).toLowerCase())) return false;
      if (p.name === 'text' && norm(textOf(n)).toLowerCase() !== norm(p.arg).toLowerCase()) return false;
      if (p.name === 'visible' && !isVisible(n)) return false;
      const sib = n.parent ? n.parent.children.filter(x => x.tag !== '#text') : [n];
      if (p.name === 'first-child' && sib[0] !== n) return false;
      if (p.name === 'last-child' && sib[sib.length - 1] !== n) return false;
      if (p.name === 'nth-child' && sib[+p.arg - 1] !== n) return false;
    }
    return true;
  }
  function matchComplex(n, parts, idx, within) {
    const { comb, cmp } = parts[idx]; if (!matchCompound(n, cmp)) return false;
    if (idx === 0) return true;
    if (comb === '>') return !!n.parent && n.parent !== within.parent && matchComplex(n.parent, parts, idx - 1, within);
    for (let a = n.parent; a && a.tag !== '#root' && a !== within.parent; a = a.parent) if (matchComplex(a, parts, idx - 1, within)) return true;
    return false;
  }
  function cssFind(scope, sel) {
    const alts = parseCss(sel);
    return descendants(scope).filter(n => alts.some(parts => matchComplex(n, parts, parts.length - 1, scope)));
  }

  /* ---------- locators: a chain of steps, resolved lazily ---------- */
  const loc = steps => ({ __t: 'loc', steps });
  const KIND_OF = { role: 'role', text: 'text', label: 'label', placeholder: 'placeholder', testid: 'testid', alt: 'alt', title: 'title', css: 'css' };
  function smallest(list) { return list.filter(a => !list.some(b => b !== a && a.children.length && descendants(a).includes(b))); }
  function findStep(doc, scope, st) {
    const all = descendants(scope);
    switch (st.kind) {
      case 'role': {
        const nm = st.opts.name != null ? matcher(st.opts.name, st.opts.exact) : null;
        return all.filter(n => roleOf(n) === st.role && (st.opts.includeHidden || isVisible(n)) && (!nm || nm(nameOf(doc, n))) &&
          (st.opts.level == null || n.tag === 'h' + st.opts.level || n.attrs['aria-level'] == st.opts.level) &&
          (st.opts.checked == null || n.checked === !!st.opts.checked) && (st.opts.disabled == null || n.disabled === !!st.opts.disabled));
      }
      case 'text': { const m = matcher(st.text, st.exact); return smallest(all.filter(n => isVisible(n) && m(textOf(n)))); }
      case 'label': {
        const m = matcher(st.text, st.exact), out = [];
        for (const l of all.filter(x => x.tag === 'label' && m(textOf(x)))) {
          const target = l.attrs.for ? all.find(x => x.attrs.id === l.attrs.for) : descendants(l).find(x => /^(input|select|textarea)$/.test(x.tag));
          if (target && !out.includes(target)) out.push(target);
        }
        for (const x of all) if (x.attrs['aria-label'] && m(x.attrs['aria-label']) && !out.includes(x)) out.push(x);
        return out.sort((a, b) => a.id - b.id);
      }
      case 'placeholder': { const m = matcher(st.text, st.exact); return all.filter(n => n.attrs.placeholder != null && m(n.attrs.placeholder)); }
      case 'testid': return all.filter(n => n.attrs['data-testid'] === st.text);
      case 'alt': { const m = matcher(st.text, st.exact); return all.filter(n => n.attrs.alt != null && m(n.attrs.alt)); }
      case 'title': { const m = matcher(st.text, st.exact); return all.filter(n => n.attrs.title != null && m(n.attrs.title)); }
      case 'css': return cssFind(scope, st.sel);
      default: return [];
    }
  }
  function resolve(doc, l) {
    let cur = [doc.root];
    for (const st of l.steps) {
      if (st.kind === 'filter') {
        cur = cur.filter(n => (st.hasText == null || matcher(st.hasText, false)(textOf(n))) &&
          (st.hasNotText == null || !matcher(st.hasNotText, false)(textOf(n))) &&
          (!st.has || descendants(n).some(d => resolve(doc, { steps: st.has.steps }).includes(d)) || resolveWithin(doc, st.has, n).length > 0));
      } else if (st.kind === 'nth') {
        const i = st.n < 0 ? cur.length + st.n : st.n; cur = cur[i] ? [cur[i]] : [];
      } else {
        const next = [];
        for (const scope of cur) for (const n of findStep(doc, scope, st)) if (!next.includes(n)) next.push(n);
        cur = next.sort((a, b) => a.id - b.id);
      }
    }
    return cur;
  }
  function resolveWithin(doc, l, scope) {
    let cur = [scope];
    for (const st of l.steps) {
      if (st.kind === 'nth') { const i = st.n < 0 ? cur.length + st.n : st.n; cur = cur[i] ? [cur[i]] : []; continue; }
      if (st.kind === 'filter') continue;
      const next = []; for (const s of cur) for (const n of findStep(doc, s, st)) if (!next.includes(n)) next.push(n);
      cur = next;
    }
    return cur;
  }
  function describeStep(st, lang) {
    const py = lang === 'py';
    const val = v => v && v.__t === 'regex' ? (py ? 're.compile(' + q(v.src) + ')' : 'Pattern.compile(' + q(v.src) + ')') : q(v);
    const ex = st.exact ? (py ? ', exact=True' : '') : '';
    const kopt = (cls, chain) => chain ? ', new ' + cls + '()' + chain : '';
    switch (st.kind) {
      case 'role': {
        const parts = []; if (st.opts.name != null) parts.push(py ? 'name=' + val(st.opts.name) : '.setName(' + val(st.opts.name) + ')');
        if (st.opts.exact) parts.push(py ? 'exact=True' : '.setExact(true)'); if (st.opts.level != null) parts.push(py ? 'level=' + st.opts.level : '.setLevel(' + st.opts.level + ')');
        return py ? 'get_by_role(' + q(st.role) + (parts.length ? ', ' + parts.join(', ') : '') + ')' : 'getByRole(AriaRole.' + st.role.toUpperCase() + (parts.length ? ', new Page.GetByRoleOptions()' + parts.join('') : '') + ')';
      }
      case 'text': return py ? 'get_by_text(' + val(st.text) + ex + ')' : 'getByText(' + val(st.text) + kopt('Page.GetByTextOptions', st.exact ? '.setExact(true)' : '') + ')';
      case 'label': return py ? 'get_by_label(' + val(st.text) + ex + ')' : 'getByLabel(' + val(st.text) + kopt('Page.GetByLabelOptions', st.exact ? '.setExact(true)' : '') + ')';
      case 'placeholder': return py ? 'get_by_placeholder(' + val(st.text) + ex + ')' : 'getByPlaceholder(' + val(st.text) + ')';
      case 'testid': return py ? 'get_by_test_id(' + q(st.text) + ')' : 'getByTestId(' + q(st.text) + ')';
      case 'alt': return py ? 'get_by_alt_text(' + val(st.text) + ')' : 'getByAltText(' + val(st.text) + ')';
      case 'title': return py ? 'get_by_title(' + val(st.text) + ')' : 'getByTitle(' + val(st.text) + ')';
      case 'css': return 'locator(' + q(st.sel) + ')';
      case 'filter': return py ? 'filter(has_text=' + val(st.hasText) + ')' : 'filter(new Locator.FilterOptions().setHasText(' + val(st.hasText) + '))';
      case 'nth': return st.n === 0 ? (py ? 'first' : 'first()') : st.n === -1 ? (py ? 'last' : 'last()') : 'nth(' + st.n + ')';
      default: return '?';
    }
  }
  const describe = (l, lang) => l.steps.map(s => describeStep(s, lang)).join('.');
  function openTag(n) {
    const keep = ['id', 'class', 'type', 'name', 'data-testid', 'placeholder', 'aria-label', 'role', 'href', 'for'];
    const at = keep.filter(k => n.attrs[k] != null).map(k => ' ' + k + '="' + n.attrs[k] + '"').join('') + (n.disabled ? ' disabled' : '') + (n.hidden ? ' hidden' : '');
    const t = textOf(n, false); const short = t.length > 40 ? t.slice(0, 37) + '...' : t;
    return VOID.has(n.tag) || !short ? '<' + n.tag + at + (VOID.has(n.tag) ? ' />' : '></' + n.tag + '>') : '<' + n.tag + at + '>' + short + '</' + n.tag + '>';
  }

  /* ---------- rendering the virtual page to HTML for the lab view ---------- */
  function renderHTML(doc, hl, bad) {
    hl = hl || []; bad = bad || [];
    function r(n) {
      if (n.tag === '#text') return escH(n.text);
      let at = ''; for (const k of Object.keys(n.attrs)) at += ' ' + k + '="' + escH(n.attrs[k]) + '"';
      if (n.hidden) at += ' hidden'; if (n.disabled) at += ' disabled'; if (n.checked) at += ' checked';
      if (n.tag === 'input') at += ' value="' + escH(n.value) + '"';
      if (hl.includes(n.id)) at += ' data-hl="ok"'; if (bad.includes(n.id)) at += ' data-hl="bad"';
      at += ' data-nid="' + n.id + '"';
      if (VOID.has(n.tag)) return '<' + n.tag + at + '>';
      if (n.tag === 'textarea') return '<textarea' + at + '>' + escH(n.value) + '</textarea>';
      if (n.tag === 'select') return '<select' + at + '>' + n.children.map(c => c.tag === 'option' ? '<option' + (c.value !== '' ? ' value="' + escH(c.value) + '"' : '') + (optValue(c) === n.value ? ' selected' : '') + '>' + escH(textOf(c, false)) + '</option>' : r(c)).join('') + '</select>';
      return '<' + n.tag + at + '>' + n.children.map(r).join('') + '</' + n.tag + '>';
    }
    return doc.root.children.map(r).join('');
  }

  /* ---------- the session: page, virtual clock, timers ---------- */
  function createSession(app, lang, o) {
    o = o || {};
    const S = {
      lang, app, speed: o.speed || 1, clock: 0, timers: [], seq: 0, doc: null, pageKey: '', url: '', title: '',
      vars: {}, store: {}, entries: [], out: [], actions: [], asserts: [], flags: { kinds: [] }, cur: null,
      actionTimeout: o.actionTimeout || 30000, expectTimeout: o.expectTimeout || 5000, snap: o.snap !== false
    };
    S.api = {
      get doc() { return S.doc; },
      get store() { return S.store; },
      el: id => descendants(S.doc.root).find(n => n.attrs.id === id) || null,
      key: k => descendants(S.doc.root).find(n => n.key === k) || null,
      keys: k => descendants(S.doc.root).filter(n => n.key === k),
      show: n => { n.hidden = false; }, hide: n => { n.hidden = true; },
      setHtml: (n, html) => { n.children = []; appendHTML(S.doc, n, html); },
      setText: (n, t) => { n.children = []; const x = textNode(S.doc, t); x.parent = n; n.children.push(x); },
      append: (n, html) => appendHTML(S.doc, n, html),
      remove: n => { if (n.parent) n.parent.children = n.parent.children.filter(c => c !== n); },
      text: n => textOf(n, false), value: n => n.value, setValue: (n, v) => { n.value = v; },
      enable: n => { n.disabled = false; }, disable: n => { n.disabled = true; },
      after: (ms, fn) => { S.timers.push({ at: S.clock + ms * S.speed, seq: ++S.seq, fn }); },
      navigate: key => loadPage(S, key), now: () => S.clock, closest: (n, tag) => { for (let x = n; x; x = x.parent) if (x.tag === tag) return x; return null; }
    };
    return S;
  }
  function loadPage(S, key) {
    const pg = S.app.pages[key]; if (!pg) throw new PwError('goto', 'Unknown page ' + key);
    S.pageKey = key; S.url = pg.url; S.title = pg.title || ''; S.doc = newDoc(pg.html); S.timers = []; S.store = {};
    if (pg.init) pg.init(S.api);
  }
  function advanceTo(S, t) {
    for (;;) {
      let best = -1;
      for (let i = 0; i < S.timers.length; i++) if (S.timers[i].at <= t && (best < 0 || S.timers[i].at < S.timers[best].at || (S.timers[i].at === S.timers[best].at && S.timers[i].seq < S.timers[best].seq))) best = i;
      if (best < 0) break;
      const tm = S.timers.splice(best, 1)[0]; S.clock = Math.max(S.clock, tm.at); tm.fn(S.api);
    }
    S.clock = Math.max(S.clock, t);
  }
  /* Waits on the virtual clock until check() is true or the timeout is over. Returns { ok, waited }. */
  function waitUntil(S, check, timeout) {
    const t0 = S.clock, deadline = t0 + timeout;
    for (;;) {
      if (check()) return { ok: true, waited: S.clock - t0 };
      const next = S.timers.filter(t => t.at <= deadline).reduce((m, t) => Math.min(m, t.at), Infinity);
      if (next === Infinity) { S.clock = deadline; return { ok: check(), waited: S.clock - t0 }; }
      advanceTo(S, Math.max(next, S.clock));
    }
  }
  function fire(S, node, type, detail) {
    const pg = S.app.pages[S.pageKey]; if (pg && pg.on) pg.on(type, node, S.api, detail || {});
  }
  function click(S, n) {
    const lab = S.api.closest(n, 'label');
    if (n.tag === 'label' || (lab && n.tag !== 'input')) {
      const l = n.tag === 'label' ? n : lab;
      const t = l.attrs.for ? S.api.el(l.attrs.for) : descendants(l).find(x => x.tag === 'input');
      if (t) return click(S, t);
    }
    if (n.tag === 'input' && n.attrs.type === 'checkbox') { n.checked = !n.checked; fire(S, n, 'change'); }
    else if (n.tag === 'input' && n.attrs.type === 'radio') { for (const o of S.doc.nodes.values()) if (o.tag === 'input' && o.attrs.type === 'radio' && o.attrs.name === n.attrs.name) o.checked = false; n.checked = true; fire(S, n, 'change'); }
    fire(S, n, 'click');
  }

  /* ---------- values and evaluation ---------- */
  const keyOf = n => n.key || n.attrs.id || n.attrs['data-testid'] || n.tag;
  function optsOf(args, lang) {
    const pos = [], o = {};
    for (const a of args) {
      if (a.name) o[a.name.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = a.value;
      else if (a.value && a.value.__t === 'opts') Object.assign(o, a.value.map);
      else pos.push(a.value);
    }
    return { pos, o };
  }
  function fail(kind, text, extra) { return new PwError(kind, text, extra); }
  const clsName = (S, t) => (t === 'page' ? 'Page' : t === 'loc' ? 'Locator' : 'object');

  function makeFind(S, key, base, pos, o) {
    const exact = !!o.exact; const text = pos[0];
    const t = (kind, extra) => loc((base ? base.steps : []).concat([Object.assign({ kind }, extra)]));
    switch (key) {
      case 'getByRole': {
        const role = pos[0]; if (typeof role !== 'string') throw fail('type', S.lang === 'py' ? 'TypeError: get_by_role() needs a role such as "button" as the first argument' : 'None of the getByRole overloads fits: pass AriaRole.BUTTON and so on');
        return t('role', { role, opts: o });
      }
      case 'getByText': return t('text', { text, exact });
      case 'getByLabel': return t('label', { text, exact });
      case 'getByPlaceholder': return t('placeholder', { text, exact });
      case 'getByTestId': return t('testid', { text });
      case 'getByAltText': return t('alt', { text, exact });
      case 'getByTitle': return t('title', { text, exact });
      case 'locator': {
        if (typeof text !== 'string') throw fail('type', 'locator() needs a selector string');
        const sel = text.trim();
        if (/^(xpath=|\/\/|\.\/\/)/.test(sel)) throw fail('unsupported', 'XPath is not supported in the code lab on purpose: it is the last resort and the most fragile choice. Try getByRole, getByLabel, getByText or a test id first.');
        if (/^(role|id|data-testid)=/.test(sel)) throw fail('unsupported', 'The selector engine "' + sel.split('=')[0] + '=" is not supported in the code lab. Use the get_by_* methods.'.replace('get_by_*', S.lang === 'py' ? 'get_by_*' : 'getBy*'));
        let l;
        const tm = /^text=(.*)$/.exec(sel);
        if (tm) l = t('text', { text: tm[1].replace(/^(["'])(.*)\1$/, '$2'), exact: /^text=(["'])/.test(sel) });
        else { parseCss(sel); l = t('css', { sel: sel.replace(/^css=/, '') }); }
        if (o.hasText != null) l = loc(l.steps.concat([{ kind: 'filter', hasText: o.hasText }]));
        return l;
      }
      default: throw fail('name', 'Unknown locator method ' + key);
    }
  }

  function strictError(S, l, els) {
    const lines = els.slice(0, 5).map((n, i) => '    ' + (i + 1) + ') ' + openTag(n)).join('\n');
    return fail('strict', (S.lang === 'py' ? 'Error: strict mode violation: ' : 'PlaywrightException: Error { message=\'strict mode violation: ') + describe(l, S.lang) + ' resolved to ' + els.length + ' elements:\n' + lines + (els.length > 5 ? '\n    ...' : '') + (S.lang === 'py' ? '' : '\' }') +
      '\n\nA locator must match exactly one element when you act on it. Make it more specific, or narrow it with filter, first, last or nth.', { nodes: els.map(n => n.id) });
  }
  function timeoutError(S, what, l, ms, why, node) {
    const d = describe(l, S.lang);
    const log = ['  - waiting for ' + d];
    if (node) log.push('  -   locator resolved to ' + openTag(node));
    if (why === 'hidden') log.push('  -   element is not visible', '  - retrying ' + what + ' action');
    if (why === 'disabled') log.push('  -   element is not enabled', '  - retrying ' + what + ' action');
    if (why === 'notfound') log.push('  -   (the locator did not match any element)');
    if (why === 'readonly') log.push('  -   element is not editable');
    return fail('timeout', (S.lang === 'py' ? 'playwright._impl._errors.TimeoutError: Locator.' : 'com.microsoft.playwright.TimeoutError: Error {message=\'Locator.') + what + ': Timeout ' + ms + 'ms exceeded.\nCall log:\n' + log.join('\n') + (S.lang === 'py' ? '' : '\''), { nodes: node ? [node.id] : [] });
  }

  /* Waits for exactly one element and the state an action needs, then returns it. */
  function actOn(S, l, what, needs, o) {
    const timeout = o.timeout != null ? o.timeout : S.actionTimeout; let why = 'notfound', node = null;
    const r = waitUntil(S, () => {
      const els = resolve(S.doc, l);
      if (els.length > 1) throw strictError(S, l, els);
      if (!els.length) { why = 'notfound'; node = null; return false; }
      node = els[0];
      if (!isVisible(node)) { why = 'hidden'; return false; }
      if (needs.includes('enabled') && node.disabled) { why = 'disabled'; return false; }
      if (needs.includes('editable') && (node.attrs.readonly != null)) { why = 'readonly'; return false; }
      return true;
    }, timeout);
    if (!r.ok) throw timeoutError(S, what, l, timeout, why, node);
    S.cur.nodes.push(node.id);
    S.flags.kinds.push.apply(S.flags.kinds, l.steps.map(s => s.kind));
    return { node, waited: r.waited };
  }
  function record(S, type, node, extra) { S.actions.push(Object.assign({ type, key: keyOf(node), nid: node.id, tag: node.tag, kinds: S.flags.lastKinds || [] }, extra)); }

  function callLoc(S, l, key, args) {
    const { pos, o } = optsOf(args, S.lang);
    const needT = { click: 'click', dblclick: 'dblclick', fill: 'fill', clear: 'clear', check: 'check', uncheck: 'uncheck', selectOption: 'select_option', press: 'press', hover: 'hover', focus: 'focus' };
    S.flags.lastKinds = l.steps.map(s => s.kind);
    const act = (what, needs, fn) => {
      const nm = S.lang === 'py' ? what : what.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      const { node, waited } = actOn(S, l, nm, needs, o);
      fn(node); S.cur.kind = 'action'; S.cur.msg = (waited ? 'waited ' + waited + ' ms, then ' : '') + what.replace('_', ' ') + ' on ' + openTag(node);
      return undefined;
    };
    switch (key) {
      case 'filter': {
        const hasText = o.hasText != null ? o.hasText : o.has_text; const hasNot = o.hasNotText != null ? o.hasNotText : undefined;
        if (hasText == null && hasNot == null && o.has == null) throw fail('type', 'filter() needs has_text or has'.replace('has_text', S.lang === 'py' ? 'has_text' : 'setHasText'));
        return loc(l.steps.concat([{ kind: 'filter', hasText, hasNotText: hasNot, has: o.has }]));
      }
      case 'first': return loc(l.steps.concat([{ kind: 'nth', n: 0 }]));
      case 'last': return loc(l.steps.concat([{ kind: 'nth', n: -1 }]));
      case 'nth': return loc(l.steps.concat([{ kind: 'nth', n: pos[0] }]));
      case 'click': return act('click', ['enabled'], n => { record(S, 'click', n); click(S, n); });
      case 'dblclick': return act('dblclick', ['enabled'], n => { record(S, 'dblclick', n); click(S, n); click(S, n); });
      case 'hover': return act('hover', [], n => { record(S, 'hover', n); fire(S, n, 'hover'); });
      case 'focus': return act('focus', [], n => { record(S, 'focus', n); });
      case 'fill': return act('fill', ['enabled', 'editable'], n => {
        if (!/^(input|textarea)$/.test(n.tag)) throw fail('type', 'Error: Element is not an <input>, <textarea> or [contenteditable] element');
        const v = pos[0]; if (typeof v !== 'string') throw fail('type', S.lang === 'py' ? 'TypeError: fill() needs a string value' : 'None of the fill overloads fits: pass a String');
        n.value = v; record(S, 'fill', n, { value: v }); fire(S, n, 'input');
      });
      case 'clear': return act('clear', ['enabled', 'editable'], n => { n.value = ''; record(S, 'clear', n); fire(S, n, 'input'); });
      case 'check': case 'uncheck': return act(key, ['enabled'], n => {
        if (!(n.tag === 'input' && /^(checkbox|radio)$/.test(n.attrs.type))) throw fail('type', 'Error: Not a checkbox or radio button');
        const want = key === 'check'; if (n.checked !== want) click(S, n); record(S, key, n);
      });
      case 'selectOption': return act('select_option', ['enabled'], n => {
        if (n.tag !== 'select') throw fail('type', 'Error: Element is not a <select> element');
        const want = Array.isArray(pos[0]) ? pos[0][0] : pos[0];
        const opt = descendants(n).find(x => x.tag === 'option' && (optValue(x) === want || textOf(x, false) === want));
        if (!opt) throw fail('timeout', 'Timeout ' + S.actionTimeout + 'ms exceeded while selecting an option: no <option> matches ' + q(want));
        n.value = optValue(opt); record(S, 'select', n, { value: n.value }); fire(S, n, 'change');
      });
      case 'press': return act('press', ['enabled'], n => {
        const k = pos[0]; record(S, 'press', n, { value: k }); fire(S, n, 'keydown', { key: k });
        if (k === 'Enter' && n.tag === 'input') { const f = S.api.closest(n, 'form'); if (f) { const b = descendants(f).find(x => x.tag === 'button' && (x.attrs.type || 'submit') === 'submit' && !x.disabled); if (b) click(S, b); } }
      });
      case 'count': { S.cur.kind = 'read'; const c = resolve(S.doc, l).length; S.cur.msg = 'count() = ' + c + ' (read once, no waiting)'; return c; }
      case 'isVisible': case 'isHidden': case 'isEnabled': case 'isDisabled': case 'isChecked': {
        const els = resolve(S.doc, l); if (els.length > 1) throw strictError(S, l, els);
        S.flags.plain = true; S.cur.kind = 'read';
        const n = els[0]; const v = { isVisible: !!n && isVisible(n), isHidden: !n || !isVisible(n), isEnabled: !!n && !n.disabled, isDisabled: !!n && n.disabled, isChecked: !!n && n.checked }[key];
        S.cur.msg = (S.lang === 'py' ? PAGE_NAME(key) : key) + '() = ' + (S.lang === 'py' ? (v ? 'True' : 'False') : v) + ' (answered at once, it does not wait). Prefer a web-first assertion with expect.';
        S.flags.immediateRead = true; return v;
      }
      case 'innerText': case 'textContent': case 'inputValue': case 'getAttribute': case 'allInnerTexts': case 'allTextContents': {
        if (key === 'allInnerTexts' || key === 'allTextContents') { S.cur.kind = 'read'; const v = resolve(S.doc, l).map(n => textOf(n)); S.cur.msg = key + ' = ' + JSON.stringify(v); return { __t: 'list', items: v }; }
        const { node } = actOn(S, l, S.lang === 'py' ? PAGE_NAME(key) : key, [], o);
        S.cur.kind = 'read';
        const v = key === 'innerText' || key === 'textContent' ? textOf(node) : key === 'inputValue' ? node.value : (node.attrs[pos[0]] != null ? node.attrs[pos[0]] : null);
        S.cur.msg = key + ' = ' + JSON.stringify(v); return v;
      }
      case 'waitFor': { const { waited } = actOn(S, l, 'wait_for', [], o); S.cur.kind = 'action'; S.cur.msg = 'waited ' + waited + ' ms for the element'; return undefined; }
      default: {
        if (FIND[key]) return makeFind(S, key, l, pos, o);
        throw fail('name', 'Unknown locator method ' + key);
      }
    }
  }
  const PAGE_NAME = key => key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());

  function callPage(S, key, args) {
    const { pos, o } = optsOf(args, S.lang);
    switch (key) {
      case 'goto': {
        const url = pos[0]; const hit = Object.keys(S.app.pages).find(k => S.app.pages[k].url === url || (S.app.pages[k].aliases || []).includes(url));
        if (!hit) throw fail('goto', (S.lang === 'py' ? 'playwright._impl._errors.Error: Page.goto: ' : 'com.microsoft.playwright.PlaywrightException: Error { message=\'Page.') + 'net::ERR_NAME_NOT_RESOLVED at ' + url + '\nThis practice page lives at ' + S.app.pages[S.app.start].url);
        loadPage(S, hit); S.cur.kind = 'goto'; S.cur.msg = 'opened ' + S.url; return undefined;
      }
      case 'reload': loadPage(S, S.pageKey); S.cur.kind = 'goto'; S.cur.msg = 'reloaded ' + S.url; return undefined;
      case 'title': S.cur.kind = 'read'; S.cur.msg = 'title = ' + q(S.title); return S.title;
      case 'url': S.cur.kind = 'read'; S.cur.msg = 'url = ' + q(S.url); return S.url;
      case 'waitForTimeout': return sleep(S, pos[0]);
      case 'setDefaultTimeout': S.actionTimeout = pos[0]; S.expectTimeout = pos[0]; S.cur.kind = 'config'; S.cur.msg = 'default timeout is now ' + pos[0] + ' ms'; return undefined;
      default: if (FIND[key]) return makeFind(S, key, null, pos, o); throw fail('name', 'Unknown page method ' + key);
    }
  }
  function sleep(S, ms) {
    if (typeof ms !== 'number') throw fail('type', 'A sleep needs a number');
    advanceTo(S, S.clock + ms); S.flags.sleep = true; S.cur.kind = 'sleep'; S.cur.status = 'warn';
    S.cur.msg = 'hard wait: slept ' + ms + ' ms no matter what the page does. Replace it with an auto-waiting action or an expect assertion.'; return undefined;
  }

  /* ---------- web-first assertions ---------- */
  const globToRe = g => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$');
  function callExpect(S, ex, key, args) {
    const { pos, o } = optsOf(args, S.lang);
    const timeout = o.timeout != null ? o.timeout : S.expectTimeout; const neg = ex.negated; const t = ex.target;
    const want = pos[0];
    let actual = '', node = null, count = 0, strict = null;
    const isPage = t.__t === 'page';
    const pageCheck = () => {
      if (key === 'toHaveURL') { actual = S.url; const ok = want && want.__t === 'regex' ? want.re.test(S.url) : (typeof want === 'string' && (want === S.url || globToRe(want).test(S.url))); return ok; }
      if (key === 'toHaveTitle') { actual = S.title; return want && want.__t === 'regex' ? want.re.test(S.title) : S.title === want; }
      throw fail('type', 'This assertion needs a locator, not a page');
    };
    const locCheck = () => {
      const els = resolve(S.doc, t); count = els.length; node = els[0] || null;
      if (els.length > 1 && key !== 'toHaveCount') { strict = strictError(S, t, els); throw strict; }
      switch (key) {
        case 'toHaveCount': actual = String(count); return count === want;
        case 'toBeVisible': actual = node ? (isVisible(node) ? 'visible' : 'hidden') : '<element(s) not found>'; return !!node && isVisible(node);
        case 'toBeHidden': actual = node ? (isVisible(node) ? 'visible' : 'hidden') : '<element(s) not found>'; return !node || !isVisible(node);
        case 'toBeEnabled': actual = node ? (node.disabled ? 'disabled' : 'enabled') : '<element(s) not found>'; return !!node && !node.disabled;
        case 'toBeDisabled': actual = node ? (node.disabled ? 'disabled' : 'enabled') : '<element(s) not found>'; return !!node && node.disabled;
        case 'toBeChecked': actual = node ? (node.checked ? 'checked' : 'unchecked') : '<element(s) not found>'; return !!node && node.checked;
        case 'toBeEmpty': actual = node ? q(node.tag === 'input' ? node.value : textOf(node)) : '<element(s) not found>'; return !!node && (node.tag === 'input' ? node.value === '' : textOf(node) === '');
        case 'toHaveText': { actual = node ? q(textOf(node)) : '<element(s) not found>'; if (!node) return false; const tx = textOf(node); return want && want.__t === 'regex' ? want.re.test(tx) : norm(want) === tx; }
        case 'toContainText': { actual = node ? q(textOf(node)) : '<element(s) not found>'; if (!node) return false; const tx = textOf(node); return want && want.__t === 'regex' ? want.re.test(tx) : tx.includes(norm(want)); }
        case 'toHaveValue': actual = node ? q(node.value) : '<element(s) not found>'; return !!node && (want && want.__t === 'regex' ? want.re.test(node.value) : node.value === want);
        case 'toHaveAttribute': { const a = node ? node.attrs[want] : undefined; actual = node ? (a != null ? q(a) : '<attribute not set>') : '<element(s) not found>'; return !!node && a != null && (pos[1] === undefined || a === pos[1]); }
        default: throw fail('name', 'Unknown assertion ' + key);
      }
    };
    const check = () => { const ok = isPage ? pageCheck() : locCheck(); return neg ? !ok : ok; };
    S.flags.kinds.push.apply(S.flags.kinds, isPage ? [] : t.steps.map(s => s.kind));
    const r = waitUntil(S, check, timeout);
    const names = EXP_M[key]; const shown = S.lang === 'py' ? (neg ? 'not_' : '') + names[0] : (neg ? 'not().' : '') + names[1];
    const phrase = { toBeVisible: 'to be visible', toBeHidden: 'to be hidden', toBeEnabled: 'to be enabled', toBeDisabled: 'to be disabled', toBeChecked: 'to be checked', toBeEmpty: 'to be empty', toHaveText: 'to have text', toContainText: 'to contain text', toHaveValue: 'to have value', toHaveCount: 'to have count', toHaveURL: 'to have URL', toHaveTitle: 'to have title', toHaveAttribute: 'to have attribute' }[key];
    S.cur.kind = 'assert'; if (node) S.cur.nodes.push(node.id);
    S.asserts.push({ type: key, key: node ? keyOf(node) : '', nid: node ? node.id : 0, negated: neg, passed: r.ok, waited: r.waited });
    if (!r.ok) {
      const exp = key === 'toBeVisible' || key === 'toBeHidden' || key === 'toBeEnabled' || key === 'toBeDisabled' || key === 'toBeChecked' || key === 'toBeEmpty' ? '' : '\nExpected' + (neg ? ' (not)' : '') + ': ' + (want && want.__t === 'regex' ? '/' + want.src + '/' : typeof want === 'string' ? q(want) : String(want));
      throw fail('expect', (S.lang === 'py' ? 'AssertionError: ' : 'AssertionFailedError: ') + (isPage ? 'Page' : 'Locator') + ' expected' + (neg ? ' not' : '') + ' ' + phrase + exp + '\nActual: ' + actual +
        '\nCall log:\n  - Expect "' + shown + '" with timeout ' + timeout + 'ms' + (isPage ? '' : '\n  - waiting for ' + describe(t, S.lang)), { nodes: node ? [node.id] : [] });
    }
    S.cur.msg = (neg ? 'not ' : '') + phrase + ' passed' + (r.waited ? ' after waiting ' + r.waited + ' ms' : ' at once');
    return undefined;
  }

  /* ---------- expression evaluation ---------- */
  function runtimeNameError(S, name, line) {
    return fail('name', S.lang === 'py' ? 'NameError: name \'' + name + '\' is not defined (line ' + line + ')' : 'Unresolved reference: ' + name + ' (line ' + line + ')', { line });
  }
  function ev(S, n) {
    switch (n.k) {
      case 'str': if (n.tpl) throw fail('unsupported', 'String interpolation is not supported in the code lab. Write the whole text as a plain string.', { line: n.line }); return n.v;
      case 'num': return n.v;
      case 'list': return { __t: 'list', items: n.items.map(x => ev(S, x)) };
      case 'not': return !truthy(ev(S, n.e));
      case 'cmp': { const a = ev(S, n.a), b = ev(S, n.b); S.flags.plain = true; return n.op === '==' ? same(a, b) : !same(a, b); }
      case 'id': return evId(S, n);
      case 'member': return evMember(S, n);
      case 'index': { const o = ev(S, n.obj), i = ev(S, n.idx); if (!o || o.__t !== 'list') throw fail('type', 'Only lists can be indexed', { line: n.line }); if (o.items[i] === undefined) throw fail('range', S.lang === 'py' ? 'IndexError: list index out of range' : 'IndexOutOfBoundsException: Index ' + i + ' out of bounds for length ' + o.items.length, { line: n.line }); return o.items[i]; }
      case 'call': return evCall(S, n);
      default: throw fail('syntax', 'Unsupported expression', { line: n.line });
    }
  }
  const truthy = v => v && v.__t === 'list' ? v.items.length > 0 : !!v;
  const same = (a, b) => (a && a.__t === 'list' && b && b.__t === 'list') ? JSON.stringify(a.items) === JSON.stringify(b.items) : a === b;
  const pyConst = { True: true, False: false, None: null }, ktConst = { true: true, false: false, null: null };
  function evId(S, n) {
    const nm = n.name; const consts = S.lang === 'py' ? pyConst : ktConst;
    if (nm in consts) return consts[nm];
    if (nm === 'page') return { __t: 'page' };
    if (Object.prototype.hasOwnProperty.call(S.vars, nm)) return S.vars[nm];
    const g = { py: ['expect', 'time', 're', 'print', 'len', 'str'], kt: ['assertThat', 'PlaywrightAssertions', 'Thread', 'Pattern', 'AriaRole', 'println', 'assertEquals', 'assertTrue', 'assertFalse', 'listOf', 'Page', 'Locator', 'LocatorAssertions'] }[S.lang];
    if (g.includes(nm)) return { __t: 'global', name: nm };
    throw runtimeNameError(S, nm, n.line);
  }
  function evMember(S, n) {
    const o = ev(S, n.obj), nm = n.name;
    if (o && o.__t === 'global') {
      if (o.name === 'AriaRole') { const r = nm.toLowerCase(); if (!ROLES.has(r) || nm !== nm.toUpperCase()) throw fail('name', 'Unresolved reference: ' + nm + ' (line ' + n.line + '). Roles are written like AriaRole.BUTTON.', { line: n.line }); return r; }
      if (o.name === 're' && (nm === 'I' || nm === 'IGNORECASE')) return { __t: 'flag', i: true };
      if (o.name === 'Pattern' && nm === 'CASE_INSENSITIVE') return { __t: 'flag', i: true };
      if ((o.name === 'Page' || o.name === 'Locator' || o.name === 'LocatorAssertions') && /Options$/.test(nm)) return { __t: 'class', name: nm };
      if (o.name === 'PlaywrightAssertions' || o.name === 'time' || o.name === 'Thread' || o.name === 're' || o.name === 'Pattern') return { __t: 'bound', obj: o, name: nm, line: n.line };
    }
    if (o && o.__t === 'loc') {
      const r = lookupName(LOC_M, nm, S.lang);
      if (S.lang === 'py' && (r.key === 'first' || r.key === 'last')) return loc(o.steps.concat([{ kind: 'nth', n: r.key === 'first' ? 0 : -1 }]));
      if (S.lang === 'py' && r.key) return { __t: 'bound', obj: o, name: nm, key: r.key, line: n.line };
    }
    if (o && o.__t === 'page' && S.lang === 'py' && nm === 'url') { S.cur.kind = 'read'; S.cur.msg = 'url = ' + q(S.url); return S.url; }
    return { __t: 'bound', obj: o, name: nm, line: n.line };
  }
  const evArgs = (S, list) => list.map(a => ({ name: a.name, value: ev(S, a.value) }));
  function evCall(S, n) {
    const fn = n.fn;
    if (fn.k === 'id') return callGlobal(S, fn.name, evArgs(S, n.args), n);
    if (fn.k !== 'member') throw fail('type', 'This call is not supported in the code lab', { line: n.line });
    /* a Python property used like a method, for example locator.first() */
    const objV = ev(S, fn.obj);
    const args = evArgs(S, n.args);
    const nm = fn.name;
    if (objV === undefined || objV === null) throw fail('type', S.lang === 'py' ? "AttributeError: 'NoneType' object has no attribute '" + nm + "'" : 'NullPointerException: ' + nm + ' was called on null', { line: n.line });
    if (objV.__t === 'class') throw fail('type', 'Options classes are created with ()', { line: n.line });
    if (objV.__t === 'opts') {
      if (!/^set[A-Z]/.test(nm)) throw fail('name', 'Unresolved reference: ' + nm + ' (line ' + n.line + '). Options are filled with setXxx(value).', { line: n.line });
      const key = nm[3].toLowerCase() + nm.slice(4); objV.map[key] = args[0] ? args[0].value : true; return objV;
    }
    if (objV.__t === 'global') return callGlobalMember(S, objV, nm, args, n);
    if (objV.__t === 'page') {
      const r = lookupName(PAGE_M, nm, S.lang);
      if (!r.key) throw methodMissing(S, 'Page', nm, r.hint, n.line);
      if (S.lang === 'py' && r.key === 'url') throw fail('type', "TypeError: 'str' object is not callable. In Python, page.url is a property: write page.url, without parentheses.", { line: n.line });
      return callPage(S, r.key, args);
    }
    if (objV.__t === 'loc') {
      const r = lookupName(LOC_M, nm, S.lang);
      if (!r.key) throw methodMissing(S, 'Locator', nm, r.hint, n.line);
      if (S.lang === 'py' && (r.key === 'first' || r.key === 'last')) throw fail('type', "TypeError: 'Locator' object is not callable. In Python, first and last are properties: write locator.first, without parentheses.", { line: n.line });
      return callLoc(S, objV, r.key, args);
    }
    if (objV.__t === 'expect') {
      let name = nm, neg = objV.negated;
      if (S.lang === 'py') { if (/^not_to_/.test(name)) { neg = true; name = name.slice(4); } }
      else if (name === 'not') return Object.assign({}, objV, { negated: !objV.negated });
      const r = lookupName(EXP_M, name, S.lang);
      if (!r.key) throw methodMissing(S, 'LocatorAssertions', nm, r.hint, n.line);
      return callExpect(S, Object.assign({}, objV, { negated: neg }), r.key, args);
    }
    if (objV.__t === 'list' || typeof objV === 'string') throw fail('name', 'This method is not available in the code lab: ' + nm, { line: n.line });
    throw fail('name', 'Unsupported call ' + nm, { line: n.line });
  }
  function methodMissing(S, cls, nm, hint, line) {
    if (S.lang === 'py') return fail('name', "AttributeError: '" + cls + "' object has no attribute '" + nm + "'" + (hint ? ". Did you mean: '" + hint + "'? (Python uses snake_case)" : '') + ' (line ' + line + ')', { line });
    return fail('name', 'Unresolved reference: ' + nm + (hint ? ' (did you mean ' + hint + '?)' : '') + ' (line ' + line + ')', { line });
  }
  function toExpect(S, target, line) {
    if (!target || (target.__t !== 'loc' && target.__t !== 'page')) throw fail('type', (S.lang === 'py' ? 'expect()' : 'assertThat()') + ' needs a locator or a page (line ' + line + ')', { line });
    return { __t: 'expect', target, negated: false };
  }
  function callGlobal(S, name, args, n) {
    const a = args.map(x => x.value);
    const g = ev(S, { k: 'id', name, line: n.line });
    if (!g || g.__t !== 'global') throw fail('type', S.lang === 'py' ? "TypeError: '" + name + "' object is not callable" : 'Expression "' + name + '" cannot be invoked as a function', { line: n.line });
    switch (name) {
      case 'expect': case 'assertThat': return toExpect(S, a[0], n.line);
      case 'print': case 'println': S.out.push(a.map(show).join(' ')); S.cur.kind = 'print'; S.cur.msg = 'printed: ' + a.map(show).join(' '); return undefined;
      case 'len': return a[0] && a[0].__t === 'list' ? a[0].items.length : String(a[0]).length;
      case 'str': return show(a[0]);
      case 'listOf': return { __t: 'list', items: a };
      case 'assertEquals': S.flags.plain = true; if (!same(a[0], a[1])) throw fail('assert', 'AssertionFailedError: expected: <' + show(a[0]) + '> but was: <' + show(a[1]) + '>\nThis is a plain assertion: it reads the value once and does not wait. The web-first assertion assertThat(locator) retries until it passes or times out.', { line: n.line }); S.cur.kind = 'assert'; S.cur.msg = 'plain assertion passed (no retries)'; S.cur.status = 'warn'; return undefined;
      case 'assertTrue': case 'assertFalse': S.flags.plain = true; if (truthy(a[0]) !== (name === 'assertTrue')) throw fail('assert', 'AssertionFailedError: ' + name + ' failed\nThis is a plain assertion: it reads the value once and does not wait.', { line: n.line }); S.cur.kind = 'assert'; S.cur.msg = 'plain assertion passed (no retries)'; S.cur.status = 'warn'; return undefined;
      default: throw fail('name', 'Unsupported function ' + name, { line: n.line });
    }
  }
  function callGlobalMember(S, g, nm, args, n) {
    const a = args.map(x => x.value);
    if (g.name === 'time' && nm === 'sleep') return sleep(S, a[0] * 1000);
    if (g.name === 'Thread' && nm === 'sleep') return sleep(S, a[0]);
    if (g.name === 'PlaywrightAssertions' && nm === 'assertThat') return toExpect(S, a[0], n.line);
    if ((g.name === 're' && nm === 'compile') || (g.name === 'Pattern' && nm === 'compile')) {
      const flagArg = a[1]; const ci = !!(flagArg && flagArg.i);
      try { return { __t: 'regex', src: a[0], re: new RegExp(a[0], ci ? 'i' : '') }; } catch (e) { throw fail('type', 'Bad regular expression ' + q(a[0]), { line: n.line }); }
    }
    if ((g.name === 'Page' || g.name === 'Locator' || g.name === 'LocatorAssertions') && /Options$/.test(nm)) return { __t: 'opts', map: {} };
    throw fail('name', S.lang === 'py' ? "AttributeError: module '" + g.name + "' has no attribute '" + nm + "' (line " + n.line + ')' : 'Unresolved reference: ' + nm + ' (line ' + n.line + ')', { line: n.line });
  }
  const show = v => v === null || v === undefined ? 'None' : v && v.__t === 'list' ? '[' + v.items.map(x => typeof x === 'string' ? "'" + x + "'" : String(x)).join(', ') + ']' : v === true ? 'True' : v === false ? 'False' : String(v);

  /* ---------- running a program ---------- */
  function run(app, src, lang, options) {
    const S = createSession(app, lang, options);
    const res = { ok: false, error: null, entries: S.entries, out: S.out, actions: S.actions, asserts: S.asserts, flags: S.flags, clock: 0, doc: null, url: '', title: '', session: S };
    let prog;
    try { prog = parseProgram(src, lang); } catch (e) {
      if (!(e instanceof PwError)) throw e;
      res.error = { kind: e.kind, line: e.line || 0, text: e.message }; return res;
    }
    loadPage(S, app.start);
    const snap = (hl, badIds) => S.snap ? renderHTML(S.doc, hl, badIds) : '';
    S.entries.push({ line: 0, code: 'page opened', kind: 'goto', status: 'pass', t0: 0, t1: 0, ms: 0, msg: 'opened ' + S.url, html: snap([], []), url: S.url, title: S.title, nodes: [] });
    for (const st of prog) {
      S.cur = { kind: 'assign', status: 'pass', msg: '', nodes: [] };
      const t0 = S.clock; let err = null;
      try {
        if (st.k === 'assign') {
          const v = evalNode(S, st.value); S.vars[st.name] = v;
          if (v && v.__t === 'loc') { S.cur.kind = 'locator'; S.cur.status = 'info'; S.cur.msg = 'defined ' + describe(v, lang) + ' (a locator is lazy: nothing is searched until you use it)'; }
          else if (v && v.__t === 'bound') throw missingParens(S, v, st);
          else S.cur.msg = 'stored a value';
        } else if (st.k === 'assert') {
          const v = evalNode(S, st.e); S.flags.plain = true;
          if (!truthy(v)) throw fail('assert', 'AssertionError: assert ' + st.text.replace(/^assert\s+/, '') + '\nThis is a plain assert: it reads the value once and does not wait. The web-first expect(locator) retries until it passes or times out.', { line: st.line });
          S.cur.kind = 'assert'; S.cur.status = 'warn'; S.cur.msg = 'plain assert passed (no retries)';
        } else {
          const v = evalNode(S, st.e);
          if (v && v.__t === 'bound') { if (lang === 'py') { S.cur.kind = 'action'; S.cur.status = 'warn'; S.cur.msg = 'missing parentheses: ' + v.name + ' is a method, so nothing happened. Write ' + v.name + '().'; S.flags.missingParens = true; } else throw missingParens(S, v, st); }
          else if (v && v.__t === 'loc') { S.cur.kind = 'locator'; S.cur.status = 'info'; S.cur.msg = 'a locator alone does nothing: add an action or an assertion'; }
          else if (S.cur.kind === 'assign') { S.cur.kind = 'expr'; S.cur.msg = 'ok'; }
        }
      } catch (e) {
        if (!(e instanceof PwError)) throw e;
        err = e;
      }
      const hl = S.cur.nodes.filter(id => S.doc.nodes.has(id));
      S.entries.push({ line: st.line, code: st.text, kind: S.cur.kind, status: err ? 'fail' : S.cur.status, t0, t1: S.clock, ms: S.clock - t0, msg: err ? err.message.split('\n')[0] : S.cur.msg, html: snap(err ? [] : hl, err ? (err.nodes || hl) : []), url: S.url, title: S.title, nodes: err ? (err.nodes || hl) : hl });
      if (err) { res.error = { kind: err.kind, line: err.line || st.line, text: err.message }; break; }
    }
    res.ok = !res.error; res.clock = S.clock; res.doc = S.doc; res.url = S.url; res.title = S.title;
    return res;
  }
  const evalNode = ev;
  function missingParens(S, v, st) {
    return fail('syntax', 'Unresolved reference or missing parentheses: ' + v.name + (S.lang === 'kt' ? ' is a function. Call it as ' + v.name + '()' : ''), { line: st.line });
  }

  /* ---------- checking the result of a lab against its goals ---------- */
  function findByKey(doc, key) { return descendants(doc.root).find(n => n.key === key || n.attrs.id === key) || null; }
  function evalChecks(result, checks) {
    return checks.map(c => {
      let ok = false;
      const a = result.actions, as = result.asserts;
      switch (c.k) {
        case 'did': ok = a.some(x => x.type === c.action && x.key === c.key && (c.value === undefined || x.value === c.value)); break;
        case 'didAny': ok = a.some(x => c.actions.includes(x.type) && x.key === c.key); break;
        case 'asserted': ok = as.some(x => x.passed && (!c.key || x.key === c.key) && (!c.type || x.type === c.type) && (c.negated === undefined || x.negated === c.negated)); break;
        case 'assertCount': ok = as.filter(x => x.passed).length >= c.min; break;
        case 'final': {
          const n = result.doc ? findByKey(result.doc, c.key) : null;
          ok = !!n && (c.visible === undefined || isVisible(n) === c.visible) && (c.text === undefined || textOf(n) === c.text) && (c.checked === undefined || n.checked === c.checked) && (c.value === undefined || n.value === c.value);
          break;
        }
        case 'finalCount': ok = !!result.doc && descendants(result.doc.root).filter(n => n.key === c.key && isVisible(n)).length === c.count; break;
        case 'url': ok = result.url === c.url; break;
        case 'via': ok = a.some(x => x.key === c.key && x.kinds.some(k => c.kinds.includes(k))); break;
        case 'uses': ok = result.flags.kinds.some(k => c.kinds.includes(k)); break;
        case 'not': ok = (c.what === 'sleep' || c.what === 'plain') ? !result.flags[c.what] : !result.flags.kinds.includes(c.what); break;
        case 'noError': ok = result.ok; break;
        case 'fast': ok = result.clock <= c.maxMs; break;
        case 'ran': ok = result.ok && result.entries.length > 1; break;
        default: ok = false;
      }
      return { t: c.t, ok };
    });
  }
  /* Runs the program on the normal page and on a slow one, so a lab can ask for a test that is robust to timing. */
  function grade(app, src, lang, checks, cfg) {
    const first = run(app, src, lang, { snap: true, actionTimeout: cfg && cfg.actionTimeout, expectTimeout: cfg && cfg.expectTimeout });
    const rows = evalChecks(first, checks.filter(c => c.k !== 'robust'));
    let slow = null;
    if (checks.some(c => c.k === 'robust')) {
      slow = run(app, src, lang, { snap: false, speed: (cfg && cfg.slowSpeed) || 3, actionTimeout: cfg && cfg.actionTimeout, expectTimeout: cfg && cfg.expectTimeout });
      const c = checks.find(x => x.k === 'robust');
      rows.push({ t: c.t, ok: first.ok && slow.ok && !first.flags.sleep, slowError: slow.error });
    }
    return { result: first, slow, rows, passed: first.ok && rows.every(r => r.ok) };
  }

  /* ---------- a short, readable highlighter for the code in the lab ---------- */
  function highlight(src, lang) {
    const kw = lang === 'py'
      ? 'import from def class return pass with as for in if elif else not and or True False None assert lambda'
      : 'package import class fun val var if else for while return true false null new object when is in private public override';
    const re = new RegExp('(\\/\\/[^\\n]*|#[^\\n]*)|("""[\\s\\S]*?"""|"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\')|\\b(' + kw.split(' ').join('|') + ')\\b|\\b(\\d+(?:\\.\\d+)?)\\b|\\b([A-Za-z_]\\w*)(?=\\()', 'g');
    let out = '', last = 0, m;
    while ((m = re.exec(src))) {
      if (m[1] !== undefined && lang === 'py' && m[1][0] === '/') continue;
      if (m[1] !== undefined && lang === 'kt' && m[1][0] === '#') continue;
      out += escH(src.slice(last, m.index));
      const cls = m[1] !== undefined ? 'tk-c' : m[2] !== undefined ? 'tk-s' : m[3] !== undefined ? 'tk-k' : m[4] !== undefined ? 'tk-n' : 'tk-f';
      out += '<span class="' + cls + '">' + escH(m[0]) + '</span>'; last = m.index + m[0].length;
    }
    return out + escH(src.slice(last));
  }

  return { run, grade, evalChecks, parseProgram, tokenize, newDoc, resolve, describe, renderHTML, highlight, roleOf, nameOf, textOf, isVisible, descendants, findByKey, PwError };
}());

if (typeof module !== 'undefined' && module.exports) module.exports = PW;

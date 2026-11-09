'use strict';
/* The two live-coding components: the code lab (you write, it runs and checks) and the watch-me-code player (the code is written for you, step by step).
   Both use the simulator from runner.js on the practice pages from sandbox.js. Trainers live in trainers.js. */

const reduceMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const ICON = { pass: '✓', fail: '✗', warn: '!', info: '·' };
const KIND_LABEL = { error: 'error', goto: 'open', action: 'action', assert: 'assert', locator: 'locator', sleep: 'hard wait', read: 'read', print: 'print', config: 'config', assign: 'value', expr: 'expression' };

function browserFrame() {
  return '<div class="browser"><div class="browser-bar"><span class="dots" aria-hidden="true">●●●</span><span class="url"></span><span class="clock" title="The lab uses a virtual clock, so waiting costs no real time"></span></div><div class="sbx" role="img" aria-label="A picture of the practice page. The step log below describes the same thing in text."></div></div>';
}
function showEntry(frame, e) {
  if (!e) return;
  $('.sbx', frame).innerHTML = e.html || '';
  $('.url', frame).textContent = e.url || '';
  $('.clock', frame).textContent = 'virtual ' + e.t1 + ' ms';
}
function logRows(entries) {
  return entries.map((e, i) => `<button class="log-row ${e.status}" data-i="${i}" role="listitem"><span class="ico" aria-hidden="true">${ICON[e.status] || '·'}</span><span><span class="src">${esc(KIND_LABEL[e.kind] || e.kind)}${e.line ? ' · line ' + e.line : ''}</span><br>${esc(e.code)}<br><span class="src">${esc(e.msg || '')}</span></span><span class="ms">${e.ms ? e.ms + ' ms' : ''}</span></button>`).join('');
}

/* ===== the code lab ===== */
function mountLab(root, def) {
  const app = SANDBOX[def.app], id = uid('lab'), lang = state.lang, noteKey = 'lab-' + def.id + '-' + lang;
  const passed = () => !!(state.labs[def.id] && state.labs[def.id][lang]);
  const starter = def.starter[lang];
  let timer = null, hintN = 0, last = null;
  root.innerHTML = `<div class="lab-goal"><b>Your task</b>${def.goal}</div>
  <div class="lab-grid">
   <div>
    <div class="field"><label for="${id}-code">Your ${LANG_NAME[lang]} code <span class="src">(the page is already open and <code>page</code> is ready)</span></label>
    <textarea id="${id}-code" class="code-in" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="${id}-tab" maxlength="${LIMITS.note}"></textarea></div>
    <p class="src" id="${id}-tab">Tab inserts spaces. To leave the editor with the keyboard, press Esc and then Tab.</p>
    <div class="lab-bar"><button class="btn" data-a="run">Run and check</button><button class="btn ghost" data-a="hint">Hint</button><button class="btn ghost" data-a="sol">Show solution</button><button class="btn ghost" data-a="reset">Reset</button><span class="pill" data-role="state" aria-live="polite"></span></div>
    <ul class="lab-checks" aria-label="What your code must do"></ul>
    <div class="lab-err" role="alert" hidden></div>
    <div class="hints"></div><div class="solution"></div>
   </div>
   <div>${browserFrame()}<div class="lab-log" role="list" aria-label="Step log" hidden></div><p class="src lab-note">The picture is a simulation of a page. Click a row of the log to see the page at that step. Waiting uses a virtual clock, so a 30 second timeout costs no real time.</p></div>
  </div>`;
  const ta = $('textarea', root), frame = $('.browser', root), logEl = $('.lab-log', root), checksEl = $('.lab-checks', root), errEl = $('.lab-err', root), pill = $('[data-role=state]', root);
  const saved = state.notes[noteKey];
  ta.value = saved && saved.t ? saved.t : starter;
  const paintPill = () => { pill.className = 'pill ' + (passed() ? 'ok' : ''); pill.textContent = passed() ? 'Passed ✓' : 'Not passed yet'; };
  const paintChecks = (rows, ran) => {
    const all = [{ t: 'The code runs without errors', ok: ran && ran.result.ok }].concat(rows || []);
    checksEl.innerHTML = all.map((r, i) => `<li class="${ran ? (r.ok ? 'pass' : 'fail') : 'idle'}"><span class="ico" aria-hidden="true">${ran ? (r.ok ? '✓' : '✗') : '○'}</span><span>${r.t}${ran && !r.ok && r.slowError ? ` <span class="src">On the slow page: ${esc(r.slowError.text.split('\n')[0])}</span>` : ''}</span></li>`).join('');
  };
  paintChecks(def.checks.filter(c => c.t).map(c => ({ t: c.t, ok: false })), null);
  paintPill();
  showEntry(frame, PW.run(app, '', lang).entries[0]);
  const select = i => {
    $$('.log-row', logEl).forEach(r => r.setAttribute('aria-current', +r.dataset.i === i ? 'true' : 'false'));
    showEntry(frame, last.entries[i]);
  };
  const play = () => {
    clearInterval(timer);
    const n = last.entries.length; let i = 0;
    const step = () => { if (!root.isConnected) { clearInterval(timer); return; } select(i); const row = $('.log-row[data-i="' + i + '"]', logEl); if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' }); if (++i >= n) clearInterval(timer); };
    if (reduceMotion() || n < 2) { select(n - 1); return; }
    step(); timer = setInterval(step, 450);
  };
  root.addEventListener('click', ev => {
    const row = ev.target.closest('.log-row'); if (row && last) { clearInterval(timer); select(+row.dataset.i); return; }
    const b = ev.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'run') {
      const code = ta.value; state.notes[noteKey] = { t: code, ts: Date.now() }; touch();
      const g = PW.grade(app, code, lang, def.checks, def.cfg || {});
      last = g.result;
      errEl.hidden = !(g.result.error || g.result.out.length);
      errEl.textContent = (g.result.out.length ? 'Output:\n' + g.result.out.join('\n') + (g.result.error ? '\n\n' : '') : '') + (g.result.error ? g.result.error.text : '');
      errEl.style.background = g.result.error ? '' : 'var(--accent-soft)'; errEl.style.borderColor = g.result.error ? '' : 'var(--accent)';
      logEl.hidden = false; logEl.innerHTML = logRows(g.result.entries);
      paintChecks(g.rows, g); play();
      if (g.passed) { const o = state.labs[def.id] || { ts: 0 }; o[lang] = 1; o.ts = Date.now(); state.labs[def.id] = o; touch(); }
      paintPill();
      pill.textContent = g.passed ? 'Passed ✓' : (passed() ? 'Passed before ✓, not passing now' : 'Not passed yet');
    } else if (a === 'hint') {
      if (!def.hints.length) return;
      hintN = Math.min(hintN + 1, def.hints.length);
      $('.hints', root).innerHTML = def.hints.slice(0, hintN).map((h, i) => `<p class="hint"><b>Hint ${i + 1}.</b> ${h}</p>`).join('');
      b.textContent = hintN < def.hints.length ? `Next hint (${hintN} of ${def.hints.length})` : `All hints shown (${hintN})`;
    } else if (a === 'sol') {
      const box = $('.solution', root);
      if (box.innerHTML) { box.innerHTML = ''; b.textContent = 'Show solution'; return; }
      box.innerHTML = `<h3 style="font-size:.95rem">One possible solution</h3>${codeOne(lang, def.solution[lang], null, null)}${def.why ? `<p class="src">${def.why}</p>` : ''}<button class="btn ghost sm" data-a="use">Copy into the editor</button>`;
      $$('[data-copy]', box).forEach(bt => { bt.onclick = () => { const t = document.getElementById(bt.dataset.copy); if (t) copyText(t.textContent, bt); }; });
      b.textContent = 'Hide solution';
    } else if (a === 'use') {
      ta.value = def.solution[lang]; state.notes[noteKey] = { t: ta.value, ts: Date.now() }; touch();
    } else if (a === 'reset') {
      clearInterval(timer); ta.value = starter; delete state.notes[noteKey]; touch(); last = null;
      logEl.hidden = true; logEl.innerHTML = ''; errEl.hidden = true; paintChecks(def.checks.filter(c => c.t).map(c => ({ t: c.t, ok: false })), null);
      showEntry(frame, PW.run(app, '', lang).entries[0]);
    }
  });
  ta.addEventListener('keydown', ev => {
    if (ev.key === 'Tab' && !ev.shiftKey && !ta.dataset.esc) {
      ev.preventDefault(); const s = ta.selectionStart; ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + 4;
    }
    ta.dataset.esc = ev.key === 'Escape' ? '1' : '';
  });
  let tm = null;
  ta.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { state.notes[noteKey] = { t: ta.value, ts: Date.now() }; touch(); }, 700); });
}

/* ===== the watch-me-code player ===== */
/* A scene is a list of steps. A step adds a chunk of code after the previous code, or, with full: true, replaces all the code.
   With run: false the code is only shown, which suits code that the simulator cannot run (classes, test boilerplate). */
function mountScene(root, def) {
  const app = SANDBOX[def.app], lang = state.lang, id = uid('scene'), runs = def.run !== false;
  const chunks = def.steps.map(s => s[lang]);
  /* codes[n] is the full text of the code after n steps */
  const codes = [''];
  def.steps.forEach((s, i) => { codes.push(s.full || !codes[i] ? chunks[i] : codes[i] + '\n' + chunks[i]); });
  let shown = 0, timer = null, playing = false, typing = false, wait = null;
  root.innerHTML = `${def.intro ? `<p>${def.intro}</p>` : ''}
  <div class="${runs ? 'lab-grid' : ''}">
   <div>
    <pre class="cb live" id="${id}-code" tabindex="0" aria-label="${LANG_NAME[lang]} code being written" aria-live="off"><code></code></pre>
    <div class="player-note" aria-live="polite"><b>What is happening and why</b><span class="say"></span></div>
    <div class="lab-bar"><button class="btn ghost" data-a="restart" aria-label="Restart">⏮ Restart</button><button class="btn" data-a="play">▶ Play</button><button class="btn ghost" data-a="next">Next step ⏭</button><span class="score" data-role="count"></span></div>
    <div class="lab-err" role="status" hidden></div>
   </div>
   ${runs ? `<div>${browserFrame()}<p class="src lab-note"></p></div>` : ''}
  </div>`;
  const codeEl = $('pre code', root), say = $('.say', root), playBtn = $('[data-a=play]', root), count = $('[data-role=count]', root), frame = $('.browser', root), errEl = $('.lab-err', root), note = $('.lab-note', root);
  const total = chunks.length;
  const paint = (text, caret) => { codeEl.innerHTML = PW.highlight(text, lang) + (caret ? '<span class="caret"></span>' : ''); };
  const runView = n => {
    if (!runs) return;
    const res = PW.run(app, codes[n], lang);
    const e = res.entries[res.entries.length - 1]; showEntry(frame, e);
    note.textContent = e && e.msg ? 'Last step: ' + e.msg : '';
    errEl.hidden = !res.error; errEl.textContent = res.error ? res.error.text : '';
  };
  const label = () => { count.textContent = 'Step ' + shown + ' of ' + total; playBtn.textContent = playing ? '⏸ Pause' : (shown >= total ? '↻ Play again' : '▶ Play'); };
  const stop = () => { clearInterval(timer); clearTimeout(wait); typing = false; };
  const finishStep = n => { typing = false; paint(codes[n], false); say.innerHTML = def.steps[n - 1].say; runView(n); label(); };
  const typeStep = n => {
    const full = def.steps[n - 1].full || !codes[n - 1];
    const prev = full ? '' : codes[n - 1] + '\n', text = chunks[n - 1];
    shown = n; label();
    if (reduceMotion()) { finishStep(n); schedule(); return; }
    typing = true; let i = 0; say.innerHTML = def.steps[n - 1].say;
    timer = setInterval(() => {
      if (!root.isConnected) { stop(); return; }
      i += 2; paint(prev + text.slice(0, i), true);
      if (i >= text.length) { clearInterval(timer); finishStep(n); schedule(); }
    }, 24);
  };
  function schedule() {
    clearTimeout(wait);
    if (!playing) return;
    if (shown >= total) { playing = false; label(); return; }
    wait = setTimeout(() => { if (root.isConnected && playing) typeStep(shown + 1); }, 1200 + def.steps[shown - 1].say.length * 14);
  }
  root.addEventListener('click', ev => {
    const b = ev.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'play') {
      if (playing) { playing = false; stop(); if (typing && shown) finishStep(shown); label(); return; }
      if (shown >= total) { shown = 0; paint('', false); say.textContent = ''; runView(0); }
      playing = true; label(); if (!typing) typeStep(shown + 1);
    } else if (a === 'next') {
      playing = false; if (typing) { stop(); finishStep(shown); label(); return; }
      stop(); if (shown < total) typeStep(shown + 1);
    } else if (a === 'restart') {
      playing = false; stop(); shown = 0; paint('', false); say.textContent = 'Press Play, or step through with Next step.'; runView(0); label();
    }
  });
  paint('', false); say.textContent = 'Press Play, or step through with Next step.'; runView(0); label();
}

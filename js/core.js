'use strict';
/* App core: state, router, language switch, quizzes, practice, flashcards, exam, glossary.
   Course text comes from content/en/*.js, labs and trainers from widgets.js, pure logic from lib.js and runner.js. */

const COURSE = [], WIDGETS = {}, LABS = {}, SCENES = {}, CARDS = [], GLOSS = [], SOURCES = {};
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let UID = 0; const uid = p => p + '-' + (++UID);
const SITE_TITLE = 'Test automation with Playwright';
const LANG_NAME = { py: 'Python', kt: 'Kotlin' };

/* ===== state and saving (the visitor's own browser only) ===== */
let state = fresh();
const store = { mode: 'none' };
let persistAsked = false;
function storageOk() { try { const k = LS_KEY + '.probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; } }
function loadLocal() { try { const s = localStorage.getItem(LS_KEY); if (s) return sanitizeState(JSON.parse(s)); } catch (e) { /* storage may be blocked */ } return null; }
function saveLocal() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); return true; } catch (e) { return false; } }
function askPersist() {
  if (persistAsked) return; persistAsked = true;
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* optional */ }
}
function touch() { state.ts = Date.now(); store.mode = saveLocal() ? 'browser' : 'none'; paintStatus(); askPersist(); }
function paintStatus() {
  const s = $('#save-state'); if (s) s.textContent = store.mode === 'browser' ? 'Saved in this browser' : 'Progress is not saved';
  const h = $('#home-save'); if (h) h.textContent = store.mode === 'browser' ? 'saved in this browser only' : 'not saved (this browser blocks site storage), use Export to keep a copy';
}
function initStore() {
  const local = loadLocal();
  if (local) state = local;
  store.mode = storageOk() ? 'browser' : 'none';
  paintStatus();
}

/* ===== export and import of progress ===== */
function exportProgress() {
  const blob = new Blob([serializeState(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'progress.json'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importProgress(file, msgEl) {
  const say = (t, ok) => { msgEl.className = 'fb ' + (ok ? 'ok' : 'bad'); msgEl.textContent = t; };
  if (!file) return;
  if (file.size > LIMITS.file) { say('The file is too large.', false); return; }
  let text; try { text = await file.text(); } catch (e) { say('The file could not be read.', false); return; }
  const r = parseImport(text);
  if (!r.ok) { say(r.error, false); return; }
  state = mergeStates(state, r.state); touch();
  document.body.dataset.lang = state.lang;
  say('Progress imported and merged with what is in this browser.', true);
  setTimeout(() => { if (currentRoute().id === 'home') route(); }, 1200);
}

/* ===== navigation: the address is #<lang>/<page>, for example #kt/m3 ===== */
const view = () => $('#view');
function currentRoute() {
  const parts = (location.hash || '#home').slice(1).split('/');
  const lang = LANGS.includes(parts[0]) ? parts.shift() : null;
  return { lang, id: parts.join('/') || 'home' };
}
const href = id => '#' + state.lang + '/' + id;
const moduleIds = () => COURSE.map(m => m.id);
function pct() { const n = COURSE.length; return n ? Math.round(doneCount(state, moduleIds()) / n * 100) : 0; }
function applyLang() {
  document.body.dataset.lang = state.lang;
  $$('.lang button').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === state.lang ? 'true' : 'false'));
}
function setLang(l) {
  if (!LANGS.includes(l) || l === state.lang) return;
  state.lang = l; touch(); applyLang();
  const y = window.scrollY;
  history.replaceState(null, '', '#' + l + '/' + currentRoute().id);
  route(true); window.scrollTo(0, y);
}
function renderChrome() {
  const nav = $('#nav'); if (!nav) return;
  const r = currentRoute().id;
  const item = (id, n, t, st, ok) => `<a href="${href(id)}" ${r === id ? 'aria-current="page"' : ''}><span class="n">${n}</span><span>${t}</span><span class="st ${ok ? 'ok' : ''}">${st}</span></a>`;
  nav.innerHTML = `<h4>Start</h4>${item('home', '·', 'About the course', '', '')}<h4>Modules</h4>` + COURSE.map((m, i) => {
    const q = state.quiz[m.id]; const ok = !!state.done[m.id];
    return item(m.id, String(i + 1).padStart(2, '0'), esc(m.short || m.title), ok ? '✓' : (q ? q.best + '/' + q.total : ''), ok);
  }).join('') +
    `<h4>Practice</h4>${item('exam', 'E', 'Final exam', state.quiz.exam ? state.quiz.exam.best + '/' + state.quiz.exam.total : '', '')}${item('cards', 'F', 'Interview flashcards', cardStat(), '')}${item('glossary', 'G', 'Glossary', '', '')}`;
  const p = pct(); $('#meter-fill').style.width = p + '%'; $('#meter-txt').textContent = p + '% of the course';
}
function cardStat() { const k = CARDS.filter(c => state.cards[c.id] && state.cards[c.id].k === 1).length; return k ? k + '/' + CARDS.length : ''; }
function route(keepScroll) {
  const r = currentRoute(); const v = view(); $('#nav').classList.remove('open');
  if (r.lang && r.lang !== state.lang) { state.lang = r.lang; touch(); }
  applyLang();
  document.title = SITE_TITLE;
  if (r.id === 'home') renderHome(v);
  else if (r.id === 'exam') renderExam(v);
  else if (r.id === 'cards') renderCards(v);
  else if (r.id === 'glossary') renderGlossary(v);
  else { const i = COURSE.findIndex(m => m.id === r.id); if (i >= 0) renderModule(v, COURSE[i], i); else renderHome(v); }
  renderChrome(); if (keepScroll !== true) window.scrollTo(0, 0);
}

/* ===== module page ===== */
function sourcesBlock(id) {
  const list = SOURCES[id]; if (!list || !list.length) return '';
  return `<div class="sources"><h3>Sources</h3><ul>${list.map(s => `<li><a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t)}</a></li>`).join('')}</ul></div>`;
}
/* Turns {{w:name}}, {{lab:id}} and {{watch:id}} in the module text into empty frames. */
function expandTokens(body) {
  return body
    .replace(/\{\{w:([\w-]+)\}\}/g, (_, n) => `<div class="widget" data-w="${n}"></div>`)
    .replace(/\{\{lab:([\w-]+)\}\}/g, (_, n) => `<div class="widget lab" data-lab="${n}"></div>`)
    .replace(/\{\{watch:([\w-]+)\}\}/g, (_, n) => `<div class="widget watch" data-watch="${n}"></div>`);
}
function mountFrames(v) {
  $$('.widget[data-w]', v).forEach(w => {
    const def = WIDGETS[w.dataset.w]; if (!def) { w.remove(); return; }
    w.innerHTML = `<div class="w-head"><span>${def.title}</span><span>${def.tag || 'trainer'}</span></div><div class="w-body"></div>`;
    def.init($('.w-body', w));
  });
  $$('.widget[data-lab]', v).forEach(w => {
    const def = LABS[w.dataset.lab]; if (!def || typeof mountLab !== 'function') { w.remove(); return; }
    w.innerHTML = `<div class="w-head"><span>Code lab: ${def.title}</span><span>live coding · simulation</span></div><div class="w-body"></div>`;
    mountLab($('.w-body', w), def);
  });
  $$('.widget[data-watch]', v).forEach(w => {
    const def = SCENES[w.dataset.watch]; if (!def || typeof mountScene !== 'function') { w.remove(); return; }
    w.innerHTML = `<div class="w-head"><span>Watch me code: ${def.title}</span><span>live coding · lesson</span></div><div class="w-body"></div>`;
    mountScene($('.w-body', w), def);
  });
}
function mountSteps(v) {
  $$('input[data-step]', v).forEach(cb => {
    cb.checked = !!state.steps[cb.dataset.step];
    cb.addEventListener('change', () => { if (cb.checked) state.steps[cb.dataset.step] = true; else delete state.steps[cb.dataset.step]; touch(); });
  });
}
function renderModule(v, m, idx) {
  const body = expandTokens(m.body);
  const prev = COURSE[idx - 1], next = COURSE[idx + 1];
  const isDone = !!state.done[m.id];
  document.title = m.title + ' | ' + SITE_TITLE;
  if (state.last !== m.id) { state.last = m.id; touch(); }
  v.innerHTML = `<article class="sheet">
  <div class="eyebrow">Module ${idx + 1} of ${COURSE.length} · about ${m.minutes} min · <span class="langtag">${L('Python track', 'Kotlin track')}</span></div>
  <h1 style="font-size:1.8rem;margin:.3rem 0">${m.title}</h1><p class="lead">${m.lead}</p>
  <div class="learn"><b>After this module you will be able to</b><ul>${m.learn.map(x => `<li>${x}</li>`).join('')}</ul></div>
  <div class="prose">${body}</div>
  <div class="take"><h3>Key points</h3><ul>${m.takeaways.map(x => `<li>${x}</li>`).join('')}</ul></div>
  <div class="quiz"><h2 style="margin-top:.4rem">Quiz</h2><p class="src">The answer options are shuffled each time. The explanation appears right after you answer, and your answers are kept in this browser, so you can leave and come back.</p><div id="quiz-box"></div></div>
  <div class="practice" id="practice-box"></div>
  ${sourcesBlock(m.id)}
  <div class="row" style="margin-top:22px;justify-content:space-between">
    <div class="row">${prev ? `<a class="btn ghost" style="text-decoration:none" href="${href(prev.id)}">← ${esc(prev.short || prev.title)}</a>` : ''}</div>
    <div class="row"><button class="btn ${isDone ? 'ghost' : ''}" id="done-btn">${isDone ? 'Module complete ✓ (undo)' : 'Mark module complete'}</button>${next ? `<a class="btn ghost" style="text-decoration:none" href="${href(next.id)}">${esc(next.short || next.title)} →</a>` : ''}</div>
  </div>
  ${isDone ? '<p class="src" style="text-align:right">Export your progress to keep a backup. <button class="btn ghost" id="export-hint">Export progress</button></p>' : ''}</article>`;
  mountFrames(v);
  mountSteps(v);
  $$('[data-copy]', v).forEach(bt => { bt.onclick = () => { const t = document.getElementById(bt.dataset.copy); if (t) copyText(t.textContent, bt); }; });
  mountQuiz($('#quiz-box'), m.quiz, { id: m.id, persist: true, onFinish: (c, t) => { recordQuiz(m.id, c, t); } });
  mountPractice($('#practice-box'), m.practice);
  $('#done-btn').onclick = () => { if (state.done[m.id]) delete state.done[m.id]; else state.done[m.id] = true; touch(); renderModule(v, m, idx); renderChrome(); };
  const eh = $('#export-hint'); if (eh) eh.onclick = exportProgress;
}
function recordQuiz(id, c, t) { const o = state.quiz[id]; if (!o || c >= o.best) { state.quiz[id] = { best: c, total: t, last: c }; } else { o.last = c; } touch(); renderChrome(); }

/* ===== quiz (answers of module quizzes are kept per question) ===== */
function feedback(q, ok, restored) {
  const t = q.type || 'mc';
  const head = ok ? 'Correct.' : (t === 'order' ? 'Different order.' : 'Incorrect.');
  const note = restored ? ` <span class="src">(answered ${ok ? 'correctly' : 'incorrectly'} earlier)</span>` : '';
  let extra = '';
  if (t === 'num') extra = ` Answer: <span class="num">${fmt(q.ans)}</span>.`;
  if (t === 'order') extra = ` The correct sequence: ${q.items.map((x, i) => `${i + 1}) ${x}`).join('; ')}.`;
  if (t === 'multi') extra = ` Right answers: ${q.a.map(i => q.o[i]).join('; ')}.`;
  if (t === 'fill') extra = ` Accepted: <code>${esc(q.ans[0])}</code>.`;
  return `<div class="fb ${ok ? 'ok' : 'bad'}"><b>${head}</b>${note}${extra} ${q.why}</div>`;
}
function mountQuiz(box, qs, cfg) {
  const key = cfg.persist ? cfg.id : null;
  let saved = key ? state.qprog[key] : null;
  if (saved && saved.length !== qs.length) saved = null;
  const res = qs.map((_, i) => saved ? (saved[i] === 'c' ? true : saved[i] === 'w' ? false : null) : null);
  box.innerHTML = '';
  const saveQuiz = () => { state.qprog[key] = res.map(r => r === true ? 'c' : r === false ? 'w' : '-').join(''); touch(); };
  qs.forEach((q, qi) => {
    const card = document.createElement('div'); card.className = 'q'; box.appendChild(card);
    renderQ(card, q, res[qi], ok => { res[qi] = ok; if (key) saveQuiz(); update(true); });
  });
  const foot = document.createElement('div'); foot.className = 'row'; foot.style.marginTop = '12px'; box.appendChild(foot);
  foot.addEventListener('click', e => {
    if (e.target.dataset.act !== 'reset') return;
    if (key) { delete state.qprog[key]; touch(); }
    mountQuiz(box, qs, cfg);
  });
  function update(live) {
    const done = res.filter(x => x !== null).length, c = res.filter(x => x === true).length;
    let h = `<span class="score">Answered ${done} of ${qs.length}, correct ${c}</span>`;
    if (done === qs.length) h += ` <span class="pill ${c / qs.length >= 0.7 ? 'ok' : 'hold'}">${Math.round(c / qs.length * 100)}%</span>`;
    if (key ? done > 0 : done === qs.length) h += ` <button class="btn ghost" data-act="reset">${key ? 'Reset quiz' : 'Try again'}</button>`;
    foot.innerHTML = h;
    if (live && done === qs.length && cfg.onFinish) cfg.onFinish(c, qs.length, res);
  }
  update(false);
}
function renderQ(card, q, prior, cb) {
  const t = q.type || 'mc';
  const qcode = q.code ? code(q.code) : '';
  if (prior !== null) {
    const opts = (t === 'mc' || t === 'multi') ? q.o.map((o, i) => `<button class="opt ${(t === 'mc' ? i === q.a : q.a.includes(i)) ? 'right' : ''}" disabled>${o}</button>`).join('') : '';
    card.innerHTML = `<p class="qt">${q.q}</p>${qcode}${opts}<div class="slot">${feedback(q, prior, true)}</div>`;
    return;
  }
  if (t === 'mc') {
    const order = shuffle(q.o.map((_, i) => i));
    card.innerHTML = `<p class="qt">${q.q}</p>${qcode}` + order.map(i => `<button class="opt" data-i="${i}">${q.o[i]}</button>`).join('') + '<div class="slot"></div>';
    card.addEventListener('click', e => {
      const b = e.target.closest('.opt'); if (!b || b.disabled) return;
      const ok = +b.dataset.i === q.a;
      $$('.opt', card).forEach(x => { x.disabled = true; if (+x.dataset.i === q.a) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      $('.slot', card).innerHTML = feedback(q, ok, false); cb(ok);
    });
  } else if (t === 'multi') {
    const order = shuffle(q.o.map((_, i) => i)); const picked = new Set(); let fin = false;
    card.innerHTML = `<p class="qt">${q.q} <span class="src">(select all that apply)</span></p>${qcode}` + order.map(i => `<button class="opt" data-i="${i}" aria-pressed="false">${q.o[i]}</button>`).join('') + '<div class="row"><button class="btn" data-check="1">Check</button></div><div class="slot"></div>';
    card.addEventListener('click', e => {
      if (fin) return;
      const chk = e.target.closest('[data-check]');
      if (chk) {
        if (!picked.size) { $('.slot', card).innerHTML = '<div class="fb info">Select at least one option.</div>'; return; }
        fin = true; const ok = sameSet([...picked], q.a);
        $$('.opt', card).forEach(x => { x.disabled = true; const i = +x.dataset.i; if (q.a.includes(i)) x.classList.add('right'); else if (picked.has(i)) x.classList.add('wrong'); });
        chk.disabled = true; $('.slot', card).innerHTML = feedback(q, ok, false); cb(ok); return;
      }
      const b = e.target.closest('.opt'); if (!b || b.disabled) return;
      const i = +b.dataset.i; if (picked.has(i)) picked.delete(i); else picked.add(i);
      b.classList.toggle('sel', picked.has(i)); b.setAttribute('aria-pressed', picked.has(i) ? 'true' : 'false');
    });
  } else if (t === 'fill') {
    const id = uid('fill');
    card.innerHTML = `<p class="qt">${q.q}</p>${qcode}<div class="row"><input type="text" id="${id}" style="max-width:320px" aria-label="Your answer" autocomplete="off" spellcheck="false"><button class="btn">Check</button></div><div class="slot"></div>`;
    const btn = $('button', card), inp = $('input', card); let fin = false;
    const submit = () => {
      if (fin) return; if (!inp.value.trim()) { $('.slot', card).innerHTML = '<div class="fb info">Type your answer first.</div>'; return; }
      const ok = fillOk(inp.value, q.ans); fin = true; inp.disabled = true; btn.disabled = true;
      $('.slot', card).innerHTML = feedback(q, ok, false); cb(ok);
    };
    btn.onclick = submit;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  } else if (t === 'num') {
    const id = uid('num');
    card.innerHTML = `<p class="qt">${q.q}</p>${qcode}<div class="row"><input type="text" inputmode="decimal" id="${id}" style="max-width:170px" aria-label="Answer"><button class="btn">Check</button></div><div class="slot"></div>`;
    const btn = $('button', card), inp = $('input', card); let fin = false;
    const submit = () => {
      if (fin) return; const v = parseNum(inp.value); if (isNaN(v)) { $('.slot', card).innerHTML = '<div class="fb info">Enter a number. A dot or a comma both work.</div>'; return; }
      const ok = Math.abs(v - q.ans) <= (q.tol || 0.005); fin = true; inp.disabled = true; btn.disabled = true;
      $('.slot', card).innerHTML = feedback(q, ok, false); cb(ok);
    };
    btn.onclick = submit;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  } else if (t === 'order') {
    const idx = shuffle(q.items.map((_, i) => i)); let picked = [], fin = false;
    const draw = () => {
      card.innerHTML = `<p class="qt">${q.q}</p>${qcode}<div class="chips">${idx.map(i => `<button class="chip ${picked.includes(i) ? 'used' : ''}" data-i="${i}" ${picked.includes(i) || fin ? 'disabled' : ''}>${q.items[i]}</button>`).join('')}</div>
      <ol class="seq">${picked.map(i => `<li>${q.items[i]}</li>`).join('')}</ol>
      <div class="row">${fin ? '' : '<button class="btn ghost" data-r="1">Clear my choice</button>'}</div><div class="slot"></div>`;
    };
    draw();
    card.addEventListener('click', e => {
      if (fin) return;
      if (e.target.dataset.r) { picked = []; draw(); return; }
      const b = e.target.closest('.chip'); if (!b || b.disabled) return; picked.push(+b.dataset.i);
      if (picked.length === q.items.length) {
        fin = true; const ok = picked.every((v, k) => v === k); draw();
        $('.slot', card).innerHTML = feedback(q, ok, false); cb(ok);
      } else draw();
    });
  }
}

/* ===== practice ===== */
function mountPractice(box, p) {
  const nid = typeof p.template === 'string' ? p.id : p.id + '-' + state.lang;
  const tpl = typeof p.template === 'string' ? p.template : p.template[state.lang];
  const note = state.notes[nid] || {}; const chk = (state.notes[p.id + ':c'] || {}).t || '';
  box.innerHTML = `<h3>Practice: ${p.title}</h3><div class="prose">${p.brief}</div>
  <div class="field" style="margin-top:10px"><label for="n-${nid}">Your answer or notes (${store.mode === 'browser' ? 'saved in this browser' : 'not saved, storage is unavailable'})</label><textarea id="n-${nid}" data-note="${nid}" maxlength="${LIMITS.note}" placeholder="Write here">${esc(note.t || tpl || '')}</textarea></div>
  <p class="src">Do not enter anything confidential here, such as passwords, API keys or employer data.</p>
  <h3 style="font-size:.95rem">Self-check</h3>${p.checks.map((c, i) => `<label class="chk"><input type="checkbox" data-c="${i}" ${chk[i] === '1' ? 'checked' : ''}><span>${c}</span></label>`).join('')}
  <details><summary>Show the reference answer</summary><div class="prose">${p.model}</div></details>`;
  $$('[data-copy]', box).forEach(bt => { bt.onclick = () => { const t = document.getElementById(bt.dataset.copy); if (t) copyText(t.textContent, bt); }; });
  const ta = $('textarea', box); let tm = null;
  ta.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { state.notes[nid] = { t: ta.value, ts: Date.now() }; touch(); }, 700); });
  box.addEventListener('change', e => { if (e.target.dataset.c === undefined) return; const bits = $$('input[data-c]', box).map(x => x.checked ? '1' : '0').join(''); state.notes[p.id + ':c'] = { t: bits, ts: Date.now() }; touch(); });
}

/* ===== home ===== */
function continueTarget() {
  const lastIdx = COURSE.findIndex(m => m.id === state.last);
  if (lastIdx >= 0 && !state.done[COURSE[lastIdx].id]) return COURSE[lastIdx];
  const after = COURSE.slice(lastIdx + 1).find(m => !state.done[m.id]);
  return after || COURSE.find(m => !state.done[m.id]) || COURSE[0];
}
function renderHome(v) {
  const first = continueTarget();
  const doneN = doneCount(state, moduleIds());
  const started = doneN > 0 || !!state.last || Object.keys(state.qprog).length > 0;
  const verb = doneN === COURSE.length ? 'Review: ' : started ? 'Continue: ' : 'Start: ';
  const labN = Object.keys(LABS).length;
  const labDone = Object.keys(LABS).filter(k => state.labs[k] && state.labs[k][state.lang]).length;
  v.innerHTML = `<article class="sheet">
  <div class="eyebrow">A free interactive course · Playwright · Python and Kotlin</div>
  <h1 style="font-size:2.1rem;margin:.4rem 0">Test automation with Playwright, from your first test to CI</h1>
  <p class="lead">${COURSE.length} modules for manual testers who are moving into automation. Every module explains what to do and why, then lets you practise: step-by-step setup, watch-me-code lessons, a code lab that runs in your browser, a quiz and a practice task. At the end there is an exam, interview flashcards and a glossary.</p>
  <h2 style="margin-top:1.2rem">1. Choose your track</h2>
  <div class="grid two">
    <button class="tile track" data-pick="py" aria-pressed="${state.lang === 'py'}"><span class="eyebrow">Track</span><b>Python</b><small>pytest and pytest-playwright. Short, readable code. A good first language.</small></button>
    <button class="tile track" data-pick="kt" aria-pressed="${state.lang === 'kt'}"><span class="eyebrow">Track</span><b>Kotlin</b><small>Gradle, JUnit 5 and Playwright for Java used from Kotlin. Typed code, familiar to Android and JVM teams.</small></button>
  </div>
  <p class="src">You can switch the track at any moment with the switch in the top bar. The theory is the same, the code, the labs and the setup steps change. Playwright has no separate Kotlin library, so the Kotlin track uses the official Java library, which works from Kotlin without any wrapper.</p>
  <h2>2. Start</h2>
  <div class="row"><a class="btn" style="text-decoration:none" href="${href(first.id)}">${verb}${esc(first.short || first.title)}</a><span class="src">${doneN} of ${COURSE.length} modules complete · ${labDone} of ${labN} code labs passed in ${LANG_NAME[state.lang]}</span></div>
  <h2>How each module works</h2>
  <ol>
   <li><b>Read</b> the explanation. Every idea starts with an everyday analogy and ends with "why this line, and what breaks without it".</li>
   <li><b>Watch me code</b>: a short animated lesson where the code is written step by step and explained.</li>
   <li><b>Do it yourself in the code lab</b>: write Playwright code in the browser and see it run against a practice page, with a step log in the style of the trace viewer.</li>
   <li><b>Do it on your machine</b>: numbered instructions with the reason for every step and the result you should see.</li>
   <li><b>Quiz and practice task</b> with explanations and a reference answer.</li>
  </ol>
  <div class="callout warn"><b>What the code lab is, and what it is not</b>The lab is a teaching simulation. It reads a safe subset of the Playwright API (locators, actions, web-first assertions) and runs it against a small practice page, with a virtual clock so waiting is instant. It is not a real browser, and it cannot run your own site. The real thing is in the step-by-step parts that you run on your own computer.</div>
  <h2>Modules</h2>
  <div class="grid">${COURSE.map((m, i) => `<a class="tile" href="${href(m.id)}"><span class="eyebrow">${String(i + 1).padStart(2, '0')} · ${m.minutes} min</span><b>${m.title}</b><small>${state.done[m.id] ? 'Complete ✓' : (state.quiz[m.id] ? 'Quiz: ' + state.quiz[m.id].best + '/' + state.quiz[m.id].total : 'Not started')}</small></a>`).join('')}</div>
  <div class="callout warn"><b>How to treat the facts</b>Playwright releases often, and options, defaults and tool versions change. The code in this course was run with the versions named in module 2. Before relying on it at work, check the current documentation, which is linked at the end of every module. This course is not affiliated with Microsoft, JetBrains or the pytest project. The names are used only to describe the tools.</div>
  <h2>Your progress</h2>
  <p>Progress and notes stay in your browser. Nothing is sent anywhere. There are no accounts, no cookies and no analytics. Current state: <b id="home-save"></b>.</p>
  <ul>
   <li>Saved: your track, completed modules, ticked steps, passed labs, quiz results and answers, flashcard marks, the text you write in practice tasks and labs, and the module you opened last.</li>
   <li>Not saved on purpose: an unfinished final exam.</li>
   <li>Progress belongs to this browser, profile and device. It does not sync to your phone or another computer.</li>
   <li>It disappears if you clear site data, close a private window or switch browsers. Safari may clear site data on its own after about a week without a visit.</li>
   <li>Back up with Export, and restore it on another device with Import. Import merges the file with what is already here.</li>
  </ul>
  <div class="row"><button class="btn" id="export-btn">Export progress</button><button class="btn ghost" id="import-btn">Import progress</button><input type="file" id="import-file" accept="application/json,.json" hidden><button class="btn ghost" id="reset-btn">Reset progress</button><span id="reset-box"></span></div>
  <div id="import-msg" role="status" style="margin-top:10px"></div>
  </article>`;
  paintStatus();
  $$('[data-pick]', v).forEach(b => { b.onclick = () => { if (b.dataset.pick !== state.lang) setLang(b.dataset.pick); }; });
  $('#export-btn').onclick = exportProgress;
  $('#import-btn').onclick = () => $('#import-file').click();
  $('#import-file').onchange = e => { importProgress(e.target.files[0], $('#import-msg')); e.target.value = ''; };
  $('#reset-btn').onclick = () => {
    $('#reset-box').innerHTML = '<span class="fb bad" style="margin:0">Erase all progress and answers? <button class="btn" id="reset-yes">Yes, erase</button> <button class="btn ghost" id="reset-no">Cancel</button></span>';
    $('#reset-yes').onclick = () => { const l = state.lang; state = fresh(); state.lang = l; touch(); route(); }; $('#reset-no').onclick = () => { $('#reset-box').innerHTML = ''; };
  };
}

/* ===== exam ===== */
function examPool() { const p = []; COURSE.forEach(m => m.quiz.forEach(q => p.push(Object.assign({ mod: m.id, modTitle: m.short || m.title }, q)))); return p; }
function renderExam(v) {
  const best = state.quiz.exam;
  v.innerHTML = `<article class="sheet"><div class="eyebrow">Final exam</div><h1 style="font-size:1.8rem;margin:.3rem 0">20 questions from all modules</h1>
  <p class="lead">The questions are picked at random. After you finish, you will see which modules to review.${best ? ` Best result: <b>${best.best}/${best.total}</b>.` : ''} An unfinished exam is not saved.</p>
  <div class="row"><button class="btn" id="ex-start">Start the exam</button></div><div id="ex-box"></div></article>`;
  $('#ex-start').onclick = () => {
    const qs = shuffle(examPool()).slice(0, 20);
    $('#ex-start').textContent = 'New exam';
    mountQuiz($('#ex-box'), qs, { id: 'exam', persist: false, onFinish: (c, t, res) => {
      recordQuiz('exam', c, t);
      const bad = {}; qs.forEach((q, i) => { if (res[i] === false) { bad[q.mod] = bad[q.mod] || { t: q.modTitle, n: 0 }; bad[q.mod].n++; } });
      const keys = Object.keys(bad);
      const sum = document.createElement('div'); sum.className = 'callout';
      sum.innerHTML = '<b>What to review</b>' + (keys.length ? '<ul>' + keys.map(k => `<li><a href="${href(k)}">${esc(bad[k].t)}</a>: ${bad[k].n} ${bad[k].n === 1 ? 'mistake' : 'mistakes'}</li>`).join('') + '</ul>' : 'No mistakes. Move on to the interview flashcards.');
      $('#ex-box').appendChild(sum);
    } });
    $('#ex-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

/* ===== flashcards ===== */
let cardFilter = 'all', cardIdx = 0, cardShown = false;
function renderCards(v) {
  const list = () => cardFilter === 'all' ? CARDS : CARDS.filter(c => !(state.cards[c.id] && state.cards[c.id].k === 1));
  const draw = () => {
    const Lst = list();
    if (!Lst.length) { v.innerHTML = '<article class="sheet"><h1 style="font-size:1.6rem">All cards are marked "I know it"</h1><p class="lead">Switch to "All" or reset the marks on individual cards.</p><button class="btn" id="cf-all">Show all</button></article>'; $('#cf-all').onclick = () => { cardFilter = 'all'; cardIdx = 0; draw(); }; return; }
    if (cardIdx >= Lst.length) cardIdx = 0; const c = Lst[cardIdx]; const k = (state.cards[c.id] || {}).k;
    v.innerHTML = `<article class="sheet"><div class="eyebrow">Interview flashcards · ${cardIdx + 1} of ${Lst.length}</div>
    <div class="row" style="margin:10px 0"><button class="btn ${cardFilter === 'all' ? '' : 'ghost'}" data-f="all">All (${CARDS.length})</button><button class="btn ${cardFilter === 'rev' ? '' : 'ghost'}" data-f="rev">Not marked "I know it" (${CARDS.filter(x => !(state.cards[x.id] && state.cards[x.id].k === 1)).length})</button><button class="btn ghost" data-sh="1">Shuffle</button></div>
    <div class="cardbox"><div class="eyebrow">${esc(c.tag || '')}${k === 1 ? ' · I know it' : k === 2 ? ' · review later' : ''}</div><div class="cq">${c.q}</div>
    ${cardShown ? `<div class="prose">${c.a}</div><div class="row"><button class="btn" data-k="1">I know it</button><button class="btn ghost" data-k="2">Review later</button></div>` : '<div><button class="btn" data-show="1">Show the answer</button></div>'}</div>
    <div class="row" style="margin-top:12px"><button class="btn ghost" data-nav="-1">← Back</button><button class="btn ghost" data-nav="1">Next →</button></div>
    <p class="src">Answer out loud first, then open the answer. The questions are phrased the way they are often asked at interviews for junior and middle test automation roles.</p></article>`;
    $$('[data-copy]', v).forEach(bt => { bt.onclick = () => { const t = document.getElementById(bt.dataset.copy); if (t) copyText(t.textContent, bt); }; });
    v.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.f) { cardFilter = b.dataset.f; cardIdx = 0; cardShown = false; draw(); }
      else if (b.dataset.sh) { const a = shuffle(CARDS); CARDS.splice(0, CARDS.length, ...a); cardIdx = 0; cardShown = false; draw(); }
      else if (b.dataset.show) { cardShown = true; draw(); }
      else if (b.dataset.k) { state.cards[c.id] = { k: +b.dataset.k, ts: Date.now() }; touch(); cardShown = false; if (cardFilter === 'rev' && b.dataset.k === '1') { /* the card leaves the filtered list */ } else cardIdx++; draw(); renderChrome(); }
      else if (b.dataset.nav) { cardIdx = (cardIdx + +b.dataset.nav + Lst.length) % Lst.length; cardShown = false; draw(); }
    };
  };
  draw();
}

/* ===== glossary ===== */
function renderGlossary(v) {
  v.innerHTML = `<article class="sheet"><div class="eyebrow">Glossary</div><h1 style="font-size:1.8rem;margin:.3rem 0">${GLOSS.length} terms of test automation</h1>
  <p class="lead">Short working definitions. For exact wording, use the Playwright documentation.</p>
  <div class="field" style="max-width:420px"><label for="gl-q">Search</label><input type="text" id="gl-q" placeholder="locator, fixture, flaky…"></div>
  <div class="tbl"><table><thead><tr><th>Term</th><th>Also called</th><th>What it is</th></tr></thead><tbody id="gl-body"></tbody></table></div></article>`;
  const draw = q => { const s = q.trim().toLowerCase(); $('#gl-body').innerHTML = GLOSS.filter(g => !s || (g.en + ' ' + (g.alt || '') + ' ' + g.d).toLowerCase().includes(s)).map(g => `<tr class="gl-row"><td>${esc(g.en)}</td><td>${esc(g.alt || '')}</td><td>${g.d}</td></tr>`).join('') || '<tr><td colspan="3">Nothing found</td></tr>'; };
  draw(''); $('#gl-q').oninput = e => draw(e.target.value);
}

/* ===== utilities and start ===== */
function copyText(text, btn) {
  const done = () => { if (!btn) return; const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = o; }, 1400); };
  try { navigator.clipboard.writeText(text).then(done, () => fallback()); } catch (e) { fallback(); }
  function fallback() { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { /* copy is optional */ } t.remove(); }
}
function boot() {
  $('#menu-btn').onclick = () => $('#nav').classList.toggle('open');
  $$('.lang button').forEach(b => { b.onclick = () => setLang(b.dataset.lang); });
  window.addEventListener('hashchange', () => route());
  initStore(); route();
}

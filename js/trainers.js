'use strict';
/* Interactive trainers: small exercises inside a module. Each one has a title, a tag and an init(body) function.
   The code lab and the player are in widgets.js. Text that depends on the track is chosen with state.lang. */

const T = (o) => (o && typeof o === 'object' && 'py' in o) ? o[state.lang] : o;

/* ===== 1. Which layer of the test pyramid? ===== */
WIDGETS.pyramid = { title: 'Where does this check belong?', tag: 'classification', init(b) {
  const layers = ['Unit test', 'API test', 'UI test (browser)'];
  const items = [
    ['Does the discount function return 10 EUR for a cart of 100 EUR?', 0, 'It is pure logic. A unit test runs in milliseconds and needs no browser and no server.'],
    ['Does POST /api/orders answer 400 when the quantity is negative?', 1, 'It is a rule of the server contract. An API test checks it directly, faster and with less noise than clicking through a page.'],
    ['Can a customer pay with a card and see the confirmation page?', 2, 'It is a whole user journey across several pages. This is what a UI test is for. Keep only a few of these, for the flows that matter most.'],
    ['Does the email validator accept "a@b.co" and reject "a@"?', 0, 'One function with many inputs: ideal for unit tests with a table of examples.'],
    ['Does GET /api/accounts return the fields "name" and "balance"?', 1, 'It is a data contract. An API test reads the response and checks the fields.'],
    ['Does the "Forgot password" link open the reset page in the browser?', 2, 'It needs a real page, a real click and a navigation. That is the UI layer.'],
    ['Does a very long product name wrap without breaking the card layout?', 2, 'It is about how things look in a browser. Only a browser can answer it.'],
    ['Does the tax calculation round half cents the same way for every country?', 0, 'It is calculation logic that does not need a page. Cover it with many fast unit tests.']
  ];
  const ids = items.map(() => uid('pyr'));
  b.innerHTML = '<p class="src">Pick the cheapest layer that can still catch the problem.</p>' + items.map((it, i) => `<div class="field" style="margin-bottom:10px"><label for="${ids[i]}">${i + 1}. ${it[0]}</label><select id="${ids[i]}"><option value="">Choose a layer</option>${layers.map((r, j) => `<option value="${j}">${r}</option>`).join('')}</select><div class="fb-slot" id="${ids[i]}-fb"></div></div>`).join('') + '<div class="row"><button class="btn" data-a="check">Check</button><span class="score" data-role="score"></span></div>';
  $('[data-a=check]', b).onclick = () => {
    let ok = 0;
    items.forEach((it, i) => { const v = $('#' + ids[i], b).value; const good = v !== '' && +v === it[1]; if (good) ok++; $('#' + ids[i] + '-fb', b).innerHTML = v === '' ? '' : `<div class="fb ${good ? 'ok' : 'bad'}">${good ? 'Correct. ' : 'Better: ' + layers[it[1]] + '. '}${it[2]}</div>`; });
    $('[data-role=score]', b).textContent = `${ok} of ${items.length} correct`;
  };
} };

/* ===== 2. Setup error decoder ===== */
WIDGETS.errdecoder = { title: 'Error decoder', tag: 'troubleshooting', init(b) {
  const E = [
    { w: 'both', e: 'Executable doesn\'t exist at ...ms-playwright... Looks like Playwright was just installed or updated.', c: 'The Playwright library is installed, but the browsers it controls were not downloaded.', f: { py: 'Run <code>playwright install</code> (or <code>python -m playwright install chromium</code>) inside the same virtual environment.', kt: 'The Java library downloads browsers on the first run. Check that the machine is online, or that a proxy does not block the download, then run the test again.' }, y: 'Playwright drives its own copies of the browsers, so that tests behave the same on every machine.' },
    { w: 'py', e: 'ModuleNotFoundError: No module named \'playwright\'', c: 'The package was installed in a different Python than the one that runs your test, usually because the virtual environment is not active.', f: { py: 'Activate the environment (<code>.venv\\Scripts\\activate</code> on Windows, <code>source .venv/bin/activate</code> on macOS and Linux) and run <code>pip install -r requirements.txt</code> again.', kt: '' }, y: 'Each virtual environment has its own packages. The terminal prompt usually shows (.venv) when it is active.' },
    { w: 'py', e: 'fixture \'page\' not found', c: 'pytest does not know the pytest-playwright plugin, so the page fixture does not exist.', f: { py: 'Install the plugin in the active environment: <code>pip install pytest-playwright</code>. Check with <code>pip list</code>.', kt: '' }, y: 'The page fixture is not built into pytest. It comes from the plugin.' },
    { w: 'py', e: 'playwright: command not found  /  \'playwright\' is not recognized', c: 'The command-line tool is not on your PATH, because the environment is not active.', f: { py: 'Activate the environment, or call it through Python: <code>python -m playwright install</code>.', kt: '' }, y: 'python -m always uses the packages of the Python you named.' },
    { w: 'both', e: 'TimeoutError: Timeout 30000ms exceeded. waiting for get_by_role(...)', c: 'Playwright waited 30 seconds and the locator never matched an element it could use. A typo, a wrong page, an element that never appears, or a hidden or disabled element.', f: { py: 'Run headed (<code>--headed</code>) and look at the page. Check the spelling of the name, and whether the page really opened. Use codegen to compare.', kt: 'Launch with <code>setHeadless(false)</code> and look at the page. Check the spelling of the name, and whether the page really opened. Use codegen to compare.' }, y: 'The error is long, but the first line of "Call log" tells you what it was waiting for and what it saw.' },
    { w: 'both', e: 'strict mode violation: ... resolved to 3 elements', c: 'The locator matches more than one element, and an action needs exactly one.', f: { py: 'Make the locator more specific: add a name, narrow it with <code>filter</code> or scope it to a container. Use <code>.first</code> only when the order is really meant.', kt: 'Make the locator more specific: add a name, narrow it with <code>filter</code> or scope it to a container. Use <code>.first()</code> only when the order is really meant.' }, y: 'If Playwright clicked "one of three", the test would pass on the wrong button and nobody would notice.' },
    { w: 'kt', e: 'Unresolved reference: getByRole  /  Unresolved reference: Playwright', c: 'The Playwright library is not on the classpath, or an import is missing.', f: { py: '', kt: 'Check that <code>testImplementation("com.microsoft.playwright:playwright:1.64.0")</code> is in <code>build.gradle.kts</code>, reload the Gradle project, and add <code>import com.microsoft.playwright.*</code>.' }, y: 'Kotlin reports what it cannot see. Usually it is a dependency that was not downloaded yet.' },
    { w: 'kt', e: 'Unsupported class file major version  /  Unsupported Java', c: 'Gradle or the Kotlin plugin was started with a Java version that does not match.', f: { py: '', kt: 'Use JDK 17 or newer (this course was tested with 21). In IntelliJ IDEA: Settings, Build Tools, Gradle, Gradle JVM. In the terminal check <code>java -version</code>.' }, y: 'The Java library, Gradle and Kotlin all have to agree on a Java version.' },
    { w: 'both', e: 'net::ERR_NAME_NOT_RESOLVED at https://...', c: 'The browser cannot find that host name: a typo in the address, no internet, or a blocked domain.', f: { py: 'Copy the address into a normal browser. Check the spelling, the proxy and the VPN.', kt: 'Copy the address into a normal browser. Check the spelling, the proxy and the VPN.' }, y: 'This error comes from the browser, not from Playwright, so the test code is probably fine.' },
    { w: 'both', e: 'Target page, context or browser has been closed', c: 'The test used a page after its context or the browser was closed, for example in a cleanup step that ran too early or in another test.', f: { py: 'Use the page only inside the test that received it. Do not store it in a global variable.', kt: 'Check the order of @AfterEach and @AfterAll, and do not share one page between tests.' }, y: 'Every test should get its own fresh context, so that nothing outlives the test.' }
  ];
  const mine = E.filter(x => x.w === 'both' || x.w === state.lang);
  const id = uid('err');
  b.innerHTML = `<div class="field" style="max-width:640px"><label for="${id}">Pick the message you see (only ${LANG_NAME[state.lang]} messages and shared ones are listed)</label><select id="${id}"><option value="">Choose an error</option>${mine.map((x, i) => `<option value="${i}">${esc(x.e)}</option>`).join('')}</select></div><div id="${id}-out" style="margin-top:10px"></div>`;
  $('#' + id, b).onchange = e => {
    const x = mine[e.target.value]; const out = $('#' + id + '-out', b);
    out.innerHTML = x ? `<div class="fb info"><b>What it means.</b> ${x.c}</div><div class="fb ok"><b>What to do.</b> ${x.f[state.lang] || x.f.py || x.f.kt}</div><p class="src"><b>Why it works this way.</b> ${x.y}</p>` : '';
  };
} };

/* ===== 3. Which locator survives a change? ===== */
WIDGETS.locrank = { title: 'Which locator survives a change?', tag: 'experiment', init(b) {
  const el = '<button class="btn btn-primary css-1x2y" data-testid="signin">Sign in</button>';
  const C = [
    { n: 'Position in the layout', py: 'page.locator("div > div:nth-child(2) > button")', kt: 'page.locator("div > div:nth-child(2) > button")', s: [0, 1, 0] },
    { n: 'Generated class names', py: 'page.locator(".btn.btn-primary.css-1x2y")', kt: 'page.locator(".btn.btn-primary.css-1x2y")', s: [0, 1, 1] },
    { n: 'XPath with text', py: 'page.locator("//button[text()=\'Sign in\']")', kt: 'page.locator("//button[text()=\'Sign in\']")', s: [1, 0, 1] },
    { n: 'Text', py: 'page.get_by_text("Sign in")', kt: 'page.getByText("Sign in")', s: [1, 0, 1] },
    { n: 'Role and name', py: 'page.get_by_role("button", name="Sign in")', kt: 'page.getByRole(AriaRole.BUTTON, Page.GetByRoleOptions().setName("Sign in"))', s: [1, 0, 1] },
    { n: 'Test id', py: 'page.get_by_test_id("signin")', kt: 'page.getByTestId("signin")', s: [1, 1, 1] }
  ];
  const S = [
    ['Developers rename the CSS classes', 'The classes now look like "button-x91f". The button text and the test id stay.'],
    ['The page is translated to German', 'The text becomes "Anmelden". The test id stays.'],
    ['The button moves into another container', 'The markup around the button changes. The button itself stays.']
  ];
  const applied = [false, false, false];
  const draw = () => {
    b.innerHTML = `<p class="src">The element on the page: <code>${esc(el)}</code>. Apply the changes one by one and watch which locators keep working.</p>
    <div class="row">${S.map((s, i) => `<button class="btn ${applied[i] ? '' : 'ghost'}" data-i="${i}" aria-pressed="${applied[i]}">${applied[i] ? '✓ ' : ''}${s[0]}</button>`).join('')}</div>
    <p class="src">${S.filter((_, i) => applied[i]).map(s => s[1]).join(' ')}</p>
    <div class="tbl"><table><thead><tr><th>Locator</th><th>Code</th>${S.map(s => `<th>${s[0]}</th>`).join('')}</tr></thead><tbody>${C.map(c => `<tr><td><b>${c.n}</b></td><td><code>${esc(T(c))}</code></td>${c.s.map((v, i) => `<td>${applied[i] ? (v ? '<span class="pill ok">works</span>' : '<span class="pill bad">breaks</span>') : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    ${applied.every(Boolean) ? '<div class="fb info"><b>What to take from it.</b> Only the test id survived all three, but it needs the developers to add it. Role and name is the best choice when there is no test id, because it follows what a user sees and what a screen reader announces. Text breaks when the wording changes. Layout-based CSS and generated classes break the most often.</div>' : ''}`;
    $$('[data-i]', b).forEach(x => { x.onclick = () => { applied[+x.dataset.i] = !applied[+x.dataset.i]; draw(); }; });
  };
  draw();
} };

/* ===== 4. Hard wait or auto-wait? ===== */
WIDGETS.autowait = { title: 'Hard wait or auto-wait?', tag: 'simulation', init(b) {
  const id = uid('aw');
  b.innerHTML = `<p class="src">The page needs some time before the result appears. Drag the slider to change that time, then run the same test 100 times with a random delay between 0.5 and 4 seconds.</p>
  <div class="field" style="max-width:420px"><label for="${id}">The page needs <b data-role="n">2.0</b> s</label><input type="range" id="${id}" min="0.5" max="8" step="0.5" value="2"></div>
  <div class="tbl"><table><thead><tr><th>Strategy</th><th>On this page</th><th>Test time</th></tr></thead><tbody data-role="rows"></tbody></table></div>
  <div class="row"><button class="btn" data-a="many">Run 100 times (random delay)</button></div><div data-role="many" style="margin-top:8px"></div>`;
  const strategies = [
    { n: 'Hard wait of 1 second', lim: 1, fixed: true }, { n: 'Hard wait of 3 seconds', lim: 3, fixed: true },
    { n: 'Hard wait of 10 seconds', lim: 10, fixed: true }, { n: 'expect(...) with the default 5 s timeout', lim: 5, fixed: false }, { n: 'An action that auto-waits (30 s)', lim: 30, fixed: false }
  ];
  const one = (s, n) => { const ok = n <= s.lim; return { ok, t: s.fixed ? s.lim : (ok ? n : s.lim) }; };
  const paint = () => {
    const n = +$('#' + id, b).value; $('[data-role=n]', b).textContent = n.toFixed(1);
    $('[data-role=rows]', b).innerHTML = strategies.map(s => { const r = one(s, n); return `<tr><td>${s.n}</td><td>${r.ok ? '<span class="pill ok">passes</span>' : '<span class="pill bad">fails</span>'}</td><td class="num">${r.t.toFixed(1)} s${s.fixed && r.ok && s.lim - n >= 1 ? ' <span class="src">(wasted ' + (s.lim - n).toFixed(1) + ' s)</span>' : ''}</td></tr>`; }).join('');
  };
  $('#' + id, b).oninput = paint; paint();
  $('[data-a=many]', b).onclick = () => {
    const runs = Array.from({ length: 100 }, () => 0.5 + Math.random() * 3.5);
    $('[data-role=many]', b).innerHTML = '<div class="tbl"><table><thead><tr><th>Strategy</th><th>Passed</th><th>Average time</th></tr></thead><tbody>' + strategies.map(s => { const rs = runs.map(n => one(s, n)); const p = rs.filter(r => r.ok).length; const avg = rs.reduce((a, r) => a + r.t, 0) / rs.length; return `<tr><td>${s.n}</td><td class="num">${p} of 100 ${p < 100 ? '<span class="pill bad">flaky</span>' : '<span class="pill ok">stable</span>'}</td><td class="num">${avg.toFixed(1)} s</td></tr>`; }).join('') + '</tbody></table></div><p class="src">A short hard wait fails when the page is slow. A long one passes but wastes time on every run. Waiting for the condition passes as fast as the page allows.</p>';
  };
} };

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const PW = require('../js/runner.js');
const SB = require('../js/sandbox.js');

const run = (app, src, lang, o) => PW.run(SB[app], src, lang, o);
const ok = r => { assert.equal(r.error, null, r.error && r.error.text); assert.equal(r.ok, true); return r; };

const PY_LOGIN = `
page.get_by_label("Email").fill("ada@example.com")
page.get_by_label("Password").fill("secret123")
page.get_by_role("button", name="Sign in").click()
expect(page.get_by_role("heading", name="Welcome, Ada")).to_be_visible()
`;
const KT_LOGIN = `
page.getByLabel("Email").fill("ada@example.com")
page.getByLabel("Password").fill("secret123")
page.getByRole(AriaRole.BUTTON, Page.GetByRoleOptions().setName("Sign in")).click()
assertThat(page.getByRole(AriaRole.HEADING, Page.GetByRoleOptions().setName("Welcome, Ada"))).isVisible()
`;

test('the same login test runs in Python and in Kotlin with the same result', () => {
  const py = ok(run('login', PY_LOGIN, 'py')), kt = ok(run('login', KT_LOGIN, 'kt'));
  assert.equal(py.url, 'https://shop.example/account');
  assert.equal(kt.url, py.url);
  assert.deepEqual(kt.actions.map(a => [a.type, a.key, a.value]), py.actions.map(a => [a.type, a.key, a.value]));
  assert.deepEqual(kt.asserts.map(a => [a.type, a.passed]), py.asserts.map(a => [a.type, a.passed]));
  assert.deepEqual(kt.entries.map(e => e.kind), py.entries.map(e => e.kind));
});

test('test boilerplate around the body is accepted in both languages', () => {
  ok(run('login', 'import re\nfrom playwright.sync_api import Page, expect\n\n\ndef test_login(page: Page):\n' + PY_LOGIN.split('\n').map(l => l && '    ' + l).join('\n'), 'py'));
  ok(run('login', 'package demo\n\nimport com.microsoft.playwright.*\nimport org.junit.jupiter.api.Test\n\nclass LoginTest {\n    @Test\n    fun signsIn() {\n' + KT_LOGIN.split('\n').map(l => l && '        ' + l).join('\n') + '\n    }\n}\n', 'kt'));
});

test('multi-line calls, comments and trailing semicolons are fine', () => {
  const kt = `// fill the form
val email = page.getByLabel("Email")
email.fill("ada@example.com"); /* block comment */
page.getByLabel("Password")
    .fill("secret123")
page.getByRole(AriaRole.BUTTON,
    Page.GetByRoleOptions().setName("Sign in")).click()`;
  const r = ok(run('login', kt, 'kt'));
  assert.equal(r.url, 'https://shop.example/account');
  const py = `# fill the form
email = page.get_by_label("Email")
email.fill(
    "ada@example.com"
)
page.get_by_label("Password").fill("secret123")
page.get_by_role("button", name="Sign in").click()`;
  assert.equal(ok(run('login', py, 'py')).url, 'https://shop.example/account');
});

test('a wrong password shows the error and stays on the page', () => {
  const r = ok(run('login', 'page.get_by_label("Email").fill("ada@example.com")\npage.get_by_label("Password").fill("nope")\npage.get_by_role("button", name="Sign in").click()\nexpect(page.get_by_role("alert")).to_have_text("Invalid email or password")', 'py'));
  assert.equal(r.url, 'https://shop.example/login');
});

test('a password field has no textbox role, so get_by_role("textbox") cannot find it', () => {
  const r = run('login', 'page.get_by_role("textbox", name="Password").fill("x")', 'py');
  assert.equal(r.ok, false);
  assert.equal(r.error.kind, 'timeout');
  assert.match(r.error.text, /Timeout 30000ms exceeded/);
  assert.match(r.error.text, /waiting for get_by_role\("textbox", name="Password"\)/);
  assert.equal(r.clock, 30000, 'the wait is virtual, so it costs no real time');
});

test('strict mode: a locator that matches three buttons cannot be clicked', () => {
  const r = run('shop', 'page.get_by_role("button", name="Add to cart").click()', 'py');
  assert.equal(r.error.kind, 'strict');
  assert.match(r.error.text, /strict mode violation/);
  assert.match(r.error.text, /resolved to 3 elements/);
  assert.equal(r.entries[r.entries.length - 1].status, 'fail');
  assert.ok(r.entries[r.entries.length - 1].html.includes('data-hl="bad"'), 'the three matches are marked in the page view');
  const k = run('shop', 'page.getByRole(AriaRole.BUTTON, Page.GetByRoleOptions().setName("Add to cart")).click()', 'kt');
  assert.equal(k.error.kind, 'strict');
});

test('narrowing a locator fixes the strict mode violation', () => {
  const py = 'page.get_by_test_id("product-backpack").get_by_role("button", name="Add to cart").click()\nexpect(page.get_by_text("Cart: 1 item")).to_be_visible()';
  const r = ok(run('shop', py, 'py'));
  assert.deepEqual(r.actions.map(a => a.key), ['add-backpack']);
  const viaFilter = 'page.locator(".card").filter(has_text="Pen").get_by_role("button", name="Add to cart").click()';
  assert.deepEqual(ok(run('shop', viaFilter, 'py')).actions.map(a => a.key), ['add-pen']);
  const kt = 'page.locator(".card").filter(Locator.FilterOptions().setHasText("Pen")).getByRole(AriaRole.BUTTON, Page.GetByRoleOptions().setName("Add to cart")).click()';
  assert.deepEqual(ok(run('shop', kt, 'kt')).actions.map(a => a.key), ['add-pen']);
  assert.deepEqual(ok(run('shop', 'page.get_by_role("button", name="Add to cart").first.click()', 'py')).actions.map(a => a.key), ['add-notebook']);
  assert.deepEqual(ok(run('shop', 'page.getByRole(AriaRole.BUTTON, Page.GetByRoleOptions().setName("Add to cart")).last().click()', 'kt')).actions.map(a => a.key), ['add-backpack']);
  assert.deepEqual(ok(run('shop', 'page.get_by_role("button", name="Add to cart").nth(1).click()', 'py')).actions.map(a => a.key), ['add-pen']);
});

test('auto-waiting: a click on a disabled button waits until it is enabled', () => {
  const py = `page.get_by_role("button", name="Load report").click()
page.get_by_role("button", name="Download CSV").click()
expect(page.get_by_text("File saved")).to_be_visible()`;
  const r = ok(run('slow', py, 'py'));
  assert.equal(r.clock, 2000, 'the download button is enabled 2000 ms after the click');
  const dl = r.entries.find(e => e.code.includes('Download'));
  assert.equal(dl.ms, 2000);
  assert.match(dl.msg, /waited 2000 ms/);
});

test('a disabled button that never becomes enabled ends in a timeout with a readable log', () => {
  const r = run('slow', 'page.get_by_role("button", name="Download CSV").click()', 'py');
  assert.equal(r.error.kind, 'timeout');
  assert.match(r.error.text, /element is not enabled/);
  assert.match(r.error.text, /<button id="download" disabled>Download CSV<\/button>/);
  const k = run('slow', 'page.getByRole(AriaRole.BUTTON, Page.GetByRoleOptions().setName("Download CSV")).click()', 'kt');
  assert.match(k.error.text, /TimeoutError/);
});

test('web-first expect retries until the page catches up', () => {
  const py = `page.get_by_role("button", name="Load report").click()
expect(page.get_by_text("Report ready")).to_be_visible()
expect(page.get_by_role("row")).to_have_count(3)`;
  const r = ok(run('slow', py, 'py'));
  assert.equal(r.asserts[0].waited, 1500);
  const slow = run('slow', py, 'py', { speed: 3 });
  assert.equal(slow.ok, true, 'at 4500 ms the report is still inside the 5000 ms of expect');
  const tooSlow = run('slow', py, 'py', { speed: 4 });
  assert.equal(tooSlow.error.kind, 'expect');
  assert.match(tooSlow.error.text, /Locator expected to be visible/);
  assert.match(tooSlow.error.text, /Call log:/);
});

test('a hard wait works on a fast page and fails on a slow one, and it is flagged', () => {
  const py = `import time
page.get_by_role("button", name="Load report").click()
time.sleep(2)
expect(page.get_by_text("Report ready")).to_be_visible()`;
  const fast = ok(run('slow', py, 'py'));
  assert.equal(fast.flags.sleep, true);
  assert.equal(fast.entries.find(e => e.kind === 'sleep').status, 'warn');
  const slow = run('slow', py, 'py', { speed: 3 });
  assert.equal(slow.ok, true, 'sleep(2) = 2000 ms then expect waits up to 5000 ms more: 4500 ms is still reached');
  const slower = run('slow', py, 'py', { speed: 6 });
  assert.equal(slower.ok, false, 'the same code fails when the page is slower than the guess');
  const kt = ok(run('slow', 'page.getByRole(AriaRole.BUTTON, Page.GetByRoleOptions().setName("Load report")).click()\nThread.sleep(2000)\nassertThat(page.getByText("Report ready")).isVisible()', 'kt'));
  assert.equal(kt.flags.sleep, true);
});

test('plain assertions read once and do not wait', () => {
  const py = 'page.get_by_role("button", name="Load report").click()\nassert page.get_by_text("Report ready").is_visible()';
  const r = run('slow', py, 'py');
  assert.equal(r.error.kind, 'assert');
  assert.match(r.error.text, /does not wait/);
  const ok2 = ok(run('slow', 'assert page.get_by_role("heading").inner_text() == "Sales report"', 'py'));
  assert.equal(ok2.flags.plain, true);
  const kt = run('slow', 'assertEquals("Sales report", page.getByRole(AriaRole.HEADING).innerText())', 'kt');
  assert.equal(kt.ok, true);
});

test('Python and Kotlin names are not mixed up, and the error says what to use', () => {
  const a = run('login', 'page.getByRole("button").click()', 'py');
  assert.match(a.error.text, /AttributeError: 'Page' object has no attribute 'getByRole'/);
  assert.match(a.error.text, /Did you mean: 'get_by_role'/);
  const b = run('login', 'page.get_by_role(AriaRole.BUTTON).click()', 'kt');
  assert.match(b.error.text, /Unresolved reference: get_by_role/);
  assert.match(b.error.text, /did you mean getByRole/);
  const c = run('login', 'page.goto("https://shop.example/login")', 'kt');
  assert.match(c.error.text, /did you mean navigate/);
  const d = run('login', 'page.navigate("https://shop.example/login")', 'py');
  assert.match(d.error.text, /Did you mean: 'goto'/);
  const e = run('login', 'expect(page.get_by_role("button")).isVisible()', 'py');
  assert.equal(e.ok, false);
  const f = run('login', 'expect(page.getByRole(AriaRole.BUTTON)).isVisible()', 'kt');
  assert.match(f.error.text, /Unresolved reference: expect/);
});

test('first and last are properties in Python and methods in Kotlin', () => {
  const a = run('shop', 'page.get_by_role("button", name="Add to cart").first().click()', 'py');
  assert.match(a.error.text, /not callable/);
  const b = run('shop', 'page.getByRole(AriaRole.BUTTON, Page.GetByRoleOptions().setName("Add to cart")).first.click()', 'kt');
  assert.equal(b.ok, false);
});

test('a role enum must exist in Kotlin, a role string is only a string in Python', () => {
  const k = run('login', 'page.getByRole(AriaRole.BUTON).click()', 'kt');
  assert.match(k.error.text, /Unresolved reference: BUTON/);
  const p = run('login', 'page.get_by_role("buton").click()', 'py', { actionTimeout: 1000 });
  assert.equal(p.error.kind, 'timeout');
});

test('XPath and other unsupported selector engines get a helpful message', () => {
  const r = run('login', 'page.locator("xpath=//button").click()', 'py');
  assert.equal(r.error.kind, 'unsupported');
  assert.match(r.error.text, /last resort/);
  const r2 = run('login', 'page.locator("//button").click()', 'py');
  assert.equal(r2.error.kind, 'unsupported');
});

test('CSS selectors, text= and test ids work', () => {
  ok(run('login', 'page.locator("#email").fill("a")\npage.locator("form input[type=checkbox]").check()\nexpect(page.locator("button:has-text(\\"Sign in\\")")).to_be_enabled()', 'py'));
  ok(run('login', 'page.locator("text=Forgot password?").click()\npage.get_by_test_id("signin").click()\nexpect(page.locator("#error")).to_have_text("Email is required")', 'py'));
  const badCss = run('login', 'page.locator("div[")', 'py');
  assert.equal(badCss.error.kind, 'selector');
  assert.match(badCss.error.text, /Unexpected token in the CSS selector/);
});

test('get_by_text matches the smallest element and exact matching is strict', () => {
  ok(run('shop', 'expect(page.get_by_text("Backpack")).to_have_count(1)\nexpect(page.get_by_text("Cart")).to_have_count(5)', 'py'));
  ok(run('shop', 'expect(page.get_by_text("cart", exact=True)).to_have_count(0)\nexpect(page.get_by_text("Your cart", exact=True)).to_have_count(1)', 'py'));
  const rx = ok(run('shop', 'import re\nexpect(page.get_by_role("button", name=re.compile("add", re.I))).to_have_count(3)', 'py'));
  assert.equal(rx.asserts[0].passed, true);
  ok(run('shop', 'assertThat(page.getByRole(AriaRole.BUTTON, Page.GetByRoleOptions().setName(Pattern.compile("add", Pattern.CASE_INSENSITIVE)))).hasCount(3)', 'kt'));
});

test('the todo list: fill, press Enter, check one item, read the counter', () => {
  const py = `box = page.get_by_placeholder("What needs to be done?")
box.fill("Buy milk")
box.press("Enter")
box.fill("Walk the dog")
box.press("Enter")
expect(page.get_by_test_id("todo-item")).to_have_count(2)
page.get_by_test_id("todo-item").filter(has_text="Buy milk").get_by_role("checkbox").check()
expect(page.get_by_text("1 item left")).to_be_visible()
expect(page.get_by_role("button", name="Clear completed")).to_be_visible()`;
  const r = ok(run('todo', py, 'py'));
  assert.deepEqual(r.actions.map(a => a.type), ['fill', 'press', 'fill', 'press', 'check']);
  const kt = `val box = page.getByPlaceholder("What needs to be done?")
box.fill("Buy milk")
box.press("Enter")
assertThat(page.getByTestId("todo-item")).hasCount(1)
page.getByTestId("todo-item").getByRole(AriaRole.CHECKBOX).check()
assertThat(page.getByText("0 items left")).isVisible()`;
  ok(run('todo', kt, 'kt'));
});

test('login on a slow server: expect waits, a plain check does not', () => {
  const good = `page.get_by_label("Email").fill("ada@example.com")
page.get_by_label("Password").fill("secret123")
page.get_by_role("button", name="Sign in").click()
expect(page.get_by_role("heading", name="Welcome, Ada")).to_be_visible()
expect(page).to_have_url("**/account")
expect(page).to_have_title("Your account")`;
  const r = ok(run('loginSlow', good, 'py'));
  assert.equal(r.asserts[0].waited, 1200);
  const bad = good.split('\n').slice(0, 3).join('\n') + '\nassert page.get_by_role("heading", name="Welcome, Ada").is_visible()';
  assert.equal(run('loginSlow', bad, 'py').error.kind, 'assert');
});

test('syntax errors point to a line and unsupported statements are explained', () => {
  const a = run('login', 'page.get_by_label("Email").fill("x"\npage.get_by_role("button").click()', 'py');
  assert.equal(a.error.kind, 'syntax');
  assert.ok(a.error.line >= 1);
  const b = run('login', 'for i in range(3):\n    page.get_by_role("button").click()', 'py');
  assert.equal(b.error.kind, 'unsupported');
  assert.match(b.error.text, /"for"/);
  const c = run('login', 'val name = "x"\npage.getByLabel("Email").fill("Hello $name")', 'kt');
  assert.match(c.error.text, /interpolation/);
  const d = run('login', 'page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("x")).click()', 'kt');
  assert.match(d.error.text, /no "new" keyword/);
  const e = run('login', 'page.get_by_label("Email").fill("unterminated)', 'py');
  assert.equal(e.error.kind, 'syntax');
  assert.equal(PW.run(SB.login, '', 'py').ok, true, 'an empty program only opens the page');
});

test('a locator alone does nothing, and a missing "()" is reported', () => {
  const a = ok(run('login', 'page.get_by_role("button", name="Sign in")', 'py'));
  assert.equal(a.entries[1].kind, 'locator');
  const b = ok(run('login', 'page.get_by_role("button", name="Sign in").click', 'py'));
  assert.equal(b.flags.missingParens, true);
  assert.equal(b.url, 'https://shop.example/login', 'nothing was clicked');
  const c = run('login', 'page.getByRole(AriaRole.BUTTON).click', 'kt');
  assert.equal(c.ok, false);
});

test('a locator is lazy: the page can change between creating and using it', () => {
  const r = ok(run('shop', 'cart = page.get_by_text("Cart: 0 items")\npage.get_by_test_id("product-pen").get_by_role("button").click()\nexpect(cart).to_have_count(0)\nexpect(page.get_by_text("Cart: 1 item")).to_be_visible()', 'py'));
  assert.equal(r.asserts.length, 2);
});

test('each step of a run keeps a picture of the page and the highlighted element', () => {
  const r = ok(run('login', PY_LOGIN, 'py'));
  assert.ok(r.entries.length >= 5);
  const fill = r.entries.find(e => e.code.includes('Email'));
  assert.match(fill.html, /data-hl="ok"/);
  assert.match(fill.html, /value="ada@example\.com"/);
  assert.ok(r.entries[0].html.includes('Sign in'));
  assert.ok(r.entries[r.entries.length - 1].html.includes('Welcome, Ada'));
  assert.equal(PW.run(SB.login, PY_LOGIN, 'py', { snap: false }).entries[1].html, '');
});

test('escaping: text typed by the learner cannot add markup to the page picture', () => {
  const r = ok(run('login', 'page.get_by_label("Email").fill("<img src=x onerror=alert(1)>")', 'py'));
  const html = r.entries[r.entries.length - 1].html;
  assert.ok(!html.includes('<img'), html);
  assert.ok(html.includes('&lt;img'));
});

test('print shows values, count() reads once', () => {
  const r = ok(run('shop', 'print(page.get_by_role("button").count())\nprint(page.title())\nprint(page.url)', 'py'));
  assert.deepEqual(r.out, ['3', 'Products', 'https://shop.example/products']);
  const k = ok(run('shop', 'println(page.getByRole(AriaRole.BUTTON).count())\nprintln(page.title())\nprintln(page.url())', 'kt'));
  assert.deepEqual(k.out, r.out);
});

test('checks: a lab can ask for actions, assertions, locator kinds and the absence of anti-patterns', () => {
  const res = ok(run('login', PY_LOGIN, 'py'));
  const rows = PW.evalChecks(res, [
    { t: 'fills the email', k: 'did', action: 'fill', key: 'email', value: 'ada@example.com' },
    { t: 'clicks sign in', k: 'did', action: 'click', key: 'signin' },
    { t: 'asserts the heading', k: 'asserted', type: 'toBeVisible' },
    { t: 'uses a role locator for the button', k: 'via', key: 'signin', kinds: ['role'] },
    { t: 'no css', k: 'not', what: 'css' },
    { t: 'no sleep', k: 'not', what: 'sleep' },
    { t: 'ends on the account page', k: 'url', url: 'https://shop.example/account' },
    { t: 'welcome visible', k: 'final', key: 'welcome', visible: true },
    { t: 'wrong', k: 'did', action: 'click', key: 'forgot' }
  ]);
  assert.deepEqual(rows.map(r => r.ok), [true, true, true, true, true, true, true, true, false]);
});

test('grade() runs a second time on a slow page for "robust" labs', () => {
  const sleepy = 'page.get_by_role("button", name="Load report").click()\nimport time\ntime.sleep(2)\nexpect(page.get_by_text("Report ready")).to_be_visible()';
  const good = 'page.get_by_role("button", name="Load report").click()\nexpect(page.get_by_text("Report ready")).to_be_visible()';
  const checks = [{ t: 'report shown', k: 'final', key: 'ready', visible: true }, { t: 'robust', k: 'robust' }];
  assert.equal(PW.grade(SB.slow, good, 'py', checks).passed, true);
  const g = PW.grade(SB.slow, sleepy, 'py', checks);
  assert.equal(g.passed, false, 'a hard wait is never robust');
  assert.equal(g.rows[0].ok, true);
  assert.equal(g.rows[1].ok, false);
});

test('page.goto opens the practice page, and an unknown address fails like a real one', () => {
  const a = ok(run('login', 'page.goto("https://shop.example/login")\nexpect(page.get_by_role("heading", name="Sign in")).to_be_visible()', 'py'));
  assert.equal(a.url, 'https://shop.example/login');
  const b = run('login', 'page.goto("https://example.org/")', 'py');
  assert.match(b.error.text, /ERR_NAME_NOT_RESOLVED/);
  ok(run('login', 'page.navigate("https://shop.example/login")', 'kt'));
});

test('negative assertions and to_be_hidden pass when the element is absent', () => {
  ok(run('login', 'expect(page.get_by_role("alert")).not_to_be_visible()\nexpect(page.get_by_role("alert")).to_be_hidden()\nexpect(page.get_by_text("nothing here")).to_have_count(0)', 'py'));
  ok(run('login', 'assertThat(page.getByRole(AriaRole.ALERT)).not().isVisible()\nassertThat(page.getByRole(AriaRole.ALERT)).isHidden()', 'kt'));
  const bad = run('login', 'expect(page.get_by_role("heading")).not_to_be_visible()', 'py');
  assert.equal(bad.error.kind, 'expect');
});

test('select_option, check and uncheck on form controls', () => {
  const app = { id: 't', start: 'm', pages: { m: { url: 'https://t.example/', title: 'T', html: '<label for="c">Colour</label><select id="c"><option value="r">Red</option><option value="b">Blue</option></select><label><input type="checkbox" id="x"> Agree</label>', on() {} } } };
  const r = PW.run(app, 'page.get_by_label("Colour").select_option("b")\nexpect(page.get_by_label("Colour")).to_have_value("b")\npage.get_by_label("Agree").check()\nexpect(page.get_by_label("Agree")).to_be_checked()\npage.get_by_label("Agree").uncheck()\nexpect(page.get_by_label("Agree")).not_to_be_checked()', 'py');
  assert.equal(r.error, null, r.error && r.error.text);
});

test('the highlighter escapes the code and colours it', () => {
  const h = PW.highlight('page.get_by_role("button")  # <b>\nx = 1', 'py');
  assert.match(h, /tk-f/);
  assert.match(h, /tk-s/);
  assert.match(h, /tk-c/);
  assert.ok(!h.includes('<b>'));
  assert.match(PW.highlight('val x = page.getByText("a") // c', 'kt'), /tk-k/);
});

'use strict';
/* The practice pages for the code lab. Each app is a few small pages written as plain HTML plus a handler for events.
   Handlers see a tiny API: el(id), key(name), show, hide, setText, setHtml, append, remove, enable, disable, after(ms, fn), navigate(page), store.
   Timers use the virtual clock of the lab, so a "slow" page is instant to run but still behaves like a slow page. */

const SANDBOX = {};

/* ===== login: an instant sign-in form ===== */
function loginApp(slow) {
  return {
    id: slow ? 'loginSlow' : 'login', title: slow ? 'Sign-in page (the server answers slowly)' : 'Sign-in page', start: 'main',
    pages: {
      main: {
        url: 'https://shop.example/login', title: 'Sign in',
        html: `<h1>Sign in</h1>
<p>Test account: ada@example.com / secret123</p>
<form>
<label for="email">Email</label><input id="email" type="email" placeholder="you@example.com">
<label for="password">Password</label><input id="password" type="password">
<label class="inline"><input id="remember" type="checkbox"> Remember me</label>
<button id="signin" type="submit" data-testid="signin">Sign in</button>
<a href="/forgot" id="forgot">Forgot password?</a>
</form>
<div id="error" role="alert" hidden></div>
<p id="progress" role="status" hidden>Signing in...</p>`,
        on(type, n, api) {
          if (type !== 'click' || n.attrs.id !== 'signin') return;
          const email = api.value(api.el('email')).trim(), pw = api.value(api.el('password')), err = api.el('error');
          api.hide(err);
          if (!email) { api.setText(err, 'Email is required'); api.show(err); return; }
          if (email === 'ada@example.com' && pw === 'secret123') {
            if (!slow) { api.navigate('account'); return; }
            api.disable(api.el('signin')); api.show(api.el('progress'));
            api.after(1200, a => a.navigate('account'));
            return;
          }
          api.setText(err, 'Invalid email or password'); api.show(err);
        }
      },
      account: {
        url: 'https://shop.example/account', title: 'Your account',
        html: `<h1 id="welcome">Welcome, Ada</h1><p id="signed-in" role="status">You are signed in.</p><button id="signout">Sign out</button>`,
        on(type, n, api) { if (type === 'click' && n.attrs.id === 'signout') api.navigate('main'); }
      }
    }
  };
}
SANDBOX.login = loginApp(false);
SANDBOX.loginSlow = loginApp(true);

/* ===== shop: repeated buttons, so a locator can match more than one element ===== */
SANDBOX.shop = {
  id: 'shop', title: 'Online shop', start: 'main',
  pages: {
    main: {
      url: 'https://shop.example/products', title: 'Products',
      html: `<h1>Products</h1>
<p id="cart-count" role="status">Cart: 0 items</p>
<div class="card" data-testid="product-notebook"><span>Notebook</span><span>$5</span><button data-key="add-notebook">Add to cart</button></div>
<div class="card" data-testid="product-pen"><span>Pen</span><span>$2</span><button data-key="add-pen">Add to cart</button></div>
<div class="card" data-testid="product-backpack"><span>Backpack</span><span>$40</span><button data-key="add-backpack">Add to cart</button></div>
<h2>Your cart</h2>
<ul id="cart-list"></ul>`,
        on(type, n, api) {
          if (type !== 'click' || n.tag !== 'button') return;
          const cart = api.store.cart = api.store.cart || [];
          const paint = () => {
            api.setText(api.el('cart-count'), 'Cart: ' + cart.length + (cart.length === 1 ? ' item' : ' items'));
            api.setHtml(api.el('cart-list'), cart.map(c => '<li data-key="line-' + c.toLowerCase() + '"><span>' + c + '</span> <button data-key="remove-' + c.toLowerCase() + '">Remove</button></li>').join(''));
          };
          if (n.key.startsWith('add-')) { cart.push(n.key.slice(4).replace(/^./, c => c.toUpperCase())); paint(); }
          else if (n.key.startsWith('remove-')) { const name = n.key.slice(7).replace(/^./, c => c.toUpperCase()); cart.splice(cart.indexOf(name), 1); paint(); }
        }
    }
  }
};

/* ===== todo: a list that grows, a counter that changes. It mirrors the public TodoMVC demo that the real exercises use. ===== */
SANDBOX.todo = {
  id: 'todo', title: 'Todo list', start: 'main',
  pages: {
    main: {
      url: 'https://demo.playwright.dev/todomvc/', title: 'TodoMVC',
      html: `<h1>todos</h1>
<input id="new-todo" class="new-todo" type="text" placeholder="What needs to be done?">
<ul class="todo-list" id="list"></ul>
<p><span id="count" data-testid="todo-count"><strong>0</strong> items left</span></p>
<button id="clear" class="clear-completed" hidden>Clear completed</button>`,
      on(type, n, api, d) {
        const list = api.el('list');
        const repaint = () => {
          const items = api.keys('item'); const left = items.filter(i => i.attrs.class !== 'completed').length;
          api.setHtml(api.el('count'), '<strong>' + left + '</strong> ' + (left === 1 ? 'item left' : 'items left'));
          if (items.length - left > 0) api.show(api.el('clear')); else api.hide(api.el('clear'));
        };
        if (type === 'keydown' && n.attrs.id === 'new-todo' && d.key === 'Enter') {
          const text = api.value(n).trim(); if (!text) return;
          api.append(list, '<li data-key="item" data-testid="todo-item" class=""><input aria-label="Toggle Todo" class="toggle" type="checkbox" data-key="toggle"><label data-testid="todo-title">' + text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '</label><button aria-label="Delete" class="destroy">x</button></li>');
          api.setValue(n, ''); repaint();
        } else if (type === 'change' && n.attrs.class === 'toggle') {
          n.parent.attrs.class = n.checked ? 'completed' : ''; repaint();
        } else if (type === 'click' && n.attrs.class === 'destroy') {
          api.remove(n.parent); repaint();
        } else if (type === 'click' && n.attrs.id === 'clear') {
          api.keys('item').filter(i => i.attrs.class === 'completed').forEach(i => api.remove(i)); repaint();
        }
      }
    }
  }
};

/* ===== slow: content that appears later, and a button that is disabled for a while ===== */
SANDBOX.slow = {
  id: 'slow', title: 'Report page (loads in a moment)', start: 'main',
  pages: {
    main: {
      url: 'https://reports.example/sales', title: 'Sales report',
      html: `<h1>Sales report</h1>
<button id="load">Load report</button>
<p id="loading" class="spinner" role="status" hidden>Loading...</p>
<table id="report" hidden><thead><tr><th>Region</th><th>Sales</th></tr></thead><tbody><tr><td>North</td><td>120</td></tr><tr><td>South</td><td>95</td></tr></tbody></table>
<p id="ready" role="status" hidden>Report ready</p>
<button id="download" disabled>Download CSV</button>
<p id="saved" role="status" hidden>File saved</p>`,
      on(type, n, api) {
        if (type !== 'click') return;
        if (n.attrs.id === 'load') {
          api.disable(n); api.show(api.el('loading'));
          api.after(1500, a => { a.hide(a.el('loading')); a.show(a.el('report')); a.show(a.el('ready')); });
          api.after(2000, a => a.enable(a.el('download')));
        } else if (n.attrs.id === 'download') api.show(api.el('saved'));
      }
    }
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = SANDBOX;

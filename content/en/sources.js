/* Public sources shown at the bottom of each module. */
(function () {
  const L = {
    pwPyIntro: { t: 'Playwright for Python: installation and first test', u: 'https://playwright.dev/python/docs/intro' },
    pwJavaIntro: { t: 'Playwright for Java: installation and first test', u: 'https://playwright.dev/java/docs/intro' },
    pwPyContexts: { t: 'Playwright for Python: isolation and browser contexts', u: 'https://playwright.dev/python/docs/browser-contexts' },
    pwPyCodegen: { t: 'Playwright for Python: generating tests with codegen', u: 'https://playwright.dev/python/docs/codegen-intro' },
    pwPyLocators: { t: 'Playwright for Python: locators', u: 'https://playwright.dev/python/docs/locators' },
    pwJavaLocators: { t: 'Playwright for Java: locators', u: 'https://playwright.dev/java/docs/locators' },
    mdnRoles: { t: 'MDN: ARIA roles', u: 'https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles' },
    pwPyAction: { t: 'Playwright for Python: actionability', u: 'https://playwright.dev/python/docs/actionability' },
    pwPyInput: { t: 'Playwright for Python: actions', u: 'https://playwright.dev/python/docs/input' },
    pwPyAssert: { t: 'Playwright for Python: assertions', u: 'https://playwright.dev/python/docs/test-assertions' },
    pwJavaAssert: { t: 'Playwright for Java: assertions', u: 'https://playwright.dev/java/docs/test-assertions' },
    pwPyRunners: { t: 'Playwright for Python: pytest plugin and fixtures', u: 'https://playwright.dev/python/docs/test-runners' },
    pwJavaJunit: { t: 'Playwright for Java: writing tests with JUnit', u: 'https://playwright.dev/java/docs/junit' },
    pytestFix: { t: 'pytest: how to use fixtures', u: 'https://docs.pytest.org/en/stable/how-to/fixtures.html' },
    junitGuide: { t: 'JUnit user guide', u: 'https://docs.junit.org/current/user-guide/' },
    pwPyPom: { t: 'Playwright for Python: page object models', u: 'https://playwright.dev/python/docs/pom' },
    fowlerPo: { t: 'Martin Fowler: Page Object', u: 'https://martinfowler.com/bliki/PageObject.html' },
    pwPyAuth: { t: 'Playwright for Python: authentication', u: 'https://playwright.dev/python/docs/auth' },
    pwJavaAuth: { t: 'Playwright for Java: authentication', u: 'https://playwright.dev/java/docs/auth' },
    twelveFactor: { t: 'The Twelve-Factor App: config in the environment', u: 'https://12factor.net/config' },
    pwPyApi: { t: 'Playwright for Python: API testing', u: 'https://playwright.dev/python/docs/api-testing' },
    pwPyMock: { t: 'Playwright for Python: mock APIs', u: 'https://playwright.dev/python/docs/mock' },
    pwPyNetwork: { t: 'Playwright for Python: network', u: 'https://playwright.dev/python/docs/network' },
    pwJavaNetwork: { t: 'Playwright for Java: network', u: 'https://playwright.dev/java/docs/network' },
    pwPyTrace: { t: 'Playwright for Python: trace viewer', u: 'https://playwright.dev/python/docs/trace-viewer' },
    pwJavaTrace: { t: 'Playwright for Java: trace viewer', u: 'https://playwright.dev/java/docs/trace-viewer' },
    pwPyDebug: { t: 'Playwright for Python: debugging tests', u: 'https://playwright.dev/python/docs/debug' },
    pwPyCi: { t: 'Playwright for Python: continuous integration', u: 'https://playwright.dev/python/docs/ci' },
    pwJavaCi: { t: 'Playwright for Java: continuous integration', u: 'https://playwright.dev/java/docs/ci' },
    xdist: { t: 'pytest-xdist: running tests in parallel', u: 'https://pytest-xdist.readthedocs.io/en/stable/' },
    pwPyBest: { t: 'Playwright: best practices (the general guide)', u: 'https://playwright.dev/docs/best-practices' },
    parabank: { t: 'ParaBank demo bank', u: 'https://parabank.parasoft.com/parabank/index.htm' },
    todomvc: { t: 'TodoMVC demo used in this course', u: 'https://demo.playwright.dev/todomvc/' },
    fowlerPyramid: { t: 'Martin Fowler: the practical test pyramid', u: 'https://martinfowler.com/articles/practical-test-pyramid.html' }
  };
  const S = {
    m1: [L.pwPyIntro, L.pwJavaIntro, L.pwPyContexts, L.fowlerPyramid],
    m2: [L.pwPyIntro, L.pwJavaIntro, L.pwPyCodegen, L.todomvc],
    m3: [L.pwPyLocators, L.pwJavaLocators, L.mdnRoles],
    m4: [L.pwPyAction, L.pwPyInput],
    m5: [L.pwPyAssert, L.pwJavaAssert],
    m6: [L.pytestFix, L.junitGuide, L.pwPyRunners, L.pwJavaJunit],
    m7: [L.pwPyPom, L.fowlerPo],
    m8: [L.pwPyAuth, L.pwJavaAuth, L.twelveFactor],
    m9: [L.pwPyApi, L.pwPyMock, L.pwPyNetwork, L.pwJavaNetwork],
    m10: [L.pwPyTrace, L.pwJavaTrace, L.pwPyDebug],
    m11: [L.pwPyCi, L.pwJavaCi, L.xdist, L.junitGuide],
    m12: [L.parabank, L.pwPyBest, L.pwPyApi]
  };
  Object.keys(S).forEach(k => { SOURCES[k] = S[k]; });
})();

# Test automation with Playwright

A free, interactive course on test automation with Playwright for manual testers who are moving into automation. Choose **Python** or **Kotlin**, and switch at any moment. The course is in English.

Live site: https://panipanda.github.io/playwright-autotests-course/

## What is inside

- 12 modules, about 13 hours in total: the big picture, setup and the first test, locators, actions and auto-waiting, assertions, structure and isolation, the Page Object pattern, test data and signing in, API testing and network control, debugging and flaky tests, configuration, parallel runs and CI, and a final project on a public demo bank.
- 69 step-by-step instructions that say what to do, why, and what you should see. Each track gets its own steps (a virtual environment for Python, Gradle for Kotlin).
- 6 watch-me-code lessons: animated, with the code written step by step and explained.
- 9 code labs that run in the browser: you write Playwright code in Python or Kotlin and see it run against a practice page, with a step log in the style of the trace viewer and error messages in the style of the real ones.
- 12 trainers (classification, ordering, experiments), 81 quiz questions with explanations, a 20-question final exam, 20 interview flashcards and a glossary of 64 terms.
- A "Sources" block at the end of each module with the official documentation.
- Runnable example projects in `examples/python` and `examples/kotlin`. Every piece of course code that is tagged as an example is checked by the tests to be exactly the code in these projects, and the projects were run against the live demo sites.

## About the Kotlin track

Playwright has no separate Kotlin library. The Kotlin track uses the official Playwright for Java library, which works from Kotlin without a wrapper, together with JUnit and Gradle.

## What the code lab is, and what it is not

The lab is a teaching simulation. It reads a safe subset of the Playwright API (locators, actions, web-first assertions) in Python or Kotlin syntax, and runs it against small practice pages with a virtual clock, so waiting is instant. It teaches how locators, strict mode, auto-waiting and assertions behave, and it checks the outcome (not the exact text of your code). It is not a real browser and cannot run your own site. The real thing is in the step-by-step parts that you run on your own computer.

## Your progress stays with you

Progress and notes stay in your browser (in `localStorage`, under the key `playwright-autotests-course.v1`). Nothing is sent anywhere. There are no accounts, cookies, servers, databases or analytics, and the site makes no requests to other sites (the fonts are served from this repository).

What is saved: the chosen track, completed modules, ticked steps, passed labs, quiz answers and best scores, flashcard marks, the text of practice answers and of your lab code, and the module you opened last.

What is not saved on purpose: an unfinished final exam.

Limits you should know about:

- Progress belongs to one browser profile on one device. It does not sync between your phone and your laptop.
- It is lost if you clear site data, close a private window or switch browsers. Safari may clear site data on its own after about a week without a visit.
- Use **Export progress** on the home page to download `progress.json`, and **Import progress** to restore it anywhere. Import merges the file with the progress already in the browser and ignores anything it does not recognize.
- Do not type anything confidential in the practice fields.

If the browser blocks site storage, the course still works and the header says "Progress is not saved".

## Run it locally

There is no build step. Open `index.html` in a browser, or serve the folder:

```
npx serve .
```

or any static server, for example `python -m http.server`.

## Tests

```
node --test "tests/*.test.js"
```

The tests check the structure of the course data, the quiz answer key, that every lab solution passes in both languages (and that no starter passes by itself), the code simulator (parsers, locators, auto-waiting, error messages), the progress export and import, that tagged code in the course equals the code in `examples/`, and that no non-English text, long dashes or personal traces are present in tracked files. They run on every push through GitHub Actions.

## The example projects

```
examples/python    pytest with pytest-playwright
examples/kotlin    Gradle (Kotlin DSL), JUnit and Playwright for Java
```

See `examples/README.md` for how to run them. They test public demo sites (the TodoMVC demo of Playwright and the ParaBank demo bank), so they need an internet connection, and they are not run on every push. The workflows `Examples (Python)` and `Examples (Kotlin)` run them on demand.

Versions used (November 2026): Python 3.12, playwright 1.64.0, pytest-playwright 0.10.0; JDK 21, Kotlin 2.4.21, Gradle 9.9, JUnit Jupiter 6.1.3, Playwright for Java 1.64.0.

## Structure

```
index.html              page shell and metadata
assets/                 styles and fonts (IBM Plex, SIL OFL)
js/lib.js               HTML helpers (code, steps, language switch), answer checking, progress state
js/runner.js            the Playwright simulator: parsers for Python and Kotlin, a small DOM, locators, auto-waiting
js/sandbox.js           the practice pages of the labs
js/core.js              state, router, language switch, quizzes, practice, flashcards, exam, glossary
js/widgets.js           the code lab and the watch-me-code player
js/trainers.js          the 12 trainers
content/en/             course text: modules, flashcards, glossary, sources
examples/               runnable Python and Kotlin projects
tests/                  node:test suites
```

The text lives in `content/en/` on its own, so another language can be added next to it without changing the code.

## Disclaimer

This is educational material. It is not affiliated with Microsoft, JetBrains or the pytest project, and the names of tools are used only to describe how they work. Tools change quickly, and options, defaults and versions differ over time. Check the code against the current documentation before relying on it at work. The demo sites belong to their owners and may change or be unavailable. Last reviewed: November 2026.

## License

Code: MIT (`LICENSE`). Course text: CC BY 4.0 (`LICENSE-CONTENT.md`). Fonts: SIL OFL 1.1.

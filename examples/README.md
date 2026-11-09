# Example projects

Two runnable projects with the code of the course. Every test file matches a module: for example `test_locators.py` and `LocatorsTest.kt` belong to module 3.

The tests use public demo sites: the [TodoMVC demo](https://demo.playwright.dev/todomvc/) of Playwright, the [API mocking demo](https://demo.playwright.dev/api-mocking/), JSONPlaceholder and the [ParaBank](https://parabank.parasoft.com/parabank/index.htm) demo bank. You need an internet connection. ParaBank limits how many requests one visitor can make, so do not run its tests many times in a row.

## Python

```
cd examples/python
python -m venv .venv
.venv\Scripts\activate          # on macOS and Linux: source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
pytest
```

Useful options: `pytest --headed --slowmo 700`, `pytest -m smoke`, `pytest tests/test_first.py`, `pytest --tracing retain-on-failure`. Run in parallel with `pip install pytest-xdist` and `pytest -n 4 --base-url https://demo.playwright.dev` (the base address is needed by one test).

## Kotlin

```
cd examples/kotlin
./gradlew test                  # on Windows: gradlew.bat test
```

The first run downloads Gradle and the browsers of Playwright, which takes a few minutes. Run one class with `./gradlew test --tests "course.FirstTest"`. Open the Playwright command-line tool with `./gradlew playwright --args="codegen https://demo.playwright.dev/todomvc/"`.

## Code style

The Python code is checked with `ruff` (see `ruff.toml`).

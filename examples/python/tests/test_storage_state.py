from playwright.sync_api import Browser, expect


def test_second_context_remembers_the_first(browser: Browser, tmp_path):
    state_file = tmp_path / "state.json"

    first = browser.new_context()
    page = first.new_page()
    page.goto("https://demo.playwright.dev/todomvc/")
    new_todo = page.get_by_placeholder("What needs to be done?")
    new_todo.fill("Buy milk")
    new_todo.press("Enter")
    first.storage_state(path=str(state_file))
    first.close()

    second = browser.new_context(storage_state=str(state_file))
    page = second.new_page()
    page.goto("https://demo.playwright.dev/todomvc/")
    expect(page.get_by_test_id("todo-title")).to_have_text("Buy milk")
    second.close()

from playwright.sync_api import Page, expect


def test_a_adds_a_todo(page: Page):
    page.goto("https://demo.playwright.dev/todomvc/")
    new_todo = page.get_by_placeholder("What needs to be done?")
    new_todo.fill("Buy milk")
    new_todo.press("Enter")
    expect(page.get_by_test_id("todo-item")).to_have_count(1)


def test_b_starts_empty(page: Page):
    page.goto("https://demo.playwright.dev/todomvc/")
    expect(page.get_by_test_id("todo-item")).to_have_count(0)

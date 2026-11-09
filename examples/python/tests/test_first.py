from playwright.sync_api import Page, expect


def test_adds_a_todo(page: Page):
    page.goto("https://demo.playwright.dev/todomvc/")

    new_todo = page.get_by_placeholder("What needs to be done?")
    new_todo.fill("Buy milk")
    new_todo.press("Enter")

    expect(page.get_by_test_id("todo-title")).to_have_text("Buy milk")

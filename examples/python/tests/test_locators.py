from playwright.sync_api import Page, expect


def test_finds_the_right_todo(page: Page):
    page.goto("https://demo.playwright.dev/todomvc/")

    new_todo = page.get_by_placeholder("What needs to be done?")
    new_todo.fill("Buy milk")
    new_todo.press("Enter")
    new_todo.fill("Walk the dog")
    new_todo.press("Enter")

    items = page.get_by_test_id("todo-item")
    expect(items).to_have_count(2)

    walk = items.filter(has_text="Walk the dog")
    walk.get_by_role("checkbox", name="Toggle Todo").check()
    expect(page.get_by_test_id("todo-count")).to_have_text("1 item left")

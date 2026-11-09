from playwright.sync_api import Page, expect


def test_completes_and_clears_todos(page: Page):
    page.goto("https://demo.playwright.dev/todomvc/")

    new_todo = page.get_by_placeholder("What needs to be done?")
    for title in ["Buy milk", "Walk the dog", "Write tests"]:
        new_todo.fill(title)
        new_todo.press("Enter")

    page.get_by_test_id("todo-item").filter(has_text="Buy milk").get_by_role("checkbox").check()
    page.get_by_role("button", name="Clear completed").click()

    expect(page.get_by_test_id("todo-item")).to_have_count(2)

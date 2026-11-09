import re

from playwright.sync_api import Page, expect


def test_assertions_on_the_todo_list(page: Page):
    page.goto("https://demo.playwright.dev/todomvc/")
    new_todo = page.get_by_placeholder("What needs to be done?")
    new_todo.fill("Buy milk")
    new_todo.press("Enter")
    new_todo.fill("Walk the dog")
    new_todo.press("Enter")

    items = page.get_by_test_id("todo-item")
    expect(items).to_have_count(2)
    expect(items.first).to_contain_text("milk")
    expect(items.nth(1)).to_have_text("Walk the dog")
    expect(new_todo).to_be_empty()
    expect(page.get_by_role("button", name="Clear completed")).to_be_hidden()

    items.first.get_by_role("checkbox").check()
    expect(items.first.get_by_role("checkbox")).to_be_checked()
    expect(page.get_by_role("button", name="Clear completed")).to_be_visible()

    expect(page).to_have_url(re.compile("/todomvc/"))
    expect(page).to_have_title(re.compile("TodoMVC"))

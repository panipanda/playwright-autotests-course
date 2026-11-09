from playwright.sync_api import Page, expect

from pages.todo_page import TodoPage


def test_completes_and_clears(page: Page):
    todo = TodoPage(page)
    todo.open()
    todo.add("Buy milk")
    todo.add("Walk the dog")

    todo.complete("Buy milk")
    todo.clear_completed.click()

    expect(todo.items).to_have_count(1)
    expect(todo.items).to_have_text("Walk the dog")

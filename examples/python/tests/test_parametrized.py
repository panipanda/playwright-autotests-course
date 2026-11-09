import pytest
from playwright.sync_api import Page, expect


@pytest.mark.parametrize("title", ["Buy milk", "Walk the dog", "Write tests"])
def test_adds_each_title(page: Page, title: str):
    page.goto("https://demo.playwright.dev/todomvc/")
    new_todo = page.get_by_placeholder("What needs to be done?")
    new_todo.fill(title)
    new_todo.press("Enter")

    expect(page.get_by_test_id("todo-title")).to_have_text(title)

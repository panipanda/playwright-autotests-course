import pytest
from playwright.sync_api import Page


@pytest.fixture
def todo_page(page: Page) -> Page:
    """A TodoMVC page that already has two todos."""
    page.goto("https://demo.playwright.dev/todomvc/")
    new_todo = page.get_by_placeholder("What needs to be done?")
    for title in ["Buy milk", "Walk the dog"]:
        new_todo.fill(title)
        new_todo.press("Enter")
    return page

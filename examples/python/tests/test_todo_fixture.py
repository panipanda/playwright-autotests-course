import pytest
from playwright.sync_api import Page, expect


@pytest.mark.smoke
def test_starts_with_two_items_left(todo_page: Page):
    expect(todo_page.get_by_test_id("todo-count")).to_have_text("2 items left")


def test_completing_one_leaves_one(todo_page: Page):
    todo_page.get_by_test_id("todo-item").first.get_by_role("checkbox").check()
    expect(todo_page.get_by_test_id("todo-count")).to_have_text("1 item left")

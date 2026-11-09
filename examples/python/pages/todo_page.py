from playwright.sync_api import Locator, Page


class TodoPage:
    URL = "https://demo.playwright.dev/todomvc/"

    def __init__(self, page: Page):
        self.page = page
        self.new_todo = page.get_by_placeholder("What needs to be done?")
        self.items = page.get_by_test_id("todo-item")
        self.count = page.get_by_test_id("todo-count")
        self.clear_completed = page.get_by_role("button", name="Clear completed")

    def open(self) -> None:
        self.page.goto(self.URL)

    def add(self, title: str) -> None:
        self.new_todo.fill(title)
        self.new_todo.press("Enter")

    def row(self, title: str) -> Locator:
        return self.items.filter(has_text=title)

    def complete(self, title: str) -> None:
        self.row(title).get_by_role("checkbox").check()

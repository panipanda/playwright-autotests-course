package course

import com.microsoft.playwright.Locator
import com.microsoft.playwright.Page
import com.microsoft.playwright.options.AriaRole

class TodoPage(private val page: Page) {
    val newTodo: Locator = page.getByPlaceholder("What needs to be done?")
    val items: Locator = page.getByTestId("todo-item")
    val count: Locator = page.getByTestId("todo-count")
    val clearCompleted: Locator = page.getByRole(AriaRole.BUTTON, Page.GetByRoleOptions().setName("Clear completed"))

    fun open() {
        page.navigate("https://demo.playwright.dev/todomvc/")
    }

    fun add(title: String) {
        newTodo.fill(title)
        newTodo.press("Enter")
    }

    fun row(title: String): Locator = items.filter(Locator.FilterOptions().setHasText(title))

    fun complete(title: String) {
        row(title).getByRole(AriaRole.CHECKBOX).check()
    }
}

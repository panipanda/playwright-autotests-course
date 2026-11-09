package course

import com.microsoft.playwright.Page
import com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat
import com.microsoft.playwright.options.AriaRole
import org.junit.jupiter.api.Test
import java.util.regex.Pattern

class AssertionsTest : BaseTest() {
    @Test
    fun assertionsOnTheTodoList() {
        page.navigate("https://demo.playwright.dev/todomvc/")
        val newTodo = page.getByPlaceholder("What needs to be done?")
        newTodo.fill("Buy milk")
        newTodo.press("Enter")
        newTodo.fill("Walk the dog")
        newTodo.press("Enter")

        val items = page.getByTestId("todo-item")
        val clearCompleted = page.getByRole(AriaRole.BUTTON, Page.GetByRoleOptions().setName("Clear completed"))
        assertThat(items).hasCount(2)
        assertThat(items.first()).containsText("milk")
        assertThat(items.nth(1)).hasText("Walk the dog")
        assertThat(newTodo).isEmpty()
        assertThat(clearCompleted).isHidden()

        items.first().getByRole(AriaRole.CHECKBOX).check()
        assertThat(items.first().getByRole(AriaRole.CHECKBOX)).isChecked()
        assertThat(clearCompleted).isVisible()

        assertThat(page).hasURL(Pattern.compile("/todomvc/"))
        assertThat(page).hasTitle(Pattern.compile("TodoMVC"))
    }
}

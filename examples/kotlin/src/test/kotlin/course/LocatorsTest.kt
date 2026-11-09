package course

import com.microsoft.playwright.Locator
import com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat
import com.microsoft.playwright.options.AriaRole
import org.junit.jupiter.api.Test

class LocatorsTest : BaseTest() {
    @Test
    fun findsTheRightTodo() {
        page.navigate("https://demo.playwright.dev/todomvc/")

        val newTodo = page.getByPlaceholder("What needs to be done?")
        newTodo.fill("Buy milk")
        newTodo.press("Enter")
        newTodo.fill("Walk the dog")
        newTodo.press("Enter")

        val items = page.getByTestId("todo-item")
        assertThat(items).hasCount(2)

        val walk = items.filter(Locator.FilterOptions().setHasText("Walk the dog"))
        walk.getByRole(AriaRole.CHECKBOX, Locator.GetByRoleOptions().setName("Toggle Todo")).check()
        assertThat(page.getByTestId("todo-count")).hasText("1 item left")
    }
}

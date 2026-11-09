package course

import com.microsoft.playwright.Locator
import com.microsoft.playwright.Page
import com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat
import com.microsoft.playwright.options.AriaRole
import org.junit.jupiter.api.Test

class ActionsTest : BaseTest() {
    @Test
    fun completesAndClearsTodos() {
        page.navigate("https://demo.playwright.dev/todomvc/")

        val newTodo = page.getByPlaceholder("What needs to be done?")
        for (title in listOf("Buy milk", "Walk the dog", "Write tests")) {
            newTodo.fill(title)
            newTodo.press("Enter")
        }

        page.getByTestId("todo-item")
            .filter(Locator.FilterOptions().setHasText("Buy milk"))
            .getByRole(AriaRole.CHECKBOX)
            .check()
        page.getByRole(AriaRole.BUTTON, Page.GetByRoleOptions().setName("Clear completed")).click()

        assertThat(page.getByTestId("todo-item")).hasCount(2)
    }
}

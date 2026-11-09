package course

import com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat
import org.junit.jupiter.api.Test

class IsolationTest : BaseTest() {
    @Test
    fun aAddsATodo() {
        page.navigate("https://demo.playwright.dev/todomvc/")
        val newTodo = page.getByPlaceholder("What needs to be done?")
        newTodo.fill("Buy milk")
        newTodo.press("Enter")
        assertThat(page.getByTestId("todo-item")).hasCount(1)
    }

    @Test
    fun bStartsEmpty() {
        page.navigate("https://demo.playwright.dev/todomvc/")
        assertThat(page.getByTestId("todo-item")).hasCount(0)
    }
}

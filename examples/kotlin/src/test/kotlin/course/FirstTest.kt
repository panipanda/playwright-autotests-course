package course

import com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat
import org.junit.jupiter.api.Test

class FirstTest : BaseTest() {
    @Test
    fun addsATodo() {
        page.navigate("https://demo.playwright.dev/todomvc/")

        val newTodo = page.getByPlaceholder("What needs to be done?")
        newTodo.fill("Buy milk")
        newTodo.press("Enter")

        assertThat(page.getByTestId("todo-title")).hasText("Buy milk")
    }
}

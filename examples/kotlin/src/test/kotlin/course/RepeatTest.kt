package course

import com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat
import org.junit.jupiter.api.RepeatedTest

class RepeatTest : BaseTest() {
    @RepeatedTest(5)
    fun addsATodoEveryTime() {
        page.navigate("https://demo.playwright.dev/todomvc/")
        val newTodo = page.getByPlaceholder("What needs to be done?")
        newTodo.fill("Buy milk")
        newTodo.press("Enter")

        assertThat(page.getByTestId("todo-title")).hasText("Buy milk")
    }
}

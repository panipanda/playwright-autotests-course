package course

import com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

class ParametrizedTest : BaseTest() {
    @ParameterizedTest
    @ValueSource(strings = ["Buy milk", "Walk the dog", "Write tests"])
    fun addsEachTitle(title: String) {
        page.navigate("https://demo.playwright.dev/todomvc/")
        val newTodo = page.getByPlaceholder("What needs to be done?")
        newTodo.fill(title)
        newTodo.press("Enter")

        assertThat(page.getByTestId("todo-title")).hasText(title)
    }
}

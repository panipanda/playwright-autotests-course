package course

import com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat
import com.microsoft.playwright.options.AriaRole
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test

class TodoFixtureTest : BaseTest() {
    @BeforeEach
    fun addTwoTodos() {
        page.navigate("https://demo.playwright.dev/todomvc/")
        val newTodo = page.getByPlaceholder("What needs to be done?")
        for (title in listOf("Buy milk", "Walk the dog")) {
            newTodo.fill(title)
            newTodo.press("Enter")
        }
    }

    @Test
    @Tag("smoke")
    fun startsWithTwoItemsLeft() {
        assertThat(page.getByTestId("todo-count")).hasText("2 items left")
    }

    @Test
    fun completingOneLeavesOne() {
        page.getByTestId("todo-item").first().getByRole(AriaRole.CHECKBOX).check()
        assertThat(page.getByTestId("todo-count")).hasText("1 item left")
    }
}

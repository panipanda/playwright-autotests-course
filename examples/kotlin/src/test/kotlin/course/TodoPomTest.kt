package course

import com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat
import org.junit.jupiter.api.Test

class TodoPomTest : BaseTest() {
    @Test
    fun completesAndClears() {
        val todo = TodoPage(page)
        todo.open()
        todo.add("Buy milk")
        todo.add("Walk the dog")

        todo.complete("Buy milk")
        todo.clearCompleted.click()

        assertThat(todo.items).hasCount(1)
        assertThat(todo.items).hasText("Walk the dog")
    }
}

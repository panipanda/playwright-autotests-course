package course

import com.microsoft.playwright.Browser
import com.microsoft.playwright.BrowserContext
import com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path

class StorageStateTest : BaseTest() {
    @Test
    fun secondContextRemembersTheFirst(@TempDir dir: Path) {
        val stateFile = dir.resolve("state.json")

        page.navigate("https://demo.playwright.dev/todomvc/")
        val newTodo = page.getByPlaceholder("What needs to be done?")
        newTodo.fill("Buy milk")
        newTodo.press("Enter")
        context.storageState(BrowserContext.StorageStateOptions().setPath(stateFile))

        val second = browser.newContext(Browser.NewContextOptions().setStorageStatePath(stateFile))
        val secondPage = second.newPage()
        secondPage.navigate("https://demo.playwright.dev/todomvc/")
        assertThat(secondPage.getByTestId("todo-title")).hasText("Buy milk")
        second.close()
    }
}

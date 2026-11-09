package course

import com.microsoft.playwright.Tracing
import com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInfo
import java.nio.file.Paths

class TraceTest : BaseTest() {
    @BeforeEach
    fun startTracing() {
        context.tracing().start(
            Tracing.StartOptions().setScreenshots(true).setSnapshots(true).setSources(true)
        )
    }

    @AfterEach
    fun stopTracing(testInfo: TestInfo) {
        val name = testInfo.testMethod.get().name
        context.tracing().stop(Tracing.StopOptions().setPath(Paths.get("build/traces/$name.zip")))
    }

    @Test
    fun addsATodoAndKeepsATrace() {
        page.navigate("https://demo.playwright.dev/todomvc/")
        val newTodo = page.getByPlaceholder("What needs to be done?")
        newTodo.fill("Buy milk")
        newTodo.press("Enter")

        assertThat(page.getByTestId("todo-title")).hasText("Buy milk")
    }
}

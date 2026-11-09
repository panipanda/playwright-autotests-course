package course

import com.microsoft.playwright.Browser
import com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat
import org.junit.jupiter.api.Test

class BaseUrlTest : BaseTest() {
    @Test
    fun opensTheAppFromTheBaseUrl() {
        val context = browser.newContext(Browser.NewContextOptions().setBaseURL("https://demo.playwright.dev"))
        val page = context.newPage()

        page.navigate("/todomvc/")

        assertThat(page.getByPlaceholder("What needs to be done?")).isVisible()
        context.close()
    }
}

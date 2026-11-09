package course

import com.google.gson.JsonParser
import com.microsoft.playwright.APIRequest
import com.microsoft.playwright.Route
import com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class ApiAndNetworkTest : BaseTest() {
    @Test
    fun apiReturnsATodo() {
        val api = playwright.request().newContext(
            APIRequest.NewContextOptions().setBaseURL("https://jsonplaceholder.typicode.com")
        )

        val response = api.get("/todos/1")

        assertThat(response).isOK()
        assertEquals(1, JsonParser.parseString(response.text()).asJsonObject["id"].asInt)
        api.dispose()
    }

    @Test
    fun showsAMockedFruit() {
        page.route("**/api/v1/fruits") { route ->
            route.fulfill(
                Route.FulfillOptions()
                    .setContentType("application/json")
                    .setBody("""[{"name": "Dragon fruit", "id": 99}]""")
            )
        }

        page.navigate("https://demo.playwright.dev/api-mocking/")

        assertThat(page.getByText("Dragon fruit")).isVisible()
        assertThat(page.getByText("Strawberry")).hasCount(0)
    }

    @Test
    fun waitsForTheRealResponse() {
        val response = page.waitForResponse("**/api/v1/fruits") {
            page.navigate("https://demo.playwright.dev/api-mocking/")
        }

        assertEquals(200, response.status())
    }
}

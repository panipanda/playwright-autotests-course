package course

import com.google.gson.JsonParser
import com.microsoft.playwright.APIRequest
import com.microsoft.playwright.APIRequestContext
import com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat
import com.microsoft.playwright.options.FormData
import com.microsoft.playwright.options.RequestOptions
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.util.UUID
import java.util.regex.Pattern

class ParabankProjectTest : BaseTest() {
    private val password = "Passw0rd"
    private lateinit var api: APIRequestContext
    private lateinit var username: String
    private var customerId = 0

    private fun registrationFields(user: String): Map<String, String> = mapOf(
        "customer.firstName" to "Test",
        "customer.lastName" to "User",
        "customer.address.street" to "1 Test Street",
        "customer.address.city" to "Testville",
        "customer.address.state" to "TS",
        "customer.address.zipCode" to "12345",
        "customer.phoneNumber" to "5550100",
        "customer.ssn" to "123-45-6789",
        "customer.username" to user,
        "customer.password" to password,
        "repeatedPassword" to password,
    )

    private fun uniqueUsername() = "qa_" + UUID.randomUUID().toString().replace("-", "").take(12)

    private fun json(): RequestOptions = RequestOptions.create().setHeader("Accept", "application/json")

    @BeforeAll
    fun registerCustomer() {
        // One customer for the whole class, because the public demo limits requests.
        api = playwright.request().newContext(APIRequest.NewContextOptions().setBaseURL("$SITE_URL/"))
        username = uniqueUsername()
        val form = FormData.create()
        registrationFields(username).forEach { (key, value) -> form.set(key, value) }
        api.get("register.htm")
        val response = api.post("register.htm", RequestOptions.create().setForm(form))
        assertTrue(response.text().contains("Your account was created successfully"))

        val login = api.get("services/bank/login/$username/$password", json())
        assertThat(login).isOK()
        customerId = JsonParser.parseString(login.text()).asJsonObject["id"].asInt
    }

    @AfterAll
    fun closeApi() {
        api.dispose()
    }

    private fun balanceOf(accountId: Int): BigDecimal {
        val response = api.get("services/bank/accounts/$accountId", json())
        assertThat(response).isOK()
        return JsonParser.parseString(response.text()).asJsonObject["balance"].asBigDecimal
    }

    @Test
    fun registersANewUser() {
        val register = RegisterPage(page)
        val user = uniqueUsername()
        register.open()
        register.fillForm(registrationFields(user))
        register.submit()

        assertThat(register.panel).containsText("Welcome $user")
        assertThat(register.panel).containsText("Your account was created successfully")

        val accounts = AccountsPage(page)
        accounts.open()
        assertThat(accounts.heading).isVisible()
        assertThat(accounts.rows.first()).isVisible()
    }

    @Test
    fun mismatchedPasswordsAreRejected() {
        val register = RegisterPage(page)
        val fields = registrationFields(uniqueUsername()).toMutableMap()
        fields["repeatedPassword"] = "Different1"
        register.open()
        register.fillForm(fields)
        register.submit()

        assertThat(page.getByText("Passwords did not match.")).isVisible()
        assertThat(page).hasURL(Pattern.compile("/register.htm"))
    }

    @Test
    fun transferChangesBothBalances() {
        val accounts = JsonParser.parseString(
            api.get("services/bank/customers/$customerId/accounts", json()).text()
        ).asJsonArray
        val accountA = accounts[0].asJsonObject["id"].asInt
        val created = api.post(
            "services/bank/createAccount",
            json()
                .setQueryParam("customerId", customerId)
                .setQueryParam("newAccountType", 1)
                .setQueryParam("fromAccountId", accountA)
        )
        assertThat(created).isOK()
        val accountB = JsonParser.parseString(created.text()).asJsonObject["id"].asInt
        val beforeA = balanceOf(accountA)
        val beforeB = balanceOf(accountB)
        val amount = BigDecimal("50.00")

        val login = LoginPage(page)
        login.open()
        login.signIn(username, password)
        val transfer = TransferPage(page)
        transfer.open()
        transfer.transfer(amount, accountA, accountB)

        assertThat(transfer.result).containsText("Transfer Complete!")

        val overview = AccountsPage(page)
        overview.open()
        assertThat(overview.row(accountA)).containsText(money(beforeA - amount))
        assertThat(overview.row(accountB)).containsText(money(beforeB + amount))

        assertEquals(0, (beforeA - amount).compareTo(balanceOf(accountA)))
        assertEquals(0, (beforeB + amount).compareTo(balanceOf(accountB)))
    }
}

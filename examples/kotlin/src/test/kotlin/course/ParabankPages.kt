package course

import com.microsoft.playwright.Locator
import com.microsoft.playwright.Page
import com.microsoft.playwright.options.AriaRole
import java.math.BigDecimal
import java.util.Locale

const val SITE_URL = "https://parabank.parasoft.com/parabank"

/** Formats an amount the way ParaBank shows it, for example $365.50. */
fun money(value: BigDecimal): String = "$" + String.format(Locale.US, "%,.2f", value)

class LoginPage(private val page: Page) {
    val username: Locator = page.locator("input[name=\"username\"]")
    val password: Locator = page.locator("input[name=\"password\"]")
    val logIn: Locator = page.getByRole(AriaRole.BUTTON, Page.GetByRoleOptions().setName("Log In"))

    fun open() {
        page.navigate("$SITE_URL/index.htm")
    }

    fun signIn(user: String, pass: String) {
        username.fill(user)
        password.fill(pass)
        logIn.click()
    }
}

class RegisterPage(private val page: Page) {
    val panel: Locator = page.locator("#rightPanel")
    val registerButton: Locator = page.getByRole(AriaRole.BUTTON, Page.GetByRoleOptions().setName("Register"))

    fun open() {
        page.navigate("$SITE_URL/register.htm")
    }

    fun fillForm(fields: Map<String, String>) {
        for ((fieldId, value) in fields) {
            // the form has no labels, and the ids contain dots, so an attribute selector is used
            page.locator("[id=\"$fieldId\"]").fill(value)
        }
    }

    fun submit() {
        registerButton.click()
    }
}

class AccountsPage(private val page: Page) {
    val heading: Locator = page.getByRole(AriaRole.HEADING, Page.GetByRoleOptions().setName("Accounts Overview"))
    val rows: Locator = page.locator("#accountTable tbody tr")

    fun open() {
        page.getByRole(AriaRole.LINK, Page.GetByRoleOptions().setName("Accounts Overview")).click()
    }

    fun row(accountId: Int): Locator = rows.filter(Locator.FilterOptions().setHasText(accountId.toString()))
}

class TransferPage(private val page: Page) {
    val amount: Locator = page.locator("#amount")
    val fromAccount: Locator = page.locator("#fromAccountId")
    val toAccount: Locator = page.locator("#toAccountId")
    val transferButton: Locator = page.getByRole(AriaRole.BUTTON, Page.GetByRoleOptions().setName("Transfer"))
    val result: Locator = page.locator("#showResult")

    fun open() {
        page.getByRole(AriaRole.LINK, Page.GetByRoleOptions().setName("Transfer Funds")).click()
    }

    fun transfer(value: BigDecimal, fromId: Int, toId: Int) {
        amount.fill(value.toPlainString())
        fromAccount.selectOption(fromId.toString())
        toAccount.selectOption(toId.toString())
        transferButton.click()
    }
}

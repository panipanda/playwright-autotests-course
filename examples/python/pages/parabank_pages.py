from decimal import Decimal

from playwright.sync_api import Page

SITE_URL = "https://parabank.parasoft.com/parabank"


def money(value: Decimal) -> str:
    """Format an amount the way ParaBank shows it, for example $365.50."""
    return f"${value:,.2f}"


class LoginPage:
    def __init__(self, page: Page):
        self.page = page
        self.username = page.locator('input[name="username"]')
        self.password = page.locator('input[name="password"]')
        self.log_in = page.get_by_role("button", name="Log In")
        self.error = page.locator("p.error")

    def open(self) -> None:
        self.page.goto(f"{SITE_URL}/index.htm")

    def sign_in(self, username: str, password: str) -> None:
        self.username.fill(username)
        self.password.fill(password)
        self.log_in.click()


class RegisterPage:
    def __init__(self, page: Page):
        self.page = page
        self.panel = page.locator("#rightPanel")
        self.register_button = page.get_by_role("button", name="Register")

    def open(self) -> None:
        self.page.goto(f"{SITE_URL}/register.htm")

    def fill_form(self, fields: dict[str, str]) -> None:
        for field_id, value in fields.items():
            # the form has no labels, and the ids contain dots, so an attribute selector is used
            self.page.locator(f'[id="{field_id}"]').fill(value)

    def submit(self) -> None:
        self.register_button.click()


class AccountsPage:
    def __init__(self, page: Page):
        self.page = page
        self.heading = page.get_by_role("heading", name="Accounts Overview")
        self.rows = page.locator("#accountTable tbody tr")

    def open(self) -> None:
        self.page.get_by_role("link", name="Accounts Overview").click()

    def row(self, account_id: int):
        return self.rows.filter(has_text=str(account_id))


class TransferPage:
    def __init__(self, page: Page):
        self.page = page
        self.amount = page.locator("#amount")
        self.from_account = page.locator("#fromAccountId")
        self.to_account = page.locator("#toAccountId")
        self.transfer_button = page.get_by_role("button", name="Transfer")
        self.result = page.locator("#showResult")

    def open(self) -> None:
        self.page.get_by_role("link", name="Transfer Funds").click()

    def transfer(self, amount: Decimal, from_id: int, to_id: int) -> None:
        self.amount.fill(str(amount))
        self.from_account.select_option(str(from_id))
        self.to_account.select_option(str(to_id))
        self.transfer_button.click()

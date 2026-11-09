import json
import re
import uuid
from decimal import Decimal

import pytest
from playwright.sync_api import APIRequestContext, Page, Playwright, expect

from pages.parabank_pages import (
    SITE_URL,
    AccountsPage,
    LoginPage,
    RegisterPage,
    TransferPage,
    money,
)

JSON = {"Accept": "application/json"}
PASSWORD = "Passw0rd"


def registration_fields(username: str) -> dict[str, str]:
    return {
        "customer.firstName": "Test",
        "customer.lastName": "User",
        "customer.address.street": "1 Test Street",
        "customer.address.city": "Testville",
        "customer.address.state": "TS",
        "customer.address.zipCode": "12345",
        "customer.phoneNumber": "5550100",
        "customer.ssn": "123-45-6789",
        "customer.username": username,
        "customer.password": PASSWORD,
        "repeatedPassword": PASSWORD,
    }


@pytest.fixture(scope="module")
def api(playwright: Playwright):
    context = playwright.request.new_context(base_url=SITE_URL + "/")
    yield context
    context.dispose()


@pytest.fixture(scope="module")
def customer(api: APIRequestContext) -> dict:
    """Register one customer through the form endpoint. The public demo limits requests."""
    username = f"qa_{uuid.uuid4().hex[:12]}"
    api.get("register.htm")
    response = api.post("register.htm", form=registration_fields(username))
    assert "Your account was created successfully" in response.text()

    login = api.get(f"services/bank/login/{username}/{PASSWORD}", headers=JSON)
    expect(login).to_be_ok()
    return {"username": username, "id": login.json()["id"]}


def balance_of(api: APIRequestContext, account_id: int) -> Decimal:
    response = api.get(f"services/bank/accounts/{account_id}", headers=JSON)
    expect(response).to_be_ok()
    return json.loads(response.text(), parse_float=Decimal)["balance"]


def test_registers_a_new_user(page: Page):
    register = RegisterPage(page)
    username = f"qa_{uuid.uuid4().hex[:12]}"
    register.open()
    register.fill_form(registration_fields(username))
    register.submit()

    expect(register.panel).to_contain_text(f"Welcome {username}")
    expect(register.panel).to_contain_text("Your account was created successfully")

    accounts = AccountsPage(page)
    accounts.open()
    expect(accounts.heading).to_be_visible()
    expect(accounts.rows.first).to_be_visible()


def test_mismatched_passwords_are_rejected(page: Page):
    register = RegisterPage(page)
    fields = registration_fields(f"qa_{uuid.uuid4().hex[:12]}")
    fields["repeatedPassword"] = "Different1"
    register.open()
    register.fill_form(fields)
    register.submit()

    expect(page.get_by_text("Passwords did not match.")).to_be_visible()
    expect(page).to_have_url(re.compile("/register.htm"))


def test_transfer_changes_both_balances(page: Page, api: APIRequestContext, customer: dict):
    accounts = api.get(f"services/bank/customers/{customer['id']}/accounts", headers=JSON).json()
    account_a = accounts[0]["id"]
    created = api.post(
        "services/bank/createAccount",
        params={"customerId": customer["id"], "newAccountType": 1, "fromAccountId": account_a},
        headers=JSON,
    )
    expect(created).to_be_ok()
    account_b = created.json()["id"]
    before_a, before_b = balance_of(api, account_a), balance_of(api, account_b)
    amount = Decimal("50.00")

    login = LoginPage(page)
    login.open()
    login.sign_in(customer["username"], PASSWORD)
    transfer = TransferPage(page)
    transfer.open()
    transfer.transfer(amount, account_a, account_b)

    expect(transfer.result).to_contain_text("Transfer Complete!")

    overview = AccountsPage(page)
    overview.open()
    expect(overview.row(account_a)).to_contain_text(money(before_a - amount))
    expect(overview.row(account_b)).to_contain_text(money(before_b + amount))

    assert balance_of(api, account_a) == before_a - amount
    assert balance_of(api, account_b) == before_b + amount

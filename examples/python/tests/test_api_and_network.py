from playwright.sync_api import Page, Playwright, expect


def test_api_returns_a_todo(playwright: Playwright):
    api = playwright.request.new_context(base_url="https://jsonplaceholder.typicode.com")

    response = api.get("/todos/1")

    expect(response).to_be_ok()
    assert response.json()["id"] == 1
    api.dispose()


def test_shows_a_mocked_fruit(page: Page):
    page.route(
        "**/api/v1/fruits",
        lambda route: route.fulfill(json=[{"name": "Dragon fruit", "id": 99}]),
    )

    page.goto("https://demo.playwright.dev/api-mocking/")

    expect(page.get_by_text("Dragon fruit")).to_be_visible()
    expect(page.get_by_text("Strawberry")).to_have_count(0)


def test_waits_for_the_real_response(page: Page):
    with page.expect_response("**/api/v1/fruits") as response_info:
        page.goto("https://demo.playwright.dev/api-mocking/")

    assert response_info.value.status == 200

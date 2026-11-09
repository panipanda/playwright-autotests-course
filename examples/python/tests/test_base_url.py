from playwright.sync_api import Page, expect


def test_opens_the_app_from_the_base_url(page: Page):
    page.goto("/todomvc/")

    expect(page.get_by_placeholder("What needs to be done?")).to_be_visible()

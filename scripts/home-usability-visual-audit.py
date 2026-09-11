from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:3106"
OUTPUT_DIR = Path("artifacts/home-usability")


def assert_no_overflow(page) -> None:
    dimensions = page.evaluate(
        """() => ({
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth
        })"""
    )
    assert dimensions["scrollWidth"] <= dimensions["innerWidth"], dimensions


def main() -> None:
    errors: list[str] = []
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        )

        mobile = browser.new_context(viewport={"width": 375, "height": 812})
        page = mobile.new_page()
        page.on(
            "console",
            lambda message: errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_selector(".place-card", timeout=15000)
        assert_no_overflow(page)
        assert page.locator(".place-card").count() > 0
        assert page.locator(".place-card-emoji").count() > 0
        assert page.locator(".place-card-trust").count() > 0
        page.screenshot(path=str(OUTPUT_DIR / "home-375.png"), full_page=True)
        mobile.close()

        desktop = browser.new_context(viewport={"width": 1440, "height": 900})
        page = desktop.new_page()
        page.on(
            "console",
            lambda message: errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_selector(".place-card", timeout=15000)
        assert_no_overflow(page)
        assert page.locator(".place-card-price-cell").count() > 0
        assert page.locator(".place-card-price").count() > 0
        page.screenshot(path=str(OUTPUT_DIR / "home-1440.png"), full_page=True)
        desktop.close()
        browser.close()

    assert not errors, f"Browser console errors: {errors}"
    print(f"PASS screenshots={OUTPUT_DIR}")


if __name__ == "__main__":
    main()

from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:3102"
OUTPUT = Path("artifacts/phase-2/home-375.png")


def main() -> None:
    errors: list[str] = []
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        )
        context = browser.new_context(viewport={"width": 375, "height": 812})
        context.clear_permissions()
        page = context.new_page()
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

        response = page.goto(BASE_URL)
        assert response and response.ok
        page.wait_for_load_state("networkidle")
        page.get_by_role("heading", name="今天这顿，别花冤枉钱。").wait_for()
        page.get_by_text("DEMO MAP / 无需密钥").wait_for()
        page.get_by_label("选择区域").select_option("science park")
        page.get_by_text("科兴科学园 · B1 员工餐厅", exact=True).first.wait_for()
        page.locator(".map-pin").first.click()
        page.locator(".place-card-selected").wait_for()
        page.wait_for_timeout(500)

        dimensions = page.evaluate(
            """() => ({
              innerWidth: window.innerWidth,
              scrollWidth: document.documentElement.scrollWidth
            })"""
        )
        assert dimensions["scrollWidth"] <= dimensions["innerWidth"], dimensions
        assert not errors, f"Browser console errors: {errors}"
        page.screenshot(path=str(OUTPUT), full_page=True)
        browser.close()

    print(f"PASS width={dimensions['innerWidth']} scrollWidth={dimensions['scrollWidth']}")
    print(f"screenshot={OUTPUT}")


if __name__ == "__main__":
    main()

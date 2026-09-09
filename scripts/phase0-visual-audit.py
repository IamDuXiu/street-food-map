from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:3000"
OUTPUT = Path("artifacts/phase-0/main-thread-audit-375.png")


def main() -> None:
    errors: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        )
        page = browser.new_page(viewport={"width": 375, "height": 812})
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")

        dimensions = page.evaluate(
            """() => ({
              innerWidth: window.innerWidth,
              scrollWidth: document.documentElement.scrollWidth
            })"""
        )
        assert dimensions["scrollWidth"] <= dimensions["innerWidth"], dimensions

        page.get_by_label("最高价格").select_option("20")
        page.get_by_role("button", name="高新园 / 科兴").click()
        page.get_by_text("科兴科学园 · B1 员工餐厅", exact=True).first.wait_for()
        page.screenshot(path=str(OUTPUT), full_page=True)

        page.goto(f"{BASE_URL}/admin/login")
        page.wait_for_load_state("networkidle")
        assert page.get_by_text("演示模式", exact=True).is_visible()
        assert not errors, f"Browser console errors: {errors}"
        browser.close()

    print(f"PASS width={dimensions['innerWidth']} scrollWidth={dimensions['scrollWidth']}")
    print(f"screenshot={OUTPUT}")


if __name__ == "__main__":
    main()

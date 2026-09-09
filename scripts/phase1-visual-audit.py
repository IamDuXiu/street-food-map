from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:3101"
OUTPUT = Path("artifacts/phase-1/admin-1440.png")


def main() -> None:
    errors: list[str] = []
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        )
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

        response = page.goto(f"{BASE_URL}/admin/import")
        assert response and response.ok
        page.wait_for_url(f"{BASE_URL}/admin/login")
        page.get_by_label("账号").fill("admin")
        page.get_by_label("密码").fill("phase1-demo-password")
        page.get_by_role("button", name="进入演示工作台").click()
        page.wait_for_url(f"{BASE_URL}/admin")

        page.goto(f"{BASE_URL}/admin/places")
        page.wait_for_load_state("networkidle")
        page.get_by_role("heading", name="地点与餐食").wait_for()
        page.wait_for_timeout(1000)
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

from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:3104"
OUTPUT_DIR = Path("artifacts/phase-4")


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
        context = browser.new_context(viewport={"width": 375, "height": 812})
        page = context.new_page()
        page.on(
            "console",
            lambda message: errors.append(message.text)
            if message.type == "error"
            else None,
        )

        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        search = page.get_by_role("textbox", name="搜店名或餐食")
        search.focus()
        assert search.evaluate("element => element === document.activeElement")
        search.fill("绝不会存在的饭点")
        page.get_by_role("heading", name="这组筛选暂时没饭").wait_for()
        assert_no_overflow(page)
        page.screenshot(path=str(OUTPUT_DIR / "empty-state-375.png"), full_page=True)
        assert not errors, f"Browser console errors before auth check: {errors}"

        page.goto(f"{BASE_URL}/admin/login")
        page.get_by_label("密码").fill("明显不正确的密码")
        page.get_by_role("button", name="进入演示工作台").click()
        page.get_by_role("status").filter(has_text="账号或密码不正确").wait_for()
        assert_no_overflow(page)
        page.screenshot(path=str(OUTPUT_DIR / "admin-login-error-375.png"), full_page=True)
        # The intentional invalid login returns 401; Chrome reports that expected
        # response as a console resource error even though the UI handles it.
        assert errors == [
            "Failed to load resource: the server responded with a status of 401 (Unauthorized)"
        ], errors
        errors.clear()

        context.close()
        browser.close()

    assert not errors, f"Browser console errors: {errors}"
    print(f"PASS screenshots={OUTPUT_DIR}")


if __name__ == "__main__":
    main()

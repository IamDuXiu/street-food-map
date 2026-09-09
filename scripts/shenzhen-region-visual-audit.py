from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:3106"
OUTPUT_DIR = Path("artifacts/shenzhen-regions")


def assert_no_overflow(page) -> None:
    dimensions = page.evaluate(
        """() => ({
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth
        })"""
    )
    assert dimensions["scrollWidth"] <= dimensions["innerWidth"], dimensions


def open_picker(page) -> None:
    page.get_by_role("button", name="选择区域", exact=False).click()
    page.get_by_role("dialog", name="选一个吃饭范围").wait_for()


def assert_directory(page) -> None:
    assert page.locator(".region-quick-actions").count() == 0
    city_context = page.get_by_role("group", name="当前城市")
    assert "当前城市" in city_context.inner_text()
    assert "深圳市" in city_context.inner_text()
    labels = [
        "我的附近",
        "全城",
        "福田区",
        "罗湖区",
        "南山区",
        "盐田区",
        "宝安区",
        "龙岗区",
        "龙华区",
        "坪山区",
        "光明区",
        "大鹏新区",
    ]
    directory = page.locator(".district-rail button")
    assert directory.count() == len(labels)
    for index, label in enumerate(labels):
        assert label in directory.nth(index).inner_text()


def main() -> None:
    errors: list[str] = []
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        )

        mobile = browser.new_context(
            viewport={"width": 375, "height": 812},
            permissions=[],
        )
        page = mobile.new_page()
        page.on(
            "console",
            lambda message: errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        open_picker(page)
        assert_directory(page)
        page.get_by_role("navigation", name="深圳行政区").get_by_role(
            "button", name="福田区", exact=False
        ).click()
        assert_no_overflow(page)
        page.screenshot(path=str(OUTPUT_DIR / "picker-futian-375.png"))
        page.get_by_role("button", name="华强北", exact=False).click()
        page.get_by_role("heading", name="这里还没有真实饭签").wait_for()
        assert_no_overflow(page)
        page.screenshot(path=str(OUTPUT_DIR / "planned-area-375.png"), full_page=True)
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
        open_picker(page)
        assert_directory(page)
        page.get_by_role("navigation", name="深圳行政区").get_by_role(
            "button", name="南山区", exact=False
        ).click()
        assert_no_overflow(page)
        page.screenshot(path=str(OUTPUT_DIR / "picker-nanshan-1440.png"))
        desktop.close()
        browser.close()

    assert not errors, f"Browser console errors: {errors}"
    print(f"PASS screenshots={OUTPUT_DIR}")


if __name__ == "__main__":
    main()

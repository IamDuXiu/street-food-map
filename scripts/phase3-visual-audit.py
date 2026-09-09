import base64
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:3103"
MOBILE_OUTPUT = Path("artifacts/phase-3/submission-success-375.png")
ADMIN_OUTPUT = Path("artifacts/phase-3/submission-review-1440.png")
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


def assert_no_overflow(page) -> None:
    dimensions = page.evaluate(
        """() => ({
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          offenders: [...document.querySelectorAll('*')]
            .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
            .slice(0, 12)
            .map((element) => ({
              tag: element.tagName,
              className: element.className,
              right: Math.round(element.getBoundingClientRect().right),
              width: Math.round(element.getBoundingClientRect().width)
            }))
        })"""
    )
    assert dimensions["scrollWidth"] <= dimensions["innerWidth"], dimensions


def main() -> None:
    errors: list[str] = []
    MOBILE_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        )
        mobile = browser.new_context(viewport={"width": 375, "height": 812})
        page = mobile.new_page()
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(f"{BASE_URL}/submit")
        page.wait_for_load_state("networkidle")
        page.get_by_label("地点名称").fill("阶段三视觉验收饭点")
        page.get_by_label("地址", exact=True).fill("深圳大学西门视觉验收地址")
        page.get_by_label("具体餐食").fill("十八元验收套餐")
        page.get_by_label("价格（元）").fill("18")
        page.locator('input[name="files"]').set_input_files(
            {"name": "proof.png", "mimeType": "image/png", "buffer": PNG}
        )
        page.get_by_label("我确认这张图片可以提交给街头饭签，用于核验。").check()
        page.get_by_role("button", name="提交这条饭签").click()
        page.get_by_role("heading", name="收到。 这顿饭我们会替大家核一下。").wait_for()
        assert_no_overflow(page)
        page.screenshot(path=str(MOBILE_OUTPUT), full_page=True)
        mobile.close()

        admin = browser.new_context(viewport={"width": 1440, "height": 900})
        page = admin.new_page()
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(f"{BASE_URL}/admin/login")
        page.get_by_label("密码").fill("phase1-demo-password")
        page.get_by_role("button", name="进入演示工作台").click()
        page.wait_for_url(f"{BASE_URL}/admin")
        page.goto(f"{BASE_URL}/admin/submissions")
        page.wait_for_load_state("networkidle")
        page.get_by_role("heading", name="投稿审核队列").wait_for()
        page.get_by_alt_text("投稿证据缩略图").first.wait_for()
        assert_no_overflow(page)
        page.screenshot(path=str(ADMIN_OUTPUT), full_page=True)
        admin.close()
        browser.close()

    assert not errors, f"Browser console errors: {errors}"
    print(f"PASS screenshots={MOBILE_OUTPUT},{ADMIN_OUTPUT}")


if __name__ == "__main__":
    main()

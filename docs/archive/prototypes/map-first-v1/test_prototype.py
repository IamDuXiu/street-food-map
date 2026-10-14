from playwright.sync_api import sync_playwright


def main():
    checks = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        desktop = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
        desktop.goto("http://127.0.0.1:4173", wait_until="networkidle")
        desktop.screenshot(path="/tmp/map-first-v1-desktop.png", full_page=True)
        checks.append(("desktop_initial", desktop.locator("#resultCount").inner_text()))
        desktop.locator("#searchInput").fill("云吞")
        checks.append(("search_filter", desktop.locator("#resultCount").inner_text()))
        desktop.locator("#clearSearch").click()
        desktop.locator('[data-budget="15"]').click()
        checks.append(("budget_15", desktop.locator("#resultCount").inner_text()))
        desktop.locator('[data-budget="20"]').click()
        desktop.locator("#sortSelect").select_option("price")
        checks.append(("sort_price_first", desktop.locator(".place-card .meal-name").first.inner_text()))
        desktop.locator(".place-card").first.click()
        desktop.locator("#selectedCard").click()
        checks.append(("detail_open", desktop.locator("#detailPanel").get_attribute("aria-hidden")))
        desktop.locator("#navigateDemo").click()
        checks.append(("nav_toast", desktop.locator("#toast").inner_text()))
        desktop.keyboard.press("Escape")
        checks.append(("detail_escape", desktop.locator("#detailPanel").get_attribute("aria-hidden")))
        desktop.locator("#locationTrigger").click()
        checks.append(("region_modal", desktop.locator("#regionBackdrop").evaluate("el => el.classList.contains('is-open')")))
        desktop.locator('[data-region="罗湖"]').click()
        checks.append(("region_empty", desktop.locator("#resultCount").inner_text()))
        desktop.locator("#closeRegion").click()
        desktop.locator("#zoomIn").click()
        checks.append(("zoom_in", desktop.locator("#resetMap").inner_text()))
        desktop.locator("#headerReset").click()
        checks.append(("reset", desktop.locator("#resultCount").inner_text()))

        mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        mobile.goto("http://127.0.0.1:4173", wait_until="networkidle")
        mobile.screenshot(path="/tmp/map-first-v1-mobile.png", full_page=True)
        mobile.locator('[data-sheet-action="half"]').click()
        checks.append(("mobile_half", mobile.locator("#listPane").get_attribute("data-sheet")))
        mobile.locator('[data-sheet-action="full"]').click()
        checks.append(("mobile_full", mobile.locator("#listPane").get_attribute("data-sheet")))
        mobile.locator('[data-sheet-action="collapsed"]').click()
        checks.append(("mobile_collapsed", mobile.locator("#listPane").get_attribute("data-sheet")))
        print("\n".join(f"{name}: {value}" for name, value in checks))
        browser.close()


if __name__ == "__main__":
    main()

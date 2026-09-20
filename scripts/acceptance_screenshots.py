#!/usr/bin/env python3
"""Read-only browser acceptance checks and screenshots for the public home UI.

The server must already be running. Keep the default URL on the isolated
Playwright port; never point this script at the live 3000 service.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from playwright.sync_api import Page, expect, sync_playwright


def wait_for_home(page: Page, base_url: str) -> None:
    page.goto(f"{base_url}/", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("region", name="搜索和筛选")).to_be_visible()
    expect(page.get_by_role("region", name="示意地图")).to_be_visible()
    expect(page.get_by_text("示意底图", exact=True)).to_be_visible()


def scroll_width_is_safe(page: Page) -> bool:
    return page.evaluate(
        "() => document.documentElement.scrollWidth <= window.innerWidth"
    )


def run(base_url: str, output_dir: Path) -> list[dict[str, object]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, object]] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for width, height in ((1440, 900), (375, 667), (390, 844)):
            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()

            # Reconnaissance happens only after networkidle, as required for
            # this dynamic Next.js page.
            wait_for_home(page, base_url)
            body_text = page.locator("body").inner_text()
            expect(page.get_by_role("textbox", name="搜店名或餐食")).to_be_visible()
            expect(page.get_by_role("button", name="仅看 ≤ ¥15", exact=True)).to_be_visible()
            expect(page.get_by_role("combobox", name="按条件或标签筛选")).to_be_visible()
            expect(page.get_by_role("combobox", name="结果排序")).to_be_visible()
            expect(page.locator(".results-panel a.card-link").first).to_be_visible()
            expect.poll(lambda: scroll_width_is_safe(page)).to_be(True)

            page.screenshot(
                path=str(output_dir / f"home-{width}.png"), full_page=True
            )

            budget = page.get_by_role("group", name="餐食价格").get_by_role(
                "button", name="仅看 ≤ ¥15", exact=True
            )
            budget.click()
            expect(budget).to_have_attribute("aria-pressed", "true")
            page.get_by_role("combobox", name="按条件或标签筛选").select_option(
                "有肉有菜"
            )
            sort = page.get_by_role("combobox", name="结果排序")
            sort.select_option("freshness")
            expect(sort).to_have_value("freshness")

            search = page.get_by_role("textbox", name="搜店名或餐食")
            search.fill("科兴")
            card = page.locator(".results-panel a.card-link").filter(
                has_text="科兴科学园 · B1 员工餐厅"
            )
            expect(card).to_be_visible()

            sheet_states: list[str] = []
            if width <= 620:
                panel = page.locator('[aria-live="polite"]').first
                for button_name, state in (("收起", "peek"), ("半屏", "half"), ("列表", "full")):
                    button = page.get_by_role("button", name=button_name, exact=True)
                    button.click()
                    expect(button).to_have_attribute("aria-pressed", "true")
                    sheet_states.append(
                        str(
                            panel.evaluate(
                                "(element) => Math.round(element.getBoundingClientRect().height)"
                            )
                        )
                    )
                pin = page.get_by_role("region", name="示意地图").get_by_role(
                    "button", name="选择科兴科学园 · B1 员工餐厅", exact=True
                )
                expect(pin).to_be_visible()
                pin.click()
                selected = page.get_by_role("link", name="查看科兴科学园 · B1 员工餐厅详情")
                expect(selected).to_be_visible()
                selected_box = selected.bounding_box()
                assert selected_box is not None
                assert selected_box["y"] + selected_box["height"] <= height
                expect.poll(lambda: scroll_width_is_safe(page)).to_be(True)

            page.screenshot(
                path=str(output_dir / f"home-{width}-interactions.png"),
                full_page=True,
            )
            results.append(
                {
                    "width": width,
                    "height": height,
                    "base_url": base_url,
                    "map_mode": "示意底图",
                    "scroll_width_safe": scroll_width_is_safe(page),
                    "sheet_heights": sheet_states,
                    "body_probe": body_text[:240].replace("\n", " | "),
                }
            )
            context.close()
        browser.close()

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:3100",
        help="Already-running isolated acceptance server (default: %(default)s)",
    )
    parser.add_argument(
        "--output-dir",
        default="artifacts/acceptance",
        help="Screenshot directory (default: %(default)s)",
    )
    args = parser.parse_args()
    print(json.dumps(run(args.base_url.rstrip("/"), Path(args.output_dir)), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

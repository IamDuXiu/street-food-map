#!/usr/bin/env python3
"""Capture unified UI acceptance screenshots against an isolated 3100 server.

The script performs reconnaissance only after networkidle and writes screenshots
to the requested artifact directory. It never targets the live port 3000.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from playwright.sync_api import Page, expect, sync_playwright


PUBLIC_ROUTES = {
    "home": "/",
    "about": "/about",
    "detail": "/places/kexing-b1-foodcourt",
    "submit": "/submit",
    "status": "/submit/status",
    "login": "/admin/login",
}
ADMIN_ROUTES = {
    "dashboard": "/admin",
    "leads": "/admin/leads",
    "submissions": "/admin/submissions",
    "places": "/admin/places",
    "import": "/admin/import",
    "exports": "/admin/exports",
    "audit-log": "/admin/audit-log",
}


def wait_networkidle(page: Page, path: str) -> None:
    page.goto(path, wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")


def assert_no_horizontal_overflow(page: Page) -> None:
    expect.poll(
        lambda: page.evaluate(
            "() => document.documentElement.scrollWidth <= window.innerWidth"
        )
    ).to_be(True)


def ensure_public_fixture(page: Page, route: str) -> None:
    if route == "/":
        expect(page.get_by_role("region", name="示意地图")).to_be_visible()
        expect(page.locator(".results-panel a.card-link").first).to_be_visible()
    elif route == "/about":
        expect(page.get_by_role("heading", name="收录与核验规则")).to_be_visible()
    elif route.startswith("/places/"):
        expect(page.get_by_role("heading", name="科兴科学园 · B1 员工餐厅")).to_be_visible()
    elif route == "/submit":
        expect(page.get_by_role("heading", name="报一条饭签。")).to_be_visible()
        expect(page.get_by_label("地点名称")).to_be_visible()
    elif route == "/submit/status":
        # Status starts with a real fixture query code created by the API below.
        expect(page.get_by_role("heading", name="查询投稿状态。")).to_be_visible()
        expect(page.locator(".status-result")).to_be_visible()
    elif route == "/admin/login":
        expect(page.get_by_role("heading", name="欢迎回到饭签后台。")).to_be_visible()


def ensure_admin_fixture(page: Page, route: str) -> None:
    headings = {
        "/admin": "总览",
        "/admin/leads": "候选池",
        "/admin/submissions": "投稿审核队列",
        "/admin/places": "地点与餐食",
        "/admin/import": "导入一批饭签",
        "/admin/exports": "导出与备份",
        "/admin/audit-log": "审计记录",
    }
    expect(page.get_by_role("heading", name=headings[route])).to_be_visible()


def capture(base_url: str, output_dir: Path) -> list[dict[str, object]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, object]] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for width, height in ((1440, 900), (375, 812)):
            context = browser.new_context(base_url=base_url, viewport={"width": width, "height": height})
            page = context.new_page()

            # The status screenshot is backed by a real isolated submission fixture.
            fixture = page.request.post(
                "/api/v1/submissions",
                data={
                    "type": "new_price",
                    "placeId": "kexing-b1-foodcourt",
                    "menuItemId": "kexing-rice",
                    "priceFen": 2200,
                    "observedAt": "2026-09-12",
                    "claimedVerificationMethod": "onsite_menu",
                    "rightsConfirmed": False,
                    "website": "",
                },
            )
            fixture_code = fixture.json()["data"]["lookupCode"]

            for name, route in PUBLIC_ROUTES.items():
                target = f"{route}?code={fixture_code}" if name == "status" else route
                wait_networkidle(page, target)
                ensure_public_fixture(page, route)
                assert_no_horizontal_overflow(page)
                path = output_dir / f"{name}-{width}.png"
                page.screenshot(path=str(path), full_page=True)
                records.append({"route": route, "width": width, "path": str(path), "scrollWidthSafe": True})

            # Login on each viewport and capture all seven real admin pages.
            wait_networkidle(page, "/admin/login")
            page.get_by_label("密码").fill("phase1-demo-password")
            page.get_by_role("button", name="进入后台工作台").click()
            expect(page).to_have_url("http://127.0.0.1:3100/admin")
            for name, route in ADMIN_ROUTES.items():
                wait_networkidle(page, route)
                ensure_admin_fixture(page, route)
                assert_no_horizontal_overflow(page)
                path = output_dir / f"admin-{name}-{width}.png"
                page.screenshot(path=str(path), full_page=True)
                records.append({"route": route, "width": width, "path": str(path), "scrollWidthSafe": True})
            context.close()
        browser.close()
    return records


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:3100")
    parser.add_argument("--output-dir", default="artifacts/unified-ui")
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")
    print(json.dumps(capture(base_url, Path(args.output_dir)), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

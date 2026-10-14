# 街头饭签 · Street Food Map

**A cheap-eats map that records the meal, not the restaurant.** Every entry is a specific dish at a specific price with a specific verification date — not an average spend, not a limited-time coupon price.

Most delivery apps rank by sales and mix a ¥15 rice bowl with a ¥45 set meal. This project answers one question instead: **which shops, right now, have a single serving for ¥15 or less?**

> **Self-hostable, one command.** Runs without any third-party account or paid API key (the default basemap is a built-in schematic map), and ships with demo data covering five Chinese cities so a fresh deployment is not an empty page.

🇨🇳 完整文档是中文的，见 [README.md](README.md)。

## What it does

- **Shop-level gate**: a shop qualifies if it has at least one single-serving dish at ≤ ¥15; other dishes are shown as-is (sanity cap ¥200).
- **180-day freshness**: prices not re-confirmed within 180 days disappear from the map instead of quietly going stale.
- **Trust tiers**: on-site menu / price tag / receipt (high), official menu or two independent confirmations (medium-high), community content (low, always labelled *unverified*).
- **Traceable sources**: every price carries its source and verification date. Creator content is stored as metadata + external link only — videos and covers are never mirrored.
- **Public whitelist**: Beijing, Shanghai, Guangzhou, Shenzhen and Hangzhou are public; other cities can be stored but stay unpublished.

## Quickstart

### Docker Compose (recommended)

```bash
git clone https://github.com/IamDuXiu/street-food-map.git
cd street-food-map
cp .env.example .env      # set ADMIN_PASSWORD (uncomment the line)
docker compose up -d
open http://localhost:3000
```

On first boot the container creates the database, applies migrations, seeds the region catalogue and the demo data, and creates the admin account (`/admin/login`, user `admin`). Data lives in the named volume `street-food-map-data`. `SESSION_SECRET` is generated and persisted for you if you don't set one.

### Node.js

Node.js **22+** (see `.nvmrc`).

```bash
npm install
export ADMIN_PASSWORD='your-local-password'
npm run setup        # database + migrations + catalogue + demo data
npm run dev
```

## Third-party credentials are yours to provide

The repository ships **no keys at all**, and borrowing someone else's generally does not work — Tencent Location Services keys can be bound to a domain allow-list (browser) or IP allow-list (server), and LLM keys bill the account that owns them.

| Feature | Credential | Without it |
|---|---|---|
| Map (default) | none | built-in schematic map, no network or account |
| Tencent basemap | `NEXT_PUBLIC_MAP_MODE=tencent` + your `NEXT_PUBLIC_TENCENT_MAP_KEY` | falls back to the schematic map |
| Admin backend | `ADMIN_PASSWORD` / `ADMIN_PASSWORD_HASH` | site works, `/admin` cannot be entered |
| Automatic geocoding | `TENCENT_MAP_WEB_SERVICE_KEY` (optional) | fill coordinates by hand |
| `npm run collect:web` | `MINIMAX_API_KEY` (optional) | that script is unavailable |

Configuration is a single file: **`.env`** in the project root (copy `.env.example`). Before deploying, run the check:

```bash
npm run preflight     # reports what is configured, what is missing, and what degrades; exits 1 on a broken config
```

## Demo data

`SEED_DEMO=1` (the default) writes ~50 shops across all five public cities, deliberately including the cases the rules reject (a shop whose cheapest dish is above ¥15, a shop whose price is older than 180 days, creator-sourced unverified entries). Verification dates are relative to seeding time, so a late deployment still looks fresh.

**The demo shops are not real**: names are generic, addresses carry a demo marker, and creator handles are `示例创作者-*` linking to `example.com`. Whenever demo data is present the site shows a notice, and the seeded zone rows are the source of truth for that check. **Set `SEED_DEMO=0` and use a clean database before exposing an instance publicly** — switching the flag back does not delete data that was already written.

## Documentation

| Topic | Where |
|---|---|
| Product rules, commands | [README.md](README.md) (Chinese) |
| Architecture, data model, migration discipline | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Configuration reference | [docs/CONFIGURATION.md](docs/CONFIGURATION.md) |
| Deployment, backups, launch checklist | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Data sources and compliance boundaries | [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md) |
| Admin backend guide | [docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md) |
| Adding a city / district | [docs/ADD-A-CITY.md](docs/ADD-A-CITY.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5.6 strict · SQLite (better-sqlite3, WAL) with versioned SQL migrations · Zod · Sharp · Vitest · Playwright. Modular monolith: pages and API routes never write SQL directly.

## Licence

[MIT](LICENSE). This is a data-catalogue tool: it does not provide food services and guarantees nothing about the listed shops. Scraping and display must respect the target sites' terms, `robots.txt` and local law.

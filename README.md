# Recovery Meetings

**One place for every AA, NA, CA, and Celebrate Recovery meeting in your city — starting with Nashville.** Filter by fellowship, day, time, and format; map out your meetings for the week; and add them to your calendar — for one day, one week, or every week.

Static site + a tiny nightly refresh script — the same zero-cost architecture as [connect-outside](https://github.com/elliot52585/connect-outside). Deployable on Cloudflare Pages, GitHub Pages, or Netlify.

## Features

- **Four fellowships, one list** — AA (Alcoholics Anonymous), NA (Narcotics Anonymous), CA (Cocaine Anonymous), Celebrate Recovery, each color-badged.
- **Filters that matter** — fellowship, day of week (with a "Today" shortcut), morning/afternoon/evening, in-person/online, open-to-all, plus free-text search across names, streets, neighborhoods, and formats ("women", "big book", "Spanish"…).
- **My Week planner** — tap "+ My week" on any meeting to build a Sunday–Saturday plan. Stored in `localStorage` only: no accounts, no tracking, nothing uploaded. Anonymity is the foundation of these programs and this site is built around that.
- **Add to calendar, three ways** — per meeting or for the whole weekly plan:
  - **Just that day** — a single `.ics` event for the next occurrence
  - **This week** — your whole plan as one-off events
  - **Continually** — events with `RRULE:FREQ=WEEKLY` that repeat every week
  - Files carry a proper `America/Chicago` VTIMEZONE and a 30-minute reminder; Google Calendar quick-add links (once or weekly) are there too. Works with Apple/Google/Outlook calendars.
- **Helplines up top** — Middle TN Central Office (AA), NA helpline, and the SAMHSA 24/7 national helpline are one tap away.
- **Every meeting links to its source** — schedules change; the card tells you where to verify.

## Quick start

```bash
python3 -m http.server 8080     # or: npm run serve
open http://localhost:8080
```

The site works immediately with the bundled starter dataset. To pull the full live schedules:

```bash
npm run fetch                   # requires Node 18+, no API keys
```

Or just push to `main` and run the **Refresh meeting data** GitHub Action (Actions → Refresh meeting data → Run workflow). It also runs nightly at 1:23am CT and commits any changes to `data/`.

## Data architecture

```
cities/
├── index.json              city registry — add a city here to turn it on
└── nashville/
    ├── city.json           center/radius, timezone, helplines, feed URLs
    └── curated.json        hand-maintained meetings (CA, Celebrate Recovery)
scripts/
├── tsml.mjs                AA — 12 Step Meeting List (TSML) feed from aanashville.org
├── bmlt.mjs                NA — BMLT aggregator (mirrors natennessee.org's server)
├── fetch-all.mjs           runs everything, merges, dedupes, writes data/
└── util.mjs                fetch/retry, haversine radius, time normalization
data/
└── nashville/meetings.json what the frontend loads
```

**Where the data comes from:**

| Fellowship | Source | How |
|---|---|---|
| AA | [aanashville.org](https://aanashville.org/) (Middle TN Central Office) | TSML JSON feed, with [area64assembly.org](https://www.area64assembly.org/) as fallback |
| NA | [natennessee.org](https://natennessee.org/) (Volunteer Region) | BMLT aggregator API, 35-mile radius of downtown |
| CA | [canashville.com](https://canashville.com/) | curated in `cities/nashville/curated.json` (no machine feed exists) |
| Celebrate Recovery | [locator.crgroups.info](https://locator.crgroups.info/) + church sites | curated in `cities/nashville/curated.json` |

A failing source never wipes data — the previous fetch's meetings for that fellowship are kept and the failure is recorded in `meta.sources`.

**The bundled starter dataset** (`data/nashville/meetings.json` with `meta.seed: true`) is a small, sourced sample so a fresh clone renders something real. The first fetch replaces it wholesale. The UI shows a "starter dataset" banner until then, and a "refreshed [date]" note after.

## Adding a curated meeting (CA, Celebrate Recovery, anything without a feed)

Append to `cities/nashville/curated.json`:

```json
{
  "id": "cr-your-church",
  "fellowship": "CR",
  "name": "Celebrate Recovery — Your Church",
  "day": 1,
  "time": "18:30",
  "types": ["Large group + open share"],
  "venue": "Your Church",
  "address": "123 Main St",
  "city": "Nashville", "state": "TN", "zip": "37203",
  "source": "https://yourchurch.org/cr"
}
```

`day`: `0`=Sunday…`6`=Saturday, an array like `[1,4]` for multiple days, or `null` if the day must be confirmed (the card then says "Day varies — confirm with source" and can't be planned). Times are 24-hour local.

## Launching a new city

1. Copy `cities/nashville/` to `cities/<newcity>/`, edit `city.json` (center lat/lng, radius, timezone, helplines, the local intergroup's TSML URL) and start a `curated.json`.
2. Add the city to `cities/index.json`.
3. Run `npm run fetch`.

Most AA intergroups run the same TSML WordPress plugin (`/wp-admin/admin-ajax.php?action=meetings`), and the BMLT aggregator covers NA nationwide, so new cities are mostly configuration. The masthead city dropdown, `?city=` URLs, fetchers, and calendar export all pick the new city up automatically.

## Deploying

It's a fully static site — any static host works.

- **Cloudflare Pages** (recommended, free, private-repo friendly): create a Pages project from this repo, no build command, output directory `/`.
- **GitHub Pages**: Settings → Pages → deploy from `main`.

Enable the nightly Action so schedules stay fresh (no secrets needed — every source is a public feed).

## Honest limitations

- **Schedules drift.** Feeds are refreshed nightly, but groups move and cancel. Every card links to its source; the footer says so too.
- **CA and Celebrate Recovery have no machine-readable feeds** — those lists are hand-curated and will only be as complete as the curation. PRs welcome.
- **This site can't run the fetchers from the browser** (CORS); they run nightly server-side, like connect-outside's event fetchers.
- Not affiliated with or endorsed by AA, NA, CA, or Celebrate Recovery.

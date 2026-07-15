// Refresh data/<city>/meetings.json for every city in cities/index.json.
// Each city declares a `sources` array in cities/<city>/city.json — one entry
// per fellowship with type tsml | bmlt | curated. Curated meetings live in
// cities/<city>/curated.json. A failing source keeps that fellowship's
// previous data rather than wiping it.
// Run one city with: CITY=nashville npm run fetch
import { fetchTsml } from "./tsml.mjs";
import { fetchBmlt } from "./bmlt.mjs";
import { readJsonIfExists, writeJson } from "./util.mjs";
import { readFile } from "node:fs/promises";

const registry = JSON.parse(await readFile("cities/index.json", "utf8"));
const only = process.env.CITY;
const cities = registry.cities.filter((c) => !only || c.key === only);
if (!cities.length) {
  console.error(`No city matches CITY=${only}`);
  process.exit(1);
}

const FETCHERS = { tsml: fetchTsml, bmlt: fetchBmlt };
let failures = 0;

for (const { key } of cities) {
  console.log(`\n=== ${key} ===`);
  const cityCfg = JSON.parse(await readFile(`cities/${key}/city.json`, "utf8"));
  const dataPath = `data/${key}/meetings.json`;
  const previous = (await readJsonIfExists(dataPath))?.meetings || [];
  const curated = (await readJsonIfExists(`cities/${key}/curated.json`))?.meetings || [];

  const status = {};
  const fetched = {}; // fellowship -> meetings[] (null = feed failed)

  for (const src of cityCfg.sources || []) {
    const f = src.fellowship;
    if (src.type === "curated") {
      status[f] = { ok: true, count: curated.filter((m) => m.fellowship === f).length, source: "curated" };
      continue;
    }
    const fetcher = FETCHERS[src.type];
    if (!fetcher) {
      status[f] = { ok: false, error: `unknown source type: ${src.type}` };
      continue;
    }
    try {
      const { meetings, used } = await fetcher(cityCfg, src);
      fetched[f] = [...(fetched[f] || []), ...meetings];
      status[f] = { ok: true, count: fetched[f].length, source: used };
      console.log(`${f}: ${meetings.length} meetings (${src.type})`);
    } catch (err) {
      if (!(f in fetched)) fetched[f] = null;
      status[f] = { ok: false, error: err.message };
      console.warn(`${f}: FAILED — ${err.message}`);
      failures++;
    }
  }

  console.log(`Curated: ${curated.length} meetings`);

  // Assemble: fetched feeds (or previous data where a feed failed) + curated
  // + previous meetings for fellowships with no source this run.
  const feedFellowships = new Set(Object.keys(fetched));
  const curatedFellowships = new Set(curated.map((m) => m.fellowship));
  const meetings = dedupe([
    ...Object.entries(fetched).flatMap(([f, list]) =>
      list !== null ? list : previous.filter((m) => m.fellowship === f)
    ),
    ...curated,
    ...previous.filter((m) => !feedFellowships.has(m.fellowship) && !curatedFellowships.has(m.fellowship)),
  ]);

  meetings.sort(
    (a, b) => (a.day ?? 9) - (b.day ?? 9) || String(a.time).localeCompare(String(b.time)) || a.name.localeCompare(b.name)
  );

  const counts = {};
  for (const m of meetings) counts[m.fellowship] = (counts[m.fellowship] || 0) + 1;

  await writeJson(dataPath, {
    meta: {
      city: key,
      generated: new Date().toISOString(),
      seed: false,
      counts,
      sources: status,
    },
    meetings,
  });
  console.log(`Wrote ${dataPath}: ${meetings.length} meetings — ${JSON.stringify(counts)}`);
}

// Exit 0 even with partial failures (previous data was preserved); the
// failure detail is recorded in meta.sources for review.
if (failures) console.warn(`\nDone with ${failures} source failure(s) — previous data kept for those.`);

function dedupe(meetings) {
  const seen = new Map();
  for (const m of meetings) {
    const key = [m.fellowship, (m.name || "").toLowerCase(), m.day, m.time, (m.address || "").toLowerCase()].join("|");
    if (!seen.has(key)) seen.set(key, m);
  }
  return [...seen.values()];
}

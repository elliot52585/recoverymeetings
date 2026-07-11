// Refresh data/<city>/meetings.json for every city in cities/index.json.
// Sources: TSML (AA), BMLT aggregator (NA), cities/<city>/curated.json (CA, CR).
// A failing source keeps that fellowship's previous data rather than wiping it.
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

let failures = 0;

for (const { key } of cities) {
  console.log(`\n=== ${key} ===`);
  const cityCfg = JSON.parse(await readFile(`cities/${key}/city.json`, "utf8"));
  const dataPath = `data/${key}/meetings.json`;
  const previous = (await readJsonIfExists(dataPath))?.meetings || [];

  const results = { AA: null, NA: null };
  const status = {};

  try {
    const { meetings, used } = await fetchTsml(cityCfg);
    results.AA = meetings;
    status.AA = { ok: true, count: meetings.length, source: used };
    console.log(`AA: ${meetings.length} meetings (${used})`);
  } catch (err) {
    status.AA = { ok: false, error: err.message };
    console.warn(`AA: FAILED — ${err.message}`);
    failures++;
  }

  try {
    const { meetings, used } = await fetchBmlt(cityCfg);
    results.NA = meetings;
    status.NA = { ok: true, count: meetings.length, source: used };
    console.log(`NA: ${meetings.length} meetings`);
  } catch (err) {
    status.NA = { ok: false, error: err.message };
    console.warn(`NA: FAILED — ${err.message}`);
    failures++;
  }

  const curated = (await readJsonIfExists(`cities/${key}/curated.json`))?.meetings || [];
  console.log(`Curated (CA/CR/extras): ${curated.length} meetings`);

  // Assemble: fetched AA/NA (or previous data if the fetch failed) + curated.
  const curatedFellowships = new Set(curated.map((m) => m.fellowship));
  const keepPrevious = (f) =>
    results[f] === null ? previous.filter((m) => m.fellowship === f && !m.seed) : [];

  const meetings = dedupe([
    ...(results.AA ?? keepPrevious("AA")),
    ...(results.NA ?? keepPrevious("NA")),
    ...curated,
    // previous meetings for fellowships not covered by feeds or curation
    ...previous.filter(
      (m) => !["AA", "NA"].includes(m.fellowship) && !curatedFellowships.has(m.fellowship)
    ),
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

// Exit 0 even with partial failures (previous data was preserved); only fail
// hard if nothing could be written.
if (failures) console.warn(`\nDone with ${failures} source failure(s) — previous data kept for those.`);

function dedupe(meetings) {
  const seen = new Map();
  for (const m of meetings) {
    const key = [m.fellowship, (m.name || "").toLowerCase(), m.day, m.time, (m.address || "").toLowerCase()].join("|");
    if (!seen.has(key)) seen.set(key, m);
  }
  return [...seen.values()];
}

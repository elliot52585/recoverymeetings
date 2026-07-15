// Generate data/<city>/zips.json — ZIP code -> [lat, lng] centroids within
// 100 miles of each city's center, from the US Census ZCTA gazetteer
// (public domain). Powers the "near ZIP, within X miles" filter.
//
// Skips cities whose zips.json is already census-sourced; regenerate with
// FORCE_ZIPS=1. A meetings-derived fallback file may be committed as a seed
// (_source != census) — this script replaces it on the next workflow run.
import { execSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { haversineMiles, readJsonIfExists } from "./util.mjs";

const GAZETTEER = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_zcta_national.zip";
const SOURCE_TAG = "census-zcta-2023";
const RANGE_MILES = 100;

const registry = JSON.parse(await readFile("cities/index.json", "utf8"));
const pending = [];
for (const { key } of registry.cities) {
  const existing = await readJsonIfExists(`data/${key}/zips.json`);
  if (existing?._source === SOURCE_TAG && !process.env.FORCE_ZIPS) {
    console.log(`${key}: zips.json already census-sourced, skipping`);
    continue;
  }
  pending.push(key);
}
if (!pending.length) process.exit(0);

console.log("Downloading Census ZCTA gazetteer…");
const tmp = "/tmp/zcta.zip";
execSync(`curl -sSf -o ${tmp} "${GAZETTEER}"`, { stdio: "inherit" });
const text = execSync(`unzip -p ${tmp}`, { maxBuffer: 256 * 1024 * 1024 }).toString("utf8");

const rows = text.split("\n").slice(1); // header: GEOID ALAND AWATER ... INTPTLAT INTPTLONG
const all = [];
for (const line of rows) {
  const cols = line.trim().split("\t").map((c) => c.trim());
  if (cols.length < 7) continue;
  const [zip, , , , , lat, lng] = cols;
  const la = Number(lat), ln = Number(lng);
  if (!/^\d{5}$/.test(zip) || isNaN(la) || isNaN(ln)) continue;
  all.push([zip, la, ln]);
}
console.log(`Parsed ${all.length} ZCTAs`);

for (const key of pending) {
  const cityCfg = JSON.parse(await readFile(`cities/${key}/city.json`, "utf8"));
  const { lat, lng } = cityCfg.center;
  const zips = {};
  for (const [zip, la, ln] of all) {
    if (haversineMiles(lat, lng, la, ln) <= RANGE_MILES) {
      zips[zip] = [Number(la.toFixed(4)), Number(ln.toFixed(4))];
    }
  }
  await mkdir(`data/${key}`, { recursive: true });
  await writeFile(`data/${key}/zips.json`, JSON.stringify({ _source: SOURCE_TAG, zips }) + "\n");
  console.log(`${key}: wrote ${Object.keys(zips).length} ZIP centroids`);
}

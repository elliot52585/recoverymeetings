// Recon round 3: OA and ACA expose POST meeting-search routes with
// unregistered args. Probe payload shapes — empty bodies first (WP error
// messages often name expected params), then lat/lng and state variants.
import { writeJson } from "./util.mjs";

const UA = "recoverymeetings-fetcher/1.0 (building a free community meeting directory; contact via repo issues)";

const CANDIDATES = [
  { key: "oa-search-empty", url: "https://oa.org/wp-json/oa-meetings/v1/meetings_search", body: {} },
  { key: "oa-search-latlng", url: "https://oa.org/wp-json/oa-meetings/v1/meetings_search",
    body: { latitude: 36.1627, longitude: -86.7816, distance: 50, type: 0, unit: "mi" } },
  { key: "oa-search-location", url: "https://oa.org/wp-json/oa-meetings/v1/meetings_search",
    body: { location: "Nashville, TN", distance: 50, type: 0 } },
  { key: "oa-results-empty", url: "https://oa.org/wp-json/oa-meetings/v1/results", body: {} },
  { key: "oa-results-latlng", url: "https://oa.org/wp-json/oa-meetings/v1/results",
    body: { latitude: 36.1627, longitude: -86.7816, distance: 50 } },
  { key: "aca-search-empty", url: "https://adultchildren.org/wp-json/wsom/v1/meeting-search", body: {} },
  { key: "aca-search-latlng", url: "https://adultchildren.org/wp-json/wsom/v1/meeting-search",
    body: { latitude: 36.1627, longitude: -86.7816, radius: 55 } },
  { key: "aca-search-state", url: "https://adultchildren.org/wp-json/wsom/v1/meeting-search",
    body: { country: "US", state: "TN" } },
  { key: "aca-intergroup-state", url: "https://adultchildren.org/wp-json/wsom/v1/intergroup-search",
    body: { country: "US", state: "TN" } },
];

const report = { generated: new Date().toISOString(), round: 3, results: [] };

for (const c of CANDIDATES) {
  const entry = { key: c.key, url: c.url, sent: c.body };
  try {
    const res = await fetch(c.url, {
      method: "POST",
      headers: { "User-Agent": UA, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(c.body),
      signal: AbortSignal.timeout(25000),
    });
    entry.status = res.status;
    entry.contentType = res.headers.get("content-type") || null;
    const text = await res.text();
    entry.bytes = text.length;
    try {
      const j = JSON.parse(text);
      entry.kind = Array.isArray(j) ? `json-array[${j.length}]` : "json-object";
      entry.sample = JSON.stringify(Array.isArray(j) ? j.slice(0, 2) : j).slice(0, 3500);
    } catch {
      entry.kind = "text";
      entry.sample = text.slice(0, 800);
    }
  } catch (err) {
    entry.error = err.message;
  }
  report.results.push(entry);
  console.log(`${c.key}: ${entry.status ?? "ERR"} ${entry.kind ?? entry.error ?? ""} (${entry.bytes ?? 0}b)`);
  await new Promise((r) => setTimeout(r, 900));
}

await writeJson("data/_probe/report.json", report);
console.log("\nWrote data/_probe/report.json");

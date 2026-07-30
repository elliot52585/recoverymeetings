// Recon round 2: the wp-json indexes revealed custom REST namespaces —
// oa-meetings/v1 (oa.org), wsom/v1 (adultchildren.org = ACA WSO Meetings),
// tm/v1 (al-anon.org). Enumerate each namespace's routes and try plausible
// meeting-search queries. One polite GET each; report to data/_probe/.
import { writeJson } from "./util.mjs";

const UA = "recoverymeetings-fetcher/1.0 (building a free community meeting directory; contact via repo issues)";

const CANDIDATES = [
  // Namespace route indexes — these list the real endpoints
  { key: "oa-ns", url: "https://oa.org/wp-json/oa-meetings/v1/" },
  { key: "aca-ns", url: "https://adultchildren.org/wp-json/wsom/v1/" },
  { key: "alanon-ns", url: "https://al-anon.org/wp-json/tm/v1/" },
  // Plausible search routes (cheap to try alongside)
  { key: "oa-q1", url: "https://oa.org/wp-json/oa-meetings/v1/meetings?latitude=36.1627&longitude=-86.7816&distance=55" },
  { key: "oa-q2", url: "https://oa.org/wp-json/oa-meetings/v1/search?lat=36.1627&lng=-86.7816&distance=55" },
  { key: "aca-q1", url: "https://adultchildren.org/wp-json/wsom/v1/meetings?lat=36.1627&lng=-86.7816&radius=55" },
  { key: "aca-q2", url: "https://adultchildren.org/wp-json/wsom/v1/search?latitude=36.1627&longitude=-86.7816" },
  { key: "alanon-q1", url: "https://al-anon.org/wp-json/tm/v1/meetings?lat=36.1627&lng=-86.7816&radius=55" },
];

const report = { generated: new Date().toISOString(), round: 2, results: [] };

for (const c of CANDIDATES) {
  const entry = { key: c.key, url: c.url };
  try {
    const res = await fetch(c.url, {
      headers: { "User-Agent": UA, Accept: "application/json, */*;q=0.5" },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    entry.status = res.status;
    entry.contentType = res.headers.get("content-type") || null;
    const text = await res.text();
    entry.bytes = text.length;
    try {
      const j = JSON.parse(text);
      entry.kind = Array.isArray(j) ? `json-array[${j.length}]` : "json-object";
      entry.sample = JSON.stringify(Array.isArray(j) ? j.slice(0, 2) : j).slice(0, 3000);
    } catch {
      entry.kind = "text";
      entry.sample = text.slice(0, 800);
    }
  } catch (err) {
    entry.error = err.message;
  }
  report.results.push(entry);
  console.log(`${c.key}: ${entry.status ?? "ERR"} ${entry.kind ?? entry.error ?? ""} (${entry.bytes ?? 0}b)`);
  await new Promise((r) => setTimeout(r, 800));
}

await writeJson("data/_probe/report.json", report);
console.log("\nWrote data/_probe/report.json");

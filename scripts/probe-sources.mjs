// Recon round 4: capture full OA meetings_search result rows (to design the
// HTML parser) and crack ACA meeting-search params.
import { writeJson } from "./util.mjs";

const UA = "recoverymeetings-fetcher/1.0 (building a free community meeting directory; contact via repo issues)";

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "User-Agent": UA, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  const text = await res.text();
  return { status: res.status, text };
}

const report = { generated: new Date().toISOString(), round: 4, results: [] };

// OA: dump a middle slice of the location-filtered results so we see real data rows.
try {
  const { status, text } = await post("https://oa.org/wp-json/oa-meetings/v1/meetings_search",
    { location: "Nashville, TN", distance: 50, type: 0 });
  let html = "";
  try { html = JSON.parse(text).html || ""; } catch { html = text; }
  // strip the toolbar/header; grab the first data rows
  const bodyStart = html.indexOf("meeting-results__tbody");
  const slice = (bodyStart >= 0 ? html.slice(bodyStart) : html).slice(0, 6000);
  const rowCount = (html.match(/meeting-results__tr--/g) || []).length;
  report.results.push({ key: "oa-search-location-rows", status, totalHtml: html.length, approxRows: rowCount, sample: slice });
  console.log(`oa rows: status ${status}, ${html.length}b html, ~${rowCount} tr markers`);
} catch (e) { report.results.push({ key: "oa-search-location-rows", error: e.message }); }

// ACA: the 500 means our params were wrong. Try the param names WP plugins
// commonly use for this exact plugin (search string / mode).
for (const body of [
  { search: "Nashville, TN", mode: "location" },
  { searchString: "37203", searchMode: "proximity", distance: 55, distanceUnits: "mi" },
  { latitude: "36.1627", longitude: "-86.7816", distance: "55", distanceUnits: "mi", mode: "proximity" },
  { query: "TN" },
]) {
  try {
    const { status, text } = await post("https://adultchildren.org/wp-json/wsom/v1/meeting-search", body);
    let kind = "text", sample = text.slice(0, 1500);
    try { const j = JSON.parse(text); kind = Array.isArray(j) ? `array[${j.length}]` : (j.results ? `results[${j.results.length||"?"}]` : "object"); sample = JSON.stringify(j).slice(0, 1500); } catch {}
    report.results.push({ key: `aca-${JSON.stringify(body).slice(0,40)}`, status, kind, sample });
    console.log(`aca ${JSON.stringify(body).slice(0,40)}: ${status} ${kind}`);
  } catch (e) { report.results.push({ key: `aca-${JSON.stringify(body).slice(0,30)}`, error: e.message }); }
  await new Promise((r) => setTimeout(r, 900));
}

await writeJson("data/_probe/report.json", report);
console.log("\nWrote data/_probe/report.json");

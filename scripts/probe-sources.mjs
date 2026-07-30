// One-shot recon: test candidate API endpoints for fellowships that don't
// publish feeds, so we can wire real adapters instead of scraping HTML.
// Run from GitHub Actions (this repo's dev container has no open network).
// Each candidate gets ONE polite GET; results go to data/_probe/report.json.
import { writeJson } from "./util.mjs";

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const BOT_UA = "recoverymeetings-fetcher/1.0 (building a free community meeting directory; contact via repo issues)";

const CANDIDATES = [
  // Al-Anon — WSO site + Middle TN local
  { key: "alanon-wso-tsml", url: "https://al-anon.org/wp-admin/admin-ajax.php?action=meetings" },
  { key: "alanon-wso-wpjson", url: "https://al-anon.org/wp-json/" },
  { key: "alanon-afsmidtn-home", url: "https://afsofmiddletn.org/" },
  // OA — national finder + Nashville intergroup
  { key: "oa-tsml", url: "https://oa.org/wp-admin/admin-ajax.php?action=meetings" },
  { key: "oa-wpjson", url: "https://oa.org/wp-json/" },
  { key: "oa-find-html", url: "https://oa.org/find-a-meeting/?type=0&distance=50&location=Nashville%2C%20TN" },
  { key: "oa-nashville-meetings", url: "https://www.oanashville.org/meetings" },
  // Celebrate Recovery locator
  { key: "cr-locator-home", url: "https://crlocator.com/" },
  { key: "cr-locator-api-guess", url: "https://crlocator.com/api/groups?latitude=36.1627&longitude=-86.7816&radius=55" },
  // SMART
  { key: "smart-meeting-page", url: "https://meetings.smartrecovery.org/meetings/3560/" },
  { key: "smart-api-guess", url: "https://meetings.smartrecovery.org/api/meetings/?location=nashville%2C%20tn&coordinates=55" },
  // ACA
  { key: "aca-wpjson", url: "https://adultchildren.org/wp-json/" },
  { key: "aca-tsml", url: "https://adultchildren.org/wp-admin/admin-ajax.php?action=meetings" },
  // Static pages (HTML capture for parser design)
  { key: "ga-tn-static", url: "https://gamblersanonymous.org/mtgdirTN.html" },
  { key: "ha-tn-local", url: "https://tnheroinanonymous.org/meetings" },
  // Gated feeds — retry with browser headers (401/400 with bot UA before)
  { key: "ma-tsml-browser", url: "https://marijuana-anonymous.org/wp-admin/admin-ajax.php?action=meetings", browser: true },
  { key: "ha-tsml-browser", url: "https://heroinanonymous.org/wp-admin/admin-ajax.php?action=meetings", browser: true },
  // SLAA Nashville (WordPress — TSML unlikely but one probe settles it)
  { key: "slaa-nashville-tsml", url: "https://slaanashville.org/wp-admin/admin-ajax.php?action=meetings" },
];

const report = { generated: new Date().toISOString(), results: [] };

for (const c of CANDIDATES) {
  const entry = { key: c.key, url: c.url };
  try {
    const res = await fetch(c.url, {
      headers: {
        "User-Agent": c.browser ? BROWSER_UA : BOT_UA,
        Accept: "application/json, text/html;q=0.8, */*;q=0.5",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    entry.status = res.status;
    entry.contentType = res.headers.get("content-type") || null;
    const text = await res.text();
    entry.bytes = text.length;
    // JSON? capture shape info; HTML? capture a slice for parser design.
    try {
      const j = JSON.parse(text);
      entry.kind = Array.isArray(j) ? `json-array[${j.length}]` : "json-object";
      entry.sample = JSON.stringify(Array.isArray(j) ? j.slice(0, 2) : j).slice(0, 1500);
    } catch {
      entry.kind = "text";
      entry.sample = text.slice(0, 1200);
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

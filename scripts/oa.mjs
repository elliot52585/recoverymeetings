// Overeaters Anonymous via oa.org's internal meeting-search API
// (oa-meetings/v1/meetings_search). It returns an HTML results table, not
// JSON, and does NOT geo-filter server-side — a "Nashville" search includes
// meetings nationwide. So we parse every row and keep only those whose ZIP
// is in the city's census ZIP set (already limited to ~100 mi of center),
// plotting each at its ZIP centroid. In-person only; OA's online meetings
// are global and would flood a local list.
import { fetchJson, normTime, slugify, readJsonIfExists } from "./util.mjs";

const DAY_INDEX = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

export async function fetchOa(cityCfg, src) {
  const zipData = (await readJsonIfExists(`data/${cityCfg.key}/zips.json`))?.zips || {};
  if (!Object.keys(zipData).length) {
    throw new Error("no zips.json for this city yet — run scripts/zips.mjs first");
  }

  // The endpoint geocodes client-side, so a location string isn't enough —
  // send the city's own lat/lng. Try a few body shapes the plugin accepts.
  const { lat: cLat, lng: cLng } = cityCfg.center;
  const bodies = [
    { latitude: cLat, longitude: cLng, distance: 55, distance_units: "mi", type: 0 },
    { lat: cLat, lng: cLng, distance: 55, unit: "mi", type: 0 },
    { latitude: cLat, longitude: cLng, distance: 55, type: 0, location: `${cityCfg.name}, ${cityCfg.state}` },
    { location: `${cityCfg.name}, ${cityCfg.state}`, distance: 55, type: 0 },
  ];
  const url = src.url || "https://oa.org/wp-json/oa-meetings/v1/meetings_search";
  let html = "";
  let bestRows = [];
  for (const body of bodies) {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "User-Agent": "recoverymeetings-fetcher/1.0 (free community meeting directory; repo issues for contact)",
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
    } catch { continue; }
    if (!res.ok) continue;
    const h = (await res.json()).html || "";
    const rows = h.split("meeting-results__tr--").slice(1);
    // Prefer the body shape that yields the most rows carrying a TN-area ZIP.
    const tnRows = rows.filter((r) => {
      const z = ((r.match(/meeting-results__meta">([\s\S]*?)<\/div>/) || [])[1] || "").match(/\b(\d{5})\b/);
      return z && zipData[z[1]];
    });
    if (tnRows.length > bestRows.length) { bestRows = tnRows; html = h; }
    if (tnRows.length >= 3) break; // good enough, stop probing
  }
  if (!html) throw new Error("no results html from any body shape");

  const rows = html.split("meeting-results__tr--").slice(1);
  const meetings = [];
  for (const row of rows) {
    // Skip online-only rows — no local location to anchor.
    const isOnline = /meeting-results__type--online/.test(row) && !/--face-to-face/.test(row);
    if (isOnline) continue;

    const time = normTime(matchTime(row));
    const day = DAY_INDEX[(pick(row, /time-day-day[^>]*>([^<]+)</) || "").trim().toLowerCase()];
    if (time == null || day == null) continue;

    const name = decode(pick(row, /meeting-results__name-link"[^>]*>([\s\S]*?)<\/a>/)?.trim());
    const meta = pick(row, /meeting-results__meta">([\s\S]*?)<\/div>/) || "";
    const parts = meta.split(/<br\s*\/?>/).map((s) => decode(strip(s)));
    const street = parts[0] || null;
    // "City, State, ZIP" line
    const cityLine = parts[1] || "";
    const zip = (cityLine.match(/\b(\d{5})\b/) || [])[1] || null;
    if (!zip || !zipData[zip]) continue; // outside our metro's ZIP set

    const cityName = (cityLine.split(",")[0] || "").trim() || null;
    const [lat, lng] = zipData[zip];
    const wheelchair = /icon--accessibility/.test(row);
    const num = pick(row, /Meeting #:[\s\S]*?notranslate">([^<]+)</)?.trim();

    meetings.push({
      id: `oa-${num ? num : slugify(name)}-d${day}-${time.replace(":", "")}`,
      fellowship: "OA",
      name: name || "OA Meeting",
      day,
      time,
      types: wheelchair ? ["Wheelchair accessible"] : [],
      online: false,
      hybrid: false,
      venue: null,
      address: street,
      city: cityName,
      state: cityCfg.state,
      zip,
      lat, lng,
      region: cityName,
      source: num ? `https://oa.org/meetings/${num}/` : src.finder,
    });
  }
  return { meetings, used: "oa-meetings/v1/meetings_search" };
}

const pick = (s, re) => (s.match(re) || [])[1] || null;
const strip = (s) => s.replace(/<[^>]*>/g, "").trim();
function matchTime(row) {
  const m = row.match(/time-day-time"><strong>(\d{1,2}:\d{2})<span[^>]*>([AP]M)/);
  return m ? `${m[1]} ${m[2]}` : null;
}
function decode(s) {
  if (!s) return s;
  return s
    .replace(/&#0?38;|&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

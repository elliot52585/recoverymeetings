// AA meetings via the 12 Step Meeting List (TSML) feed that most AA
// intergroup sites expose (aanashville.org runs it). Feed reference:
// https://github.com/code4recovery/12-step-meeting-list
import { fetchJson, haversineMiles, normTime, slugify } from "./util.mjs";

// TSML type codes -> friendly labels (unknown codes pass through as-is).
const TYPE_LABELS = {
  O: "Open", C: "Closed", D: "Discussion", B: "Big Book", BB: "Big Book",
  SP: "Speaker", ST: "Step study", TR: "Tradition study", GR: "Grapevine",
  W: "Women", M: "Men", Y: "Young people", G: "LGBTQ+", T: "Transgender",
  BE: "Beginner", LIT: "Literature", MED: "Meditation", CAN: "Candlelight",
  X: "Wheelchair accessible", BA: "Babysitting", AL: "Al-Anon aside",
  "AL-AN": "Concurrent with Al-Anon", EN: null, ONL: null, HY: null,
  TC: null, "TC-TEMP": "Location temporarily closed", S: "Spanish",
  FF: "Fragrance free", OUT: "Outdoor", DB: "Digital basket",
};

export async function fetchTsml(cityCfg) {
  const src = cityCfg.sources.aa;
  let raw = null;
  let used = null;
  const errors = [];
  for (const url of src.urls) {
    try {
      raw = await fetchJson(url);
      used = url;
      break;
    } catch (err) {
      errors.push(err.message);
    }
  }
  if (!raw) throw new Error(`all TSML feeds failed: ${errors.join(" | ")}`);
  if (!Array.isArray(raw)) throw new Error(`${used}: expected a JSON array`);

  const { lat: cLat, lng: cLng } = cityCfg.center;
  const meetings = [];
  for (const m of raw) {
    if (!m.name || m.day === undefined || m.day === null) continue;
    if (m.attendance_option === "inactive") continue;

    // Keep meetings inside the radius; keep online-only meetings from the feed too.
    const lat = num(m.latitude), lng = num(m.longitude);
    const online = m.attendance_option === "online";
    const hybrid = m.attendance_option === "hybrid";
    if (!online) {
      if (lat === null || lng === null) continue;
      if (haversineMiles(cLat, cLng, lat, lng) > cityCfg.radiusMiles) continue;
    }

    const types = (m.types || [])
      .map((t) => (t in TYPE_LABELS ? TYPE_LABELS[t] : t))
      .filter(Boolean);

    meetings.push({
      id: `aa-${slugify(m.slug || m.name)}-d${m.day}-${String(normTime(m.time) || "").replace(":", "")}`,
      fellowship: "AA",
      name: m.name,
      day: Number(m.day), // TSML: 0=Sunday..6=Saturday
      time: normTime(m.time),
      endTime: normTime(m.end_time),
      types,
      online,
      hybrid,
      conferenceUrl: m.conference_url || null,
      venue: m.location || null,
      address: m.address || (m.formatted_address ? m.formatted_address.split(",")[0] : null),
      city: m.city || null,
      state: m.state || cityCfg.state,
      zip: m.postal_code || null,
      lat, lng,
      region: m.region || null,
      notes: m.location_notes || m.notes || null,
      source: m.url || src.finder,
    });
  }
  return { meetings: meetings.filter((m) => m.time), used };
}

const num = (v) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? null : Number(v));

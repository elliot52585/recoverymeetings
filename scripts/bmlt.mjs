// NA meetings via the BMLT aggregator (aggregator.bmltenabled.org), which
// mirrors every registered BMLT root server — including the Volunteer
// Region (natennessee.org) that covers Nashville / Middle Tennessee.
// API reference: https://bmlt.app/semantic/
import { fetchJson, normTime, slugify } from "./util.mjs";

const FORMAT_LABELS = {
  O: "Open", C: "Closed", D: "Discussion", "So": "Speaker only", "Sp": "Speaker",
  St: "Step study", Tr: "Tradition study", To: "Topic", BT: "Basic Text",
  IW: "It Works study", JT: "Just for Today", SG: "Step working guide",
  W: "Women", M: "Men", GL: "LGBTQ+", Y: "Young people", B: "Beginner",
  WC: "Wheelchair accessible", CW: "Children welcome", NS: "Non-smoking",
  Lit: "Literature", Me: "Meditation", CL: "Candlelight", VM: null, HY: null, TC: null,
  ES: "Spanish",
};

// src: { fellowship, aggregator, finder } from the city's sources array.
export async function fetchBmlt(cityCfg, src) {
  const { lat, lng } = cityCfg.center;
  const fields = [
    "id_bigint", "meeting_name", "weekday_tinyint", "start_time", "duration_time",
    "location_text", "location_street", "location_municipality", "location_province",
    "location_postal_code_1", "location_info", "latitude", "longitude",
    "formats", "comments", "virtual_meeting_link", "venue_type",
  ].join(",");
  const url =
    `${src.aggregator}/client_interface/json/?switcher=GetSearchResults` +
    `&lat_val=${lat}&long_val=${lng}&geo_width=${src.radiusMiles || cityCfg.radiusMiles}` +
    `&data_field_key=${fields}`;

  const raw = await fetchJson(url);
  const rows = Array.isArray(raw) ? raw : raw?.meetings;
  if (!Array.isArray(rows)) throw new Error(`${url}: unexpected shape`);

  const meetings = [];
  for (const m of rows) {
    if (!m.meeting_name || !m.weekday_tinyint) continue;
    const day = (Number(m.weekday_tinyint) - 1 + 7) % 7; // BMLT: 1=Sunday..7=Saturday
    const time = normTime(m.start_time);
    if (!time) continue;

    const codes = String(m.formats || "").split(",").map((s) => s.trim()).filter(Boolean);
    const types = codes.map((c) => (c in FORMAT_LABELS ? FORMAT_LABELS[c] : c)).filter(Boolean);
    // venue_type: 1=in person, 2=virtual, 3=hybrid (falls back to format codes)
    const vt = Number(m.venue_type) || (codes.includes("VM") ? 2 : 1);
    const online = vt === 2;
    const hybrid = vt === 3 || codes.includes("HY");

    meetings.push({
      id: `${src.fellowship.toLowerCase()}-${slugify(m.meeting_name)}-${m.id_bigint || `d${day}-${time.replace(":", "")}`}`,
      fellowship: src.fellowship,
      name: m.meeting_name,
      day,
      time,
      endTime: endFromDuration(time, m.duration_time),
      types,
      online,
      hybrid,
      conferenceUrl: m.virtual_meeting_link || null,
      venue: m.location_text || null,
      address: m.location_street || null,
      city: m.location_municipality || null,
      state: m.location_province || cityCfg.state,
      zip: m.location_postal_code_1 || null,
      lat: numOrNull(m.latitude), lng: numOrNull(m.longitude),
      region: m.location_municipality || null,
      notes: [m.location_info, m.comments].filter(Boolean).join(" — ") || null,
      source: src.finder,
    });
  }
  return { meetings, used: url };
}

function endFromDuration(time, duration) {
  const d = String(duration || "").match(/^(\d{1,2}):(\d{2})/);
  if (!d) return null;
  const [h, mi] = time.split(":").map(Number);
  const total = h * 60 + mi + Number(d[1]) * 60 + Number(d[2]);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const numOrNull = (v) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? null : Number(v));

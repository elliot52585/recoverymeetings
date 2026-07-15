/* Recovery Meetings — find meetings, plan your week, export to calendar.
   No accounts, no tracking: state lives in localStorage only. */

(() => {
  "use strict";

  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const PLAN_KEY = "rm-plan-v1";
  const NEAR_KEY = "rm-near-v1";
  const REPORT_URL = "https://github.com/elliot52585/recoverymeetings/issues/new";
  const FALLBACK_COLOR = "#64748b";

  const state = {
    cityKey: null,
    city: null,        // cities/<key>/city.json
    tz: "America/Chicago",
    registry: [],      // registry/fellowships.json records, in registry order
    meetings: [],      // normalized: one entry per (meeting, day)
    meta: null,
    filters: { fellowship: new Set(), day: null, time: null, format: new Set(), q: "" },
    near: loadNear(),  // { zip: "37203", radius: 10 } — stored on-device only
    zips: {},          // ZIP -> [lat, lng] centroids (census file + meeting-derived fallback)
    plan: loadPlan(),  // [{id}] — id already encodes the day
    tab: "meetings",
  };

  const fellowshipInfo = (key) =>
    state.registry.find((f) => f.key === key) || { key, name: key, short: key, color: FALLBACK_COLOR };

  const $ = (sel) => document.querySelector(sel);

  // ---------- boot ----------

  async function boot() {
    const registry = await getJSON("cities/index.json");
    const params = new URLSearchParams(location.search);
    state.cityKey = params.get("city") || registry.default;

    const citySel = $("#city-select");
    citySel.innerHTML = registry.cities
      .map((c) => `<option value="${c.key}" ${c.key === state.cityKey ? "selected" : ""}>${esc(c.name)}</option>`)
      .join("");
    citySel.addEventListener("change", () => {
      const url = new URL(location.href);
      url.searchParams.set("city", citySel.value);
      location.href = url.toString();
    });

    state.city = await getJSON(`cities/${state.cityKey}/city.json`);
    state.registry = (await getJSON("registry/fellowships.json")).fellowships || [];
    state.tz = state.city.timezone || "America/Chicago";
    document.title = `Recovery Meetings in ${state.city.name} — every AA, NA, CA & Celebrate Recovery meeting`;

    renderHelplines();
    renderAboutSources();

    const data = await getJSON(`data/${state.cityKey}/meetings.json`);
    state.meta = data.meta || null;
    state.meetings = normalize(data.meetings || []);
    await loadZips();

    buildFilterChips();
    wireEvents();
    renderAll();
  }

  async function getJSON(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return res.json();
  }

  // ZIP centroids: the census-derived file, with centroids computed from the
  // meetings themselves filling any gaps (a ZIP with meetings in it always
  // resolves, even before the census file exists).
  async function loadZips() {
    const derived = {};
    const byZip = {};
    for (const m of state.meetings) {
      if (m.zip && /^\d{5}$/.test(m.zip) && m.lat != null && m.lng != null) {
        (byZip[m.zip] = byZip[m.zip] || []).push(m);
      }
    }
    for (const [z, list] of Object.entries(byZip)) {
      derived[z] = [
        list.reduce((s, m) => s + m.lat, 0) / list.length,
        list.reduce((s, m) => s + m.lng, 0) / list.length,
      ];
    }
    let census = {};
    try {
      census = (await getJSON(`data/${state.cityKey}/zips.json`)).zips || {};
    } catch { /* file not generated yet — derived centroids still work */ }
    state.zips = { ...derived, ...census };
  }

  function loadNear() {
    try {
      const n = JSON.parse(localStorage.getItem(NEAR_KEY) || "{}");
      return { zip: n.zip || "", radius: n.radius || null };
    } catch {
      return { zip: "", radius: null };
    }
  }
  function saveNear() {
    try { localStorage.setItem(NEAR_KEY, JSON.stringify(state.near)); } catch {}
  }

  function nearCenter() {
    const { zip, radius } = state.near;
    if (!radius || !/^\d{5}$/.test(zip)) return null;
    return state.zips[zip] || null;
  }

  // Expand day arrays into one entry per day; keep day:null entries once.
  function normalize(raw) {
    const out = [];
    for (const m of raw) {
      const days = Array.isArray(m.day) ? m.day : [m.day];
      for (const d of days) {
        out.push({
          ...m,
          day: d,
          id: days.length > 1 ? `${m.id}-d${d}` : m.id,
          baseId: m.id,
          online: !!m.online,
          hybrid: !!m.hybrid,
          types: m.types || [],
        });
      }
    }
    out.sort((a, b) => (a.day ?? 9) - (b.day ?? 9) || cmp(a.time, b.time) || cmp(a.name, b.name));
    return out;
  }

  const cmp = (a, b) => (a || "").localeCompare(b || "");

  function haversineMiles(lat1, lng1, lat2, lng2) {
    const R = 3958.8;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  // ---------- header ----------

  function renderHelplines() {
    $("#helplines").innerHTML = (state.city.helplines || [])
      .map((h) => {
        const label = `<strong>${esc(h.name)}</strong>${h.phone ? " " + esc(h.phone) : ""}`;
        return h.phone
          ? `<a class="helpline" href="tel:${h.phone.replace(/[^\d+]/g, "")}">${label}</a>`
          : `<a class="helpline" href="${esc(h.url)}" target="_blank" rel="noopener">${label}</a>`;
      })
      .join("");
  }

  function renderAboutSources() {
    $("#about-sources").innerHTML = (state.city.sources || [])
      .filter((s) => s.finder)
      .map((s) => {
        const info = fellowshipInfo(s.fellowship);
        return `<li><strong>${esc(info.short)}:</strong> <a href="${esc(s.finder)}" target="_blank" rel="noopener">${esc(info.name)} — official meeting finder</a></li>`;
      })
      .join("");
  }

  // ---------- filters ----------

  function buildFilterChips() {
    // Offer a chip for every fellowship present in this city's data (or
    // configured as a source), in registry order — new fellowships appear
    // automatically when their feed starts returning meetings.
    const present = new Set(state.meetings.map((m) => m.fellowship));
    for (const s of state.city.sources || []) present.add(s.fellowship);
    const chips = state.registry.filter((f) => present.has(f.key));
    for (const key of present) if (!chips.some((f) => f.key === key)) chips.push(fellowshipInfo(key));
    $("#chips-fellowship").innerHTML =
      `<button class="chip on" data-fellowship="">All</button>` +
      chips.map((f) => `<button class="chip" data-fellowship="${esc(f.key)}">${esc(f.short)}</button>`).join("");

    const today = todayInTz();
    $("#chips-day").innerHTML =
      `<button class="chip on" data-day="">All week</button>` +
      `<button class="chip today-chip" data-day="${today}">Today</button>` +
      DAYS_SHORT.map((d, i) => `<button class="chip" data-day="${i}">${d}</button>`).join("");
  }

  function wireEvents() {
    document.querySelectorAll(".tab").forEach((t) =>
      t.addEventListener("click", () => switchTab(t.dataset.tab))
    );

    // Fellowships are multi-select: tap AA and NA to see both. "All" clears.
    $("#chips-fellowship").addEventListener("click", (e) => {
      const b = e.target.closest("[data-fellowship]");
      if (!b) return;
      const key = b.dataset.fellowship;
      const sel = state.filters.fellowship;
      if (!key) sel.clear();
      else sel.has(key) ? sel.delete(key) : sel.add(key);
      $("#chips-fellowship").querySelectorAll(".chip").forEach((c) =>
        c.classList.toggle("on", c.dataset.fellowship === "" ? sel.size === 0 : sel.has(c.dataset.fellowship))
      );
      renderMeetings();
    });

    $("#chips-day").addEventListener("click", (e) => {
      const b = e.target.closest("[data-day]");
      if (!b) return;
      state.filters.day = b.dataset.day === "" ? null : Number(b.dataset.day);
      setSoloChip($("#chips-day"), b);
      renderMeetings();
    });

    $("#chips-time").addEventListener("click", (e) => {
      const b = e.target.closest("[data-time]");
      if (!b) return;
      state.filters.time = state.filters.time === b.dataset.time ? null : b.dataset.time;
      $("#chips-time").querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.time === state.filters.time));
      renderMeetings();
    });

    $("#chips-format").addEventListener("click", (e) => {
      const b = e.target.closest("[data-format]");
      if (!b) return;
      const f = b.dataset.format;
      state.filters.format.has(f) ? state.filters.format.delete(f) : state.filters.format.add(f);
      b.classList.toggle("on");
      renderMeetings();
    });

    const zipInput = $("#near-zip");
    const radiusSel = $("#near-radius");
    zipInput.value = state.near.zip;
    radiusSel.value = state.near.radius ? String(state.near.radius) : "";
    const onNearChange = () => {
      state.near.zip = zipInput.value.trim();
      state.near.radius = radiusSel.value ? Number(radiusSel.value) : null;
      saveNear();
      updateNearHint();
      renderMeetings();
    };
    zipInput.addEventListener("input", onNearChange);
    radiusSel.addEventListener("change", onNearChange);
    updateNearHint();

    $("#q").addEventListener("input", () => {
      state.filters.q = $("#q").value.trim().toLowerCase();
      renderMeetings();
    });
    $("#clear").addEventListener("click", () => {
      $("#q").value = "";
      state.filters.q = "";
      renderMeetings();
    });

    $("#export-week").addEventListener("click", exportWeek);
    $("#clear-week").addEventListener("click", () => {
      if (!state.plan.length) return;
      if (confirm("Clear your whole weekly plan?")) {
        state.plan = [];
        savePlan();
        renderAll();
      }
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".cal-menu-wrap")) closeCalMenus();
    });
  }

  function updateNearHint() {
    const hint = $("#near-hint");
    const { zip, radius } = state.near;
    if (!radius && !zip) hint.textContent = "";
    else if (!radius) hint.textContent = "pick a distance";
    else if (!/^\d{5}$/.test(zip)) hint.textContent = "enter a 5-digit ZIP";
    else if (!state.zips[zip]) hint.textContent = "ZIP not found — is it in this area?";
    else hint.textContent = "in-person meetings only (online hidden)";
  }

  function setSoloChip(container, chip) {
    container.querySelectorAll(".chip").forEach((c) => c.classList.remove("on"));
    chip.classList.add("on");
  }

  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll(".tab").forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", String(on));
    });
    $("#view-meetings").hidden = tab !== "meetings";
    $("#view-week").hidden = tab !== "week";
    $("#view-about").hidden = tab !== "about";
    const showFilters = tab === "meetings";
    $("#filters").style.display = showFilters ? "" : "none";
    $("#search-row").style.display = showFilters ? "" : "none";
  }

  function applyFilters() {
    const f = state.filters;
    const center = nearCenter();
    const radius = center ? state.near.radius : null;
    return state.meetings.filter((m) => {
      if (center) {
        // Distance filter: in-person/hybrid only — online meetings have no
        // "distance" and are hidden while it's active (a hint says so).
        if (m.online && !m.hybrid) return false;
        const pt = m.lat != null && m.lng != null ? [m.lat, m.lng] : state.zips[m.zip] || null;
        if (!pt) return false;
        m._dist = haversineMiles(center[0], center[1], pt[0], pt[1]);
        if (m._dist > radius) return false;
      } else {
        m._dist = null;
      }
      if (f.fellowship.size && !f.fellowship.has(m.fellowship)) return false;
      if (f.day !== null && m.day !== f.day) return false;
      if (f.time) {
        const h = parseInt(m.time, 10);
        if (f.time === "morning" && h >= 12) return false;
        if (f.time === "afternoon" && (h < 12 || h >= 17)) return false;
        if (f.time === "evening" && h < 17) return false;
      }
      if (f.format.has("online") && !(m.online || m.hybrid)) return false;
      if (f.format.has("inperson") && m.online && !m.hybrid) return false;
      if (f.format.has("open") && !m.types.some((t) => /open/i.test(t))) return false;
      if (f.format.has("wheelchair") && !m.types.some((t) => /wheelchair/i.test(t))) return false;
      if (f.q) {
        const hay = [m.name, m.venue, m.address, m.city, m.region, m.notes, ...(m.types || [])]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(f.q)) return false;
      }
      return true;
    });
  }

  // ---------- meetings view ----------

  function renderAll() {
    renderMeetings();
    renderWeek();
    $("#count-week").textContent = state.plan.length;
  }

  function renderMeetings() {
    const list = applyFilters();
    $("#count-meetings").textContent = state.meetings.length;

    const note = $("#data-note");
    if (state.meta?.seed) {
      note.hidden = false;
      note.textContent = "Starter dataset — the full live schedules load after the first data refresh. Always confirm details with the meeting's source before attending.";
    } else if (state.meta?.generated) {
      note.hidden = false;
      note.textContent = `Schedules refreshed ${new Date(state.meta.generated).toLocaleDateString()} from official sources. Confirm with the source before attending.`;
    } else {
      note.hidden = true;
    }

    const host = $("#meetings-list");
    if (!list.length) {
      host.innerHTML = emptyStateHtml();
      return;
    }

    const today = todayInTz();
    const nearActive = !!nearCenter();
    // Order days starting today, then the rest of the week; unknown-day last.
    const dayOrder = [...Array(7).keys()].map((i) => (today + i) % 7);
    let html = "";
    for (const d of dayOrder) {
      let dayList = list.filter((m) => m.day === d);
      if (!dayList.length) continue;
      if (nearActive) dayList = [...dayList].sort((a, b) => (a._dist ?? 9e9) - (b._dist ?? 9e9));
      html += `<h2 class="day-header">${DAYS[d]}${d === today ? ' <span class="today-tag">· today</span>' : ""}</h2>`;
      html += dayList.map(cardHtml).join("");
    }
    const unknown = list.filter((m) => m.day === null || m.day === undefined);
    if (unknown.length) {
      html += `<h2 class="day-header">Day varies — confirm with source</h2>`;
      html += unknown.map(cardHtml).join("");
    }
    host.innerHTML = html;
    wireCards(host);
  }

  function emptyStateHtml() {
    if (nearCenter()) {
      return `<div class="empty"><p><strong>No meetings within ${state.near.radius} miles of ${esc(state.near.zip)} match those filters.</strong></p>
        <p>Try a wider radius — or clear the distance filter to see online meetings too.</p>
        <p>If you think meetings are missing for your area, <a href="${REPORT_URL}?title=${encodeURIComponent(`[coverage] No meetings near ${state.near.zip}`)}" target="_blank" rel="noopener">tell us</a>.</p></div>`;
    }
    const f = state.filters.fellowship.size === 1 ? [...state.filters.fellowship][0] : null;
    const src = f && (state.city.sources || []).find((s) => s.fellowship === f);
    const finder = src?.finder || fellowshipInfo(f || "")?.onlineDirectory;
    const officialLink = f && finder
      ? `<p>Check the <a href="${esc(finder)}" target="_blank" rel="noopener">official ${esc(fellowshipInfo(f).short)} meeting finder</a> — new data lands here after the next refresh.</p>`
      : "";
    return `<div class="empty"><p><strong>No meetings match those filters yet.</strong></p>${officialLink}<p>Try clearing a filter, or search less specifically.</p></div>`;
  }

  function cardHtml(m) {
    const inPlan = state.plan.includes(m.id);
    const noDay = m.day === null || m.day === undefined;
    const mapLink = m.address
      ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([m.address, m.city, m.state, m.zip].filter(Boolean).join(", "))}" target="_blank" rel="noopener">${esc([m.address, m.city].filter(Boolean).join(", "))}</a>`
      : esc(m.city || "");
    const tags = [
      ...(m.types || []),
      m.online && !m.hybrid ? "Online" : null,
      m.hybrid ? "Hybrid" : null,
      m.region || null,
    ].filter(Boolean);

    const info = fellowshipInfo(m.fellowship);
    const reportLink = `${REPORT_URL}?title=${encodeURIComponent(`[meeting] ${m.name} (${m.fellowship})`)}&body=${encodeURIComponent(`Meeting: ${m.name}\nID: ${m.id}\nWhat changed (time / place / cancelled / other)?\n\n`)}`;
    return `<article class="mtg" data-id="${esc(m.id)}">
      <div class="mtg-time">${fmtTime(m.time)}</div>
      <div class="mtg-main">
        <h3 class="mtg-name"><span class="badge" style="background:${esc(info.color || FALLBACK_COLOR)}" title="${esc(info.name)}">${esc(info.short)}</span> ${esc(m.name)}</h3>
        <p class="mtg-where">${m.venue ? esc(m.venue) + " · " : ""}${mapLink}${m._dist != null ? ` · <span class="mtg-dist">${m._dist.toFixed(1)} mi</span>` : ""}</p>
        ${tags.length ? `<div class="mtg-tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
        ${m.notes ? `<p class="mtg-notes">${esc(m.notes)}</p>` : ""}
        <p class="mtg-notes">${m.source ? `<a href="${esc(m.source)}" target="_blank" rel="noopener">source</a> · ` : ""}<a href="${reportLink}" target="_blank" rel="noopener">report a change</a></p>
      </div>
      <div class="mtg-actions">
        <button class="btn small ${inPlan ? "in-plan" : ""}" data-act="plan" ${noDay ? "disabled title='Confirm the day with the source first'" : ""}>
          ${inPlan ? "✓ In my week" : "+ My week"}
        </button>
        <div class="cal-menu-wrap">
          <button class="btn small" data-act="cal" ${noDay ? "disabled title='Confirm the day with the source first'" : ""}>📅 Calendar</button>
        </div>
      </div>
    </article>`;
  }

  function wireCards(host) {
    host.querySelectorAll("[data-act='plan']").forEach((b) =>
      b.addEventListener("click", () => togglePlan(b.closest(".mtg").dataset.id))
    );
    host.querySelectorAll("[data-act='cal']").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        openCalMenu(b, b.closest(".mtg").dataset.id);
      })
    );
  }

  // ---------- calendar menu ----------

  function openCalMenu(anchor, id) {
    closeCalMenus();
    const m = state.meetings.find((x) => x.id === id);
    if (!m) return;
    const next = nextOccurrence(m.day, m.time);
    const menu = document.createElement("div");
    menu.className = "cal-menu";
    menu.innerHTML = `
      <div class="menu-note">${esc(m.name)} — ${DAYS[m.day]}s ${fmtTime(m.time)}</div>
      <button data-mode="once">Just ${esc(DAYS_SHORT[m.day])} ${next.getMonth() + 1}/${next.getDate()} (.ics)</button>
      <button data-mode="weekly">Every ${esc(DAYS[m.day])} (.ics)</button>
      <a href="${gcalUrl(m, "weekly")}" target="_blank" rel="noopener">Google Calendar (weekly)</a>
      <a href="${gcalUrl(m, "once")}" target="_blank" rel="noopener">Google Calendar (once)</a>`;
    menu.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        downloadIcs(icsForMeetings([m], b.dataset.mode), icsFileName(m));
        closeCalMenus();
        toast("Calendar file downloaded — open it to add the event.");
      })
    );
    anchor.parentElement.appendChild(menu);
  }

  function closeCalMenus() {
    document.querySelectorAll(".cal-menu").forEach((m) => m.remove());
  }

  // ---------- weekly plan ----------

  function loadPlan() {
    try {
      const p = JSON.parse(localStorage.getItem(PLAN_KEY) || "[]");
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  function savePlan() {
    localStorage.setItem(PLAN_KEY, JSON.stringify(state.plan));
  }

  function togglePlan(id) {
    const i = state.plan.indexOf(id);
    if (i >= 0) state.plan.splice(i, 1);
    else {
      state.plan.push(id);
      toast("Added to your week — see the “My week” tab.");
    }
    savePlan();
    renderAll();
  }

  function renderWeek() {
    const host = $("#week-grid");
    const today = todayInTz();
    const planned = state.plan
      .map((id) => state.meetings.find((m) => m.id === id))
      .filter(Boolean);

    let html = "";
    for (let d = 0; d < 7; d++) {
      const items = planned.filter((m) => m.day === d).sort((a, b) => cmp(a.time, b.time));
      html += `<div class="week-day ${d === today ? "today" : ""}">
        <h3>${DAYS[d]}${d === today ? ' <span class="today-tag">· today</span>' : ""}</h3>
        ${items.length
          ? items.map((m) => `
            <div class="week-item" style="border-left-color:${esc(fellowshipInfo(m.fellowship).color || FALLBACK_COLOR)}">
              <strong>${fmtTime(m.time)} — ${esc(m.name)}</strong>
              <span class="wi-meta">${esc(fellowshipInfo(m.fellowship).short)} · ${esc(m.venue || m.address || m.city || "")}</span>
              <div class="wi-actions">
                <button data-wi="cal" data-id="${esc(m.id)}">📅 .ics</button>
                <button data-wi="rm" data-id="${esc(m.id)}">remove</button>
              </div>
            </div>`).join("")
          : `<p class="week-empty">Nothing planned.</p>`}
      </div>`;
    }
    host.innerHTML = html;

    host.querySelectorAll("[data-wi='rm']").forEach((b) =>
      b.addEventListener("click", () => togglePlan(b.dataset.id))
    );
    host.querySelectorAll("[data-wi='cal']").forEach((b) =>
      b.addEventListener("click", () => {
        const m = state.meetings.find((x) => x.id === b.dataset.id);
        const mode = $("#week-repeat").value === "once" ? "once" : "weekly";
        downloadIcs(icsForMeetings([m], mode), icsFileName(m));
        toast("Calendar file downloaded.");
      })
    );
  }

  function exportWeek() {
    const planned = state.plan
      .map((id) => state.meetings.find((m) => m.id === id))
      .filter(Boolean);
    if (!planned.length) {
      toast("Your week is empty — add meetings from the “Find a meeting” tab first.");
      return;
    }
    const mode = $("#week-repeat").value === "once" ? "once" : "weekly";
    downloadIcs(icsForMeetings(planned, mode), `my-recovery-week-${state.cityKey}.ics`);
    toast(`Downloaded ${planned.length} meeting${planned.length > 1 ? "s" : ""} — open the file to add them.`);
  }

  // ---------- dates / timezone ----------

  // Current weekday (0=Sun) in the city's timezone.
  function todayInTz() {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: state.tz, weekday: "short" }).format(new Date());
    return DAYS_SHORT.indexOf(name);
  }

  // Y/M/D of "now" in the city's timezone.
  function nowPartsInTz() {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: state.tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const get = (t) => Number(p.find((x) => x.type === t).value);
    return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute") };
  }

  // Next calendar date (in city tz) that falls on `day` at `time` (HH:MM wall clock).
  // Returned as a Date used only for its Y/M/D fields.
  function nextOccurrence(day, time) {
    const now = nowPartsInTz();
    const base = new Date(Date.UTC(now.y, now.mo - 1, now.d));
    const todayDow = todayInTz();
    let delta = (day - todayDow + 7) % 7;
    if (delta === 0) {
      const [h, mi] = time.split(":").map(Number);
      if (h < now.h || (h === now.h && mi <= now.mi)) delta = 7; // already passed today
    }
    base.setUTCDate(base.getUTCDate() + delta);
    return base;
  }

  const pad = (n) => String(n).padStart(2, "0");

  function icsDate(d, time) {
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${time.replace(":", "")}00`;
  }

  function addMinutes(time, mins) {
    const [h, mi] = time.split(":").map(Number);
    const t = h * 60 + mi + mins;
    return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
  }

  // ---------- ICS ----------

  // Covers every US Central-time city. A city.json with a different
  // timezone needs its own VTIMEZONE block added here.
  const VTIMEZONE_CHICAGO = [
    "BEGIN:VTIMEZONE",
    "TZID:America/Chicago",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0600",
    "TZOFFSETTO:-0500",
    "TZNAME:CDT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0600",
    "TZNAME:CST",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ].join("\r\n");

  function icsEscape(s) {
    return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  }

  function icsForMeetings(meetings, mode) {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z/, "Z");
    const events = meetings.map((m) => {
      const start = nextOccurrence(m.day, m.time);
      const end = m.endTime || addMinutes(m.time, 60);
      const endDate = m.endTime && m.endTime < m.time ? shiftDate(start, 1) : start;
      const loc = [m.venue, m.address, m.city, m.state, m.zip].filter(Boolean).join(", ");
      const desc = [
        `${m.fellowship} meeting${m.types?.length ? ` (${m.types.join(", ")})` : ""}.`,
        m.notes || "",
        m.source ? `Details / verify: ${m.source}` : "",
        m.conferenceUrl ? `Join online: ${m.conferenceUrl}` : "",
      ].filter(Boolean).join("\\n");
      return [
        "BEGIN:VEVENT",
        `UID:${m.id}-${mode}@recoverymeetings`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=${state.tz}:${icsDate(start, m.time)}`,
        `DTEND;TZID=${state.tz}:${icsDate(endDate, end)}`,
        mode === "weekly" ? "RRULE:FREQ=WEEKLY" : null,
        `SUMMARY:${icsEscape(`${m.name} (${m.fellowship})`)}`,
        loc ? `LOCATION:${icsEscape(loc)}` : null,
        `DESCRIPTION:${icsEscape(desc)}`,
        m.source ? `URL:${m.source}` : null,
        "BEGIN:VALARM",
        "TRIGGER:-PT30M",
        "ACTION:DISPLAY",
        `DESCRIPTION:${icsEscape(m.name)} in 30 minutes`,
        "END:VALARM",
        "END:VEVENT",
      ].filter(Boolean).join("\r\n");
    });

    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Recovery Meetings//EN",
      "CALSCALE:GREGORIAN",
      VTIMEZONE_CHICAGO,
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");
  }

  function shiftDate(d, days) {
    const c = new Date(d);
    c.setUTCDate(c.getUTCDate() + days);
    return c;
  }

  function icsFileName(m) {
    return `${m.baseId || m.id}.ics`;
  }

  function downloadIcs(text, filename) {
    const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function gcalUrl(m, mode) {
    const start = nextOccurrence(m.day, m.time);
    const end = m.endTime || addMinutes(m.time, 60);
    const endDate = m.endTime && m.endTime < m.time ? shiftDate(start, 1) : start;
    const loc = [m.venue, m.address, m.city, m.state, m.zip].filter(Boolean).join(", ");
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `${m.name} (${m.fellowship})`,
      dates: `${icsDate(start, m.time)}/${icsDate(endDate, end)}`,
      ctz: state.tz,
      details: `${m.fellowship} meeting. ${m.notes || ""}${m.source ? ` Verify: ${m.source}` : ""}`.trim(),
      location: loc,
    });
    if (mode === "weekly") params.set("recur", "RRULE:FREQ=WEEKLY");
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  // ---------- misc ----------

  function fmtTime(t) {
    if (!t) return "—";
    let [h, mi] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${pad(mi)}<span class="ampm">${ampm}</span>`;
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3200);
  }

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  boot().catch((err) => {
    console.error(err);
    $("#meetings-list").innerHTML =
      `<div class="empty"><p><strong>Couldn't load meeting data.</strong></p><p>${esc(err.message)}</p></div>`;
  });
})();

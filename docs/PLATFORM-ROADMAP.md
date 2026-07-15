# The Recovery Platform — Data Architecture & Product Roadmap

*The definitive recovery database: every fellowship, every meeting, every resource — built on privacy, anonymity, accuracy, and respect for each fellowship's traditions.*

**Status:** planning document · v1 · July 2026
**What exists today:** a live multi-fellowship meeting finder for Nashville (AA · NA · CA · Celebrate Recovery, 900+ meetings), a nightly ingestion pipeline (TSML + BMLT + curated), a weekly planner, and calendar export. That is the seed of Phase 1, not the product.

---

## 0. Operating principles — the constraints that shape everything

These are not values-statement decoration. Each one dictates architecture decisions below.

1. **Anonymity is structural, not a setting.** Traditions 11 and 12 (anonymity at the level of press; principles before personalities) mean the platform must be fully usable with zero identity: no account, no email, no phone, no tracking, no analytics on recovery behavior. Consequence: *local-first architecture* — personal data lives on the device by default and syncs only as an opt-in, end-to-end-encrypted blob we cannot read.
2. **Attendance data is health data.** A record of "this person attends NA on Tuesdays" can cost someone a job, custody, or worse, and is subpoenable if we hold it. Consequence: we never store meeting attendance, plans, journals, or sobriety dates server-side in readable form. Zero-knowledge or not at all.
3. **Fellowships neither endorse nor oppose.** Traditions 6 and 10 mean we present every fellowship neutrally, never imply affiliation or endorsement, never use a fellowship's registered marks/logos without written permission, and never rank one program over another. We are infrastructure, like a phone book.
4. **Meeting facts are facts; literature is property.** Times, places, and formats of public meetings are factual data (not copyrightable in the US per *Feist*). But daily readings, prayers, steps/traditions text, and books are aggressively enforced copyrights (AAWS and NAWS both have active IP programs). Consequence: **link, never republish.** The "Daily Reading" feature is a deep link + notification, not hosted text, until written licenses exist.
5. **Provenance on every record.** Every meeting row carries its source, fetch timestamp, and confidence. Stale or unverifiable data is labeled, never silently presented as fresh. A wrong meeting time can mean someone in crisis standing outside a locked church.
6. **Official source > aggregator > scrape > manual.** In that order, always. Scraping only where legal, ethical, robots-respecting, and there is no feed — and always with a parallel effort to get an official feed or permission.

---

## 1. The organization registry

### 1.1 How meeting data actually flows in the recovery world (read this first)

Nearly all machine-readable recovery meeting data flows through **four open infrastructures**. Owning excellent adapters for these four covers the large majority of the world's 12-step meetings:

| Infrastructure | Who uses it | Access | Notes |
|---|---|---|---|
| **Meeting Guide API / TSML** ([spec](https://github.com/code4recovery/spec), maintained by [Code for Recovery](https://code4recovery.org/)) | ~1,400+ AA intergroups worldwide, plus many Al-Anon, OA, SLAA, CoDA sites running the WordPress "12 Step Meeting List" plugin | Open JSON feed per site (`/wp-admin/admin-ajax.php?action=meetings`) | Non-proprietary spec. No public central aggregator — AAWS's Meeting Guide app aggregates privately. **We build our own registry of feed URLs** (the spec repo and code4recovery community are the map). |
| **BMLT** — Basic Meeting List Toolbox ([bmlt.app](https://bmlt.app/)) | Most NA regions worldwide; some other fellowships | Open semantic API per root server, plus the public **aggregator** (aggregator.bmltenabled.org) that mirrors all registered root servers | Already integrated in our pipeline. One adapter = worldwide NA. |
| **iCalendar (ICS)** | Clubhouses, alano clubs, churches (CR), retreat centers, conventions | Open standard | Our connect-outside project already has a production ICS pipeline to reuse. |
| **findtreatment.gov API** (SAMHSA) | All licensed US treatment facilities | Free API; [developer guide](https://findtreatment.gov/assets/FindTreatment-Developer-Guide.pdf) + [access request form](https://findtreatment.gov/api-request-form) | US-government work = public domain. This is the *entire treatment module* handed to us. |

Everything that doesn't flow through these four is either a **custom finder** (SMART, Celebrate Recovery, In The Rooms — partnership conversations) or **manual curation** (small fellowships — our `curated.json` pattern, scaled with a review UI).

### 1.2 Tier 1 — full profiles (largest fellowships, deepest integration)

**Legend for "Directory": ** MG/TSML = Meeting Guide API feeds · BMLT = BMLT semantic API · Custom = proprietary finder, no public API.

---

#### Alcoholics Anonymous (AA)
| Field | Detail |
|---|---|
| Website | [aa.org](https://www.aa.org) (GSO); meeting data lives at ~1,400 intergroup/central-office sites |
| Coverage | Worldwide, ~120k groups, ~180 countries |
| Meeting directory | Per-intergroup MG/TSML feeds (open JSON); [OIAA](https://aa-intergroup.org) for online meetings (also TSML-powered); Meeting Guide app aggregates but is not a public API |
| Downloads / feeds | Each TSML site exports CSV; no global download |
| Event calendars | Intergroup ICS calendars; International Convention (every 5 years, next 2030); area assemblies |
| Daily readings | *Daily Reflections* — © AAWS, on aa.org. **Link only.** |
| Literature | Big Book, 12&12 — © AAWS (note: 1st-edition Big Book text is widely held to be US public domain; get counsel's opinion before relying on it) |
| Podcasts / speakers | No official podcast. Speaker recordings ecosystem is third-party (see §3.4) |
| News | Box 4-5-9 newsletter (aa.org); AA Grapevine (separate entity, subscription, © Grapevine Inc.) |
| Local chapters / service | Intergroups + Areas/Districts; service = GSR/Intergroup volunteer structure; central offices list volunteer needs |
| Contact | Per-intergroup; GSO: contact form on aa.org |
| Apps | Official **Meeting Guide** (iOS/Android); Grapevine app |
| Update frequency | Intergroup feeds update continuously; fetch nightly |
| Licensing | Meeting facts: open. Literature/readings/logos (circle-triangle): **permission required.** Never present as "AA-endorsed." |

#### Narcotics Anonymous (NA)
| Field | Detail |
|---|---|
| Website | [na.org](https://na.org) (NA World Services); regional sites |
| Coverage | Worldwide, ~76k meetings, 140+ countries |
| Meeting directory | BMLT root servers per region + global aggregator; [virtual-na.org](https://virtual-na.org) for online meetings; na.org meeting search |
| Downloads / feeds | BMLT semantic API exports JSON/CSV/XML; printable lists per region |
| Event calendars | Regional ICS/BMLT events; World Convention (WCNA); regional conventions |
| Daily readings | *Just for Today* — © NAWS, email subscription + page on na.org. **Link only.** |
| Literature | Basic Text, It Works, Living Clean — © NAWS, actively enforced |
| Podcasts / speakers | No official; large third-party speaker ecosystem |
| News | NAWS News, The NA Way magazine (free PDF on na.org) |
| Local chapters / service | Areas/Regions; H&I (Hospitals & Institutions) and PR service bodies — strong volunteer-opportunity data |
| Contact | fsmail@na.org; per-region contacts |
| Apps | No official meeting app (BMLT-based third-party apps exist) |
| Update frequency | BMLT aggregator syncs continuously; fetch nightly |
| Licensing | Meeting facts open via BMLT (built for this). Literature/readings: **permission required.** |

#### Cocaine Anonymous (CA)
| Field | Detail |
|---|---|
| Website | [ca.org](https://ca.org); ~area sites (e.g. canashville.com) |
| Coverage | US, Canada, UK, Europe — ~2k meetings |
| Meeting directory | ca.org meeting list + [CA Online (CAO)](https://ca-online.org) for virtual; area sites mostly static pages — **curation + area outreach** |
| Daily readings | *A Quiet Peace* daily meditation book — © CA World Services. Link only. |
| Literature | "Hope, Faith & Courage" — © CAWS |
| Conventions | CA World Service Convention (annual) |
| Apps / feeds | None official |
| Update frequency | Manual/curated; quarterly re-verification + area contact program |
| Licensing | Meeting facts open; literature copyrighted |

#### Crystal Meth Anonymous (CMA)
| Field | Detail |
|---|---|
| Website | [crystalmeth.org](https://crystalmeth.org) |
| Coverage | US-centered, growing international; ~800 meetings |
| Meeting directory | crystalmeth.org meeting finder (district-based); online meetings list | 
| Notes | High-value fellowship for urban coverage; directory is semi-structured — request feed access, fall back to curation |

#### Marijuana Anonymous (MA)
| Field | Detail |
|---|---|
| Website | [marijuana-anonymous.org](https://marijuana-anonymous.org) |
| Coverage | US + international; districts worldwide |
| Meeting directory | MG/TSML-compatible feed (MA runs the 12-step-meeting-list stack) — **adapter we already have** |
| Daily readings | *A New Leaf* — © MA World Services. Link only. |
| Apps | Official MA app |

#### Celebrate Recovery (CR)
| Field | Detail |
|---|---|
| Website | [celebraterecovery.com](https://www.celebraterecovery.com); [locator.crgroups.info](https://locator.crgroups.info) |
| Coverage | ~35k churches, worldwide; Christ-centered, covers all "hurts, habits, hang-ups" |
| Meeting directory | Official locator (custom, no public API). **Priority partnership conversation** — until then: curation + church-site ICS feeds |
| Daily readings | Daily devotional — © CR/Purpose Driven. Link only. |
| Literature | Step studies, journals — commercial (Zondervan) |
| Events | One-day "Summit" events + annual Summit conference |
| Apps | Official CR app |
| Licensing | CR is a brand of Saddleback/Purpose Driven — logo and name usage need permission; meeting facts from churches are open |

#### Al-Anon / Alateen (families of alcoholics)
| Field | Detail |
|---|---|
| Website | [al-anon.org](https://al-anon.org) |
| Coverage | Worldwide, ~24k groups, 130+ countries |
| Meeting directory | al-anon.org meeting search; many Areas run TSML feeds (adapter reuse); official mobile app has meetings + chat |
| Daily readings | *Courage to Change*, *One Day at a Time* — © Al-Anon WSO. Link only. |
| Apps | Official Al-Anon app (includes online meetings) |
| Why Tier 1 | Family members are half the audience of a true recovery platform, and nobody serves them well. |

#### Nar-Anon (families of addicts)
| Field | Detail |
|---|---|
| Website | [nar-anon.org](https://nar-anon.org) |
| Coverage | Worldwide |
| Meeting directory | nar-anon.org finder (custom); curation + outreach |

#### SMART Recovery (secular, science-based)
| Field | Detail |
|---|---|
| Website | [smartrecovery.org](https://smartrecovery.org); [meetings.smartrecovery.org](https://meetings.smartrecovery.org/meetings/) |
| Coverage | ~30 countries; strong online program; 4-Point Program + Family & Friends |
| Meeting directory | "SMARTfinder" (custom, no public API) — **partnership required**; they have a national org with staff, so a data agreement is realistic |
| Tools | SMART toolbox (CBA, ABC worksheets) — © SMART Recovery, some materials free to distribute with attribution; confirm per-item |
| Apps | Official SMART Recovery app |
| Why Tier 1 | The largest secular alternative; including it is what makes us "recovery" and not "12-step only." |

#### Recovery Dharma (Buddhist-informed, peer-led)
| Field | Detail |
|---|---|
| Website | [recoverydharma.org](https://recoverydharma.org) |
| Coverage | US + international, strong online presence |
| Meeting directory | Public meeting list on site (structured); the book *Recovery Dharma* is **Creative Commons licensed** — the rare case where literature can potentially be embedded (verify CC variant: BY-SA vs NC) |
| Why notable | CC-licensed program text is a unique content opportunity no competitor exploits. |

#### Overeaters Anonymous (OA)
| Field | Detail |
|---|---|
| Website | [oa.org](https://oa.org) |
| Coverage | Worldwide, ~6k meetings, 80+ countries |
| Meeting directory | oa.org "Find a Meeting" (structured, exportable); many intergroups run TSML |
| Daily readings | *Voices of Recovery*, *For Today* — © OA. Link only. |

#### Gamblers Anonymous (GA)
| Field | Detail |
|---|---|
| Website | [gamblersanonymous.org](https://gamblersanonymous.org) |
| Coverage | International |
| Meeting directory | Site directory (semi-structured, scrape-with-care or curate); Gam-Anon for families |

#### Adult Children of Alcoholics & Dysfunctional Families (ACA)
| Field | Detail |
|---|---|
| Website | [adultchildren.org](https://adultchildren.org) |
| Coverage | Worldwide, ~2.5k meetings |
| Meeting directory | adultchildren.org meeting search (structured, has export/JSON behind the finder — investigate); many meetings online |

#### Co-Dependents Anonymous (CoDA)
| Field | Detail |
|---|---|
| Website | [coda.org](https://coda.org) |
| Coverage | 60+ countries |
| Meeting directory | coda.org finder; many locals on TSML |

#### In The Rooms (aggregator/community — potential partner, not fellowship)
| Field | Detail |
|---|---|
| Website | [intherooms.com](https://intherooms.com) |
| What it is | 1M+ member online recovery community; hosts 130+ weekly live online meetings across fellowships |
| Relationship | Competitor for "community" features, ideal **partner** for live online meetings — embed/refer rather than rebuild. They have existing B2B integrations. |

### 1.3 Tier 2 — one-line registry (integrate via TSML/BMLT adapters where present, else curate)

**Substance fellowships:** Heroin Anonymous (heroinanonymous.org) · Pills Anonymous (pillsanonymous.org) · Nicotine Anonymous (nicotine-anonymous.org — TSML) · Chemically Dependent Anonymous (cdaweb.org) · Dual Recovery Anonymous (co-occurring; draonline.qwknetllc.com — verify status) · All Recovery (unaffiliated multi-pathway meetings, often via recovery community orgs)

**Behavioral fellowships:** Sex Addicts Anonymous (saa-recovery.org) · Sexaholics Anonymous (sa.org) · Sex & Love Addicts Anonymous (slaafws.org — TSML ecosystem) · Sexual Recovery Anonymous · Debtors Anonymous (debtorsanonymous.org) · Underearners Anonymous (underearnersanonymous.org) · Workaholics Anonymous (workaholics-anonymous.org) · Emotions Anonymous (emotionsanonymous.org) · Food Addicts in Recovery Anonymous (foodaddicts.org — structured finder) · Food Addicts Anonymous (foodaddictsanonymous.org) · Internet & Technology Addicts Anonymous (internetaddictsanonymous.org) · Online Gamers Anonymous (olganon.org) · Clutterers Anonymous · Spenders Anonymous

**Family & friends:** Families Anonymous (familiesanonymous.org) · Gam-Anon (gam-anon.org) · S-Anon (sanon.org) · COSA (cosa-recovery.org) · Co-Anon (co-anon.org) · Alateen (via Al-Anon) · Parents of Addicted Loved Ones — PAL (palgroup.org) · GRASP (grief after substance passing — grasphelp.org)

**Secular / alternative pathways:** LifeRing Secular Recovery (lifering.org) · Women for Sobriety (womenforsobriety.org) · Secular Organizations for Sobriety (sossobriety.org) · She Recovers (sherecovers.org) · The Phoenix (thephoenix.org — free sober active community, growing fast, has class calendar) · Moderation Management (moderation.org) · Recovering from Religion adjacent groups — evaluate case-by-case

**Faith & culture specific:** Wellbriety / White Bison (whitebison.org — Native American; talking circles) · Millati Islami (millatiislami.org — Islamic 12-step) · JACS (Jewish community, jbfcs adjacent) · Buddhist Recovery Network (buddhistrecovery.org) · Catholic in Recovery (catholicinrecovery.com)

**Online-native directories:** OIAA (aa-intergroup.org) · Virtual NA (virtual-na.org) · 24hourrecovery.org · online-meeting-list projects (code4recovery)

**International bodies:** each Tier 1 fellowship has national General Service structures (e.g., AA Great Britain alcoholics-anonymous.org.uk runs its own structured finder; AA Deutschland; NA regions worldwide via BMLT). Strategy: country expansion = enumerate that country's service bodies, most already on the four infrastructures.

*Registry maintenance: this table lives as `registry/fellowships.json` in-repo — one record per org with all fields from §1.2, machine-readable, powering both the docs and the ingestion pipeline config.*

---

## 2. Complete information architecture

Every category the platform supports, mapped to its data model, source, and privacy class.

**Privacy classes:** `PUBLIC` (server-side, shared by all) · `LOCAL` (device only by default) · `E2E` (syncable only as encrypted blob) · `MODERATED` (user-generated, visible to others, requires moderation infrastructure).

### 2.1 Meetings (PUBLIC)
| Item | Model / source notes |
|---|---|
| In-person / online / hybrid | `attendance_option` — already modeled; conference URL + dial-in fields |
| Temporary changes | `status: active/suspended/moved` + `status_note` + `effective_dates`; TSML has `TC` codes; BMLT has `unpublished`; plus user reports queue |
| Accessibility | wheelchair (TSML `X`, BMLT `WC`), ASL, fragrance-free, parking notes |
| Language | ISO code list per meeting (TSML/BMLT both carry it) |
| Childcare | flag + note (TSML `BA`) |
| Beginner / newcomer | flag (TSML `BE`, BMLT `B`) |
| Open vs closed | flag — with plain-language explainer ("open = anyone; closed = for those who identify as members") |
| Formats | normalized vocabulary mapped from each source's codes (we already maintain both maps) |
| Calendar integration | ICS + Google links (built); add per-meeting subscribe feed (`webcal://` per meeting/plan) |
| Favorites / recently viewed | LOCAL |
| Attendance history | E2E only, opt-in — never PUBLIC, never plain server-side |

### 2.2 Recovery resources (PUBLIC, link-first)
| Item | Source strategy |
|---|---|
| Daily readings | Deep links + local notification: Daily Reflections (AAWS), Just for Today (NAWS), Courage to Change (Al-Anon), A New Leaf (MA), Voices of Recovery (OA)… — **hosted text requires per-publisher license; do not ship without it** |
| Prayers & meditations | Public-domain items only (Serenity Prayer short form is PD; St. Francis Prayer PD) + links |
| Literature catalog | Metadata + ISBNs + links to official stores (aa.org, na.org bookstore, Hazelden). Never PDFs. Recovery Dharma (CC) is the exception — embeddable if license variant allows |
| Audiobooks | Link to official (AAWS has free Big Book audio on aa.org) |
| Speaker recordings | Index + link/embed from consenting archives (see §3.4); rights are murky — takedown process required |
| Podcasts | Standard podcatcher model: index public RSS, play from source, never re-host. Curated recovery podcast directory (Recovery Elevator, The Bubble Hour, Sober Powered, That Sober Guy, HOME Podcast, Dopey…) |
| Videos | Link/embed official YouTube (SMART has strong official video library) |
| Workshops / retreats / conventions / events | ICS ingestion + curated registry; per-fellowship convention calendars |

### 2.3 Personal recovery (LOCAL → E2E)
Sobriety tracker (multiple dates, per-substance/behavior) · milestones (auto-computed, fellowship-appropriate chips: 24h, 30/60/90, 6mo, 1yr…) · gratitude journal · step work workspace (structured worksheets per fellowship, content-neutral prompts to avoid literature copyright) · inventory tools (4th-step style grids — our own neutral wording) · sponsor notes · sponsee tracker (names optional/initials, E2E) · goals & habits · daily reflections journal · mood tracking. **All device-first; export/import as encrypted file from day one so no lock-in.**

### 2.4 Community (MODERATED — late phases, see risk note §6)
Local announcements (intergroup-sourced = PUBLIC, low risk) · service opportunities (H&I, GSR openings, coffee commitments — sourced from intergroups) · volunteer opportunities · group chat / anonymous messaging / sponsorship matching / accountability partners (**highest-risk features on this list** — predation, 13th-stepping, crisis liability; require real moderation staffing, safety design, and probably partnership rather than building).

### 2.5 Treatment (PUBLIC)
findtreatment.gov API: detox, inpatient, outpatient, MAT, sober living adjacent (plus NARR-certified recovery residences via state affiliate lists) · recovery coaches (peer-support certification bodies per state) · therapists (Psychology Today API is closed; link-out or partnerships) · **crisis: 988 Suicide & Crisis Lifeline, SAMHSA helpline 1-800-662-4357, Never Use Alone (neverusealone.com), local crisis lines** — hard-coded, tested, top of every surface · insurance: facility-level payment-accepted data comes with findtreatment.gov.

### 2.6 Education (PUBLIC)
NIAAA/NIDA/SAMHSA public-domain articles (US-gov = free to use, huge win) · addiction-science explainers · family resources (also PD from SAMHSA) · FAQ per fellowship (our own words) · glossary (our own words; quote sparingly under fair use).

---

## 3. Data source strategy (feature → best source)

| Feature | Best source | Type | Update | Licensing |
|---|---|---|---|---|
| AA meetings | Per-intergroup MG/TSML feeds (registry of ~1,400 URLs) | Open JSON | Nightly | Facts — open |
| NA meetings | BMLT aggregator | Open API | Nightly | Facts — open |
| Online AA/NA | OIAA / Virtual NA | TSML / lists | Nightly | Facts — open |
| Al-Anon, OA, MA, SLAA, CoDA, Nicotine A. | Their TSML feeds where present | Open JSON | Nightly | Facts — open |
| SMART | SMARTfinder | Custom | **Partnership** | Ask |
| CR | locator.crgroups.info | Custom | **Partnership**; curation meanwhile | Ask; brand permission |
| CA, GA, smaller fellowships | Area sites + curation queue | Manual | Quarterly re-verify | Facts — open |
| Treatment facilities | findtreatment.gov API | Gov API | Weekly | Public domain |
| Recovery residences | NARR state affiliates | Lists | Monthly | Facts |
| Crisis lines | 988/SAMHSA (static, hand-verified) | Static | Quarterly manual test | PD |
| Daily readings | Official pages (deep link) | Link | n/a | © — link only |
| Podcasts | Public RSS | RSS | 6-hourly | Index/play = standard podcatcher practice |
| Speakers | Consenting archives | Partnership | Weekly | Murky — consent + takedown |
| Events/conventions | ICS + curated registry | ICS | Daily | Facts |
| Education | NIAAA/NIDA/SAMHSA | PD content | Monthly | Public domain |

**Scraping policy:** only for sources with no feed, robots-permitting, factual data only, with contact-first outreach ("we'd love a feed; here's our TSML setup help") — code4recovery's tooling means *helping a small intergroup adopt TSML* is often easier than scraping them, and it improves the whole ecosystem. That outreach program is itself a moat.

---

## 4. Technical architecture

### 4.1 Evolution strategy — don't build Google-scale on day one

**Stage A (now):** static-first. Per-city JSON on CDN (Cloudflare), client-side filtering. Zero cost, absurdly scalable for reads, already live.
**Stage B (city count > ~50 or data > ~5MB/city):** ingestion moves to workers + a real database; the site consumes generated per-city bundles + a search API. Cloudflare Workers + **Postgres (Neon/Supabase) or D1**; R2 for bundles.
**Stage C (accounts/community):** dedicated API tier, auth, moderation tooling.

The static bundle path never goes away — it *is* the offline story and the cost ceiling.

### 4.2 Core schema (Stage B, Postgres)

```sql
-- Reference
fellowship(id, key, name, family, website, traditions_notes, brand_permissions)
source(id, fellowship_id, kind /*tsml|bmlt|ics|custom|curated|gov*/,
       url, region_hint, license_note, fetch_cadence, last_ok_at, health)

-- Places & groups
venue(id, name, address, city, region, country, postal, lat, lng,
      geocode_confidence, accessibility jsonb)
grp(id, fellowship_id, name, website, contact_opaque, notes)  -- "group" is reserved

-- The meeting itself (recurring template)
meeting(id, grp_id, venue_id, fellowship_id, name,
        day smallint, time time, end_time time, timezone,
        attendance /*in_person|online|hybrid*/, conference_url, dial_in,
        languages text[], formats text[] /*normalized vocab*/,
        open_to_all bool, status /*active|suspended|unverified*/,
        status_note, source_id, source_key, first_seen, last_verified,
        confidence real, search tsvector)

meeting_exception(meeting_id, date, kind /*cancelled|moved|time_change*/, note)

-- Content
event(id, fellowship_id, name, starts, ends, venue_id, url, kind /*convention|workshop|retreat*/, source_id)
resource(id, kind /*reading_link|podcast|literature|education|speaker|video*/,
         fellowship_id, title, url, rss_url, publisher, license, description)
facility(id, samhsa_id, name, services text[], payment text[], lat, lng, ...)  -- mirror of findtreatment.gov
crisis_line(id, name, phone, sms, chat_url, coverage, last_tested)

-- Registry & ops
report(id, meeting_id, kind /*wrong_time|moved|closed|new*/, body, created, status)  -- user reports, no user id required
review_queue(id, entity, entity_id, proposed jsonb, source, status)
```

**User data is *not* in this database.** Local device store (IndexedDB) holds plan/favorites/journal/sobriety. Optional sync = one opaque encrypted blob per anonymous vault ID (`vault(id, blob bytea, updated)`) — we can't read it, so it can't leak or be subpoenaed usefully.

### 4.3 Ingestion pipeline

```
registry/fellowships.json + source table
   → adapters (tsml | bmlt | ics | custom | curated | findtreatment)
   → normalize (shared meeting schema, format-code vocab maps)
   → geocode (cache-first; Nominatim/Geoapify; store confidence)
   → dedupe (fellowship + fuzzy name + day + time + geo proximity)
   → validate & score (required fields, sane times, URL liveness)
   → diff against current → publish (per-city bundles + DB upsert)
   → provenance stamps on every record; failures keep last-good (already built)
   → anomaly alerts (feed shrank 40%? flag, don't publish)
```

Nightly full runs; hourly for sources that support delta. All of this is an evolution of the pipeline already running in this repo.

### 4.4 Search
Stage A: client-side (MiniSearch) over the city bundle — instant, offline, private (queries never leave the device — a real privacy feature: *what someone searches for in this app is sensitive*).
Stage B+: Typesense/Meilisearch for cross-city and "meetings near me now" (geo + time queries); keep client search as fallback.

### 4.5 Offline & sync
PWA + service worker: app shell + user's cities cached; meeting data works fully offline (someone in a shaky moment in a hospital basement must still see tonight's list). Background sync refreshes bundles. Personal data: IndexedDB; optional E2E vault sync (WebCrypto AES-GCM, key derived from passphrase via Argon2; server stores ciphertext only). Export/import encrypted file ships in Phase 2 — sync can wait, portability can't.

### 4.6 Accounts & anonymous mode
Anonymous is the default and is not degraded. Optional "vault account" = random ID + passphrase — no email, no phone, no name (email optional for recovery, stored hashed-blind if provided). Never OAuth via Google/Facebook (links recovery to real identity). No third-party trackers, no ad SDKs, ever. Analytics: privacy-preserving aggregate counts only (e.g., self-hosted Plausible), no per-user trails, IPs not retained.

### 4.7 AI integration (useful, never creepy)
- **Pipeline AI (highest value, zero privacy risk):** normalize messy curated/scraped listings; entity-resolve duplicate venues; classify formats; draft curation entries from web pages for human review; anomaly explanation.
- **Product AI:** natural-language meeting search ("women's meeting tonight near me I can get to by bus"); plan suggestions ("your Tuesday is empty; three beginner meetings within 2 miles") — computed on-device or on anonymous queries.
- **Explicitly out:** AI on journals/step work unless it runs on-device; AI "sponsors" or crisis counseling (route to 988/humans, always).

### 4.8 Moderation
Phase-gated: none needed for PUBLIC data beyond the report/review queue (human-reviewed). Community features require: identity-light reputation, human moderators with recovery experience, crisis-escalation runbooks, block/report on everything, and legal review — this staffing cost is *the* reason community lands in Phase 5.

### 4.9 Scalability
Reads: CDN-served static bundles scale to millions of users for ~$0. API tier: Workers autoscale; Postgres read replicas by Stage C. The dataset itself is small by tech standards (worldwide meetings ≈ low millions of rows) — the hard part is *freshness breadth*, not volume. Budget accordingly: this is a data-operations product more than a big-compute product.

---

## 5. Feature prioritization

Scores 1–5 (5 = best). **Value** = user value · **Cx** = complexity (5 = easiest) · **Cost** (5 = cheapest) · **Edge** = competitive advantage · **Daily** = daily engagement · **Ret** = retention · **Rev** = revenue potential.

| Feature | Value | Cx | Cost | Edge | Daily | Ret | Rev | Phase |
|---|---|---|---|---|---|---|---|---|
| Multi-fellowship meeting finder (done, deepen) | 5 | 4 | 5 | 5 | 4 | 4 | 2 | 1 |
| TSML/BMLT breadth (all fellowships w/ feeds) | 5 | 4 | 4 | 5 | 3 | 4 | 2 | 1 |
| Weekly planner + calendar export (done) | 4 | 5 | 5 | 4 | 3 | 4 | 1 | 1 |
| PWA offline | 5 | 4 | 5 | 4 | 3 | 4 | 1 | 1 |
| Accessibility/language/format filters | 4 | 5 | 5 | 3 | 2 | 3 | 1 | 1 |
| "Meeting changed" reports + review queue | 5 | 4 | 4 | 4 | 2 | 3 | 1 | 1 |
| Crisis resources surface | 5 | 5 | 5 | 2 | 1 | 2 | 0 | 1 |
| City expansion framework (10→50 cities) | 5 | 3 | 4 | 5 | 3 | 4 | 3 | 2 |
| Sobriety tracker + milestones (local) | 5 | 4 | 5 | 3 | 5 | 5 | 1 | 2 |
| Daily reading links + notifications | 4 | 5 | 5 | 3 | 5 | 5 | 1 | 2 |
| Journal/gratitude (local, encrypted export) | 4 | 4 | 5 | 3 | 5 | 5 | 1 | 2 |
| Treatment locator (findtreatment.gov) | 4 | 4 | 5 | 3 | 1 | 2 | 3 | 2 |
| Podcast directory + player | 3 | 4 | 4 | 2 | 4 | 4 | 2 | 3 |
| Events/conventions calendar | 3 | 4 | 4 | 4 | 2 | 3 | 2 | 3 |
| Speaker recording index | 4 | 3 | 3 | 4 | 4 | 4 | 1 | 3 |
| National/worldwide coverage | 5 | 2 | 2 | 5 | 3 | 4 | 4 | 3–4 |
| E2E vault sync + step-work tools | 4 | 2 | 3 | 4 | 4 | 5 | 3 | 4 |
| Sponsor/sponsee tools (E2E) | 4 | 3 | 4 | 4 | 3 | 4 | 2 | 4 |
| Service/volunteer board (intergroup-sourced) | 3 | 3 | 4 | 4 | 2 | 3 | 1 | 4 |
| Community: chat/matching/messaging | 4 | 1 | 1 | 3 | 5 | 5 | 3 | 5 |
| AI natural-language search | 3 | 3 | 3 | 4 | 3 | 3 | 2 | 5 |

**Revenue stance (informs the Rev column):** never ads on recovery surfaces, never data sales, never pay-to-rank for treatment. Sustainable models, in order: individual donations ("gratitude button"), grants (SAMHSA/state opioid-response, foundations), B2B data/API licensing to *vetted* treatment orgs and health systems, white-label meeting finders for intergroups/regions (they pay for hosting+support of their own data — deepens the moat), premium personal features (sync, families plan) — with the free tier never crippled.

---

## 6. Phased roadmap

### Phase 1 — Own the meeting layer (0–3 months)
**Build:** every fellowship with an open feed (Al-Anon, OA, MA, SLAA, CoDA, Nicotine A. via existing TSML adapter; expand BMLT breadth), fellowship registry file, curation review queue + "report a change" on every card, accessibility/language filters, PWA offline, crisis strip, 5–10 launch cities using the existing city framework.
**Why first:** meeting accuracy is the entire brand; every later feature stands on it. All of this reuses adapters that already run in production tonight.
**Exit criteria:** 10 cities · 8+ fellowships · <2% stale-meeting reports/month · offline works.

### Phase 2 — Become daily (3–7 months)
**Build:** sobriety tracker + milestones, daily-reading links with local notifications, gratitude/journal (device-only + encrypted export), treatment locator (findtreatment.gov API + NARR residences), city expansion to ~50 via registry-driven onboarding.
**Why now:** the finder is used weekly at best; readings + tracker + journal make it the first app opened every morning — retention that community features would otherwise have to buy with moderation risk. All LOCAL-class: zero privacy debt.
**Exit criteria:** DAU/MAU > 25% · tracker adoption > 30% of returning users.

### Phase 3 — Own the content layer (7–12 months)
**Build:** podcast directory/player (RSS), events & conventions calendar (ICS + registry), speaker-archive partnerships, education hub from public-domain NIAAA/NIDA/SAMHSA content, Typesense search, national coverage push (top 100 US metros).
**Why now:** content deepens daily use and is licensing-light if done link-first; national coverage converts the app from "my city's tool" to "the default."
**Exit criteria:** 100 metros · content sessions > 20% of sessions.

### Phase 4 — Personal platform (12–20 months)
**Build:** E2E vault sync across devices, step-work workspaces (fellowship-neutral wording), sponsor/sponsee tools, service-opportunity board sourced from intergroups, SMART/CR/In The Rooms partnerships signed, international pilot (UK + Canada via AA GB finder + BMLT).
**Why now:** sync/sponsor tools need the E2E infrastructure matured; partnerships need the traffic Phases 1–3 create as leverage.
**Exit criteria:** vault users > 100k · 2 signed data partnerships · 2 countries.

### Phase 5 — Community, carefully (20+ months)
**Build:** moderated local announcements → accountability-partner matching → group messaging, in that order, each gated on safety review; AI natural-language search; grants/B2B revenue engine mature.
**Why last:** matching and messaging carry predation, 13th-stepping, and crisis-liability risk that requires paid moderators with recovery experience, escalation runbooks, and counsel. Doing this before the trust and revenue exist would endanger users and the platform. Genuine alternative: partner with In The Rooms for community and stay the best *directory + personal* layer — decide at Phase 4 exit with data.

### Explicitly deferred / declined
- Hosting copyrighted literature or daily-reading text (until licensed, link only)
- Fellowship logos/marks without written permission
- Any server-side plaintext personal recovery data — permanently declined
- Ads, trackers, data sales — permanently declined

---

## 7. Permissions & legal checklist (before each launch)

| Item | Who | Needed for | Status |
|---|---|---|---|
| findtreatment.gov API key | SAMHSA | Phase 2 treatment | Request form online |
| SMART data agreement | SMART Recovery national | SMART meetings | Outreach letter |
| CR locator data | Celebrate Recovery / Purpose Driven | CR at scale | Outreach letter |
| Daily-reading licenses | AAWS · NAWS · Al-Anon WSO · Hazelden | Hosted reading text (else link-only) | Not started — link-only until signed |
| Recovery Dharma CC variant confirmation | Recovery Dharma board | Embedded program text | Verify license file |
| Speaker archive consents | XA-Speakers et al. | Phase 3 speakers | Outreach |
| Trademark review (names/marks usage) | IP counsel | All phases | Before Phase 1 marketing |
| Privacy policy + threat-model review | Privacy counsel | Phase 2 (personal data) | Before tracker ships |
| Community safety/liability review | Counsel + safety advisor | Phase 5 | Gate condition |

---

*Maintained at `docs/PLATFORM-ROADMAP.md`. The machine-readable fellowship registry it describes lives at `registry/fellowships.json` (Phase 1 deliverable). Corrections welcome — accuracy is the product.*

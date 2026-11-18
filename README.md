# Tamargi clickable prototype

Arabic-first (RTL) HTML prototype of the Tamargi clinic app. It has no build step and no server: open `index.html` in a browser. All data is fake.

The prototype shows the final product only: screens, features and user journeys. Where each feature came from is recorded in the vault: `01_Obsidian_Vault/03_Healthcare_Domain/competitors/nitco/feature-traceability.md`.

## Layout
- `index.html`: the hub. It links all 35 screens (42 screen states), the user journeys, the features by app and the design system preview.
- `screens/*.html`: one file per screen. Start new screens from `_screen-template.html`; its comment block lists the rules.
- `assets/tamargi.css`: the design system (tokens, components, RTL, dark mode).
- `assets/shell.js`: the app shell. It provides the top bar (org and branch switchers, role, AR/EN, theme), the side nav, the feature-guide pins (Alt+N), the state switcher (`#state=name`), and the `Tamargi.ctx` / `Tamargi.onCtx` API.
- `assets/demo-data.js` (`window.TamargiData`): one shared fake dataset holding the orgs, branches, rooms, doctors, shifts, staff, patients, services and prices, appointments, invoices, stock, equipment, plans, leaves, vitals and past visits, plus their helpers.
- `assets/demo-clinical.js` (`window.TamargiClinical`): clinical content grouped by specialty (drug lines, Rx sets, visit templates, ICD-10 labels). Only the visit-note, prescription, Rx-favourites and templates screens load it.

## Organizations and branches
The model is Organization, then Branches, then Rooms.
- **Sample orgs:** `selim` is a solo clinic with one branch. `nile` is a polyclinic with two branches, Toreil and University.
- **Switching:** every screen renders from the current org and branch and re-renders when you switch them in the top bar. The selection is kept in localStorage.
- **Org-wide data:** the patient file and the file number belong to the org.
- **Per-branch data:** invoice, receipt and credit-note numbers each run a separate series per branch, for example `NMC-TOR-2026-003121` or `CN-TOR-2026-000007`. Queue numbers are counted per branch per day.

## Script order on each screen
`demo-data.js` → (`demo-clinical.js` on clinical screens) → `shell.js` → the page's own inline script.

## Feedback
Every page shows a "💬 ملاحظات / Feedback" button (from `assets/shell.js`). Testers pick "This screen" or "General / system logic", their role and a comment; the screen, org/branch, language, time and viewport are added automatically. Comments go to `POST /api/feedback` and are stored one file per comment in a **private** Vercel Blob store (`feedback/<time>-<id>.json`). If sending fails, the comment stays queued in the browser and is retried. Opened as a local file, nothing is sent; testers can still download their own comments (JSON / CSV) from the same panel.

**One-time setup on Vercel (founder)**
1. Project → **Storage** → **Create** → **Blob**. Choose **Private** access (it cannot be changed later) and a region close to Egypt (for example Frankfurt), then create.
2. In the store's **Projects** tab, **Connect to Project** → this project, all environments. Vercel adds `BLOB_STORE_ID` and uses OIDC, so no token is needed (`BLOB_READ_WRITE_TOKEN` also works if you add one).
3. Project → **Settings** → **Environment Variables** → add `FEEDBACK_ADMIN_KEY` = a long random password (at least 12 characters; 24+ recommended), all environments. Keep it secret.
4. **Deployments** → **Redeploy** the latest deployment so the functions see the new variables.

**View / download all feedback:** the hub has a "📋 ملاحظات المختبرين / Tester feedback" button that opens `feedback-admin.html` (noindex, disallowed in robots.txt). The first time on a device, paste the admin key once; after it works it is remembered on that device ("Forget key on this device" removes it). "Copy private bookmark link" gives a `…/feedback-admin.html#key=…` link that opens the list straight away (the key is removed from the address bar on load; never share that link). All comments show newest first, with filters (type, role, screen, search) and **Download CSV (Excel)** / **Download JSON**. The CSV is UTF-8 with BOM, so Excel shows Arabic correctly; its screen label follows the page language.

**Screen names:** each comment stores `screen_id` (file name without `.html`, e.g. `clinic-web-page`), `screen_label_ar` / `screen_label_en` (from the one screen registry in `assets/shell.js`, also used by the hub) and `page_path`. `screenTitle` / `screenFile` are kept for compatibility; older comments get their `screen_id` from `page_path` or `screenFile`.

**Developers:** `npm install` then `npm test` (node --test, Blob calls mocked). Code: `api/feedback.js`, `api/feedback-export.js`, shared logic in `api/_lib/feedback-core.js`.

## Logo vote
`screens/logo-vote.html` ("🗳️ صوّت على الشعار / Vote on the logo" on the hub) lets testers like the shortlisted logos. Each logo is one row: name and idea, its palette (swatch + hex + role), then every designed version on the background it was designed for (symbol, symbol on its own dark ground, one-colour, black for thermal print, 16 px favicon at real size and enlarged, app icon, WhatsApp avatar, bilingual/Arabic/Latin/stacked lockups, alternative colourway, palette board, as available). The strip wraps on desktop and scrolls sideways on phones. The row ends with the live count, "👍 أعجبني / I like it" and "💬 Comment on this logo", which opens the feedback widget tagged with the logo and quick aspect chips (Colour / Shape / Arabic font / Latin font / Small size / Other). A ranking bar chart sits at the bottom.

- **Logos:** the list lives in one data file, `assets/logos/logos.json` (id, name AR/EN, idea AR/EN, palette `[{hex, name, role}]`, `grounds {light, dark}`, `variants [{kind, file, label, bg, w, h}]`). Files sit in `assets/logos/<id>/<kind>.svg`, copied unchanged (colours and geometry) from `06_Design/brand/logo/concepts` by `05_Tools/logo_vote_assets/build.py`, which also writes `logos.json`. `npm test` checks the schema, that every listed SVG exists and is safe (no scripts, fonts, text, images, external refs), that symbols sit on the concept's own grounds, and that no internal round codes leak into names or SVG titles.
- **Logo comments:** `POST /api/feedback` accepts optional `logo_id` (must be a logos.json id) and `aspects` (subset of colour, shape, arabic_font, latin_font, small_size, other; only with `logo_id`). `feedback-admin.html` shows a Logo column with the aspects and a Logo filter; both CSVs carry the columns.
- **One vote per logo per browser:** the browser remembers its votes and a random device id in localStorage; "Undo my vote" removes the vote.
- **API:** `GET /api/logo-votes` returns public counts (cached up to 10 s). `POST /api/logo-votes {logoId, deviceId, action: "vote"|"unvote"}` validates the logo id against `logos.json` and the device id format, caps the body at 1 KB and rate-limits per IP.
- **Storage:** the same private Vercel Blob store as feedback. Each vote is its own blob, `votes/<logoId>/<deviceId>.json` (never overwritten, so the same device cannot vote twice); undo deletes it, and counts come from listing by prefix. Device ids are never returned.
- Opened as a local file, the logos show but voting is off. Code: `api/logo-votes.js`, `api/_lib/logo-votes-core.js`; `vercel.json` bundles `logos.json` with the function.

# Tamargi clickable prototype

Arabic-first (RTL) HTML prototype of the Tamargi clinic app. It has no build step and no server: open `index.html` in a browser. All data is fake.

## Layout
- `index.html`: the hub. It links all 35 screens, the user journeys, the NITCO lessons and the known gaps. Counts: 35 screens, 42 screen states, 217 design notes, 119 of which cite NITCO.
- `screens/*.html`: one file per screen. Start new screens from `_screen-template.html`; its comment block lists the rules.
- `assets/tamargi.css`: the design system (tokens, components, RTL, dark mode).
- `assets/shell.js`: the app shell. It provides the top bar (org and branch switchers, role, AR/EN, theme), the side nav, the annotation pins (Alt+N), the state switcher (`#state=name`), and the `Tamargi.ctx` / `Tamargi.onCtx` API.
- `assets/demo-data.js` (`window.TamargiData`): one shared fake dataset holding the orgs, branches, rooms, doctors, shifts, staff, patients, services and prices, appointments, invoices, stock, equipment, plans (D45-A), leaves, vitals and past visits, plus their helpers.
- `assets/demo-clinical.js` (`window.TamargiClinical`): clinical content grouped by specialty (drug lines, Rx sets, visit templates, ICD-10 labels). Only the visit-note, prescription, Rx-favourites and templates screens load it.

## Tenancy
The model is Organization, then Branches, then Rooms (ADR-017, `01_Obsidian_Vault/02_Product/tenancy-model.md`).
- **Sample orgs:** `selim` is a solo clinic with one branch. `nile` is a polyclinic with two branches, Toreil and University.
- **Switching:** every screen renders from the current org and branch and re-renders when you switch them in the top bar. The selection is kept in localStorage.
- **Org-wide data:** the patient file and the file number belong to the org.
- **Per-branch data:** invoice, receipt and credit-note numbers each run a separate series per branch (D39-A), for example `NMC-TOR-2026-003121` or `CN-TOR-2026-000007`. Queue numbers are counted per branch per day.

## Script order on each screen
`demo-data.js` → (`demo-clinical.js` on clinical screens) → `shell.js` → the page's own inline script.

## Checks (2026-11-14)
- All 35 screens and the hub were loaded in headless Chrome at 390px and 1280px, for selim/main and nile tor, gam and "all branches", in AR and EN. No JS errors appeared and no page scrolled horizontally.
- Switching org or branch changes the data on every screen except the org-wide ones.
- Nobody has clicked through the prototype in a normal browser yet.

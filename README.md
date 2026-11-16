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

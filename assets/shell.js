/* =====================================================================
   Tamargi prototype shell — shell.js  (v1.2, 2026-11-14)
   Include at the end of <body>:  <script src="../assets/shell.js"></script>
   What it does
   - Wraps <main id="screen"> in the app shell: top bar (clinic, search,
     role switcher, AR/EN toggle, theme toggle) + side nav of all screens.
   - AR/EN: flips <html dir/lang>; swaps text of any element carrying
     data-en (Arabic is the authored default, cached into data-ar).
     Also data-en-placeholder / data-en-title / data-en-aria-label.
   - Annotations: every [data-note] (English) / [data-note-ar] gets a numbered
     magenta pin + an entry in the floating "Annotations" panel.
   - States: elements with [data-state="name"] are alternative states of the
     screen (e.g. results / no-results). A state switcher appears in the spec
     strip; only the active state is shown. Deep link: #state=name
   - Helpers: [data-open="#id"] shows a hidden modal/drawer, [data-close]
     hides the nearest .t-scrim/.t-drawer, [data-toast="text"] shows a toast,
     [data-href="file.html"] navigates. window.Tamargi.toast(msg).
   - Body options: data-shell="bare" (sign-in, public page: no side nav),
     data-screen="file-name" (auto-detected from the URL otherwise).
   - Screen meta: { tier: 2 } marks a polyclinic-plan screen (nav + spec strip badge).
     { phase: "later" } marks a post-v1 module (badge "مرحلة لاحقة").
   - Tenancy (v1.2): ORG switcher (Organization = tenant) + BRANCH switcher in the
     top bar. One person can belong to several orgs (switch without re-login).
     Owner (and "all screens" view) also gets "كل الفروع". An org with one branch
     shows the branch name statically. Body data-org="nile" pins a screen's sample
     org at load. Inside <main>, [data-branch="tor gam"] elements only show for
     those branches (all show under "كل الفروع"); .t-only-all shows only under
     "كل الفروع"; [data-branch-name] is filled with the current branch name.
     Event: document "tamargi:scope" {org, branch}. API: Tamargi.scope().
   No external dependencies. Persists lang/theme/role/notes/org/branch in
   localStorage (wrapped in try/catch; page works without it).
   ===================================================================== */
(function () {
  "use strict";

  /* ---------- Screen registry (single source of truth for the nav) ---------- */
  var GROUPS = [
    { id: "reception",  ar: "الاستقبال والدور",       en: "Reception & queue" },
    { id: "clinical",   ar: "ملف المريض والكشف",      en: "Patient file & visit" },
    { id: "rx",         ar: "الروشتة",                en: "Prescriptions" },
    { id: "scheduling", ar: "المواعيد",               en: "Scheduling" },
    { id: "billing",    ar: "الحسابات والخزنة",        en: "Billing & cash" },
    { id: "owner",      ar: "لوحة المالك والتقارير",   en: "Owner dashboard & reports" },
    { id: "setup",      ar: "الإعداد والإعدادات",      en: "Setup & settings" },
    { id: "multi",      ar: "تعدد الفروع والمخزون",    en: "Branches, stock & equipment" }
  ];
  var SCREENS = [
    /* Reception & queue */
    { f: "reception-queue",        g: "reception",  icon: "queue",    roles: ["reception"], home: "reception", ar: "الدور المباشر",          en: "Live queue" },
    { f: "patient-search",         g: "reception",  icon: "search",   roles: ["reception", "doctor", "nurse"], ar: "البحث عن مريض", en: "Patient search" },
    { f: "patient-quick-register", g: "reception",  icon: "user",     roles: ["reception"], ar: "تسجيل سريع",               en: "Quick register" },
    { f: "chat-inbox",             g: "reception",  icon: "chat",     roles: ["reception"], ar: "رسائل المرضى",            en: "Patient chat inbox" },
    /* Patient file & visit */
    { f: "doctor-home",            g: "clinical",   icon: "home",     roles: ["doctor"], home: "doctor", ar: "يوم الطبيب",          en: "Doctor's day" },
    { f: "nurse-vitals",           g: "clinical",   icon: "heart",    roles: ["nurse"], home: "nurse", ar: "التمريض والعلامات الحيوية", en: "Nurse station & vitals" },
    { f: "patient-file",           g: "clinical",   icon: "file",     roles: ["doctor", "nurse", "reception"], ar: "ملف المريض", en: "Patient file" },
    { f: "visit-note",             g: "clinical",   icon: "edit",     roles: ["doctor"], ar: "الكشف",                   en: "Visit workspace" },
    /* Prescriptions */
    { f: "prescription-builder",   g: "rx",         icon: "rx",       roles: ["doctor"], ar: "كتابة الروشتة",           en: "Write prescription" },
    { f: "prescription-print",     g: "rx",         icon: "print",    roles: ["doctor", "reception"], ar: "طباعة الروشتة والشهادات", en: "Rx & certificate print" },
    { f: "rx-favourites",          g: "rx",         icon: "star",     roles: ["doctor"], ar: "المفضلة وروشتات جاهزة",   en: "Favourites & Rx sets" },
    /* Scheduling */
    { f: "appointments-calendar",  g: "scheduling", icon: "calendar", roles: ["reception", "doctor", "owner"], ar: "جدول المواعيد", en: "Appointments calendar" },
    { f: "appointment-book",       g: "scheduling", icon: "plus",     roles: ["reception"], ar: "حجز موعد",                en: "Book appointment" },
    { f: "doctor-schedule",        g: "scheduling", icon: "clock",    roles: ["owner", "doctor"], ar: "مواعيد عمل الطبيب والإجازات", en: "Doctor hours & leaves" },
    /* Billing & cash */
    { f: "cashier-checkout",       g: "billing",    icon: "cash",     roles: ["reception"], ar: "الخزنة — تحصيل",          en: "Cashier checkout" },
    { f: "receipt-print",          g: "billing",    icon: "receipt",  roles: ["reception"], ar: "معاينة طباعة الإيصال",    en: "Receipt print preview" },
    { f: "invoice-detail",         g: "billing",    icon: "receipt",  roles: ["reception", "owner"], ar: "الفاتورة والمرتجع", en: "Invoice & credit note" },
    { f: "patient-account",        g: "billing",    icon: "wallet",   roles: ["reception", "owner"], ar: "حساب المريض (مديونية ورصيد)", en: "Patient account (debt & deposit)" },
    { f: "cash-close",             g: "billing",    icon: "lock",     roles: ["reception", "owner"], ar: "تقفيل الخزنة",        en: "Cashier shift close" },
    { f: "packages-plans",         g: "billing",    icon: "template", roles: ["reception", "doctor", "owner"], tier: 2, ar: "الباقات وخطط العلاج", en: "Packages & treatment plans" },
    /* Owner dashboard & reports */
    { f: "owner-dashboard",        g: "owner",      icon: "chart",    roles: ["owner"], home: "owner", ar: "لوحة المالك",        en: "Owner dashboard" },
    { f: "reports",                g: "owner",      icon: "download", roles: ["owner"], ar: "التقارير وسجل النشاط",     en: "Reports & activity log" },
    /* Setup & settings */
    { f: "onboarding-wizard",      g: "setup",      icon: "check",    roles: ["owner"], ar: "تجهيز العيادة (التجربة)",  en: "Clinic setup (trial)" },
    { f: "settings-clinic",        g: "setup",      icon: "settings", roles: ["owner"], ar: "بيانات العيادة والقواعد",  en: "Clinic profile & rules" },
    { f: "services-prices",        g: "setup",      icon: "tag",      roles: ["owner"], ar: "الخدمات والأسعار والخصومات", en: "Services, fees & discounts" },
    { f: "settings-users-roles",   g: "setup",      icon: "users",    roles: ["owner"], ar: "المستخدمون والصلاحيات",   en: "Users & roles" },
    { f: "settings-letterhead",    g: "setup",      icon: "file",     roles: ["owner", "doctor"], ar: "ترويسة الروشتة والإيصال", en: "Letterhead" },
    { f: "settings-templates",     g: "setup",      icon: "note",     roles: ["doctor", "owner"], ar: "قوالب الكشف والاختصارات", en: "Visit templates & shortcuts" },
    { f: "subscription-plan",      g: "setup",      icon: "card",     roles: ["owner"], ar: "الاشتراك والتجربة",       en: "Subscription & trial" },
    { f: "clinic-web-page",        g: "setup",      icon: "globe",    roles: ["public"], ar: "صفحة العيادة للمرضى",      en: "Clinic public page" },
    /* Branches, stock & equipment (tenancy round, 2026-11-14) */
    { f: "org-branches",           g: "multi",      icon: "building", roles: ["owner"], tier: 2, ar: "المؤسسة والفروع",          en: "Organization & branches" },
    { f: "rooms",                  g: "multi",      icon: "door",     roles: ["owner", "reception"], tier: 2, ar: "الغرف والعيادات",   en: "Rooms & chairs" },
    { f: "doctors-branches",       g: "multi",      icon: "users",    roles: ["owner", "doctor"], tier: 2, ar: "الأطباء والفروع",     en: "Doctors & branches" },
    { f: "stock",                  g: "multi",      icon: "box",      roles: ["owner", "nurse", "reception"], phase: "later", ar: "مخزون العيادة", en: "Clinic stock" },
    { f: "equipment",              g: "multi",      icon: "device",   roles: ["owner"], phase: "later", ar: "سجل الأجهزة",          en: "Equipment register" }
  ];
  var ROLES = [
    { id: "all",       ar: "كل الشاشات",  en: "All screens" },
    { id: "reception", ar: "الاستقبال",   en: "Receptionist" },
    { id: "doctor",    ar: "الطبيب",      en: "Doctor" },
    { id: "nurse",     ar: "التمريض",     en: "Nurse" },
    { id: "owner",     ar: "المالك",      en: "Owner / manager" }
  ];
  /* ---------- Tenancy demo model: Organization (tenant) → Branch → Room ----------
     The demo person (Dr. Ahmed) belongs to 2 orgs: his own solo clinic (owner + doctor)
     and a polyclinic where he works as a doctor in 2 branches. FAKE data only. */
  var ORGS = [
    { id: "selim", ar: "عيادة د. أحمد سليم", en: "Dr. Ahmed Selim Clinic",
      roleAr: "مالك + طبيب", roleEn: "Owner + doctor", planAr: "باقة العيادة", planEn: "Clinic plan",
      branches: [ { id: "main", ar: "المنصورة — الفرع الرئيسي", en: "Mansoura — main branch", rooms: 1, doctors: 2 } ] },
    { id: "nile", ar: "مجمع النيل الطبي", en: "Nile Medical Centre",
      roleAr: "طبيب في فرعين", roleEn: "Doctor in 2 branches", planAr: "باقة المجمعات", planEn: "Polyclinic plan",
      branches: [
        { id: "tor", ar: "المنصورة - توريل", en: "Mansoura - Toreil", rooms: 5, doctors: 4 },
        { id: "gam", ar: "المنصورة - الجامعة", en: "Mansoura - University", rooms: 3, doctors: 3 } ] }
  ];
  /* Branches each role may see in the demo (reception/nurse are assigned to one branch). */
  var ROLE_BRANCHES = { reception: ["main", "tor"], nurse: ["main", "tor"] };

  /* ---------- Icon sprite ---------- */
  var I = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M22 20c0-3-2-5-5-5.4"/>',
    queue: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    rx: '<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M8.5 8.5l7 7"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    receipt: '<path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z"/><path d="M9 8h6M9 12h6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    heart: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    door: '<path d="M6 21V4h12v17M3 21h18M14 12h.01"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    note: '<path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
    home: '<path d="M3 11l9-7 9 7M5 10v10h14V10"/>',
    template: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    call: '<path d="M3 10v4h3l7 4V6L6 10z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
    wallet: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1z"/><path d="M4 7V6a2 2 0 0 1 2-2h10v3M16 13.5h.01"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    building: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M2 21h20M8 8h3M8 12h3M8 16h3"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    box: '<path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>',
    device: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M7 10h2l1.5-2.5 2 5L14 10h3"/>',
    swap: '<path d="M7 4L4 7l3 3M4 7h13M17 20l3-3-3-3M20 17H7"/>',
    chevdown: '<path d="M6 9l6 6 6-6"/>'
  };

  /* ---------- Storage (never required) ---------- */
  function load(k, d) { try { var v = localStorage.getItem("tamargi." + k); return v === null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem("tamargi." + k, v); } catch (e) { /* ignore */ } }

  var html = document.documentElement;
  var body = document.body;
  var scriptEl = document.currentScript || document.querySelector('script[src*="shell.js"]');
  var assetsBase = scriptEl ? scriptEl.src.replace(/shell\.js(\?.*)?$/, "") : "../assets/";
  var screensBase = assetsBase.replace(/assets\/$/, "screens/");

  var current = body.getAttribute("data-screen") || (location.pathname.split("/").pop() || "").replace(/\.html?$/, "");
  var state = {
    lang: load("lang", "ar"),
    theme: load("theme", "auto"),
    role: load("role", "all"),
    notes: load("notes", "off") === "on",
    org: load("org", "selim"),
    branch: null,
    menu: null          /* "org" | "branch" | null — which switcher menu is open */
  };
  var pageOrg = body.getAttribute("data-org");
  if (pageOrg) state.org = pageOrg;          /* screen pins its sample org at load (not saved) */

  /* ---------- Tenancy scope helpers ---------- */
  function orgById(id) { return ORGS.filter(function (o) { return o.id === id; })[0] || ORGS[0]; }
  function curOrg() { return orgById(state.org); }
  function canSeeAll() { return state.role === "all" || state.role === "owner"; }
  function allowedBranches() {
    var o = curOrg(), lim = ROLE_BRANCHES[state.role];
    var list = lim ? o.branches.filter(function (b) { return lim.indexOf(b.id) > -1; }) : o.branches.slice();
    return list.length ? list : o.branches.slice(0, 1);
  }
  function resolveBranch() {
    var allowed = allowedBranches(), stored = load("branch." + state.org, null);
    var ok = function (id) { return (id === "all" && canSeeAll() && curOrg().branches.length > 1) || allowed.some(function (b) { return b.id === id; }); };
    if (state.branch && ok(state.branch)) return;
    state.branch = stored && ok(stored) ? stored : allowed[0].id;
  }
  function branchName(id) {
    if (id === "all") return state.lang === "en" ? "All branches" : "كل الفروع";
    var b = curOrg().branches.filter(function (x) { return x.id === id; })[0];
    return b ? (state.lang === "en" ? b.en : b.ar) : "";
  }
  resolveBranch();

  function t(o) { return state.lang === "en" ? o.en : o.ar; }
  function icon(name, cls) { return '<svg class="t-icon ' + (cls || "") + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
  function el(tag, attrs, inner) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (inner != null) n.innerHTML = inner;
    return n;
  }

  /* ---------- Sprite ---------- */
  var sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">';
  for (var key in I) sprite += '<symbol id="i-' + key + '" viewBox="0 0 24 24">' + I[key] + "</symbol>";
  sprite += "</svg>";
  body.insertAdjacentHTML("afterbegin", sprite);

  /* ---------- Build shell ---------- */
  var main = document.getElementById("screen") || document.querySelector("main");
  var bare = body.getAttribute("data-shell") === "bare";
  var app = el("div", { "class": "t-app" + (bare ? " is-bare" : "") });
  if (bare) app.style.gridTemplateColumns = "1fr";

  var topbar = el("header", { "class": "t-topbar" });
  var sidenav = el("nav", { "class": "t-sidenav", "aria-label": "Screens" });

  function renderTopbar() {
    var roleOpts = ROLES.map(function (r) { return '<option value="' + r.id + '"' + (r.id === state.role ? " selected" : "") + ">" + t(r) + "</option>"; }).join("");
    var isDark = html.getAttribute("data-theme") === "dark" || (state.theme === "auto" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    topbar.innerHTML =
      '<button class="t-btn icon ghost t-menu-btn" type="button" data-shell-menu aria-label="Menu" title="Menu"' + (bare ? ' style="display:inline-flex"' : "") + ">" + icon("menu") + "</button>" +
      (bare ? '<a class="t-brand" href="' + screensBase + 'reception-queue.html"><span class="t-brand-mark">ت</span><span>' + (state.lang === "en" ? "Tamargi" : "تمرجي") + "</span></a>" :
        '<div class="t-brand"><a class="t-brand-mark" href="' + screensBase + 'reception-queue.html" title="' + (state.lang === "en" ? "Tamargi home" : "تمرجي — الرئيسية") + '">ت</a>' + renderOrgSwitch() + "</div>" + renderBranchSwitch()) +
      (bare ? "" :
      '<div class="t-topbar-search t-input-wrap">' + icon("search") +
        '<input class="t-input" type="search" data-shell-search placeholder="' + (state.lang === "en" ? "Patient name, phone or file no." : "اسم المريض أو الموبايل أو رقم الملف") + '">' +
        '<span class="t-kbd">Ctrl K</span></div>') +
      '<div class="t-topbar-tools">' +
        (bare ? "" : '<a class="t-trial-pill t-hide-sm" href="' + screensBase + 'subscription-plan.html">' + (state.lang === "en" ? "Free trial: 12 days left" : "تجربة مجانية: باقي ١٢ يوم") + "</a>") +
        '<label class="t-sr" for="t-role">' + (state.lang === "en" ? "View as role" : "عرض كـ") + "</label>" +
        '<select id="t-role" class="t-select" style="height:34px;width:auto;font-size:13px" title="' + (state.lang === "en" ? "View as role (prototype)" : "عرض كدور (للنموذج)") + '">' + roleOpts + "</select>" +
        '<button class="t-btn sm" type="button" data-shell-lang title="' + (state.lang === "en" ? "التبديل للعربية" : "Switch to English") + '">' + icon("globe", "sm") + "<span>" + (state.lang === "en" ? "عربي" : "English") + "</span></button>" +
        '<button class="t-btn icon ghost" type="button" data-shell-theme aria-label="Theme" title="' + (state.lang === "en" ? "Light / dark" : "فاتح / داكن") + '">' + icon(isDark ? "sun" : "moon") + "</button>" +
        (bare ? "" : '<span class="t-avatar sm t-hide-sm" title="' + (state.lang === "en" ? "Signed in" : "مسجل الدخول") + '">' + (state.lang === "en" ? "SR" : "سر") + "</span>") +
      "</div>";
  }

  /* ---------- Org + branch switchers (top bar) ---------- */
  function en() { return state.lang === "en"; }
  function renderOrgSwitch() {
    var o = curOrg(), open = state.menu === "org";
    var label = '<span class="t-scope-txt"><b>' + (en() ? o.en : o.ar) + "</b><span>" + (en() ? o.planEn : o.planAr) + "</span></span>";
    if (ORGS.length < 2) return '<span class="t-scope-btn is-static">' + label + "</span>";
    var items = '<li class="t-menu-head" role="presentation">' + (en() ? "Your organizations — switch without signing out" : "مؤسساتك — بدّل من غير ما تخرج") + "</li>" +
      ORGS.map(function (x) {
        var on = x.id === o.id;
        return '<li role="menuitemradio" tabindex="-1" aria-checked="' + on + '" data-scope-org="' + x.id + '">' + icon("building", "sm") +
          '<span class="t-grow"><b>' + (en() ? x.en : x.ar) + '</b><small>' + (en() ? x.roleEn : x.roleAr) + " · " + x.branches.length + (en() ? (x.branches.length > 1 ? " branches" : " branch") : (x.branches.length > 1 ? " فروع" : " فرع")) + "</small></span>" +
          (on ? icon("check", "sm") : "") + "</li>";
      }).join("") +
      '<li class="t-menu-sep" role="separator"></li>' +
      '<li class="t-menu-head" role="presentation">' + (en() ? "Each organization's patients, money and stock stay separate." : "مرضى وفلوس ومخزون كل مؤسسة منفصلين تمامًا.") + "</li>";
    return '<div class="t-scope-item"><button type="button" class="t-scope-btn" data-scope-toggle="org" aria-haspopup="menu" aria-expanded="' + open + '" title="' + (en() ? "Switch organization" : "تبديل المؤسسة") + '">' +
      icon("building", "sm t-scope-ico") + label + icon("chevdown", "sm") + "</button>" +
      '<ul class="t-menu t-scope-menu" role="menu" aria-label="' + (en() ? "Organizations" : "المؤسسات") + '"' + (open ? "" : " hidden") + ">" + items + "</ul></div>";
  }
  function renderBranchSwitch() {
    var o = curOrg(), allowed = allowedBranches(), open = state.menu === "branch";
    var isAll = state.branch === "all";
    var pill = icon("pin", "sm") + '<span class="t-scope-label">' + branchName(state.branch) + "</span>";
    var multi = allowed.length > 1 || (canSeeAll() && o.branches.length > 1);
    if (!multi) {
      var why = o.branches.length > 1 ? (en() ? "You are assigned to this branch only" : "إنت متسجل على الفرع ده بس") : (en() ? "One branch" : "فرع واحد");
      return '<span class="t-branch-pill is-static" title="' + why + '">' + pill + (o.branches.length > 1 ? icon("lock", "sm") : "") + "</span>";
    }
    var items = "";
    if (canSeeAll() && o.branches.length > 1) {
      items += '<li role="menuitemradio" tabindex="-1" aria-checked="' + isAll + '" data-scope-branch="all">' + icon("building", "sm") +
        '<span class="t-grow"><b>' + (en() ? "All branches" : "كل الفروع") + "</b><small>" + (en() ? "Combined numbers, owner only" : "أرقام مجمّعة — للمالك بس") + "</small></span>" + (isAll ? icon("check", "sm") : "") + "</li>" +
        '<li class="t-menu-sep" role="separator"></li>';
    }
    items += allowed.map(function (b) {
      var on = b.id === state.branch;
      return '<li role="menuitemradio" tabindex="-1" aria-checked="' + on + '" data-scope-branch="' + b.id + '">' + icon("pin", "sm") +
        '<span class="t-grow"><b>' + (en() ? b.en : b.ar) + "</b><small>" + b.rooms + (en() ? " rooms · " : " غرف · ") + b.doctors + (en() ? " doctors" : " أطباء") + "</small></span>" + (on ? icon("check", "sm") : "") + "</li>";
    }).join("");
    if (canSeeAll()) items += '<li class="t-menu-sep" role="separator"></li><li role="menuitem" tabindex="-1" data-href="org-branches.html">' + icon("settings", "sm") + "<span>" + (en() ? "Manage branches" : "إدارة الفروع") + "</span></li>";
    return '<div class="t-scope-item"><button type="button" class="t-branch-pill' + (isAll ? " is-all" : "") + '" data-scope-toggle="branch" aria-haspopup="menu" aria-expanded="' + open + '" title="' + (en() ? "Switch branch" : "تبديل الفرع") + '">' +
      pill + icon("chevdown", "sm") + "</button>" +
      '<ul class="t-menu t-scope-menu" role="menu" aria-label="' + (en() ? "Branches" : "الفروع") + '"' + (open ? "" : " hidden") + ">" + items + "</ul></div>";
  }

  /* Apply the current scope to the page: branch filters, names, mismatch notice, event. */
  function applyScope() {
    var isAll = state.branch === "all";
    var mismatch = pageOrg && pageOrg !== state.org;
    html.setAttribute("data-branch-scope", state.branch);
    html.toggleAttribute("data-scope-all", isAll && !mismatch);
    if (main) {
      Array.prototype.forEach.call(main.querySelectorAll("[data-branch]"), function (n) {
        var ids = n.getAttribute("data-branch").split(/\s+/);
        n.classList.toggle("is-other-branch", !mismatch && !isAll && ids.indexOf(state.branch) === -1);
      });
      Array.prototype.forEach.call(main.querySelectorAll("[data-branch-name]"), function (n) { n.textContent = branchName(state.branch); });
      var old = main.querySelector(".t-scope-alert"); if (old) old.remove();
      if (mismatch) {
        var po = orgById(pageOrg);
        var a = el("div", { "class": "t-alert warning t-scope-alert no-print", role: "status" },
          icon("info") + "<span>" + (en() ? "This screen's sample data belongs to <b>" + po.en + "</b>. You are now in <b>" + curOrg().en + "</b>: in the real app you would see that organization's data only."
                                       : "بيانات العينة في الشاشة دي تبع <b>" + po.ar + "</b>. إنت دلوقتي في <b>" + curOrg().ar + "</b>: في البرنامج الحقيقي هتشوف بيانات المؤسسة دي بس.") + "</span>" +
          '<div class="t-actions"><button class="t-btn sm" type="button" data-scope-org="' + pageOrg + '">' + (en() ? "Back to " + po.en : "ارجع لـ" + po.ar) + "</button></div>");
        var host = main.querySelector(".t-container") || main;
        host.insertBefore(a, host.firstChild);
      }
    }
    var ev; try { ev = new CustomEvent("tamargi:scope", { detail: { org: state.org, branch: state.branch, mismatch: !!mismatch } }); } catch (e) { ev = null; }
    if (ev) document.dispatchEvent(ev);
  }
  function setMenu(m) {
    state.menu = m; renderTopbar();
    if (m) { var f = topbar.querySelector('.t-scope-menu:not([hidden]) li[tabindex]'); if (f) f.focus(); }
  }
  function pickOrg(id) {
    if (id === state.org) { setMenu(null); return; }
    state.org = id; state.branch = null; save("org", id); resolveBranch(); state.menu = null;
    renderTopbar(); applyScope();
    toast(en() ? "Switched to " + curOrg().en + " — no sign-out needed" : "اتنقلت لـ" + curOrg().ar + " — من غير تسجيل خروج");
  }
  function pickBranch(id) {
    state.branch = id; save("branch." + state.org, id); state.menu = null;
    renderTopbar(); applyScope();
    toast(en() ? "Now working in: " + branchName(id) : "إنت دلوقتي في: " + branchName(id));
  }

  function renderNav() {
    var out = "";
    GROUPS.forEach(function (g) {
      out += '<div class="t-nav-group"><h6>' + t(g) + "</h6>";
      SCREENS.filter(function (s) { return s.g === g.id; }).forEach(function (s) {
        var dim = state.role !== "all" && s.roles.indexOf(state.role) === -1;
        var isHome = state.role !== "all" && s.home === state.role;
        out += '<a class="t-nav-link' + (dim ? " is-dim" : "") + '" href="' + screensBase + s.f + '.html"' + (s.f === current ? ' aria-current="page"' : "") + ">" +
          icon(s.icon, "sm") + "<span>" + t(s) + "</span>" + (isHome ? '<span class="t-nav-home">' + (state.lang === "en" ? "home" : "الرئيسية") + "</span>" : "") +
          (s.tier === 2 ? '<span class="t-tier" title="' + (state.lang === "en" ? "Polyclinic plan, not in solo MVP" : "باقة المجمعات، ليست في نسخة العيادة الفردية") + '">' + (state.lang === "en" ? "Tier 2" : "المرحلة ٢") + "</span>" : "") +
          (s.phase === "later" ? '<span class="t-tier t-phase" title="' + (state.lang === "en" ? "Post-v1 module, shown for discussion" : "موديول بعد النسخة الأولى، للعرض والنقاش") + '">' + (state.lang === "en" ? "Later" : "مرحلة لاحقة") + "</span>" : "") + "</a>";
      });
      out += "</div>";
    });
    sidenav.innerHTML = out;
  }

  if (main) {
    main.classList.add("t-main");
    if (!main.id) main.id = "screen";
    body.insertBefore(app, main);
    app.appendChild(topbar);
    if (!bare) app.appendChild(sidenav);
    else { sidenav.classList.add("is-drawer"); body.appendChild(sidenav); sidenav.style.position = "fixed"; sidenav.style.top = "var(--topbar-h)"; sidenav.style.insetInlineStart = "0"; sidenav.style.width = "min(300px,86vw)"; sidenav.style.zIndex = "45"; sidenav.style.boxShadow = "var(--e-3)"; sidenav.style.transform = "none"; sidenav.hidden = true; }
    app.appendChild(main);
  }

  /* ---------- Spec strip (screen meta + state switcher), shown with annotations ---------- */
  var meta = SCREENS.filter(function (s) { return s.f === current; })[0];
  var spec = el("div", { "class": "t-spec no-print" });
  var stateNames = [];
  Array.prototype.forEach.call(document.querySelectorAll("[data-state]"), function (n) {
    var s = n.getAttribute("data-state"); if (stateNames.indexOf(s) === -1) stateNames.push(s);
  });
  var activeState = (location.hash.match(/state=([\w-]+)/) || [])[1] || stateNames[0];

  function renderSpec() {
    if (!main) return;
    var roleTxt = meta ? meta.roles.map(function (r) { var R = ROLES.filter(function (x) { return x.id === r; })[0]; return R ? t(R) : (state.lang === "en" ? "Patient (public)" : "المريض (عام)"); }).join("، ") : "";
    var h = "<b>" + (state.lang === "en" ? "Spec" : "مواصفات") + ":</b> " + (meta ? current + ".html — " + t(meta) + (roleTxt ? " — " + (state.lang === "en" ? "for " : "لـ ") + roleTxt : "") + (meta.tier === 2 ? ' <span class="t-tier">' + (state.lang === "en" ? "Tier 2 — polyclinic plan" : "المرحلة ٢ — باقة المجمعات") + "</span>" : "") + (meta.phase === "later" ? ' <span class="t-tier t-phase">' + (state.lang === "en" ? "Later phase — post-v1 module" : "مرحلة لاحقة — بعد النسخة الأولى") + "</span>" : "") : current);
    if (stateNames.length > 1) {
      h += '<span class="t-states t-seg" role="group" aria-label="States">' + stateNames.map(function (s) {
        return '<button type="button" data-set-state="' + s + '" aria-pressed="' + (s === activeState) + '">' + s + "</button>";
      }).join("") + "</span>";
    }
    spec.innerHTML = h;
    if (!spec.parentNode) main.insertBefore(spec, main.firstChild);
  }
  function applyState() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-state]"), function (n) { n.hidden = n.getAttribute("data-state") !== activeState; });
    Array.prototype.forEach.call(document.querySelectorAll("[data-set-state],[data-show-state]"), function (b) {
      var s = b.getAttribute("data-set-state") || b.getAttribute("data-show-state");
      b.setAttribute("aria-pressed", String(s === activeState));
    });
  }

  /* ---------- Language ---------- */
  var ATTRS = ["placeholder", "title", "aria-label"];
  function applyLang() {
    html.setAttribute("lang", state.lang);
    html.setAttribute("dir", state.lang === "en" ? "ltr" : "rtl");
    Array.prototype.forEach.call(document.querySelectorAll("[data-en]"), function (n) {
      if (!n.hasAttribute("data-ar")) n.setAttribute("data-ar", n.innerHTML);
      n.innerHTML = state.lang === "en" ? n.getAttribute("data-en") : n.getAttribute("data-ar");
    });
    ATTRS.forEach(function (a) {
      Array.prototype.forEach.call(document.querySelectorAll("[data-en-" + a + "]"), function (n) {
        if (!n.hasAttribute("data-ar-" + a)) n.setAttribute("data-ar-" + a, n.getAttribute(a) || "");
        n.setAttribute(a, state.lang === "en" ? n.getAttribute("data-en-" + a) : n.getAttribute("data-ar-" + a));
      });
    });
    var tt = document.querySelector("title");
    if (tt && tt.hasAttribute("data-en")) document.title = tt.textContent;
  }

  /* ---------- Theme ---------- */
  function applyTheme() {
    if (state.theme === "auto") html.removeAttribute("data-theme");
    else html.setAttribute("data-theme", state.theme);
  }

  /* ---------- Annotations ---------- */
  var fab = el("button", { "class": "t-notes-fab no-print", type: "button", "aria-pressed": "false" });
  var panel = el("aside", { "class": "t-notes-panel no-print", "aria-label": "Annotations" });
  function collectNotes() { return Array.prototype.filter.call(document.querySelectorAll("[data-note]"), function (n) { return !n.closest("[hidden]"); }); }
  function renderNotes() {
    Array.prototype.forEach.call(document.querySelectorAll(".t-note-pin"), function (p) { p.remove(); });
    var notes = collectNotes();
    var list = "";
    notes.forEach(function (n, i) {
      var txt = (state.lang === "ar" && n.getAttribute("data-note-ar")) || n.getAttribute("data-note");
      var pin = el("span", { "class": "t-note-pin", title: txt, "aria-hidden": "true" }, String(i + 1));
      var host = /^(INPUT|TEXTAREA|SELECT|IMG|BR|HR)$/.test(n.tagName) ? null : n;
      if (host) host.appendChild(pin);
      else n.insertAdjacentElement("afterend", pin);
      list += '<li data-goto="' + i + '"><span class="n">' + (i + 1) + "</span><span>" + txt + "</span></li>";
    });
    panel.innerHTML = "<h4>" + (state.lang === "en" ? "Annotations" : "ملاحظات التصميم") + "</h4>" + (notes.length ? "<ol>" + list + "</ol>" : '<p class="t-muted">' + (state.lang === "en" ? "No annotations on this screen." : "لا توجد ملاحظات في هذه الشاشة.") + "</p>");
    fab.innerHTML = icon("note") + "<span>" + (state.lang === "en" ? "Annotations" : "ملاحظات التصميم") + '</span><span class="t-badge">' + notes.length + "</span>";
    fab.setAttribute("aria-pressed", String(state.notes));
    html.classList.toggle("notes-on", state.notes);
    panel.onclick = function (e) {
      var li = e.target.closest("[data-goto]"); if (!li) return;
      var target = notes[+li.getAttribute("data-goto")];
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.remove("t-note-flash"); void target.offsetWidth; target.classList.add("t-note-flash");
    };
  }
  body.appendChild(fab); body.appendChild(panel);

  /* ---------- Toasts ---------- */
  var toastHost = el("div", { "class": "t-toasts", "aria-live": "polite" });
  body.appendChild(toastHost);
  function toast(msg, actionLabel) {
    var n = el("div", { "class": "t-toast", role: "status" }, icon("check") + "<span>" + msg + "</span>" + (actionLabel ? '<button class="t-toast-action" type="button">' + actionLabel + "</button>" : ""));
    toastHost.appendChild(n);
    setTimeout(function () { n.remove(); }, 4000);
  }

  /* ---------- Render all ---------- */
  function renderAll() {
    applyLang();
    renderTopbar();
    if (!bare) applyScope();
    if (!bare || sidenav) renderNav();
    renderSpec();
    applyState();
    renderNotes();
  }
  applyTheme();
  renderAll();

  /* ---------- Events ---------- */
  document.addEventListener("click", function (e) {
    var b;
    if ((b = e.target.closest("[data-scope-toggle]"))) { var m = b.getAttribute("data-scope-toggle"); setMenu(state.menu === m ? null : m); return; }
    if ((b = e.target.closest("[data-scope-org]"))) { pickOrg(b.getAttribute("data-scope-org")); return; }
    if ((b = e.target.closest("[data-scope-branch]"))) { pickBranch(b.getAttribute("data-scope-branch")); return; }
    if (state.menu && !e.target.closest(".t-scope-item")) setMenu(null);
    if ((b = e.target.closest("[data-shell-lang]"))) { state.lang = state.lang === "en" ? "ar" : "en"; save("lang", state.lang); renderAll(); return; }
    if ((b = e.target.closest("[data-shell-theme]"))) {
      var dark = html.getAttribute("data-theme") === "dark" || (!html.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
      state.theme = dark ? "light" : "dark"; save("theme", state.theme); applyTheme(); renderTopbar(); return;
    }
    if ((b = e.target.closest("[data-shell-menu]"))) {
      if (bare) sidenav.hidden = !sidenav.hidden; else html.classList.toggle("nav-open"); return;
    }
    if (e.target === fab || fab.contains(e.target)) { state.notes = !state.notes; save("notes", state.notes ? "on" : "off"); renderNotes(); return; }
    if ((b = e.target.closest("[data-set-state],[data-show-state]"))) {
      activeState = b.getAttribute("data-set-state") || b.getAttribute("data-show-state");
      try { history.replaceState(null, "", "#state=" + activeState); } catch (err) { /* file:// */ }
      applyState(); renderNotes(); return;
    }
    if ((b = e.target.closest("[data-open]"))) { var m = document.querySelector(b.getAttribute("data-open")); if (m) { m.hidden = false; var f = m.querySelector("input,textarea,select,button"); if (f) f.focus(); } e.preventDefault(); return; }
    if ((b = e.target.closest("[data-close]"))) { var c = b.closest(".t-scrim,.t-drawer,[data-dismissable]"); if (c) c.hidden = true; return; }
    if ((b = e.target.closest("[data-toast]"))) { toast(b.getAttribute(state.lang === "en" && b.hasAttribute("data-toast-en") ? "data-toast-en" : "data-toast")); }
    if ((b = e.target.closest("[data-href]"))) { location.href = screensBase + b.getAttribute("data-href"); return; }
    if (html.classList.contains("nav-open") && !e.target.closest(".t-sidenav")) html.classList.remove("nav-open");
  });
  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "t-role") { state.role = e.target.value; save("role", state.role); resolveBranch(); renderNav(); renderTopbar(); applyScope(); var r = document.getElementById("t-role"); if (r) r.focus(); }
  });
  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || "") || (e.target && e.target.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
      var s = document.querySelector("[data-shell-search]") || document.querySelector(".t-search-xl input");
      if (s) { e.preventDefault(); s.focus(); s.select(); }
    }
    if (state.menu && e.target && e.target.closest && e.target.closest(".t-scope-menu")) {
      var items = Array.prototype.slice.call(e.target.closest(".t-scope-menu").querySelectorAll("li[tabindex]"));
      var i = items.indexOf(e.target);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); var nx = items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]; if (nx) nx.focus(); return; }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.target.click(); return; }
    }
    if (e.key === "Escape" && state.menu) { var which = state.menu; setMenu(null); var tg = topbar.querySelector('[data-scope-toggle="' + which + '"]'); if (tg) tg.focus(); return; }
    if (e.key === "Escape") {
      Array.prototype.forEach.call(document.querySelectorAll(".t-scrim:not(.inline),.t-drawer:not(.inline)"), function (m) { m.hidden = true; });
      html.classList.remove("nav-open");
    }
    if (!typing && e.altKey && (e.key === "n" || e.key === "N")) { state.notes = !state.notes; save("notes", state.notes ? "on" : "off"); renderNotes(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.target && e.target.matches && e.target.matches("[data-shell-search]") && e.key === "Enter") location.href = screensBase + "patient-search.html";
  });

  window.Tamargi = { toast: toast, screens: SCREENS, groups: GROUPS, orgs: ORGS, setState: function (s) { activeState = s; applyState(); renderNotes(); }, lang: function () { return state.lang; },
    scope: function () { return { org: state.org, branch: state.branch, all: state.branch === "all", mismatch: !!(pageOrg && pageOrg !== state.org), branchName: branchName(state.branch) }; },
    role: function () { return state.role; } };
})();

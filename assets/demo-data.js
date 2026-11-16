/* =====================================================================
   Tamargi prototype — demo-data.js
   ONE shared FAKE dataset for every screen. No real people, no real phones.
   Load BEFORE shell.js:
     <script src="../assets/demo-data.js"></script>
     <script src="../assets/shell.js"></script>
   Global: window.TamargiData  (alias: Tamargi.data once shell.js has run)

   Tenancy:
     Organization (tenant) -> Branches -> Rooms.
     Specialty belongs to the DOCTOR. Doctor profile is per org.
     One patient file per org (shared by its branches, never across orgs).
     Branch scopes operations (queue, cash, stock, prices), not clinical privacy.
   Conventions
     - Every org-owned record has `org`; branch-owned records also have `branch`.
     - Bilingual text = { ar, en } fields on the record (or ar/en keys).
     - Hours are decimal (17.5 = 5:30 pm). Dates are ISO "YYYY-MM-DD".
     - Day index: 0 = Sat, 1 = Sun, 2 = Mon, 3 = Tue, 4 = Wed, 5 = Thu, 6 = Fri.
     - Money is whole EGP.
     - Demo clock: TODAY = 2026-11-14 (Saturday), NOW = 17.5.
     - Numbering: invoices, receipts, credit notes run one series PER BRANCH
       (D.invoiceNo / D.docNo / D.nextInvoiceNo, branch `code`); file numbers run one
       series per ORG. Queue numbers per branch per day (D.ticket = room-number).
     - Also here: D.leaves, D.vitals, D.visits (+ slot/leave/ticket/initials helpers).
       Clinical content by specialty (drugs, templates, Rx sets) lives in demo-clinical.js,
       loaded only by the clinical screens, between demo-data.js and shell.js.
   ===================================================================== */
(function () {
  "use strict";

  var D = {
    version: "1.0",
    today: "2026-11-14",
    now: 17.5,
    me: "p-ahmed",                 /* the signed-in demo person */
    currency: { ar: "ج.م", en: "EGP" }
  };

  /* ---------------- Lookups (global, not tenant data) ---------------- */
  D.days = [
    { ar: "السبت", en: "Sat" }, { ar: "الأحد", en: "Sun" }, { ar: "الاتنين", en: "Mon" }, { ar: "التلات", en: "Tue" },
    { ar: "الأربع", en: "Wed" }, { ar: "الخميس", en: "Thu" }, { ar: "الجمعة", en: "Fri" }
  ];
  /* cls = .t-spec-tag / colour class in tamargi.css */
  D.specialties = {
    im:    { ar: "باطنة",       en: "Internal med.",  cls: "im" },
    derma: { ar: "جلدية",       en: "Dermatology",    cls: "derma" },
    laser: { ar: "ليزر تجميل",  en: "Cosmetic laser", cls: "derma" },
    peds:  { ar: "أطفال",       en: "Paediatrics",    cls: "peds" },
    ent:   { ar: "أنف وأذن",    en: "ENT",            cls: "ent" },
    dent:  { ar: "أسنان",       en: "Dental",         cls: "dent" },
    gyn:   { ar: "نسا وتوليد",  en: "OB/GYN",         cls: "gyn" }
  };
  D.roomTypes = {
    consult: { ar: "كشف", en: "Consult" }, dental: { ar: "كرسي أسنان", en: "Dental chair" },
    laser: { ar: "ليزر", en: "Laser" }, proc: { ar: "إجراءات", en: "Procedures" }
  };
  D.roles = {
    owner:     { ar: "المالك",     en: "Owner" },
    manager:   { ar: "مدير فرع",   en: "Branch manager" },
    doctor:    { ar: "طبيب",       en: "Doctor" },
    nurse:     { ar: "تمريض",      en: "Nurse" },
    reception: { ar: "استقبال",    en: "Receptionist" },
    cashier:   { ar: "خزنة",       en: "Cashier" }
  };
  /* status -> .t-chip class is the same word */
  D.apptStatus = {
    booked: { ar: "محجوز", en: "Booked" }, confirmed: { ar: "مأكد", en: "Confirmed" }, arrived: { ar: "وصل", en: "Arrived" },
    waiting: { ar: "منتظر", en: "Waiting" }, called: { ar: "اتنادى", en: "Called" }, inroom: { ar: "في الكشف", en: "In room" },
    done: { ar: "خلص", en: "Done" }, left: { ar: "مشي", en: "Left" }, noshow: { ar: "مجاش", en: "No-show" }, cancelled: { ar: "اتلغى", en: "Cancelled" }
  };
  D.invoiceStatus = {
    paid: { ar: "مدفوعة", en: "Paid" }, partial: { ar: "مدفوع جزء", en: "Part-paid" }, unpaid: { ar: "مش مدفوعة", en: "Unpaid" },
    credit: { ar: "عليها مرتجع", en: "Credited" }, "void": { ar: "ملغية", en: "Void" }
  };
  D.payMethods = { cash: { ar: "كاش", en: "Cash" }, card: { ar: "فيزا", en: "Card" }, instapay: { ar: "إنستاباي", en: "InstaPay" }, wallet: { ar: "محفظة", en: "Mobile wallet" } };
  D.equipStatus = { service: { ar: "شغّال", en: "In service" }, maint: { ar: "في الصيانة", en: "Under maintenance" }, oos: { ar: "عطلان", en: "Out of service" } };
  D.maintKinds = { pm: { ar: "صيانة دورية", en: "Preventive maintenance" }, cal: { ar: "معايرة", en: "Calibration" }, fix: { ar: "إصلاح", en: "Repair" }, chk: { ar: "فحص", en: "Check" } };
  /* stock flag -> chip class + label */
  D.stockFlags = {
    ok:   { cls: "ok",       ar: "متوفر",        en: "OK" },
    low:  { cls: "low",      ar: "قرب يخلص",     en: "Low" },
    exp:  { cls: "expiring", ar: "قرب ينتهي",    en: "Expiring" },
    dead: { cls: "expired",  ar: "منتهي — معزول", en: "Expired — quarantined" }
  };

  /* ---------------- People (global identity; one login, many orgs) ---------------- */
  D.people = [
    { id: "p-ahmed", ar: "د. أحمد سليم عبد الحميد", en: "Dr. Ahmed Selim Abdelhamid", phone: "0100 000 1001" },
    { id: "p-noha",  ar: "د. نهى الشربيني",          en: "Dr. Noha El-Sherbini",        phone: "0100 000 1002" }
  ];

  /* ---------------- Organizations ----------------
     kind: solo | polyclinic. plan: clinic | poly.
     clinicalVisibility: "org" = every doctor of the org sees the whole file (default);
     a membership may override with "own" (own patients only).
     myRole*: how the signed-in person (D.me) sits in this org (org switcher label). */
  D.orgs = [
    { id: "selim", kind: "solo", ar: "عيادة د. أحمد سليم", en: "Dr. Ahmed Selim Clinic", ini: "أس",
      plan: "clinic", planAr: "باقة العيادة", planEn: "Clinic plan", myRoleAr: "مالك + طبيب", myRoleEn: "Owner + doctor",
      gov: { ar: "الدقهلية", en: "Dakahlia" }, invPrefix: "INV", clinicalVisibility: "org", followupDays: 14, discountApprovalAbove: 20 },
    { id: "nile", kind: "polyclinic", ar: "مجمع النيل الطبي", en: "Nile Medical Centre", ini: "ن",
      plan: "poly", planAr: "باقة المجمعات", planEn: "Polyclinic plan", myRoleAr: "طبيب في فرعين", myRoleEn: "Doctor in 2 branches",
      gov: { ar: "الدقهلية", en: "Dakahlia" }, invPrefix: "NMC", clinicalVisibility: "org", followupDays: 10, discountApprovalAbove: 10 }
  ];

  /* ---------------- Plans: monthly EGP price + included seats; extra doctor / branch add-ons ----------------
     Rooms and chairs are never limited. org.plan points here. */
  D.plans = {
    solo:   { ar: "فردي", en: "Solo", price: 199, doctors: 1, branches: 1, staff: 3, addDoc: 99, addBranch: null, subAr: "دكتور واحد ومساعدة", subEn: "One doctor and an assistant" },
    clinic: { ar: "العيادة", en: "Clinic", price: 399, doctors: 3, branches: 1, staff: 8, addDoc: 99, addBranch: null, subAr: "٢–٣ أطباء في مكان واحد", subEn: "2–3 doctors in one place" },
    poly:   { ar: "المجمعات", en: "Polyclinic", price: 699, doctors: 8, branches: 2, staff: 25, addDoc: 79, addBranch: 249, subAr: "مراكز طبية وفروع", subEn: "Medical centres and branches" }
  };

  /* ---------------- Branches ---------------- */
  D.branches = [
    { id: "main", org: "selim", code: "SLM", ar: "المنصورة — الفرع الرئيسي", en: "Mansoura — main branch", shortAr: "الرئيسي", shortEn: "Main",
      city: { ar: "المنصورة", en: "Mansoura" }, addressAr: "المنصورة، شارع الجمهورية، برج النور، الدور ٣", addressEn: "Mansoura, El-Gomhoreya St., Al-Nour tower, 3rd floor",
      phone: "050 000 1100", hours: { from: 10, to: 21 }, closedDays: [6] },
    { id: "tor", org: "nile", code: "TOR", ar: "المنصورة - توريل", en: "Mansoura - Toreil", shortAr: "توريل", shortEn: "Toreil",
      city: { ar: "المنصورة", en: "Mansoura" }, addressAr: "توريل، شارع السلام، أمام الحديقة", addressEn: "Toreil, El-Salam St., facing the park",
      phone: "050 000 2200", hours: { from: 10, to: 23 }, closedDays: [6] },
    { id: "gam", org: "nile", code: "UNI", ar: "المنصورة - الجامعة", en: "Mansoura - University", shortAr: "الجامعة", shortEn: "University",
      city: { ar: "المنصورة", en: "Mansoura" }, addressAr: "شارع الجامعة، بجوار بوابة ٢", addressEn: "University St., next to gate 2",
      phone: "050 000 3300", hours: { from: 16, to: 23 }, closedDays: [6] }
  ];

  /* ---------------- Rooms (type, never specialty) ---------------- */
  D.rooms = [
    { id: "S1", org: "selim", branch: "main", ar: "غرفة الكشف", en: "Consult room", type: "consult", bookable: true },
    { id: "T1", org: "nile", branch: "tor", ar: "غرفة كشف ١", en: "Consult room 1", type: "consult", bookable: true },
    { id: "T2", org: "nile", branch: "tor", ar: "غرفة كشف ٢", en: "Consult room 2", type: "consult", bookable: true },
    { id: "T3", org: "nile", branch: "tor", ar: "غرفة كشف ٣", en: "Consult room 3", type: "consult", bookable: true },
    { id: "T4", org: "nile", branch: "tor", ar: "غرفة الليزر", en: "Laser room", type: "laser", bookable: true },
    { id: "T5", org: "nile", branch: "tor", ar: "غرفة الإجراءات والحقن", en: "Procedures & injections", type: "proc", bookable: false, nurse: true },
    { id: "G1", org: "nile", branch: "gam", ar: "غرفة كشف ١", en: "Consult room 1", type: "consult", bookable: true },
    { id: "G2", org: "nile", branch: "gam", ar: "غرفة كشف ٢", en: "Consult room 2", type: "consult", bookable: true },
    { id: "G3", org: "nile", branch: "gam", ar: "كرسي أسنان ١", en: "Dental chair 1", type: "dental", bookable: true }
  ];

  /* ---------------- Doctor profiles (per org; `person` links the same human) ----------------
     sp[0] is the primary specialty. visibility overrides org.clinicalVisibility. */
  D.doctors = [
    { id: "s-ahmed", org: "selim", person: "p-ahmed", ar: "د. أحمد سليم عبد الحميد", en: "Dr. Ahmed Selim Abdelhamid", shortAr: "د. أحمد سليم", shortEn: "Dr. Ahmed Selim", ini: "أس",
      sp: ["im"], packAr: "باقة الباطنة: قوالب SOAP وروشتات جاهزة", packEn: "Internal medicine pack: SOAP templates, Rx sets", phone: "0100 000 1001", licence: "00000-DEMO" },
    { id: "s-noha", org: "selim", person: "p-noha", ar: "د. نهى الشربيني", en: "Dr. Noha El-Sherbini", shortAr: "د. نهى الشربيني", shortEn: "Dr. Noha El-Sherbini", ini: "نش",
      sp: ["derma"], packAr: "باقة الجلدية", packEn: "Dermatology pack", phone: "0100 000 1002", licence: "00000-DEMO" },

    { id: "n-ahmed", org: "nile", person: "p-ahmed", ar: "د. أحمد سليم عبد الحميد", en: "Dr. Ahmed Selim Abdelhamid", shortAr: "د. أحمد سليم", shortEn: "Dr. Ahmed Selim", ini: "أس",
      sp: ["im"], packAr: "باقة الباطنة: قوالب SOAP وروشتات جاهزة", packEn: "Internal medicine pack: SOAP templates, Rx sets", phone: "0100 000 1001", licence: "00000-DEMO" },
    { id: "n-noha", org: "nile", person: "p-noha", ar: "د. نهى الشربيني", en: "Dr. Noha El-Sherbini", shortAr: "د. نهى الشربيني", shortEn: "Dr. Noha El-Sherbini", ini: "نش",
      sp: ["derma", "laser"], packAr: "باقة الجلدية + باقة الليزر (جلسات وصور قبل/بعد)", packEn: "Dermatology + laser packs (sessions, before/after photos)", phone: "0100 000 1002", licence: "00000-DEMO" },
    { id: "n-marwa", org: "nile", ar: "د. مروة السيد حجازي", en: "Dr. Marwa El-Sayed Hegazy", shortAr: "د. مروة حجازي", shortEn: "Dr. Marwa Hegazy", ini: "مح",
      sp: ["peds"], packAr: "باقة الأطفال: منحنيات النمو وجرعات بالوزن", packEn: "Paediatrics pack: growth charts, weight-based doses", phone: "0100 000 1003", licence: "00000-DEMO" },
    { id: "n-karim", org: "nile", ar: "د. كريم عبد الرؤوف الدسوقي", en: "Dr. Karim Abdelraouf El-Desouky", shortAr: "د. كريم الدسوقي", shortEn: "Dr. Karim El-Desouky", ini: "كد",
      sp: ["ent"], packAr: "باقة الأنف والأذن", packEn: "ENT pack", phone: "0100 000 1004", licence: "00000-DEMO" },
    { id: "n-yasser", org: "nile", ar: "د. ياسر منصور الشافعي", en: "Dr. Yasser Mansour El-Shafei", shortAr: "د. ياسر الشافعي", shortEn: "Dr. Yasser El-Shafei", ini: "يش",
      sp: ["dent"], packAr: "باقة الأسنان: خريطة الأسنان وخطط العلاج", packEn: "Dental pack: tooth chart, treatment plans", phone: "0100 000 1005", licence: "00000-DEMO",
      visibility: "own", rentsShift: true },
    { id: "n-heba", org: "nile", ar: "د. هبة علي النجار", en: "Dr. Heba Ali El-Naggar", shortAr: "د. هبة النجار", shortEn: "Dr. Heba El-Naggar", ini: "هن",
      sp: ["gyn"], packAr: "باقة النسا: متابعة الحمل", packEn: "OB/GYN pack: pregnancy follow-up", phone: "0100 000 1006", licence: "00000-DEMO" }
  ];

  /* ---------------- Shifts: doctor x branch x room x days x time ----------------
     Built-in conflicts (for the Rooms screen):
       Wed: T3 karim 17:30-23 overlaps marwa 14:30-18 (room double-booked).
       Thu: n-ahmed in Toreil 18-20 and University 17-22 (doctor in two branches). */
  D.shifts = [
    { id: "sh1",  org: "selim", branch: "main", room: "S1", doctor: "s-ahmed", sp: "im",    days: [0, 1, 2, 3, 4, 5], from: 10, to: 15 },
    { id: "sh2",  org: "selim", branch: "main", room: "S1", doctor: "s-noha",  sp: "derma", days: [0, 4], from: 15, to: 19 },

    { id: "sh10", org: "nile", branch: "tor", room: "T1", doctor: "n-ahmed",  sp: "im",    days: [0, 2, 4], from: 17, to: 23 },
    { id: "sh11", org: "nile", branch: "tor", room: "T1", doctor: "n-ahmed",  sp: "im",    days: [5], from: 18, to: 20 },
    { id: "sh12", org: "nile", branch: "tor", room: "T3", doctor: "n-noha",   sp: "derma", days: [0, 1, 2, 3, 4, 5], from: 10, to: 14 },
    { id: "sh13", org: "nile", branch: "tor", room: "T3", doctor: "n-marwa",  sp: "peds",  days: [0, 1, 3, 4], from: 14.5, to: 18 },
    { id: "sh14", org: "nile", branch: "tor", room: "T3", doctor: "n-karim",  sp: "ent",   days: [0, 2], from: 19, to: 23 },
    { id: "sh15", org: "nile", branch: "tor", room: "T3", doctor: "n-karim",  sp: "ent",   days: [4], from: 17.5, to: 23 },
    { id: "sh16", org: "nile", branch: "tor", room: "T4", doctor: "n-noha",   sp: "laser", days: [2, 5], from: 15, to: 19 },
    { id: "sh17", org: "nile", branch: "gam", room: "G1", doctor: "n-heba",   sp: "gyn",   days: [0, 2, 4], from: 16, to: 20 },
    { id: "sh18", org: "nile", branch: "gam", room: "G2", doctor: "n-ahmed",  sp: "im",    days: [1, 3, 5], from: 17, to: 22 },
    { id: "sh19", org: "nile", branch: "gam", room: "G3", doctor: "n-yasser", sp: "dent",  days: [0, 1, 2, 3, 4, 5], from: 16, to: 23 }
  ];

  /* ---------------- Staff = memberships (person x org) with role grants per branch ----------------
     grants: [{ role, branches: "all" | [branchIds] }]. Owner is always "all".
     status: active | invited | inactive (default active). lastActive: { ar, en } display text.
     Doctor memberships without ar/en take their name from the linked doctor profile (D.memberName). */
  D.staff = [
    { id: "m-s-ahmed", org: "selim", person: "p-ahmed", doctor: "s-ahmed", ar: "د. أحمد سليم عبد الحميد", en: "Dr. Ahmed Selim Abdelhamid", ini: "أس", phone: "0100 000 1001",
      grants: [{ role: "owner", branches: "all" }, { role: "doctor", branches: "all" }], discountCap: 100, lastActive: { ar: "دلوقتي", en: "Now" } },
    { id: "m-s-noha", org: "selim", person: "p-noha", doctor: "s-noha", ar: "د. نهى الشربيني", en: "Dr. Noha El-Sherbini", ini: "نش", phone: "0100 000 1002",
      grants: [{ role: "doctor", branches: ["main"] }], discountCap: 30, lastActive: { ar: "النهارده ١:٤٠ م", en: "Today 1:40 pm" } },
    { id: "m-s-sara", org: "selim", ar: "سارة رمضان علي", en: "Sara Ramadan Ali", ini: "سر", phone: "0100 000 1101",
      grants: [{ role: "reception", branches: ["main"] }, { role: "cashier", branches: ["main"] }], discountCap: 20, lastActive: { ar: "دلوقتي · كمبيوتر الاستقبال", en: "Now · reception PC" } },
    { id: "m-s-menna", org: "selim", ar: "منة خالد إبراهيم", en: "Menna Khaled Ibrahim", ini: "مخ", phone: "0100 000 1102",
      grants: [{ role: "reception", branches: ["main"] }], discountCap: 20, lastActive: { ar: "النهارده ٢:٠٥ م", en: "Today 2:05 pm" } },
    { id: "m-s-samar", org: "selim", ar: "سمر عبد الله مصطفى", en: "Samar Abdallah Mostafa", ini: "سع", phone: "0100 000 1103", status: "invited",
      grants: [{ role: "nurse", branches: ["main"] }], discountCap: 0, lastActive: { ar: "الدعوة اتبعتت ١٣ نوفمبر · تنتهي بعد ٦ أيام", en: "Invite sent 13 Nov · expires in 6 days" } },
    { id: "m-s-hala", org: "selim", ar: "هالة محمود سعد", en: "Hala Mahmoud Saad", ini: "هم", phone: "0100 000 1104", status: "inactive",
      grants: [{ role: "reception", branches: ["main"] }], discountCap: null, lastActive: { ar: "اتوقفت ١ أكتوبر · تاريخها محفوظ", en: "Stopped 1 Oct · history kept" } },

    { id: "m-n-hossam", org: "nile", ar: "د. حسام الدين رشاد", en: "Dr. Hossam El-Din Rashad", ini: "حر", phone: "0100 000 2001",
      grants: [{ role: "owner", branches: "all" }], discountCap: 100 },
    { id: "m-n-walid", org: "nile", ar: "وليد سمير عبد الفتاح", en: "Walid Samir Abdelfattah", ini: "وس", phone: "0100 000 2002",
      grants: [{ role: "manager", branches: ["tor"] }], discountCap: 25 },
    { id: "m-n-doaa", org: "nile", ar: "دعاء حمدي البيلي", en: "Doaa Hamdy El-Beily", ini: "دب", phone: "0100 000 2003",
      grants: [{ role: "reception", branches: ["tor"] }], discountCap: 10 },
    { id: "m-n-mahmoud", org: "nile", ar: "محمود عاطف سلامة", en: "Mahmoud Atef Salama", ini: "مس", phone: "0100 000 2004",
      grants: [{ role: "cashier", branches: ["tor"] }], discountCap: 10 },
    { id: "m-n-esraa", org: "nile", ar: "إسراء فتحي زيدان", en: "Esraa Fathy Zidan", ini: "إز", phone: "0100 000 2005",
      grants: [{ role: "reception", branches: ["gam"] }, { role: "cashier", branches: ["gam"] }], discountCap: 10 },
    { id: "m-n-amal", org: "nile", ar: "أمل عبد المنعم شحاتة", en: "Amal Abdelmoneim Shehata", ini: "أش", phone: "0100 000 2006",
      grants: [{ role: "nurse", branches: ["tor"] }] },
    { id: "m-n-ahmed",  org: "nile", person: "p-ahmed", doctor: "n-ahmed",  grants: [{ role: "doctor", branches: ["tor", "gam"] }], discountCap: 0 },
    { id: "m-n-noha",   org: "nile", person: "p-noha",  doctor: "n-noha",   grants: [{ role: "doctor", branches: ["tor"] }], discountCap: 0 },
    { id: "m-n-marwa",  org: "nile", doctor: "n-marwa",  grants: [{ role: "doctor", branches: ["tor"] }], discountCap: 0 },
    { id: "m-n-karim",  org: "nile", doctor: "n-karim",  grants: [{ role: "doctor", branches: ["tor"] }], discountCap: 0 },
    { id: "m-n-yasser", org: "nile", doctor: "n-yasser", grants: [{ role: "doctor", branches: ["gam"] }], discountCap: 0 },
    { id: "m-n-heba",   org: "nile", doctor: "n-heba",   grants: [{ role: "doctor", branches: ["gam"] }], discountCap: 0 }
  ];

  /* ---------------- Patients (one file per org; regBranch = where registered) ----------------
     debt / deposit are org-wide balances in EGP. followupUntil = free follow-up window end. */
  function P(id, org, fileNo, ar, en, sex, age, phone, regBranch, extra) {
    var p = { id: id, org: org, fileNo: fileNo, ar: ar, en: en, sex: sex, age: age, phone: phone, regBranch: regBranch, allergies: [], chronic: [], debt: 0, deposit: 0 };
    if (extra) for (var k in extra) p[k] = extra[k];
    return p;
  }
  var PEN = { ar: "بنسلين", en: "Penicillin" }, DM = { ar: "سكر", en: "Diabetes" }, HTN = { ar: "ضغط", en: "Hypertension" };
  D.patients = [
    /* selim — names match the solo-clinic screens (patient-search etc.); phones are fake */
    P("s-p1",  "selim", "0871", "محمد عبد الله إبراهيم العشري", "Mohamed Abdallah Ibrahim El-Ashry", "M", 52, "0100 000 0101", "main", { deposit: 200, chronic: [DM] }),
    P("s-p2",  "selim", "1310", "محمد عبدالله فوزي الجندي", "Mohamed Abdallah Fawzy El-Gendy", "M", 29, "0100 000 0102", "main", { followupUntil: "2026-11-25" }),
    P("s-p3",  "selim", "1043", "منى عبد الرحمن السيد الشناوي", "Mona Abdelrahman El-Sayed El-Shennawy", "F", 34, "0100 000 0103", "main", { allergies: [PEN], debt: 40, followupUntil: "2026-11-19" }),
    P("s-p4",  "selim", "0655", "هبة محمود عبد الله سرور", "Heba Mahmoud Abdallah Sorour", "F", 41, "0100 000 0104", "main"),
    P("s-p5",  "selim", "2214", "ريم أحمد عبد الفتاح زكي", "Reem Ahmed Abdelfattah Zaki", "F", 5, "0100 000 0105", "main", { child: true, guardian: { ar: "أحمد عبد الفتاح (الأب)", en: "Ahmed Abdelfattah (father)" } }),
    P("s-p6",  "selim", "0412", "عبد الله فتحي القط", "Abdallah Fathy El-Qott", "M", 63, "0100 000 0106", "main", { debt: 150, chronic: [HTN, DM] }),
    P("s-p7",  "selim", "1502", "أسماء عبد العاطي المرسي", "Asmaa Abdelaty El-Morsy", "F", 27, "0100 000 0107", "main"),
    P("s-p8",  "selim", "1188", "إسراء محمد الشربيني", "Esraa Mohamed El-Sherbiny", "F", 31, "0100 000 0108", "main"),
    P("s-p9",  "selim", "1620", "كريم محمود عبد العزيز", "Karim Mahmoud Abdelaziz", "M", 38, "0100 000 0109", "main", { debt: 150 }),
    P("s-p10", "selim", "1621", "سامية فؤاد البدراوي", "Samia Fouad El-Badrawy", "F", 46, "0100 000 0110", "main", { allergies: [PEN] }),

    /* nile — one file per patient across Toreil + University */
    P("n-p1",  "nile", "3101", "ياسمين حسن عبد الواحد", "Yasmin Hassan Abdelwahed", "F", 29, "0100 000 0201", "tor"),
    P("n-p2",  "nile", "3102", "عمر خالد الدمرداش", "Omar Khaled El-Demerdash", "M", 7, "0100 000 0202", "tor", { child: true }),
    P("n-p3",  "nile", "3103", "نادية سعيد البنا", "Nadia Saeed El-Banna", "F", 58, "0100 000 0203", "tor", { chronic: [HTN] }),
    P("n-p4",  "nile", "3104", "مصطفى إبراهيم شلبي", "Moustafa Ibrahim Shalaby", "M", 44, "0100 000 0204", "tor", { debt: 100, followupUntil: "2026-11-20" }),
    P("n-p5",  "nile", "3105", "ملك محمد عبد الغني", "Malak Mohamed Abdelghani", "F", 4, "0100 000 0205", "tor", { child: true }),
    P("n-p6",  "nile", "3106", "رضا عبد الحليم فرج", "Reda Abdelhalim Farag", "M", 36, "0100 000 0206", "tor"),
    P("n-p7",  "nile", "3107", "دينا أشرف الجمّال", "Dina Ashraf El-Gammal", "F", 32, "0100 000 0207", "tor", { deposit: 1600, note: { ar: "باقة ليزر ٦ جلسات — فاضل ٢", en: "Laser package 6 sessions — 2 left" } }),
    P("n-p8",  "nile", "3108", "شيماء طارق منصور", "Shaimaa Tarek Mansour", "F", 27, "0100 000 0208", "gam", { pregnant: true, note: { ar: "متابعة حمل — الأسبوع ٢٤", en: "Pregnancy follow-up — week 24" } }),
    P("n-p9",  "nile", "3109", "هالة فاروق النحاس", "Hala Farouk El-Nahhas", "F", 39, "0100 000 0209", "gam"),
    P("n-p10", "nile", "3110", "طارق سمير عوض", "Tarek Samir Awad", "M", 51, "0100 000 0210", "gam", { chronic: [DM] }),
    P("n-p11", "nile", "3111", "نور الهدى رمضان", "Nour El-Hoda Ramadan", "F", 23, "0100 000 0211", "tor"),
    P("n-p12", "nile", "3112", "إبراهيم عادل قنديل", "Ibrahim Adel Kandil", "M", 62, "0100 000 0212", "gam", { allergies: [PEN], chronic: [HTN, DM] }),
    P("n-p13", "nile", "3113", "زياد وائل حمدي", "Ziad Wael Hamdy", "M", 19, "0100 000 0213", "gam"),
    P("n-p14", "nile", "3114", "سلمى أيمن رزق", "Salma Ayman Rizk", "F", 10, "0100 000 0214", "tor", { child: true }),
    P("n-p15", "nile", "3115", "فاطمة السيد غنيم", "Fatma El-Sayed Ghoneim", "F", 47, "0100 000 0215", "tor"),
    P("n-p16", "nile", "3116", "محمود جمال الصاوي", "Mahmoud Gamal El-Sawy", "M", 33, "0100 000 0216", "gam"),
    P("n-p17", "nile", "3117", "آدم محمود سلامة", "Adam Mahmoud Salama", "M", 3, "0100 000 0217", "tor", { child: true }),
    P("n-p18", "nile", "3118", "عادل منير الشامي", "Adel Mounir El-Shamy", "M", 55, "0100 000 0218", "tor"),
    P("n-p19", "nile", "3119", "رحاب صلاح عيد", "Rehab Salah Eid", "F", 30, "0100 000 0219", "gam", { pregnant: true }),
    P("n-p20", "nile", "3120", "مي عبد الفتاح خليل", "Mai Abdelfattah Khalil", "F", 26, "0100 000 0220", "gam")
  ];

  /* ---------------- Services (org catalogue) + price overrides ----------------
     kind: consult | followup | procedure | session | test.
     main: the headline service of a specialty (used for "consult fee" columns).
     base = org default price. Overrides in D.prices (doctor and/or branch). */
  D.services = [
    { id: "s-im-c",  org: "selim", sp: "im",    kind: "consult",   main: true, ar: "كشف باطنة", en: "Internal med. consult", minutes: 15, base: 250 },
    { id: "s-im-f",  org: "selim", sp: "im",    kind: "followup",  ar: "استشارة (متابعة)", en: "Follow-up", minutes: 10, base: 100, freeWithinDays: 14 },
    { id: "s-dr-c",  org: "selim", sp: "derma", kind: "consult",   main: true, ar: "كشف جلدية", en: "Dermatology consult", minutes: 15, base: 300 },
    { id: "s-ecg",   org: "selim", sp: null,    kind: "test",      ar: "رسم قلب", en: "ECG (resting)", minutes: 10, base: 150 },
    { id: "s-inj",   org: "selim", sp: null,    kind: "procedure", ar: "حقنة", en: "Injection", minutes: 5, base: 50 },
    { id: "s-neb",   org: "selim", sp: null,    kind: "procedure", ar: "جلسة نيبولايزر", en: "Nebuliser session", minutes: 15, base: 60 },

    { id: "n-im-c",  org: "nile", sp: "im",    kind: "consult",   main: true, ar: "كشف باطنة", en: "Internal med. consult", minutes: 15, base: 300 },
    { id: "n-im-f",  org: "nile", sp: "im",    kind: "followup",  ar: "استشارة باطنة", en: "Internal med. follow-up", minutes: 10, base: 150, freeWithinDays: 10 },
    { id: "n-dr-c",  org: "nile", sp: "derma", kind: "consult",   main: true, ar: "كشف جلدية", en: "Dermatology consult", minutes: 15, base: 350 },
    { id: "n-dr-f",  org: "nile", sp: "derma", kind: "followup",  ar: "استشارة جلدية", en: "Dermatology follow-up", minutes: 10, base: 150, freeWithinDays: 10 },
    { id: "n-lz-s",  org: "nile", sp: "laser", kind: "session",   main: true, ar: "جلسة ليزر (منطقة)", en: "Laser session (one area)", minutes: 30, base: 800, fromPrice: true },
    { id: "n-pd-c",  org: "nile", sp: "peds",  kind: "consult",   main: true, ar: "كشف أطفال", en: "Paediatrics consult", minutes: 15, base: 250 },
    { id: "n-en-c",  org: "nile", sp: "ent",   kind: "consult",   main: true, ar: "كشف أنف وأذن", en: "ENT consult", minutes: 15, base: 300 },
    { id: "n-en-sc", org: "nile", sp: "ent",   kind: "procedure", ar: "منظار أنف", en: "Nasal endoscopy", minutes: 15, base: 500 },
    { id: "n-dt-c",  org: "nile", sp: "dent",  kind: "consult",   main: true, ar: "كشف أسنان", en: "Dental consult", minutes: 15, base: 200 },
    { id: "n-dt-fl", org: "nile", sp: "dent",  kind: "procedure", ar: "حشو كومبوزيت", en: "Composite filling", minutes: 30, base: 600 },
    { id: "n-dt-ex", org: "nile", sp: "dent",  kind: "procedure", ar: "خلع ضرس", en: "Tooth extraction", minutes: 20, base: 400 },
    { id: "n-gy-c",  org: "nile", sp: "gyn",   kind: "consult",   main: true, ar: "كشف نسا", en: "OB/GYN consult", minutes: 15, base: 350 },
    { id: "n-gy-us", org: "nile", sp: "gyn",   kind: "test",      ar: "سونار", en: "Ultrasound", minutes: 15, base: 300 },
    { id: "n-ecg",   org: "nile", sp: null,    kind: "test",      ar: "رسم قلب", en: "ECG (resting)", minutes: 10, base: 150 },
    { id: "n-inj",   org: "nile", sp: null,    kind: "procedure", ar: "حقنة", en: "Injection", minutes: 5, base: 50 }
  ];
  /* Most specific wins: doctor+branch > doctor > branch > base. */
  D.prices = [
    { org: "nile", service: "n-im-c", doctor: "n-ahmed", branch: "tor", price: 300 },
    { org: "nile", service: "n-im-c", doctor: "n-ahmed", branch: "gam", price: 250 },
    { org: "nile", service: "n-im-f", doctor: "n-ahmed", branch: "gam", price: 120 },
    { org: "nile", service: "n-dr-c", doctor: "n-noha",  branch: null,  price: 350 },
    { org: "nile", service: "n-inj",  doctor: null,      branch: "gam", price: 60 }
  ];

  /* ---------------- Appointments + live queue ----------------
     status: booked | confirmed | arrived | waiting | called | inroom | done | left | noshow | cancelled
     source: walkin | phone | whatsapp | online. queueNo is filled below (per branch per day). */
  function A(id, org, branch, room, doctor, patient, date, from, service, status, source) {
    var s = null; for (var i = 0; i < D.services.length; i++) if (D.services[i].id === service) s = D.services[i];
    return { id: id, org: org, branch: branch, room: room, doctor: doctor, patient: patient, date: date, from: from, dur: s ? s.minutes : 15, service: service, status: status, source: source || "phone" };
  }
  var T = D.today;
  D.appointments = [
    /* selim, today: Dr. Ahmed morning (finished), Dr. Noha afternoon (live) */
    A("s-a1", "selim", "main", "S1", "s-ahmed", "s-p1", T, 10,    "s-im-c", "done"),
    A("s-a2", "selim", "main", "S1", "s-ahmed", "s-p6", T, 10.5,  "s-im-f", "done"),
    A("s-a3", "selim", "main", "S1", "s-ahmed", "s-p7", T, 11.25, "s-im-c", "done", "walkin"),
    A("s-a4", "selim", "main", "S1", "s-ahmed", "s-p9", T, 12,    "s-im-c", "done"),
    A("s-a5", "selim", "main", "S1", "s-ahmed", "s-p2", T, 13,    "s-im-f", "left", "whatsapp"),
    A("s-a6", "selim", "main", "S1", "s-noha",  "s-p3", T, 15,    "s-dr-c", "done"),
    A("s-a7", "selim", "main", "S1", "s-noha",  "s-p4", T, 16,    "s-dr-c", "done"),
    A("s-a8", "selim", "main", "S1", "s-noha",  "s-p10", T, 17.25, "s-dr-c", "inroom", "walkin"),
    A("s-a9", "selim", "main", "S1", "s-noha",  "s-p8", T, 17.5,  "s-dr-c", "waiting"),
    A("s-a10","selim", "main", "S1", "s-noha",  "s-p5", T, 18,    "s-dr-c", "confirmed", "whatsapp"),
    /* selim, tomorrow */
    A("s-a11","selim", "main", "S1", "s-ahmed", "s-p3", "2026-11-15", 10.5, "s-im-f", "booked"),
    A("s-a12","selim", "main", "S1", "s-ahmed", "s-p6", "2026-11-15", 11,   "s-im-c", "booked", "online"),

    /* nile Toreil, today */
    A("n-a1",  "nile", "tor", "T3", "n-noha",  "n-p11", T, 10,    "n-dr-c", "done"),
    A("n-a2",  "nile", "tor", "T3", "n-noha",  "n-p15", T, 10.5,  "n-dr-c", "done"),
    A("n-a3",  "nile", "tor", "T3", "n-noha",  "n-p7",  T, 11,    "n-dr-f", "done"),
    A("n-a4",  "nile", "tor", "T3", "n-noha",  "n-p1",  T, 12,    "n-dr-c", "done", "online"),
    A("n-a5",  "nile", "tor", "T3", "n-marwa", "n-p2",  T, 14.5,  "n-pd-c", "done"),
    A("n-a6",  "nile", "tor", "T3", "n-marwa", "n-p14", T, 15.25, "n-pd-c", "done"),
    A("n-a7",  "nile", "tor", "T3", "n-marwa", "n-p5",  T, 17,    "n-pd-c", "inroom"),
    A("n-a8",  "nile", "tor", "T3", "n-marwa", "n-p17", T, 17.5,  "n-pd-c", "waiting", "walkin"),
    A("n-a9",  "nile", "tor", "T1", "n-ahmed", "n-p3",  T, 17,    "n-im-c", "done"),
    A("n-a10", "nile", "tor", "T1", "n-ahmed", "n-p4",  T, 17.25, "n-im-f", "inroom"),
    A("n-a11", "nile", "tor", "T1", "n-ahmed", "n-p12", T, 17.5,  "n-im-c", "waiting"),     /* registered at University, seen in Toreil: one org-wide file */
    A("n-a12", "nile", "tor", "T1", "n-ahmed", "n-p18", T, 18,    "n-im-c", "confirmed"),
    A("n-a13", "nile", "tor", "T1", "n-ahmed", "n-p11", T, 18.5,  "n-im-c", "booked", "whatsapp"),
    A("n-a14", "nile", "tor", "T3", "n-karim", "n-p6",  T, 19,    "n-en-c", "booked"),
    A("n-a15", "nile", "tor", "T3", "n-karim", "n-p1",  T, 19.5,  "n-en-c", "booked", "online"),
    /* nile University, today */
    A("n-a16", "nile", "gam", "G1", "n-heba",   "n-p8",  T, 16,   "n-gy-c", "done"),
    A("n-a17", "nile", "gam", "G1", "n-heba",   "n-p20", T, 16.5, "n-gy-c", "noshow"),
    A("n-a18", "nile", "gam", "G1", "n-heba",   "n-p9",  T, 17,   "n-gy-c", "called"),
    A("n-a19", "nile", "gam", "G1", "n-heba",   "n-p19", T, 17.5, "n-gy-c", "waiting", "walkin"),
    A("n-a20", "nile", "gam", "G3", "n-yasser", "n-p10", T, 16,   "n-dt-fl", "done"),
    A("n-a21", "nile", "gam", "G3", "n-yasser", "n-p13", T, 17,   "n-dt-c", "inroom"),
    A("n-a22", "nile", "gam", "G3", "n-yasser", "n-p16", T, 18,   "n-dt-ex", "booked"),
    A("n-a23", "nile", "gam", "G3", "n-yasser", "n-p13", T, 20,   "n-dt-fl", "cancelled"),
    /* nile, tomorrow (Sun) */
    A("n-a24", "nile", "gam", "G2", "n-ahmed", "n-p12", "2026-11-15", 17,  "n-im-f", "booked"),
    A("n-a25", "nile", "gam", "G2", "n-ahmed", "n-p9",  "2026-11-15", 17.5, "n-im-c", "booked", "online"),
    A("n-a26", "nile", "tor", "T3", "n-noha",  "n-p7",  "2026-11-15", 10,  "n-dr-f", "booked"),
    A("n-a27", "nile", "tor", "T3", "n-marwa", "n-p2",  "2026-11-15", 15,  "n-pd-c", "booked")
  ];
  /* queue numbers: order of arrival per org+branch+date, for everyone who arrived */
  (function () {
    var arrived = { arrived: 1, waiting: 1, called: 1, inroom: 1, done: 1, left: 1 }, seq = {};
    D.appointments.slice().sort(function (a, b) { return a.from - b.from; }).forEach(function (a) {
      if (!arrived[a.status]) return;
      var k = a.org + "|" + a.branch + "|" + a.date; seq[k] = (seq[k] || 0) + 1; a.queueNo = seq[k];
    });
  })();

  /* ---------------- Invoices ----------------
     lines: [{ service, ar, en, qty, price, discount }]. total = sum(qty*price - discount).
     Generated for every "done" appointment today, plus a few historical ones. */
  D.invoices = [];
  function buildInvoices() {   /* runs after the helpers below exist */
    var special = {                       /* per-appointment payment quirks */
      "s-a2": { lines: [["s-im-f", 1, 0]], note: { ar: "متابعة مجانية خلال ١٤ يوم", en: "Free follow-up within 14 days" } },
      "s-a4": { paid: 100, method: "cash" },                                   /* owes 150 */
      "s-a6": { extra: [["s-inj", 1, 0]], paid: 310, method: "cash" },          /* owes 40 */
      "n-a3": { method: "card" },
      "n-a20": { extra: [["n-dt-c", 1, 200]] },                                /* consult waived inside a filling visit */
      "n-a9": { extra: [["n-ecg", 1, 0]], method: "instapay" }
    };
    var cashier = { selim: { main: "m-s-sara" }, nile: { tor: "m-n-mahmoud", gam: "m-n-esraa" } };
    var seq = { main: 2390, tor: 3120, gam: 1240 };   /* per-branch series */
    D.appointments.forEach(function (a) {
      if (a.status !== "done") return;
      var q = special[a.id] || {}, lines = [];
      var base = q.lines || [[a.service, 1, 0]];
      base.concat(q.extra || []).forEach(function (l) {
        var price = D.price(l[0], a.doctor, a.branch), s = D.service(l[0]);
        lines.push({ service: l[0], ar: s.ar, en: s.en, qty: l[1], price: q.lines ? 0 : price, discount: l[2] });
      });
      var total = lines.reduce(function (t, l) { return t + l.qty * l.price - l.discount; }, 0);
      var paid = q.paid != null ? q.paid : total;
      seq[a.branch]++;
      D.invoices.push({ id: "inv-" + a.id, no: D.invoiceNo(a.branch, seq[a.branch]), org: a.org, branch: a.branch, patient: a.patient, doctor: a.doctor,
        appointment: a.id, date: a.date, time: a.from + 0.25, lines: lines, total: total, paid: paid, method: q.method || "cash",
        status: paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid", cashier: cashier[a.org][a.branch], note: q.note || null });
    });
    /* historical */
    D.invoices.push(
      { id: "inv-h1", no: D.invoiceNo("tor", 3098), org: "nile", branch: "tor", patient: "n-p4", doctor: "n-ahmed", appointment: null, date: "2026-11-10", time: 18,
        lines: [{ service: "n-im-c", ar: "كشف باطنة", en: "Internal med. consult", qty: 1, price: 300, discount: 0 }], total: 300, paid: 200, method: "cash", status: "partial", cashier: "m-n-mahmoud" },
      { id: "inv-h2", no: D.invoiceNo("tor", 3104), org: "nile", branch: "tor", patient: "n-p7", doctor: "n-noha", appointment: null, date: "2026-11-11", time: 16,
        lines: [{ service: "n-lz-s", ar: "جلسة ليزر (منطقة)", en: "Laser session (one area)", qty: 1, price: 800, discount: 0 }], total: 800, paid: 800, method: "card", status: "credit",
        cashier: "m-n-mahmoud", creditNote: { no: D.docNo("CN", "tor", 7), amount: 800, reason: { ar: "الجهاز وقف في نص الجلسة — الجلسة اتعادت مجانًا", en: "Device stopped mid-session — session redone free" } } },
      { id: "inv-h3", no: D.invoiceNo("main", 2384), org: "selim", branch: "main", patient: "s-p6", doctor: "s-ahmed", appointment: null, date: "2026-11-03", time: 11,
        lines: [{ service: "s-im-c", ar: "كشف باطنة", en: "Internal med. consult", qty: 1, price: 250, discount: 0 }, { service: "s-ecg", ar: "رسم قلب", en: "ECG (resting)", qty: 1, price: 150, discount: 0 }],
        total: 400, paid: 250, method: "cash", status: "partial", cashier: "m-s-sara" }
    );
  }

  /* ---------------- Suppliers ---------------- */
  D.suppliers = [
    { id: "v-nour",  org: "nile",  ar: "شركة النور للأجهزة الطبية", en: "Al-Nour Medical Devices Co.", kind: "devices" },
    { id: "v-emes",  org: "nile",  ar: "المصرية لصيانة الأجهزة الطبية", en: "Egyptian Medical Equipment Service", kind: "devices" },
    { id: "v-delta", org: "nile",  ar: "شركة الدلتا للمستلزمات الطبية", en: "Delta Medical Supplies Co.", kind: "supplies" },
    { id: "v-shrq",  org: "nile",  ar: "منشأة الشروق للأدوية والمستلزمات", en: "Al-Shorouk Pharma & Supplies", kind: "supplies" },
    { id: "v-s-dev", org: "selim", ar: "المصرية لصيانة الأجهزة الطبية", en: "Egyptian Medical Equipment Service", kind: "devices" },
    { id: "v-s-sup", org: "selim", ar: "شركة الدلتا للمستلزمات الطبية", en: "Delta Medical Supplies Co.", kind: "supplies" }
  ];

  /* ---------------- Stock (per branch store; nearest-expiry batch shown) ----------------
     expiry "YYYY-MM" = end of that month. Status from D.stockStatus(item). */
  function S(id, org, branch, ar, en, cat, unit, qty, min, expiry, batch, extra) {
    var s = { id: id, org: org, branch: branch, ar: ar, en: en, cat: cat, unit: unit, qty: qty, min: min, expiry: expiry, batch: batch };
    if (extra) for (var k in extra) s[k] = extra[k];
    return s;
  }
  var INJ = { ar: "حقن", en: "Injections" }, CON = { ar: "مستلزمات", en: "Consumables" }, IV = { ar: "محاليل", en: "IV fluids" }, DEN = { ar: "أسنان", en: "Dental" }, LZC = { ar: "مستلزمات ليزر", en: "Laser consumables" }, VAC = { ar: "لقاحات", en: "Vaccines" };
  var AMP = { ar: "أمبول", en: "amp" }, VIAL = { ar: "فيال", en: "vial" }, DOSE = { ar: "جرعة", en: "dose" }, CAN = { ar: "جركن", en: "can" }, PCS = { ar: "قطعة", en: "pcs" }, BOX = { ar: "علبة", en: "box" }, BAG = { ar: "كيس", en: "bag" }, CART = { ar: "كارتريدج", en: "cart." }, SYR = { ar: "سرنجة", en: "syr." };
  D.stock = [
    S("st1",  "nile", "tor", "ديكلوفيناك ٧٥ مجم حقن", "Diclofenac 75 mg injection", INJ, AMP, 46, 20, "2027-03", "DK-2611"),
    S("st2",  "nile", "tor", "سيفترياكسون ١ جم فيال", "Ceftriaxone 1 g vial", INJ, VIAL, 12, 20, "2027-01", "CF-5512"),
    S("st3",  "nile", "tor", "فيتامين ب١٢ أمبول", "Vitamin B12 ampoule", INJ, AMP, 30, 10, "2026-12", "B12-0934"),
    S("st4",  "nile", "tor", "لقاح الإنفلونزا الموسمي", "Seasonal flu vaccine", VAC, DOSE, 8, 5, "2027-02", "FL-26-07", { cold: true, device: "fridge" }),
    S("st5",  "nile", "tor", "جل ليزر (٥ لتر)", "Laser gel (5 L)", LZC, CAN, 1, 2, "2028-06", "LG-118"),
    S("st6",  "nile", "tor", "سرنجة ٥ مل", "Syringe 5 ml", CON, PCS, 180, 100, "2029-09", "SY5-77"),
    S("st7",  "nile", "tor", "جوانتي فحص M (علبة ١٠٠)", "Exam gloves M (box of 100)", CON, BOX, 9, 5, "2028-04", "GL-M-21"),
    S("st8",  "nile", "tor", "محلول ملح ٠٫٩٪ ٥٠٠ مل", "Saline 0.9% 500 ml", IV, BAG, 4, 6, "2026-10", "NS-4410"),
    S("st9",  "nile", "gam", "ليدوكايين ٢٪ كارتريدج أسنان", "Lidocaine 2% dental cartridge", DEN, CART, 14, 20, "2026-11", "LD-2207"),
    S("st10", "nile", "gam", "خيط جراحي ٣/٠", "Suture 3/0", CON, PCS, 20, 10, "2028-07", "SU3-09"),
    S("st11", "nile", "gam", "حشو كومبوزيت A2", "Composite filling A2", DEN, SYR, 6, 4, "2027-08", "CA2-31"),
    S("st12", "nile", "gam", "ديكلوفيناك ٧٥ مجم حقن", "Diclofenac 75 mg injection", INJ, AMP, 15, 10, "2027-05", "DK-2588"),
    S("st13", "nile", "gam", "جوانتي فحص M (علبة ١٠٠)", "Exam gloves M (box of 100)", CON, BOX, 4, 5, "2028-04", "GL-M-21"),
    S("st20", "selim", "main", "ديكلوفيناك ٧٥ مجم حقن", "Diclofenac 75 mg injection", INJ, AMP, 18, 10, "2027-04", "DK-2702"),
    S("st21", "selim", "main", "سرنجة ٥ مل", "Syringe 5 ml", CON, PCS, 60, 50, "2029-01", "SY5-80"),
    S("st22", "selim", "main", "محلول نيبولايزر (فنتولين)", "Nebuliser solution (salbutamol)", INJ, AMP, 3, 10, "2027-02", "VN-118"),
    S("st23", "selim", "main", "قطب رسم قلب (علبة ٥٠)", "ECG electrodes (box of 50)", CON, BOX, 2, 1, "2026-12", "EL-55")
  ];

  /* ---------------- Equipment ----------------
     room: room id, or null = branch level. next: { kind, date }. war = warranty end "YYYY-MM".
     log: [{ date, kind, ar, en, cost, warranty }]. files: [{ ar, en, type }]. */
  function E(o) { o.log = o.log || []; o.files = o.files || []; return o; }
  function LG(date, kind, ar, en, cost, warranty) { return { date: date, kind: kind, ar: ar, en: en, cost: cost, warranty: !!warranty }; }
  function FL(ar, en, type) { return { ar: ar, en: en, type: type }; }
  D.equipment = [
    E({ id: "laser", org: "nile", branch: "tor", room: "T4", ar: "جهاز ليزر إزالة الشعر (دايود)", en: "Diode hair-removal laser", status: "service", next: { kind: "pm", date: "2026-12-02" }, war: "2027-06", serial: "LZ-2291-A", bought: "2025-06", cost: 420000, vendor: "v-nour",
      log: [LG("2026-09-02", "pm", "تغيير فلتر المياه وتنظيف الهاند بيس", "Water filter change, handpiece cleaning", 1500), LG("2026-06-15", "fix", "عطل في التبريد — اتصلح", "Cooling fault — repaired", 0, true), LG("2026-03-02", "pm", "صيانة دورية", "Preventive maintenance", 1500)],
      files: [FL("فاتورة الشراء", "Purchase invoice", "PDF"), FL("شهادة الضمان", "Warranty certificate", "PDF"), FL("تقرير صيانة سبتمبر ٢٠٢٦", "Service report Sep 2026", "PDF"), FL("دليل التشغيل", "User manual", "PDF")] }),
    E({ id: "ecg", org: "nile", branch: "tor", room: "T5", ar: "جهاز رسم قلب ١٢ قناة", en: "12-lead ECG", status: "service", next: { kind: "cal", date: "2027-01-15" }, war: "2026-03", serial: "ECG-7781", bought: "2024-03", cost: 38000, vendor: "v-emes",
      log: [LG("2026-01-15", "cal", "معايرة سنوية — مطابق", "Annual calibration — passed", 900)], files: [FL("شهادة معايرة ٢٠٢٦", "Calibration certificate 2026", "PDF"), FL("فاتورة الشراء", "Purchase invoice", "JPG")] }),
    E({ id: "fridge", org: "nile", branch: "tor", room: "T5", ar: "ثلاجة اللقاحات (٢–٨°)", en: "Vaccine fridge (2–8 °C)", status: "service", next: { kind: "chk", date: "2026-12-20" }, war: "2027-11", serial: "VF-120-339", bought: "2025-11", cost: 26000, vendor: "v-nour", cold: true,
      log: [LG("2026-11-14", "chk", "قراءة الحرارة الصبح ٤٫٦° والمسا ٥٫١°", "Temperature am 4.6 °C, pm 5.1 °C", 0), LG("2026-06-20", "chk", "فحص كل ٦ شهور — سليم", "6-month check — OK", 400)], files: [FL("سجل الحرارة نوفمبر", "Temperature log Nov", "PDF")] }),
    E({ id: "suction", org: "nile", branch: "tor", room: "T5", ar: "جهاز شفط", en: "Suction unit", status: "service", next: { kind: "pm", date: "2027-03-01" }, war: "2027-09", serial: "SU-0457", bought: "2025-09", cost: 9500, vendor: "v-emes", log: [LG("2026-09-01", "pm", "صيانة دورية", "Preventive maintenance", 300)] }),
    E({ id: "bp1", org: "nile", branch: "tor", room: "T1", ar: "جهاز ضغط ديجيتال", en: "Digital BP monitor", status: "service", next: { kind: "cal", date: "2026-11-20" }, war: "2027-02", serial: "BP-55-1021", bought: "2025-02", cost: 2200, vendor: "v-emes", log: [LG("2025-11-20", "cal", "معايرة — فرق ٢ مم زئبق", "Calibration — 2 mmHg offset", 250)] }),
    E({ id: "gluco", org: "nile", branch: "tor", room: "T1", ar: "جهاز قياس السكر", en: "Glucometer", status: "service", next: { kind: "chk", date: "2027-02-10" }, war: "2027-02", serial: "GM-3390", bought: "2025-02", cost: 900, vendor: "v-emes" }),
    E({ id: "scale", org: "nile", branch: "tor", room: "T2", ar: "ميزان ديجيتال بالطول", en: "Digital scale with height rod", status: "service", next: { kind: "cal", date: "2027-04-01" }, war: "2026-10", serial: "SC-2210", bought: "2024-10", cost: 4800, vendor: "v-emes" }),
    E({ id: "neb", org: "nile", branch: "tor", room: "T3", ar: "جهاز نيبولايزر", en: "Nebuliser", status: "service", next: { kind: "pm", date: "2027-05-01" }, war: "2027-05", serial: "NB-8812", bought: "2025-05", cost: 1800, vendor: "v-emes" }),
    E({ id: "scope", org: "nile", branch: "tor", room: "T3", ar: "منظار أنف وأذن", en: "ENT endoscope", status: "service", next: { kind: "pm", date: "2026-12-28" }, war: "2027-08", serial: "EN-4471", bought: "2025-08", cost: 65000, vendor: "v-nour",
      log: [LG("2026-06-28", "pm", "صيانة دورية وتعقيم", "Preventive maintenance and sterilisation", 800)], files: [FL("فاتورة الشراء", "Purchase invoice", "PDF")] }),
    E({ id: "us", org: "nile", branch: "gam", room: "G1", ar: "جهاز سونار محمول", en: "Portable ultrasound", status: "maint", next: { kind: "fix", date: "2026-11-18" }, war: "2027-02", serial: "US-PX-6630", bought: "2025-02", cost: 185000, vendor: "v-nour",
      log: [LG("2026-11-10", "fix", "الصورة بتقطع — الجهاز عند المورد (في الضمان)", "Image dropouts — with vendor (under warranty)", 0, true), LG("2026-08-02", "pm", "صيانة دورية", "Preventive maintenance", 1200)],
      files: [FL("إيصال استلام المورد", "Vendor pick-up receipt", "JPG"), FL("شهادة الضمان", "Warranty certificate", "PDF")] }),
    E({ id: "bp2", org: "nile", branch: "gam", room: "G2", ar: "جهاز ضغط ديجيتال", en: "Digital BP monitor", status: "service", next: { kind: "cal", date: "2027-09-01" }, war: "2028-09", serial: "BP-55-1140", bought: "2026-09", cost: 2400, vendor: "v-emes" }),
    E({ id: "chair", org: "nile", branch: "gam", room: "G3", ar: "كرسي أسنان كامل + كمبروسر", en: "Dental unit + compressor", status: "service", next: { kind: "pm", date: "2026-11-20" }, war: "2027-09", serial: "DU-9920", bought: "2026-09", cost: 310000, vendor: "v-nour",
      log: [LG("2026-09-20", "chk", "تركيب وتشغيل", "Installation and commissioning", 0, true)], files: [FL("فاتورة الشراء", "Purchase invoice", "PDF"), FL("محضر التركيب", "Installation report", "PDF")] }),
    E({ id: "xray", org: "nile", branch: "gam", room: "G3", ar: "جهاز أشعة أسنان صغير", en: "Intra-oral dental X-ray", status: "service", next: { kind: "cal", date: "2027-01-05" }, war: "2027-09", serial: "XR-IO-3307", bought: "2026-09", cost: 95000, vendor: "v-nour", files: [FL("شهادة الفحص الإشعاعي", "Radiation safety check", "PDF")] }),
    E({ id: "auto", org: "nile", branch: "gam", room: null, ar: "جهاز تعقيم (أوتوكلاف)", en: "Autoclave steriliser", status: "oos", next: { kind: "fix", date: "2026-11-05" }, war: "2026-08", serial: "AC-23L-118", bought: "2024-08", cost: 48000, vendor: "v-emes", impact: true,
      log: [LG("2026-11-05", "fix", "عطل في الحساس — مستني قطعة غيار (بره الضمان)", "Sensor fault — waiting for spare part (out of warranty)", 3200)], files: [FL("عرض سعر الإصلاح", "Repair quotation", "PDF")] }),
    E({ id: "s-ecg", org: "selim", branch: "main", room: "S1", ar: "جهاز رسم قلب ٣ قنوات", en: "3-channel ECG", status: "service", next: { kind: "cal", date: "2027-02-01" }, war: "2027-02", serial: "ECG-3C-410", bought: "2025-02", cost: 22000, vendor: "v-s-dev" }),
    E({ id: "s-bp", org: "selim", branch: "main", room: "S1", ar: "جهاز ضغط ديجيتال", en: "Digital BP monitor", status: "service", next: { kind: "cal", date: "2026-12-10" }, war: "2027-06", serial: "BP-55-0877", bought: "2025-06", cost: 2100, vendor: "v-s-dev" }),
    E({ id: "s-neb", org: "selim", branch: "main", room: "S1", ar: "جهاز نيبولايزر", en: "Nebuliser", status: "service", next: { kind: "pm", date: "2027-03-15" }, war: "2027-03", serial: "NB-7720", bought: "2025-03", cost: 1700, vendor: "v-s-dev" })
  ];

  /* =====================================================================
     Helpers
     ===================================================================== */
  var idx = {};
  function by(coll, id) {
    if (!idx[coll]) { idx[coll] = {}; (D[coll] || []).forEach(function (r) { idx[coll][r.id] = r; }); }
    return idx[coll][id] || null;
  }
  D.by = by;
  D.org = function (id) { return by("orgs", id); };
  D.branch = function (id) { return by("branches", id); };
  D.room = function (id) { return by("rooms", id); };
  D.doctor = function (id) { return by("doctors", id); };
  D.patient = function (id) { return by("patients", id); };
  D.service = function (id) { return by("services", id); };
  D.member = function (id) { return by("staff", id); };
  D.supplier = function (id) { return by("suppliers", id); };
  D.device = function (id) { return by("equipment", id); };

  D.branchesOf = function (orgId) { return D.branches.filter(function (b) { return b.org === orgId; }); };

  /* ctx = { org, branch } where branch may be "all". A record is in scope when it is in ctx.org
     and (it has no branch, or ctx.branch is "all", or its branch equals ctx.branch). */
  D.inScope = function (rec, ctx) {
    if (!rec || !ctx || rec.org !== ctx.org) return false;
    return !rec.branch || ctx.branch === "all" || rec.branch === ctx.branch;
  };
  /* D.scoped("rooms", Tamargi.ctx [, extraFilterFn]) -> array */
  D.scoped = function (coll, ctx, fn) {
    return (D[coll] || []).filter(function (r) { return D.inScope(r, ctx) && (!fn || fn(r)); });
  };
  /* Branch ids covered by ctx (["tor"] or every branch of the org under "all"). */
  D.scopeBranches = function (ctx) {
    return ctx.branch === "all" ? D.branchesOf(ctx.org).map(function (b) { return b.id; }) : [ctx.branch];
  };

  /* Doctors */
  D.shiftsOf = function (doctorId) { return D.shifts.filter(function (s) { return s.doctor === doctorId; }); };
  D.doctorBranches = function (doctorId) {
    var out = []; D.shiftsOf(doctorId).forEach(function (s) { if (out.indexOf(s.branch) === -1) out.push(s.branch); }); return out;
  };
  /* Doctors of ctx.org with at least one shift in the scoped branch(es). */
  D.doctorsIn = function (ctx) {
    var brs = D.scopeBranches(ctx);
    return D.doctors.filter(function (d) { return d.org === ctx.org && D.doctorBranches(d.id).some(function (b) { return brs.indexOf(b) > -1; }); });
  };
  D.visibilityOf = function (doctorId) { var d = D.doctor(doctorId); return d ? (d.visibility || D.org(d.org).clinicalVisibility) : "org"; };
  D.memberOfDoctor = function (doctorId) { return D.staff.filter(function (m) { return m.doctor === doctorId; })[0] || null; };
  /* display name of a membership (falls back to the linked doctor profile) */
  D.memberName = function (m, lang) { var d = m.doctor ? D.doctor(m.doctor) : null; var r = m.ar ? m : d || m; return lang === "en" ? r.en : r.ar; };
  D.rolesIn = function (m, branchId) {
    return m.grants.filter(function (g) { return g.branches === "all" || g.branches.indexOf(branchId) > -1; }).map(function (g) { return g.role; });
  };

  /* Prices: most specific wins (doctor+branch > doctor > branch > base). */
  D.price = function (serviceId, doctorId, branchId) {
    var s = D.service(serviceId); if (!s) return 0;
    var best = null, bestScore = -1;
    D.prices.forEach(function (p) {
      if (p.service !== serviceId) return;
      if (p.doctor && p.doctor !== doctorId) return;
      if (p.branch && p.branch !== branchId) return;
      var score = (p.doctor ? 2 : 0) + (p.branch ? 1 : 0);
      if (score > bestScore) { best = p; bestScore = score; }
    });
    return best ? best.price : s.base;
  };
  /* Services a doctor offers (their specialties + general ones), priced for a branch. */
  D.servicesFor = function (doctorId, branchId) {
    var d = D.doctor(doctorId); if (!d) return [];
    return D.services.filter(function (s) { return s.org === d.org && (!s.sp || d.sp.indexOf(s.sp) > -1); })
      .map(function (s) { return { service: s, price: D.price(s.id, doctorId, branchId) }; });
  };
  /* headline service for a specialty in an org (consult, or laser session) */
  D.mainService = function (orgId, sp) { return D.services.filter(function (s) { return s.org === orgId && s.sp === sp && s.main; })[0] || null; };

  /* Schedule expansion + conflict detection.
     D.blocks(orgId) -> [{ key, org, shift, room, doctor, sp, day, from, to, branch, conflict: null|"room"|"doctor" }]
     D.conflicts(orgId) -> [{ type: "room"|"doctor", a: block, b: block, from, to }] */
  var blockCache = {};
  D.blocks = function (orgId) {
    if (blockCache[orgId]) return blockCache[orgId];
    var B = [];
    D.shifts.filter(function (s) { return s.org === orgId; }).forEach(function (s) {
      s.days.forEach(function (d) { B.push({ key: s.id + "-" + d, org: s.org, shift: s.id, room: s.room, doctor: s.doctor, sp: s.sp, day: d, from: s.from, to: s.to, branch: s.branch, conflict: null }); });
    });
    var C = [];
    for (var i = 0; i < B.length; i++) for (var j = i + 1; j < B.length; j++) {
      var a = B[i], b = B[j];
      if (a.day !== b.day || !(a.from < b.to && b.from < a.to)) continue;
      var span = { from: Math.max(a.from, b.from), to: Math.min(a.to, b.to) };
      if (a.room === b.room) { a.conflict = b.conflict = "room"; C.push({ type: "room", a: a, b: b, from: span.from, to: span.to }); }
      else if (a.doctor === b.doctor && a.branch !== b.branch) { a.conflict = b.conflict = "doctor"; C.push({ type: "doctor", a: a, b: b, from: span.from, to: span.to }); }
    }
    blockCache[orgId] = B; blockCache[orgId + ":c"] = C;
    return B;
  };
  D.conflicts = function (orgId) { D.blocks(orgId); return blockCache[orgId + ":c"]; };

  /* Appointments / queue */
  D.dayIndex = function (iso) { var p = iso.split("-"); return (new Date(+p[0], +p[1] - 1, +p[2]).getDay() + 1) % 7; }; /* 0 = Sat */
  D.appointmentsOn = function (ctx, date) { return D.scoped("appointments", ctx, function (a) { return a.date === (date || D.today); }).sort(function (a, b) { return a.from - b.from; }); };
  var LIVE = { arrived: 1, waiting: 1, called: 1, inroom: 1 };
  D.queue = function (ctx, date) { return D.appointmentsOn(ctx, date).filter(function (a) { return a.status !== "cancelled"; }); };
  D.isLive = function (a) { return !!LIVE[a.status]; };
  D.patientAppointments = function (patientId) { return D.appointments.filter(function (a) { return a.patient === patientId; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.from - a.from; }); };
  D.patientInvoices = function (patientId) { return D.invoices.filter(function (i) { return i.patient === patientId; }); };

  /* Stock status. Returns { flags: ["low","exp"] | ["ok"] | ["dead"], days, short } */
  function monthEnd(ym) { var p = ym.split("-"); return new Date(+p[0], +p[1], 0); }
  function todayDate() { var p = D.today.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  D.daysTo = function (iso) { var t = iso.length === 7 ? monthEnd(iso) : (function () { var p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); })(); return Math.round((t - todayDate()) / 864e5); };
  D.stockStatus = function (item) {
    var days = D.daysTo(item.expiry), flags = [];
    if (days < 0) flags.push("dead");
    else { if (days <= 60) flags.push("exp"); if (item.qty < item.min) flags.push("low"); }
    if (!flags.length) flags.push("ok");
    return { flags: flags, days: days, short: Math.max(0, item.min - item.qty) };
  };
  /* devices per room (rooms screen "N devices" link) */
  D.devicesIn = function (roomId) { return D.equipment.filter(function (e) { return e.room === roomId; }); };

  /* ---------------- Document numbering (one series per branch) ----------------
     Invoice:  <org invPrefix>-<branch code>-<year>-<6 digits>   e.g. NMC-TOR-2026-003121
     Others:   <kind>-<branch code>-<year>-<6 digits>             e.g. CN-TOR-2026-000007, RCV-UNI-2026-000193
     The patient FILE number stays one sequence per org (no branch prefix). */
  function pad(n, w) { var s = String(n); while (s.length < w) s = "0" + s; return s; }
  D.branchCode = function (branchId) { var b = D.branch(branchId); return b ? b.code : String(branchId || "").toUpperCase(); };
  D.series = function (kind, branchId) { return kind + "-" + D.branchCode(branchId) + "-" + D.today.slice(0, 4) + "-"; };
  D.docNo = function (kind, branchId, seq) { return D.series(kind, branchId) + pad(seq, 6); };
  D.invoiceSeries = function (branchId) { var b = D.branch(branchId); return D.series(D.org(b.org).invPrefix, branchId); };
  D.invoiceNo = function (branchId, seq) { return D.invoiceSeries(branchId) + pad(seq, 6); };
  /* next free number in a series; `extra` = numbers created on the page (strings) */
  D.nextNo = function (prefix, extra) {
    var max = 0;
    D.invoices.forEach(function (i) {
      [i.no, i.creditNote && i.creditNote.no].forEach(function (no) { if (no && no.indexOf(prefix) === 0) max = Math.max(max, +no.slice(prefix.length) || 0); });
    });
    (extra || []).forEach(function (no) { if (no && no.indexOf(prefix) === 0) max = Math.max(max, +no.slice(prefix.length) || 0); });
    return prefix + pad(max + 1, 6);
  };
  D.nextInvoiceNo = function (branchId, extra) { return D.nextNo(D.invoiceSeries(branchId), extra); };

  /* ---------------- Formatting (lang = "ar" | "en") ---------------- */
  var AD = "٠١٢٣٤٥٦٧٨٩";
  D.fmt = {
    t: function (rec, lang) { return rec ? (lang === "en" ? rec.en : rec.ar) : ""; },
    num: function (n, lang) { var s = String(n); return lang === "en" ? s : s.replace(/\d/g, function (d) { return AD[d]; }); },
    /* money uses Latin digits in both languages (matches .t-money in the screens) */
    money: function (n) { return Number(n).toLocaleString("en-US"); },
    hour: function (h, lang) {
      var hh = Math.floor(h), mm = Math.round((h - hh) * 60), pm = hh >= 12, h12 = hh > 12 ? hh - 12 : hh;
      var s = h12 + (mm ? ":" + (mm < 10 ? "0" : "") + mm : "");
      return lang === "en" ? s + (pm ? " pm" : " am") : D.fmt.num(s, "ar") + (pm ? " م" : " ص");
    },
    range: function (a, b, lang) { return D.fmt.hour(a, lang) + "–" + D.fmt.hour(b, lang); },
    day: function (i, lang) { return D.fmt.t(D.days[i], lang); },
    date: function (iso) { var p = iso.split("-"); return (p[2] ? p[2] + "/" : "") + p[1] + "/" + p[0]; }, /* wrap in .t-ltr */
    /* "١٤ نوفمبر" / "14 Nov" (D.months is defined further down) */
    dayMonth: function (iso, lang) { var p = iso.split("-"); return D.fmt.num(+p[2], lang) + " " + D.fmt.t(D.months[+p[1] - 1], lang); },
    pct: function (n, lang) { return lang === "en" ? n + "%" : D.fmt.num(n, "ar") + "٪"; }
  };

  buildInvoices();

  /* ---------------- Scheduling + clinical extras (merged from demo-data-ext.js) ----------------
     D.leaves (full or partial day), D.vitals (nurse readings; today's carry `appointment`),
     D.visits (past visit summaries), plus date/slot/ticket/initials helpers. */
  (function () {
    var F = D.fmt;

    /* ---------------- Dates ---------------- */
    function parse(iso) { var p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function iso(d) { var m = d.getMonth() + 1, x = d.getDate(); return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (x < 10 ? "0" : "") + x; }
    D.addDays = function (s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
    D.months = [
      { ar: "يناير", en: "Jan" }, { ar: "فبراير", en: "Feb" }, { ar: "مارس", en: "Mar" }, { ar: "أبريل", en: "Apr" }, { ar: "مايو", en: "May" }, { ar: "يونيو", en: "Jun" },
      { ar: "يوليو", en: "Jul" }, { ar: "أغسطس", en: "Aug" }, { ar: "سبتمبر", en: "Sep" }, { ar: "أكتوبر", en: "Oct" }, { ar: "نوفمبر", en: "Nov" }, { ar: "ديسمبر", en: "Dec" }
    ];
    /* "السبت ١٤ نوفمبر" / "Sat 14 Nov" (opts: { noDay, year }) */
    F.dateLong = function (s, lang, opts) {
      opts = opts || {};
      var d = parse(s), m = D.months[d.getMonth()];
      var out = (opts.noDay ? "" : F.day(D.dayIndex(s), lang) + " ") + F.num(d.getDate(), lang) + " " + F.t(m, lang);
      return out + (opts.year ? " " + F.num(d.getFullYear(), lang) : "");
    };
    /* 17.5 -> "17:30" for <input type=time> and URLs */
    F.hhmm = function (h) { var hh = Math.floor(h) % 24, mm = Math.round((h - Math.floor(h)) * 60); return (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm; };
    F.fromHHMM = function (s) { if (!s) return null; var p = s.split(":"); return +p[0] + (+p[1] || 0) / 60; };

    /* ---------------- Leaves ----------------
       hours: null = full day(s); otherwise { from, to } on every date in the range.
       past: true + doneAr/En = a closed leave kept for history. */
    D.leaves = [
      { id: "lv1", org: "selim", doctor: "s-ahmed", from: "2026-11-15", to: "2026-11-15", hours: { from: 10, to: 12 },
        ar: "مؤتمر طبي، القاهرة", en: "Medical conference, Cairo" },
      { id: "lv2", org: "selim", doctor: "s-ahmed", from: "2026-12-24", to: "2026-12-26", hours: null, ar: "سفر", en: "Travel" },
      { id: "lv3", org: "selim", doctor: "s-ahmed", from: "2026-10-01", to: "2026-10-01", hours: null, ar: "ظرف شخصي", en: "Personal",
        past: true, doneAr: "انتهت · ٣ اتنقلوا", doneEn: "Past · 3 moved" },
      { id: "lv4", org: "selim", doctor: "s-noha", from: "2026-11-18", to: "2026-11-18", hours: null, ar: "ظرف شخصي", en: "Personal" },
      { id: "lv5", org: "nile", doctor: "n-ahmed", from: "2026-11-15", to: "2026-11-15", hours: { from: 17, to: 19 },
        ar: "مؤتمر طبي، القاهرة", en: "Medical conference, Cairo" },
      { id: "lv6", org: "nile", doctor: "n-marwa", from: "2026-11-17", to: "2026-11-17", hours: null, ar: "إجازة عارضة", en: "Casual leave" },
      { id: "lv7", org: "nile", doctor: "n-heba", from: "2026-11-16", to: "2026-11-16", hours: { from: 16, to: 18 }, ar: "عملية في مستشفى تاني", en: "Surgery at another hospital" }
    ];
    D.leavesOf = function (doctorId) { return D.leaves.filter(function (l) { return l.doctor === doctorId; }).sort(function (a, b) { return a.from < b.from ? -1 : 1; }); };
    /* the leave covering doctor+date (and hour h, if given) */
    D.leaveAt = function (doctorId, s, h) {
      return D.leaves.filter(function (l) {
        if (l.doctor !== doctorId || s < l.from || s > l.to) return false;
        return h == null || !l.hours || (h >= l.hours.from && h < l.hours.to);
      })[0] || null;
    };
    /* live appointments of the doctor that fall inside a leave */
    D.inLeave = function (l) {
      return D.appointments.filter(function (a) {
        return a.doctor === l.doctor && a.date >= l.from && a.date <= l.to && a.status !== "cancelled" &&
          (!l.hours || (a.from >= l.hours.from && a.from < l.hours.to));
      }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.from - b.from; });
    };

    /* ---------------- Slots ----------------
       Booking grid uses 30-min slots; patients per slot = 30 / main service minutes. */
    D.slotLen = 30;
    D.slotPer = function (doctorId) {
      var d = D.doctor(doctorId), s = d && D.mainService(d.org, d.sp[0]);
      return Math.max(1, Math.floor(D.slotLen / (s ? s.minutes : 30)));
    };
    /* shifts of a doctor on a date, optionally limited to branch ids */
    D.shiftsOn = function (doctorId, s, branches) {
      var di = D.dayIndex(s);
      return D.shiftsOf(doctorId).filter(function (x) { return x.days.indexOf(di) > -1 && (!branches || branches.indexOf(x.branch) > -1); })
        .sort(function (a, b) { return a.from - b.from; });
    };
    /* true when the dataset has real appointments for that org + date */
    D.hasDay = function (orgId, s) { return D.appointments.some(function (a) { return a.org === orgId && a.date === s; }); };
    /* deterministic demo load for future dates the dataset does not cover (0..2 per slot) */
    D.demoLoad = function (doctorId, s, h) {
      var k = doctorId + s + h, n = 7;
      for (var i = 0; i < k.length; i++) n = (n * 31 + k.charCodeAt(i)) % 9973;
      return n % 5 > 2 ? 0 : n % 3;
    };
    /* booked (not cancelled) count in one 30-min slot */
    D.slotLoad = function (doctorId, s, h) {
      var d = D.doctor(doctorId);
      if (!d || !D.hasDay(d.org, s)) return d && s > D.today ? Math.min(D.demoLoad(doctorId, s, h), D.slotPer(doctorId)) : 0;
      return D.appointments.filter(function (a) { return a.doctor === doctorId && a.date === s && a.status !== "cancelled" && a.from >= h && a.from < h + D.slotLen / 60; }).length;
    };

    /* ---------------- Queue ticket = room + arrival number in the branch ---------------- */
    D.ticket = function (a) { return a.queueNo ? a.room + "-" + (a.queueNo < 10 ? "0" : "") + a.queueNo : "—"; };
    D.initials = function (rec, lang) {
      var w = F.t(rec, lang).replace(/^(د\.|Dr\.)\s*/, "").split(/\s+/);
      return (w[0] ? w[0].charAt(0) : "") + (w[1] ? (lang === "en" ? "" : " ") + w[1].charAt(0) : "");
    };
    /* doctor who last saw the patient (live/finished visit, else last invoice) */
    D.lastDoctor = function (patientId) {
      var seen = { done: 1, inroom: 1, called: 1, waiting: 1, arrived: 1 };
      var a = D.patientAppointments(patientId).filter(function (x) { return seen[x.status] && x.date <= D.today; })[0];
      if (a) return a.doctor;
      var inv = D.patientInvoices(patientId).sort(function (x, y) { return x.date < y.date ? 1 : -1; })[0];
      return inv ? inv.doctor : null;
    };

    /* ---------------- Vitals (nurse readings) ----------------
       by = staff member id (nurse) or doctor id. bp = [systolic, diastolic]. */
    D.vitals = [
      /* today, sent to the doctor */
      { id: "v1", org: "selim", patient: "s-p10", appointment: "s-a8", date: D.today, at: 17.1, by: "m-s-samar", bp: [118, 76], pulse: 78, temp: 36.8, spo2: 99, weight: 64 },
      { id: "v2", org: "nile", patient: "n-p12", appointment: "n-a11", date: D.today, at: 17.3, by: "m-n-amal", bp: [150, 95], pulse: 88, temp: 37.1, spo2: 98, weight: 80, glucose: 212, glType: "random",
        note: { ar: "صداع من ٣ أيام، بيقول نسي دوا الضغط مرتين الأسبوع ده.", en: "Headache for 3 days, says he missed his BP tablets twice this week." } },
      { id: "v3", org: "nile", patient: "n-p5", appointment: "n-a7", date: D.today, at: 16.9, by: "m-n-amal", temp: 38.6, spo2: 97, weight: 16 },
      { id: "v4", org: "nile", patient: "n-p4", appointment: "n-a10", date: D.today, at: 17.1, by: "m-n-amal", bp: [126, 82], pulse: 92, temp: 37.4, spo2: 96, weight: 88 },
      { id: "v5", org: "nile", patient: "n-p9", appointment: "n-a18", date: D.today, at: 16.9, by: "n-heba", bp: [112, 70], pulse: 84, weight: 68 },
      /* history */
      { id: "v10", org: "nile", patient: "n-p12", appointment: null, date: "2026-10-20", by: "m-n-amal", bp: [140, 90], pulse: 84, weight: 81, height: 168, glucose: 236, glType: "random" },
      { id: "v11", org: "nile", patient: "n-p12", appointment: null, date: "2026-09-14", by: "n-ahmed", bp: [130, 85], pulse: 80, weight: 82, glucose: 188, glType: "random" },
      { id: "v12", org: "selim", patient: "s-p8", appointment: null, date: "2026-10-12", by: "m-s-samar", bp: [110, 70], pulse: 76, weight: 61, height: 162 },
      { id: "v13", org: "nile", patient: "n-p17", appointment: null, date: "2026-10-28", by: "m-n-amal", temp: 37, weight: 14.5, height: 96 },
      { id: "v14", org: "nile", patient: "n-p19", appointment: null, date: "2026-10-30", by: "n-heba", bp: [108, 68], weight: 63, height: 165 },
      { id: "v15", org: "selim", patient: "s-p5", appointment: null, date: "2026-10-03", by: "m-s-samar", temp: 37.8, weight: 18, height: 108 },
      { id: "v16", org: "nile", patient: "n-p18", appointment: null, date: "2026-10-25", by: "m-n-amal", bp: [135, 85], pulse: 76, weight: 90, height: 175 }
    ];
    D.vitalsOf = function (patientId) { return D.vitals.filter(function (v) { return v.patient === patientId; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.at || 0) - (a.at || 0); }); };
    D.vitalsFor = function (apptId) { return D.vitals.filter(function (v) { return v.appointment === apptId; })[0] || null; };
    /* name of whoever took a reading */
    D.byName = function (id, lang) {
      var d = D.doctor(id); if (d) return lang === "en" ? d.shortEn : d.shortAr;
      var m = D.member(id); if (!m) return "";
      var first = F.t(m, lang).split(/\s+/)[0];
      return m.grants.some(function (g) { return g.role === "nurse"; }) ?(lang === "en" ? "Nurse " + first : "الممرضة " + first) : first;
    };

    /* ---------------- Past visits (doctor's summary) ---------------- */
    D.visits = [
      { id: "vs1", org: "nile", branch: "gam", patient: "n-p12", doctor: "n-yasser", date: "2026-11-01", dx: { ar: "كشف أسنان دوري", en: "Routine dental check" }, plan: { ar: "تنضيف جير", en: "Scaling" } },
      { id: "vs2", org: "nile", branch: "tor", patient: "n-p12", doctor: "n-ahmed", date: "2026-10-20", dx: { ar: "ضغط مرتفع (I10) + سكر نوع ٢ (E11)", en: "Essential hypertension (I10) + type 2 diabetes (E11)" },
        plan: { ar: "كونكور ٥ مجم مرة يوميًا، تحليل سكر تراكمي الزيارة الجاية", en: "Concor 5 mg once daily, HbA1c next visit" } },
      { id: "vs3", org: "selim", branch: "main", patient: "s-p8", doctor: "s-noha", date: "2026-10-12", dx: { ar: "حب شباب (L70)", en: "Acne vulgaris (L70)" }, plan: { ar: "كريم موضعي بالليل، مراجعة بعد ٤ أسابيع", en: "Topical cream at night, review in 4 weeks" } },
      { id: "vs4", org: "selim", branch: "main", patient: "s-p10", doctor: "s-noha", date: "2026-10-05", dx: { ar: "التهاب جلد تلامسي (L25)", en: "Contact dermatitis (L25)" }, plan: { ar: "كريم كورتيزون خفيف أسبوع", en: "Mild steroid cream for one week" } },
      { id: "vs5", org: "selim", branch: "main", patient: "s-p5", doctor: "s-noha", date: "2026-10-03", dx: { ar: "إكزيما أطفال (L20)", en: "Childhood eczema (L20)" }, plan: { ar: "مرطب مرتين يوميًا", en: "Emollient twice daily" } },
      { id: "vs6", org: "nile", branch: "tor", patient: "n-p4", doctor: "n-ahmed", date: "2026-11-10", dx: { ar: "التهاب شعبي حاد (J20)", en: "Acute bronchitis (J20)" }, plan: { ar: "مضاد حيوي ٥ أيام، متابعة خلال ١٠ أيام", en: "Antibiotic for 5 days, follow-up within 10 days" } },
      { id: "vs7", org: "nile", branch: "tor", patient: "n-p18", doctor: "n-ahmed", date: "2026-10-25", dx: { ar: "التهاب معدة (K29)", en: "Gastritis (K29)" }, plan: { ar: "مضاد حموضة ٤ أسابيع", en: "Acid reducer for 4 weeks" } },
      { id: "vs8", org: "nile", branch: "tor", patient: "n-p17", doctor: "n-marwa", date: "2026-10-28", dx: { ar: "متابعة نمو", en: "Growth check" }, plan: { ar: "نقط فيتامين د", en: "Vitamin D drops" } },
      { id: "vs9", org: "nile", branch: "gam", patient: "n-p19", doctor: "n-heba", date: "2026-10-30", dx: { ar: "متابعة حمل — الأسبوع ٢٠", en: "Pregnancy follow-up — week 20" }, plan: { ar: "حديد وفوليك، سونار الزيارة الجاية", en: "Iron + folic acid, ultrasound next visit" } },
      { id: "vs10", org: "nile", branch: "gam", patient: "n-p16", doctor: "n-yasser", date: "2026-11-07", dx: { ar: "تسوس ضرس سفلي", en: "Caries, lower molar" }, plan: { ar: "خلع مخطط", en: "Extraction planned" } }
    ];
    D.visitsOf = function (patientId) { return D.visits.filter(function (v) { return v.patient === patientId; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }); };
    /* clinical visibility: may `viewerDoctorId` read a note written by `authorDoctorId`? */
    D.canRead = function (viewerDoctorId, authorDoctorId) {
      return !viewerDoctorId || viewerDoctorId === authorDoctorId || D.visibilityOf(authorDoctorId) !== "own";
    };
  })();

  window.TamargiData = D;
})();

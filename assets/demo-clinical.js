/* Tamargi prototype — FAKE clinical demo content (window.TamargiClinical).
   Load AFTER demo-data.js and BEFORE shell.js on clinical screens
   (visit-note, prescription-builder, prescription-print, rx-favourites, settings-templates).
   Holds what demo-data.js does not: drug lines, Rx favourites and sets, visit templates,
   ICD-10 labels, exam rows and text shortcuts, all keyed by SPECIALTY (the specialty belongs
   to the doctor: tenancy-model §3 rule 1), plus helpers that turn a demo appointment into a
   "current visit" (patient, doctor, branch, room, history, letterhead).
   Drug names are public trade names; usage counts and everything else are invented.
   Plain ES5, works from file://. */
(function () {
  "use strict";
  var D = window.TamargiData;
  if (!D) return;
  var K = {};

  /* ---------- Vocabularies (Arabic is printed on the Rx; English shown in the UI) ---------- */
  K.FREQ = [["مرة يوميًا", "Once daily"], ["مرتين يوميًا", "Twice daily"], ["٣ مرات يوميًا", "3 times daily"], ["كل ٦ ساعات", "Every 6 h"], ["كل ٨ ساعات", "Every 8 h"], ["كل ١٢ ساعة", "Every 12 h"], ["قبل النوم", "At bedtime"], ["عند اللزوم", "As needed"]];
  K.DUR = [["٣ أيام", "3 days"], ["٥ أيام", "5 days"], ["٧ أيام", "7 days"], ["١٠ أيام", "10 days"], ["١٤ يوم", "14 days"], ["شهر", "1 month"], ["مستمر", "Ongoing"], ["عند اللزوم", "As needed"]];
  K.INSTR = [["بعد الأكل", "After meals"], ["قبل الأكل", "Before meals"], ["على الريق", "Empty stomach"], ["قبل النوم", "At bedtime"], ["مع الأكل", "With meals"], ["", "None"]];
  K.INSTR_EN = { "بعد الأكل": "After meals", "قبل الأكل": "Before meals", "على الريق": "Empty stomach", "قبل النوم": "At bedtime", "مع الأكل": "With meals",
    "لا تزيد عن ٥ أيام": "Max 5 days", "في نص كوب ماء": "In ½ glass of water", "عند المغص": "For colic", "بعد كل مرة إسهال": "After each loose stool",
    "طبقة رفيعة": "Thin layer", "بالليل على الوش كله": "At night, whole face", "قبل الخروج بنص ساعة": "30 min before going out", "مضمضة ثم تفل": "Rinse, then spit" };
  K.FAM = { penicillin: ["بنسلين", "Penicillin"], nsaid: ["مسكنات NSAID", "NSAID"], macrolide: ["ماكروليد", "Macrolide"], ceph: ["سيفالوسبورين", "Cephalosporin"], sulfa: ["سلفا", "Sulfa"], tetra: ["تتراسيكلين", "Tetracycline"] };
  K.FORM_EN = { "أقراص": "Tablets", "كبسول": "Capsules", "شراب": "Syrup", "معلق": "Suspension", "بخاخ أنف": "Nasal spray", "أكياس": "Sachets", "كريم / مرهم": "Cream / ointment", "جل": "Gel", "حقن": "Injection", "نقط": "Drops", "أقراص فوار": "Effervescent", "غسول فم": "Mouthwash", "استحلاب": "Lozenges" };
  K.MONTHS = { ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"], en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] };
  K.PEN = /amox|augmentin|penicil|ampicil|cloxacil|unasyn|megamox|hibiotic|curam|e-?mox|fluclox/i;

  /* ---------- Drug lines: id -> {drug, g (generic), form, dose, doseEn, freq, dur, instr, fam?, preg?} ---------- */
  function R(drug, g, form, dose, doseEn, freq, dur, instr, extra) {
    var r = { drug: drug, g: g, form: form, dose: dose, doseEn: doseEn, freq: freq, dur: dur, instr: instr || "" };
    if (extra) for (var k in extra) r[k] = extra[k];
    return r;
  }
  K.drugs = {
    /* general / internal medicine */
    panadol:    R("Panadol 500 mg", "paracetamol", "أقراص", "قرص", "1 tab", "كل ٨ ساعات", "٥ أيام", "بعد الأكل"),
    congestal:  R("Congestal", "paracetamol + pseudoephedrine", "أقراص", "قرص", "1 tab", "مرتين يوميًا", "٣ أيام", "بعد الأكل", { preg: true }),
    augmentin:  R("Augmentin 1 g", "amoxicillin + clavulanate", "أقراص", "قرص", "1 tab", "كل ١٢ ساعة", "٧ أيام", "بعد الأكل", { fam: "penicillin" }),
    controloc:  R("Controloc 40 mg", "pantoprazole", "أقراص", "قرص", "1 tab", "مرة يوميًا", "١٤ يوم", "على الريق"),
    concor:     R("Concor 5 mg", "bisoprolol", "أقراص", "قرص", "1 tab", "مرة يوميًا", "مستمر", "بعد الأكل"),
    brufen:     R("Brufen 400 mg", "ibuprofen", "أقراص", "قرص", "1 tab", "كل ١٢ ساعة", "٣ أيام", "بعد الأكل", { fam: "nsaid", preg: true }),
    xithrone:   R("Xithrone 500 mg", "azithromycin", "كبسول", "كبسولة", "1 cap", "مرة يوميًا", "٣ أيام", "قبل الأكل", { fam: "macrolide" }),
    klacid:     R("Klacid 500 mg", "clarithromycin", "أقراص", "قرص", "1 tab", "كل ١٢ ساعة", "٧ أيام", "بعد الأكل", { fam: "macrolide" }),
    antinal:    R("Antinal 200 mg", "nifuroxazide", "كبسول", "كبسولة", "1 cap", "كل ٦ ساعات", "٣ أيام", ""),
    otrivin:    R("Otrivin 0.1% nasal spray", "xylometazoline", "بخاخ أنف", "بخة بكل فتحة", "1 puff/nostril", "مرتين يوميًا", "٥ أيام", "لا تزيد عن ٥ أيام"),
    buscopan:   R("Buscopan 10 mg", "hyoscine", "أقراص", "قرص", "1 tab", "٣ مرات يوميًا", "عند اللزوم", "عند المغص"),
    telfast:    R("Telfast 120 mg", "fexofenadine", "أقراص", "قرص", "1 tab", "مرة يوميًا", "٧ أيام", ""),
    glucophage: R("Glucophage 500 mg", "metformin", "أقراص", "قرص", "1 tab", "مرتين يوميًا", "مستمر", "مع الأكل"),
    mucosolvan: R("Mucosolvan syrup", "ambroxol", "شراب", "١٠ مل", "10 ml", "٣ مرات يوميًا", "٧ أيام", "بعد الأكل"),
    vitacid:    R("Vitacid C 500 mg effervescent", "vitamin C", "أقراص فوار", "قرص فوار", "1 eff. tab", "مرة يوميًا", "١٠ أيام", "في نص كوب ماء"),
    strepsils:  R("Strepsils lozenges", "amylmetacresol", "استحلاب", "استحلاب", "1 lozenge", "كل ٦ ساعات", "٥ أيام", ""),
    rehydran:   R("Rehydran sachets", "ORS", "أكياس", "كيس في كوب ماء", "1 sachet", "عند اللزوم", "٣ أيام", "بعد كل مرة إسهال"),
    nexium:     R("Nexium 40 mg", "esomeprazole", "أقراص", "قرص", "1 tab", "مرة يوميًا", "١٤ يوم", "على الريق"),
    motilium:   R("Motilium 10 mg", "domperidone", "أقراص", "قرص", "1 tab", "٣ مرات يوميًا", "٧ أيام", "قبل الأكل"),
    gaviscon:   R("Gaviscon Advance susp.", "alginate", "معلق", "١٠ مل", "10 ml", "٣ مرات يوميًا", "عند اللزوم", "بعد الأكل"),
    /* dermatology / laser */
    zyrtec:     R("Zyrtec 10 mg", "cetirizine", "أقراص", "قرص", "1 tab", "قبل النوم", "١٤ يوم", ""),
    fucidin:    R("Fucidin 2% cream", "fusidic acid", "كريم / مرهم", "دهان", "apply", "مرتين يوميًا", "٧ أيام", "طبقة رفيعة"),
    differin:   R("Differin 0.1% gel", "adapalene", "جل", "دهان", "apply", "قبل النوم", "شهر", "بالليل على الوش كله", { preg: true }),
    lamisil:    R("Lamisil 1% cream", "terbinafine", "كريم / مرهم", "دهان", "apply", "مرتين يوميًا", "١٤ يوم", "طبقة رفيعة"),
    fluclox:    R("Flucloxacillin 500 mg", "flucloxacillin", "كبسول", "كبسولة", "1 cap", "كل ٦ ساعات", "٧ أيام", "قبل الأكل", { fam: "penicillin" }),
    betnovate:  R("Betnovate 0.1% cream", "betamethasone", "كريم / مرهم", "دهان", "apply", "مرتين يوميًا", "٧ أيام", "طبقة رفيعة"),
    doxy:       R("Vibramycin 100 mg", "doxycycline", "كبسول", "كبسولة", "1 cap", "مرة يوميًا", "شهر", "بعد الأكل", { fam: "tetra", preg: true }),
    sunblock:   R("Sunscreen SPF 50+ cream", "sunscreen", "كريم / مرهم", "دهان", "apply", "مرتين يوميًا", "مستمر", "قبل الخروج بنص ساعة"),
    /* paediatrics (child doses) */
    cetal:      R("Cetal syrup 120 mg/5 ml", "paracetamol", "شراب", "٥ مل", "5 ml", "كل ٦ ساعات", "عند اللزوم", ""),
    brufenSyr:  R("Brufen syrup 100 mg/5 ml", "ibuprofen", "شراب", "٥ مل", "5 ml", "كل ٨ ساعات", "٣ أيام", "بعد الأكل", { fam: "nsaid" }),
    augSusp:    R("Augmentin 457 mg/5 ml susp.", "amoxicillin + clavulanate", "معلق", "٥ مل", "5 ml", "كل ١٢ ساعة", "٧ أيام", "بعد الأكل", { fam: "penicillin" }),
    zithroSusp: R("Zithromax 200 mg/5 ml susp.", "azithromycin", "معلق", "٥ مل", "5 ml", "مرة يوميًا", "٣ أيام", "قبل الأكل", { fam: "macrolide" }),
    otrivinPed: R("Otrivin 0.05% paediatric drops", "xylometazoline", "نقط", "نقطة بكل فتحة", "1 drop/nostril", "مرتين يوميًا", "٣ أيام", ""),
    /* ENT */
    ciprodex:   R("Ciprodex ear drops", "ciprofloxacin + dexamethasone", "نقط", "٤ نقط بالأذن", "4 drops", "مرتين يوميًا", "٧ أيام", ""),
    avamys:     R("Avamys nasal spray", "fluticasone furoate", "بخاخ أنف", "بختين بكل فتحة", "2 puffs/nostril", "مرة يوميًا", "شهر", ""),
    /* dental */
    flagyl:     R("Flagyl 500 mg", "metronidazole", "أقراص", "قرص", "1 tab", "كل ٨ ساعات", "٧ أيام", "بعد الأكل", { preg: true }),
    panadolX:   R("Panadol Extra", "paracetamol + caffeine", "أقراص", "قرص", "1 tab", "كل ٨ ساعات", "٣ أيام", "بعد الأكل"),
    hexitol:    R("Hexitol mouthwash", "chlorhexidine", "غسول فم", "١٥ مل", "15 ml", "مرتين يوميًا", "٧ أيام", "مضمضة ثم تفل"),
    /* OB/GYN */
    folic:      R("Folic acid 5 mg", "folic acid", "أقراص", "قرص", "1 tab", "مرة يوميًا", "مستمر", ""),
    feroglobin: R("Feroglobin capsules", "iron + vitamins", "كبسول", "كبسولة", "1 cap", "مرة يوميًا", "شهر", "بعد الأكل"),
    calmag:     R("Cal-Mag tablets", "calcium + magnesium", "أقراص", "قرص", "1 tab", "مرتين يوميًا", "شهر", "بعد الأكل"),
    gynodakt:   R("Gyno-Daktarin vaginal cream", "miconazole", "كريم / مرهم", "أبلكيتور", "1 applicator", "قبل النوم", "٧ أيام", "")
  };
  K.drug = function (id) { return K.drugs[id] || null; };

  /* ---------- Specialty -> which content pack (laser shares the derma pack) ---------- */
  K.packOf = function (sp) { return sp === "laser" ? "derma" : sp; };

  /* ---------- Rx favourites per specialty pack: [drugId, uses, lastAr, lastEn] (order = builder order) ---------- */
  K.favs = {
    im:    [["panadol", 212, "اليوم", "Today"], ["congestal", 164, "أمس", "Yesterday"], ["augmentin", 131, "أمس", "Yesterday"], ["controloc", 120, "١٢ نوفمبر", "12 Nov"],
            ["concor", 104, "اليوم", "Today"], ["brufen", 97, "١٣ نوفمبر", "13 Nov"], ["xithrone", 88, "اليوم", "Today"], ["antinal", 76, "١٠ نوفمبر", "10 Nov"],
            ["otrivin", 69, "اليوم", "Today"], ["buscopan", 54, "٩ نوفمبر", "9 Nov"], ["telfast", 45, "٢ نوفمبر", "2 Nov"], ["glucophage", 44, "أمس", "Yesterday"],
            ["klacid", 41, "٨ نوفمبر", "8 Nov"], ["vitacid", 38, "اليوم", "Today"]],
    derma: [["zyrtec", 140, "اليوم", "Today"], ["fucidin", 122, "اليوم", "Today"], ["differin", 98, "أمس", "Yesterday"], ["lamisil", 81, "١٢ نوفمبر", "12 Nov"],
            ["fluclox", 60, "١١ نوفمبر", "11 Nov"], ["betnovate", 55, "أمس", "Yesterday"], ["doxy", 47, "١٠ نوفمبر", "10 Nov"], ["sunblock", 38, "اليوم", "Today"]],
    peds:  [["cetal", 188, "اليوم", "Today"], ["augSusp", 121, "اليوم", "Today"], ["brufenSyr", 96, "أمس", "Yesterday"], ["zithroSusp", 72, "١٢ نوفمبر", "12 Nov"],
            ["otrivinPed", 64, "أمس", "Yesterday"], ["rehydran", 58, "١٣ نوفمبر", "13 Nov"], ["mucosolvan", 40, "٩ نوفمبر", "9 Nov"]],
    ent:   [["augmentin", 102, "اليوم", "Today"], ["avamys", 90, "أمس", "Yesterday"], ["ciprodex", 77, "اليوم", "Today"], ["otrivin", 70, "١٢ نوفمبر", "12 Nov"],
            ["brufen", 61, "أمس", "Yesterday"], ["telfast", 44, "١٠ نوفمبر", "10 Nov"], ["xithrone", 39, "٨ نوفمبر", "8 Nov"]],
    dent:  [["brufen", 150, "اليوم", "Today"], ["augmentin", 98, "اليوم", "Today"], ["flagyl", 74, "أمس", "Yesterday"], ["panadolX", 66, "١٣ نوفمبر", "13 Nov"], ["hexitol", 59, "أمس", "Yesterday"]],
    gyn:   [["folic", 133, "اليوم", "Today"], ["feroglobin", 109, "اليوم", "Today"], ["calmag", 92, "أمس", "Yesterday"], ["gynodakt", 57, "١٢ نوفمبر", "12 Nov"],
            ["flagyl", 41, "١٠ نوفمبر", "10 Nov"], ["panadol", 37, "أمس", "Yesterday"]]
  };
  /* Rx sets per pack */
  K.sets = {
    im:    [{ ar: "نزلة برد — بالغين", en: "URTI — adult", dx: "J06.9", items: ["panadol", "congestal", "otrivin", "vitacid"], uses: 58 },
            { ar: "التهاب حلق بكتيري", en: "Bacterial sore throat", dx: "J02.9", items: ["augmentin", "panadol", "vitacid"], uses: 41 },
            { ar: "نزلة معوية", en: "Gastroenteritis", dx: "A09", items: ["antinal", "buscopan"], uses: 27 },
            { ar: "حموضة وارتجاع", en: "Reflux / GERD", dx: "K21.9", items: ["controloc"], uses: 19 },
            { ar: "حساسية موسمية", en: "Seasonal allergy", dx: "J30.2", items: ["telfast", "otrivin"], uses: 12 }],
    derma: [{ ar: "حب شباب متوسط", en: "Moderate acne", dx: "L70.0", items: ["differin", "doxy", "sunblock"], uses: 44 },
            { ar: "فطريات جلد", en: "Tinea corporis", dx: "B35.4", items: ["lamisil", "zyrtec"], uses: 31 },
            { ar: "قوباء (إمبتيجو)", en: "Impetigo", dx: "L01.0", items: ["fucidin", "fluclox"], uses: 18 },
            { ar: "إكزيما", en: "Eczema", dx: "L30.9", items: ["betnovate", "zyrtec"], uses: 15 }],
    peds:  [{ ar: "التهاب لوز (أطفال)", en: "Tonsillitis — child", dx: "J03.9", items: ["augSusp", "cetal"], uses: 52 },
            { ar: "نزلة برد (أطفال)", en: "URTI — child", dx: "J06.9", items: ["cetal", "otrivinPed", "mucosolvan"], uses: 47 },
            { ar: "نزلة معوية (أطفال)", en: "Gastroenteritis — child", dx: "A09", items: ["rehydran", "cetal"], uses: 22 }],
    ent:   [{ ar: "التهاب أذن خارجية", en: "Otitis externa", dx: "H60.9", items: ["ciprodex", "brufen"], uses: 33 },
            { ar: "التهاب جيوب", en: "Acute sinusitis", dx: "J01.9", items: ["augmentin", "avamys", "otrivin"], uses: 29 },
            { ar: "حساسية أنف", en: "Allergic rhinitis", dx: "J30.4", items: ["avamys", "telfast"], uses: 21 }],
    dent:  [{ ar: "خراج سن", en: "Dental abscess", dx: "K04.7", items: ["augmentin", "flagyl", "brufen"], uses: 38 },
            { ar: "بعد الخلع", en: "After extraction", dx: "K08.1", items: ["brufen", "hexitol"], uses: 26 }],
    gyn:   [{ ar: "مكملات الحمل", en: "Pregnancy supplements", dx: "Z34.9", items: ["folic", "feroglobin", "calmag"], uses: 61 },
            { ar: "التهاب مهبلي فطري", en: "Vaginal candidiasis", dx: "B37.3", items: ["gynodakt"], uses: 23 }]
  };

  /* ---------- ICD-10 labels used by the demo ---------- */
  K.icd = {
    "I10": ["ضغط مرتفع أساسي", "Essential hypertension"], "E11.9": ["سكر نوع ٢", "Type 2 diabetes mellitus"], "E03.9": ["قصور الغدة الدرقية", "Hypothyroidism"],
    "K29.7": ["التهاب المعدة", "Gastritis, unspecified"], "K30": ["عسر هضم وظيفي", "Functional dyspepsia"], "K21.9": ["ارتجاع المريء", "Gastro-oesophageal reflux"],
    "J02.9": ["التهاب البلعوم الحاد", "Acute pharyngitis"], "J03.9": ["التهاب اللوزتين الحاد", "Acute tonsillitis"], "J06.9": ["عدوى الجهاز التنفسي العلوي", "Acute upper respiratory infection"],
    "J01.9": ["التهاب الجيوب الحاد", "Acute sinusitis"], "J30.2": ["حساسية موسمية", "Seasonal allergic rhinitis"], "J30.4": ["حساسية الأنف", "Allergic rhinitis"],
    "A09": ["نزلة معوية", "Infectious gastroenteritis"], "R51": ["صداع", "Headache"], "D50.9": ["أنيميا نقص الحديد", "Iron deficiency anaemia"], "N39.0": ["التهاب مسالك بولية", "Urinary tract infection"],
    "L70.0": ["حب الشباب", "Acne vulgaris"], "B35.4": ["فطريات الجلد", "Tinea corporis"], "L01.0": ["قوباء", "Impetigo"], "L30.9": ["إكزيما", "Dermatitis, unspecified"],
    "H60.9": ["التهاب الأذن الخارجية", "Otitis externa"], "H66.9": ["التهاب الأذن الوسطى", "Otitis media"], "K04.7": ["خراج حول الجذر", "Periapical abscess"], "K02.9": ["تسوس الأسنان", "Dental caries"],
    "K08.1": ["فقد سن بالخلع", "Tooth loss after extraction"], "Z34.9": ["متابعة حمل طبيعي", "Normal pregnancy supervision"], "B37.3": ["فطريات مهبلية", "Vaginal candidiasis"], "N76.0": ["التهاب مهبلي", "Acute vaginitis"]
  };
  /* chronic condition (patients[].chronic[].en) -> ICD + continuing drug */
  K.chronic = { "Diabetes": { icd: "E11.9", drug: "glucophage" }, "Hypertension": { icd: "I10", drug: "concor" } };

  /* ---------- Visit templates per pack ----------
     rx / svc are ticked (applied); rxOff / svcOff are "suggested only".
     svc codes resolve to the org's own service through K.service(code, org). */
  function T(id, ar, en, uses, dx, rx, svc, soap, extra) {
    var t = { id: id, ar: ar, en: en, uses: uses, dx: dx, rx: rx, svc: svc || [], s: soap[0], o: soap[1], p: soap[2], rxOff: [], svcOff: [] };
    if (extra) for (var k in extra) t[k] = extra[k];
    return t;
  }
  K.templates = {
    im: [
      T("htn", "متابعة ضغط مرتفع", "Hypertension follow-up", 112, ["I10"], ["concor"], ["ecg"],
        [{ ar: "صداع الصبح، ملتزم بالعلاج ___ ، مفيش ألم صدر.", en: "Morning headache, adherent to treatment ___, no chest pain." },
         { ar: "الضغط ___/___، النبض ___، القلب والصدر طبيعي.", en: "BP ___/___, pulse ___, heart and chest normal." },
         { ar: "تقليل الملح، مشي ٣٠ دقيقة يوميًا، قياس الضغط في البيت وتسجيله.", en: "Low-salt diet, walk 30 min daily, record home BP." }]),
      T("dm", "متابعة سكر نوع ٢", "Type 2 diabetes follow-up", 97, ["E11.9"], ["glucophage"], [],
        [{ ar: "متابعة سكر، مفيش أعراض هبوط.", en: "Diabetes follow-up, no hypo symptoms." },
         { ar: "سكر صايم ___، فاطر ___، القدم سليمة.", en: "FBS ___, PPBS ___, feet intact." },
         { ar: "نظام أكل السكر، تحليل تراكمي كل ٣ شهور.", en: "Diabetic diet, HbA1c every 3 months." }]),
      T("gas", "التهاب معدة / عسر هضم", "Gastritis / dyspepsia", 86, ["K29.7", "K30"], ["nexium", "motilium"], [],
        [{ ar: "ألم وحرقان في أعلى البطن بعد الأكل منذ ___ أسابيع، مع انتفاخ. لا يوجد قيء دموي أو براز أسود.", en: "Epigastric burning after meals for ___ weeks, with bloating. No haematemesis or melaena." },
         { ar: "ألم عند الضغط في منطقة فم المعدة. البطن لينة، لا يوجد تضخم بالكبد أو الطحال.", en: "Epigastric tenderness. Soft abdomen, no hepatosplenomegaly." },
         { ar: "تجنب الأكل الحار والمقلي والمنبهات. وجبات صغيرة. عدم النوم بعد الأكل مباشرة.", en: "Avoid spicy and fried food and stimulants. Small meals. Do not lie down right after eating." }],
        { rxOff: ["gaviscon"] }),
      T("throat", "التهاب حلق بكتيري", "Bacterial sore throat", 73, ["J02.9"], ["augmentin", "panadol", "strepsils"], [],
        [{ ar: "التهاب في الزور وسخونية من ___ أيام.", en: "Sore throat and fever for ___ days." },
         { ar: "احمرار في البلعوم واللوز، صديد ___.", en: "Congested pharynx and tonsils, exudate ___." },
         { ar: "سوائل دافية، راحة، ومتابعة لو السخونية استمرت ٣ أيام.", en: "Warm fluids, rest; return if fever lasts 3 days." }]),
      T("ge", "نزلة معوية", "Gastroenteritis", 58, ["A09"], ["antinal", "rehydran"], ["inj"],
        [{ ar: "إسهال ___ مرات وقيء من امبارح.", en: "Diarrhoea ___ times and vomiting since yesterday." },
         { ar: "البطن لينة، علامات جفاف ___.", en: "Soft abdomen, dehydration signs ___." },
         { ar: "محلول جفاف بعد كل مرة إسهال، أكل خفيف.", en: "ORS after each loose stool, light diet." }]),
      T("gerd", "ارتجاع المريء", "Reflux (GERD)", 41, ["K21.9"], ["controloc"], [],
        [{ ar: "حرقان خلف عظمة الصدر بالليل.", en: "Retrosternal burning at night." },
         { ar: "الفحص طبيعي.", en: "Examination normal." },
         { ar: "رفع راس السرير، آخر وجبة قبل النوم بـ٣ ساعات.", en: "Raise the bed head; last meal 3 h before sleep." }],
        { rxOff: ["gaviscon"] })
    ],
    derma: [
      T("acne", "حب شباب متوسط", "Moderate acne", 64, ["L70.0"], ["differin", "doxy", "sunblock"], [],
        [{ ar: "حبوب في الوش من ___ شهور.", en: "Facial spots for ___ months." },
         { ar: "حبوب ملتهبة ورؤوس سودا على الخدود والجبهة.", en: "Inflamed papules and comedones on cheeks and forehead." },
         { ar: "غسول لطيف مرتين، ممنوع العصر، واقي شمس يوميًا.", en: "Gentle wash twice daily, no squeezing, daily sunscreen." }]),
      T("tinea", "فطريات جلد", "Tinea corporis", 37, ["B35.4"], ["lamisil", "zyrtec"], [],
        [{ ar: "بقعة بتهرش من ___ أسابيع.", en: "Itchy patch for ___ weeks." },
         { ar: "بقعة حلقية حوافها مرتفعة.", en: "Annular plaque with raised edge." },
         { ar: "تنشيف كويس، فوطة شخصية.", en: "Keep dry, personal towel." }]),
      T("impetigo", "قوباء (إمبتيجو)", "Impetigo", 21, ["L01.0"], ["fucidin", "fluclox"], [],
        [{ ar: "قشور عسلية حوالين البق والمناخير.", en: "Honey-coloured crusts around mouth and nose." },
         { ar: "قشور على قاعدة حمرا، مفيش سخونية.", en: "Crusts on red base, afebrile." },
         { ar: "غسيل بالمية والصابون، أدوات شخصية.", en: "Soap-and-water cleansing, personal items." }])
    ],
    peds: [
      T("ton", "التهاب لوز (أطفال)", "Tonsillitis (child)", 73, ["J03.9"], ["augSusp", "cetal"], [],
        [{ ar: "سخونية وألم في الزور من ___ أيام، الأكل قليل.", en: "Fever and sore throat for ___ days, eating less." },
         { ar: "اللوز متضخم وعليه صديد، الوزن ___ كجم.", en: "Enlarged tonsils with exudate, weight ___ kg." },
         { ar: "الجرعة محسوبة على الوزن، سوائل كتير.", en: "Weight-based dose, plenty of fluids." }]),
      T("urti-c", "نزلة برد (أطفال)", "URTI (child)", 52, ["J06.9"], ["cetal", "otrivinPed"], ["neb"],
        [{ ar: "رشح وكحة من ___ أيام.", en: "Runny nose and cough for ___ days." },
         { ar: "الصدر سليم، الأذن سليمة.", en: "Chest clear, ears normal." },
         { ar: "غسيل أنف بمحلول ملح، متابعة لو النفس اتغير.", en: "Saline nose wash; return if breathing changes." }],
        { svcOff: ["neb"], svc: [] })
    ],
    ent: [
      T("oe", "التهاب أذن خارجية", "Otitis externa", 33, ["H60.9"], ["ciprodex", "brufen"], [],
        [{ ar: "ألم في الأذن ___ بعد البحر/الحمام.", en: "Ear pain ___ after swimming/bath." },
         { ar: "قناة الأذن ملتهبة، الطبلة سليمة.", en: "Inflamed ear canal, intact drum." },
         { ar: "الأذن ناشفة، ممنوع أعواد القطن.", en: "Keep ear dry, no cotton buds." }]),
      T("sinus", "التهاب جيوب", "Acute sinusitis", 29, ["J01.9"], ["augmentin", "avamys"], [],
        [{ ar: "صداع وانسداد في الأنف من ___ أيام.", en: "Headache and blocked nose for ___ days." },
         { ar: "إفرازات صديدية، ألم عند الضغط على الجيوب.", en: "Purulent discharge, sinus tenderness." },
         { ar: "بخار، غسيل أنف.", en: "Steam inhalation, nasal wash." }],
        { svcOff: ["scope"] })
    ],
    dent: [
      T("abscess", "خراج سن", "Dental abscess", 38, ["K04.7"], ["augmentin", "flagyl", "brufen"], [],
        [{ ar: "ألم شديد وتورم في سن ___.", en: "Severe pain and swelling at tooth ___." },
         { ar: "ألم عند الطرق، تورم في اللثة.", en: "Tender to percussion, gingival swelling." },
         { ar: "مضمضة مية دافية وملح، ميعاد علاج عصب.", en: "Warm salt rinses; book root-canal visit." }],
        { svcOff: ["ext"] }),
      T("caries", "تسوس — حشو", "Caries — filling", 26, ["K02.9"], ["panadolX", "hexitol"], ["fill"],
        [{ ar: "حساسية من البارد في سن ___.", en: "Cold sensitivity at tooth ___." },
         { ar: "تسوس متوسط، مفيش ألم عند الطرق.", en: "Moderate caries, no percussion pain." },
         { ar: "فرشة مرتين، خيط أسنان.", en: "Brush twice daily, floss." }])
    ],
    gyn: [
      T("anc", "متابعة حمل", "Antenatal visit", 61, ["Z34.9"], ["folic", "feroglobin", "calmag"], ["us"],
        [{ ar: "حامل في الأسبوع ___، مفيش نزيف أو ألم.", en: "Pregnant ___ weeks, no bleeding or pain." },
         { ar: "الضغط ___، ارتفاع الرحم ___، نبض الجنين ___.", en: "BP ___, fundal height ___, FHR ___." },
         { ar: "مكملات يومية، ميعاد السونار الجاي.", en: "Daily supplements; next scan date." }]),
      T("cand", "التهاب مهبلي فطري", "Vaginal candidiasis", 23, ["B37.3"], ["gynodakt"], [],
        [{ ar: "إفرازات وهرش من ___ أيام.", en: "Discharge and itching for ___ days." },
         { ar: "إفرازات بيضا متجبنة.", en: "White curd-like discharge." },
         { ar: "ملابس قطن، تجنب الغسولات المعطرة.", en: "Cotton underwear, avoid scented washes." }])
    ]
  };
  /* Specialty exam rows (only the doctor's own specialty tab is shown in the visit) */
  K.exam = {
    im:    { ar: "فحص الباطنة", en: "Internal medicine exam", rows: [["general", "الحالة العامة", "General"], ["chest", "الصدر", "Chest"], ["heart", "القلب", "Heart"], ["abd", "البطن", "Abdomen"], ["throat", "الزور", "Throat"], ["ll", "الرجلين (تورم)", "Legs (oedema)"]] },
    derma: { ar: "فحص الجلدية", en: "Dermatology exam", rows: [["lesion", "نوع الطفح", "Lesion type"], ["dist", "التوزيع", "Distribution"], ["nails", "الشعر والضوافر", "Hair & nails"], ["inf", "عدوى ثانوية", "Secondary infection"]] },
    peds:  { ar: "فحص الأطفال", en: "Paediatric exam", rows: [["hyd", "الحالة والجفاف", "General & hydration"], ["throat", "الزور واللوز", "Throat & tonsils"], ["ears", "الأذن", "Ears"], ["chest", "الصدر", "Chest"], ["growth", "الوزن للسن", "Weight for age"]] },
    ent:   { ar: "فحص الأنف والأذن", en: "ENT exam", rows: [["ear", "الأذن (منظار)", "Ears (otoscopy)"], ["nose", "الأنف", "Nose"], ["throat", "الحلق", "Throat"], ["neck", "غدد الرقبة", "Neck nodes"]] },
    dent:  { ar: "فحص الأسنان", en: "Dental exam", rows: [["perc", "الطرق على السن", "Percussion"], ["gum", "اللثة", "Gums"], ["swell", "التورم", "Swelling"], ["occl", "الإطباق", "Occlusion"]] },
    gyn:   { ar: "فحص النسا", en: "OB/GYN exam", rows: [["bp", "الضغط", "Blood pressure"], ["fundus", "ارتفاع الرحم", "Fundal height"], ["fhr", "نبض الجنين", "Fetal heart"], ["oed", "التورم", "Oedema"]] }
  };
  /* Text shortcuts: owner "org" = whole organization, otherwise a specialty pack (doctor-level) */
  K.shortcuts = [
    { k: "/fu",   owner: "org",   ar: "متابعة بعد أسبوعين ومعاه نتيجة التحاليل", uses: 156 },
    { k: "/cbc",  owner: "org",   ar: "CBC, ESR, CRP", uses: 142 },
    { k: "/lft",  owner: "im",    ar: "ALT, AST, Albumin, Bilirubin (T & D)", uses: 88 },
    { k: "/neg",  owner: "im",    ar: "لا يوجد سخونية أو قيء أو إسهال", uses: 131 },
    { k: "/htn",  owner: "im",    ar: "الضغط ___/___ على Concor 5 مرة يوميًا، ملتزم بالعلاج", uses: 104 },
    { k: "/diet", owner: "im",    ar: "تجنب الأكل الحار والمقلي والمنبهات، وجبات صغيرة", uses: 77 },
    { k: "/acne", owner: "derma", ar: "غسول لطيف مرتين يوميًا، ممنوع العصر، واقي شمس", uses: 58 },
    { k: "/wt",   owner: "peds",  ar: "الوزن ___ كجم، الجرعة محسوبة على الوزن", uses: 61 },
    { k: "/oto",  owner: "ent",   ar: "الطبلة سليمة، القناة نظيفة", uses: 33 },
    { k: "/perc", owner: "dent",  ar: "ألم عند الطرق على سن ___", uses: 29 },
    { k: "/anc",  owner: "gyn",   ar: "الضغط ___، ارتفاع الرحم ___، نبض الجنين ___", uses: 47 }
  ];
  /* Specialty pack catalogue (counts shown on settings-templates and rx-favourites import) */
  K.packs = [
    { sp: "im",    templates: 14, favs: 38, shortcuts: 22, services: 9,  ver: "2026.10" },
    { sp: "peds",  templates: 12, favs: 45, shortcuts: 18, services: 4,  ver: "2026.10" },
    { sp: "gyn",   templates: 16, favs: 30, shortcuts: 11, services: 11, ver: "2026.09" },
    { sp: "derma", templates: 10, favs: 34, shortcuts: 12, services: 12, ver: "2026.10" },
    { sp: "ent",   templates: 9,  favs: 26, shortcuts: 6,  services: 6,  ver: "2026.08" },
    { sp: "dent",  templates: 0,  favs: 18, shortcuts: 5,  services: 14, ver: "—", later: true }
  ];
  /* Pack import candidates per pack (rx-favourites "Import specialty pack"): drug ids not always in the favourites */
  K.packDrugs = {
    im: ["panadol", "augmentin", "flagyl", "nexium", "motilium", "rehydran", "brufen", "glucophage", "concor"],
    derma: ["zyrtec", "fucidin", "differin", "lamisil", "betnovate", "sunblock"],
    peds: ["cetal", "brufenSyr", "augSusp", "zithroSusp", "otrivinPed", "rehydran"],
    ent: ["ciprodex", "avamys", "otrivin", "augmentin", "brufen"],
    dent: ["brufen", "augmentin", "flagyl", "hexitol", "panadolX"],
    gyn: ["folic", "feroglobin", "calmag", "gynodakt", "flagyl"]
  };

  /* ---------- Services by short code -> the org's own service id ---------- */
  var SVC = { ecg: { selim: "s-ecg", nile: "n-ecg" }, inj: { selim: "s-inj", nile: "n-inj" }, neb: { selim: "s-neb" }, us: { nile: "n-gy-us" },
              scope: { nile: "n-en-sc" }, fill: { nile: "n-dt-fl" }, ext: { nile: "n-dt-ex" } };
  K.service = function (code, org) { var m = SVC[code]; return m && m[org] ? D.service(m[org]) : null; };

  /* ---------- Formatting helpers ---------- */
  K.t = function (pair, lang) { return lang === "en" ? pair[1] : pair[0]; };
  K.enOf = function (list, ar) { for (var i = 0; i < list.length; i++) if (list[i][0] === ar) return list[i][1]; return K.INSTR_EN[ar] || ar; };
  K.sigAr = function (f) { return f.dose + " " + f.freq + (f.instr ? " " + f.instr : "") + (f.dur === "مستمر" || f.dur === "عند اللزوم" ? " — " + f.dur : " لمدة " + f.dur); };
  K.sigEn = function (f) {
    var dur = K.enOf(K.DUR, f.dur);
    return (f.doseEn || f.dose) + " " + K.enOf(K.FREQ, f.freq).toLowerCase() + (f.instr ? ", " + K.enOf(K.INSTR, f.instr).toLowerCase() : "") + (f.dur === "مستمر" || f.dur === "عند اللزوم" ? " — " + dur.toLowerCase() : " for " + dur);
  };
  K.parse = function (iso) { var p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +(p[2] || 1)); };
  K.iso = function (d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
  K.addDays = function (iso, n) { var d = K.parse(iso); d.setDate(d.getDate() + n); return K.iso(d); };
  /* "السبت ٢٨ نوفمبر" / "Sat 28 Nov" (withDay = include weekday) */
  K.dateText = function (iso, lang, withDay) {
    var d = K.parse(iso), di = (d.getDay() + 1) % 7;
    var s = D.fmt.num(d.getDate(), lang) + " " + K.MONTHS[lang === "en" ? "en" : "ar"][d.getMonth()];
    return withDay === false ? s : D.fmt.day(di, lang) + " " + s;
  };
  K.slash = function (iso) { var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; };

  /* ---------- Patient helpers ---------- */
  K.flags = function (p) {
    var al = p.allergies || [];
    return {
      pen: al.some(function (a) { return /penicillin/i.test(a.en); }),
      preg: !!p.pregnant,
      child: !!p.child
    };
  };
  K.initials = function (p) { var w = p.ar.split(" "); return w[0].charAt(0) + " " + (w[w.length - 1] || "").replace(/^ال/, "").charAt(0); };
  K.firstName = function (p, lang) { return (lang === "en" ? p.en : p.ar).split(" ")[0]; };
  K.sexWord = function (p, lang) { return lang === "en" ? (p.sex === "F" ? "F" : "M") : (p.sex === "F" ? "أنثى" : "ذكر"); };
  K.isMine = function (a) { var d = D.doctor(a.doctor); return !!(d && d.person === D.me); };

  /* ---------- Current visit ----------
     Live appointments today in the current scope, the signed-in doctor's own first,
     then in-room > called > waiting > arrived, then by time. */
  var RANK = { inroom: 0, called: 1, waiting: 2, arrived: 3 };
  K.liveVisits = function (C) {
    return D.scoped("appointments", C, function (a) { return a.date === D.today && D.isLive(a); }).sort(function (a, b) {
      return (K.isMine(b) - K.isMine(a)) || (RANK[a.status] - RANK[b.status]) || (a.from - b.from);
    });
  };
  /* ?appt=<id> in the URL (links between visit, Rx builder and print carry it) */
  K.wanted = function () { var m = /[?&]appt=([\w-]+)/.exec(location.search); return m ? m[1] : null; };
  /* returns { appt, requested, list } — requested = the wanted appointment when it is outside the current scope */
  K.pickVisit = function (C, want) {
    var list = K.liveVisits(C), hit = null, req = null;
    if (want) {
      hit = list.filter(function (a) { return a.id === want; })[0] || null;
      if (!hit) {
        req = D.by("appointments", want) || null;
        if (req && D.inScope(req, C)) { hit = req; req = null; }
      }
    }
    return { appt: hit || list[0] || null, requested: req, list: list };
  };
  /* Visit history (other visits of the same org-wide file), newest first.
     Each item: {date, from, doctor, branch, service, appt|null}. */
  K.history = function (patientId, exceptId) {
    var out = [];
    D.patientAppointments(patientId).forEach(function (a) { if (a.id !== exceptId && a.status === "done") out.push({ date: a.date, from: a.from, doctor: a.doctor, branch: a.branch, service: a.service, appt: a.id }); });
    D.patientInvoices(patientId).forEach(function (i) { if (!i.appointment) out.push({ date: i.date, from: i.time, doctor: i.doctor, branch: i.branch, service: i.lines[0] && i.lines[0].service, appt: null }); });
    out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.from - a.from; });
    return out;
  };
  /* Clinical visibility: a doctor with "own patients only" sees only their own notes,
     and their notes are hidden from every other doctor. */
  K.canSee = function (viewerDoctorId, authorDoctorId) {
    if (viewerDoctorId === authorDoctorId) return true;
    return D.visibilityOf(viewerDoctorId) !== "own" && D.visibilityOf(authorDoctorId) !== "own";
  };
  /* Everything a clinical screen needs about one appointment */
  K.visit = function (a) {
    if (!a) return null;
    var p = D.patient(a.patient), doc = D.doctor(a.doctor), br = D.branch(a.branch), org = D.org(a.org), svc = D.service(a.service);
    var sp = (D.shifts.filter(function (s) { return s.doctor === a.doctor && s.room === a.room; })[0] || {}).sp || doc.sp[0];
    var hist = K.history(p.id, a.id);
    var seen = hist.filter(function (h) { return K.canSee(doc.id, h.doctor); });
    var free = !!(svc && svc.kind === "followup" && p.followupUntil && p.followupUntil >= a.date);
    return { appt: a, patient: p, doctor: doc, branch: br, org: org, room: D.room(a.room), service: svc, sp: sp, pack: K.packOf(sp),
      flags: K.flags(p), history: seen, hiddenHistory: hist.length - seen.length, last: seen[0] || null,
      free: free, price: svc ? D.price(svc.id, doc.id, br.id) : 0 };
  };
  /* Next date (>= today + days) that this doctor works in this branch -> {iso, from, to} */
  K.nextShift = function (doctorId, branchId, days) {
    var sh = D.shiftsOf(doctorId).filter(function (s) { return s.branch === branchId; });
    for (var k = days; k < days + 21; k++) {
      var iso = K.addDays(D.today, k), di = D.dayIndex(iso);
      var s = sh.filter(function (x) { return x.days.indexOf(di) > -1; })[0];
      if (s) return { iso: iso, from: s.from, to: s.to, k: k };
    }
    return null;
  };
  /* Doctor's hours in one branch: "السبت، الاتنين، الأربع ٥–١١ م" */
  K.hoursText = function (doctorId, branchId, lang) {
    return D.shiftsOf(doctorId).filter(function (s) { return s.branch === branchId; }).map(function (s) {
      return s.days.map(function (d) { return D.fmt.day(d, lang); }).join(lang === "en" ? ", " : "، ") + " " + D.fmt.range(s.from, s.to, lang);
    }).join(" · ");
  };
  /* Per-branch document series: certificate / report numbers carry the branch code */
  K.branchCode = function (br) { return br.code || D.branchCode(br.id); };   /* branches carry `code` in demo-data.js */
  K.docNo = function (kind, br, seq) { return kind + "-" + K.branchCode(br) + "-2026-" + ("000" + seq).slice(-4); };

  /* ---------- Shared markup ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  K.esc = esc;
  /* Patient banner inner HTML (the .t-banner element stays in the page) */
  K.banner = function (v, lang, extraFact) {
    var p = v.patient, F = D.fmt, en = lang === "en", fl = v.flags, a = v.appt;
    var alerts = (p.allergies || []).map(function (al) { return '<span class="t-allergy"><svg class="t-icon sm"><use href="#i-alert"/></svg><span>' + (en ? "Allergy: " : "حساسية: ") + esc(F.t(al, lang)) + "</span></span>"; }).join("");
    if (!(p.allergies || []).length) alerts += '<span class="t-flag">' + (en ? "No known allergies" : "مفيش حساسية مسجلة") + "</span>";
    if ((p.chronic || []).length) alerts += '<span class="t-flag">' + p.chronic.map(function (c) { return esc(F.t(c, lang)); }).join(" · ") + "</span>";
    if (p.note) alerts += '<span class="t-flag">' + esc(F.t(p.note, lang)) + "</span>";
    if (p.debt) alerts += '<span class="t-balance debt">' + (en ? "Owes " + F.money(p.debt) + " EGP" : (p.sex === "F" ? "عليها " : "عليه ") + F.money(p.debt) + " ج.م") + "</span>";
    if (p.deposit) alerts += '<span class="t-balance deposit">' + (en ? "Deposit " + F.money(p.deposit) + " EGP" : "رصيد مقدم " + F.money(p.deposit) + " ج.م") + "</span>";
    if (p.followupUntil && p.followupUntil >= D.today) alerts += '<span class="t-balance followup">' + (en ? "Free follow-up until " : "استشارة مجانية حتى ") + K.dateText(p.followupUntil, lang, false) + "</span>";
    var reg = D.branch(p.regBranch);
    return '<div class="t-banner-id"><span class="t-avatar">' + esc(K.initials(p)) + "</span><div>" +
      '<div class="t-banner-name">' + esc(F.t(p, lang)) + "</div>" +
      '<div class="t-banner-facts">' +
        "<span><b>" + F.num(p.age, lang) + "</b> " + (en ? "yrs · " : "سنة · ") + K.sexWord(p, lang) + "</span>" +
        "<span>" + (en ? "File " : "ملف ") + '<b class="t-ltr">' + esc(p.fileNo) + "</b></span>" +
        '<span class="t-ltr">' + esc(p.phone) + "</span>" +
        (p.guardian ? "<span>" + (en ? "Guardian: " : "ولي الأمر: ") + esc(F.t(p.guardian, lang)) + "</span>" : "") +
        (D.branchesOf(p.org).length > 1 && reg ? "<span>" + (en ? "Registered at " + reg.shortEn : "مسجل في " + reg.shortAr) + "</span>" : "") +
        (extraFact || "") +
      "</div></div></div>" +
      '<div class="t-banner-alerts">' + alerts + "</div>";
  };
  /* Letterhead = org logo + doctor block (per org profile) ; branch block goes in the sheet footer */
  K.letterhead = function (v) {
    var d = v.doctor, o = v.org, b = v.branch, sps = d.sp.map(function (s) { return D.specialties[s]; });
    var multi = D.branchesOf(o.id).length > 1;
    return '<header class="t-letterhead"><div><div class="lh-name">' + esc(d.ar) + '</div><div class="lh-title">' +
      "أخصائي " + sps.map(function (s) { return s.ar; }).join(" و") + "<br>" + esc(o.ar) + (multi ? " — فرع " + esc(b.shortAr) : "") + "<br>رقم القيد بالنقابة: <span class=\"t-ltr\">" + esc(d.licence) + "</span></div></div>" +
      '<div class="lh-logo">' + esc(o.ini) + "</div>" +
      '<div class="lh-en"><div class="lh-name">' + esc(d.shortEn) + '</div><div class="lh-title">' + sps.map(function (s) { return s.en; }).join(" & ") + " specialist<br>" + esc(o.en) + (multi ? " — " + esc(b.shortEn) + " branch" : "") + "<br>Syndicate no. " + esc(d.licence) + "</div></div></header>";
  };
  /* Branch block for the sheet footer: address + phone (+ the doctor's hours in this branch) */
  K.branchFoot = function (v, withHours) {
    var b = v.branch;
    return "<span>" + (withHours ? "مواعيد " + esc(v.doctor.shortAr) + ": " + K.hoursText(v.doctor.id, b.id, "ar") + "<br>" : "") + esc(b.addressAr) + '<br><span class="t-ltr">' + esc(b.phone) + "</span></span>";
  };

  window.TamargiClinical = K;
})();

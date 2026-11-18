/* feedback-admin.html — founder view of all tester feedback via GET /api/feedback-export (x-admin-key).
   Key source on load: URL hash #key=... (then stripped from the address bar) or localStorage on this device.
   The key input is shown only when no key is stored or the server answers 401. Data cells use textContent only. */
(function () {
  "use strict";
  var API = "/api/feedback-export";
  var KEY_STORE = "tamargi.adminKey";
  var html = document.documentElement;
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  try { sessionStorage.removeItem(KEY_STORE); } catch (e) { /* ignore: older versions kept it here */ }

  var lang = lsGet("tamargi.lang") === "en" ? "en" : "ar";
  var theme = lsGet("tamargi.theme");
  if (theme === "dark" || theme === "light") html.setAttribute("data-theme", theme);

  /* Key from the hash wins; remove it from the address bar and history entry right away. */
  var key = "";
  var m = /(?:^#|&)key=([^&]*)/.exec(location.hash || "");
  if (m) {
    try { key = decodeURIComponent(m[1]).trim(); } catch (e) { key = ""; }
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
  }
  if (!key) key = (lsGet(KEY_STORE) || "").trim();

  var items = null;
  var f = { type: "", role: "", screen: "", logo: "", q: "" };
  var logoNames = {};   // id -> { ar, en } from assets/logos/logos.json (falls back to the id)
  var $ = function (id) { return document.getElementById(id); };
  var keyIn = $("fa-keyin"), statusEl = $("fa-status");

  var T = {
    count: ["{n} ملاحظة", "{n} comments"],
    countOf: ["{s} من {n} ملاحظة", "{s} of {n} comments"],
    loading: ["جاري التحميل…", "Loading…"],
    e401: ["المفتاح غلط أو اتغيّر. اكتبه تاني.", "Wrong or changed key. Enter it again."],
    e429: ["محاولات كتير غلط. استنى شوية وجرّب تاني.", "Too many wrong attempts. Wait a few minutes and try again."],
    e503: ["التصدير مش متظبط أو التخزين مش متاح: راجع FEEDBACK_ADMIN_KEY ومخزن Blob في Vercel.", "Export is not configured or storage is unavailable: check FEEDBACK_ADMIN_KEY and the Blob store in Vercel."],
    eNet: ["معرفناش نوصل للسيرفر.", "Could not reach the server."],
    eFile: ["الصفحة دي بتشتغل على رابط Vercel بس، مش كملف على الجهاز.", "This page works on the Vercel link only, not as a local file."],
    needKey: ["اكتب مفتاح الإدارة الأول.", "Enter the admin key first."],
    copied: ["اتنسخ. الرابط فيه المفتاح: احفظه في المفضلة عندك بس ومتبعتهوش لحد.", "Copied. The link contains the key: keep it in your own bookmarks and never share it."],
    copyFail: ["معرفناش ننسخ. انسخ الرابط ده بإيدك:", "Could not copy. Copy this link by hand:"],
    forgot: ["المفتاح اتمسح من الجهاز ده.", "The key was removed from this device."],
    none: ["مفيش ملاحظات لسه.", "No feedback yet."],
    noMatch: ["مفيش ملاحظات بالفلتر ده.", "No feedback matches these filters."],
    allLogos: ["كل الشعارات", "All logos"],
    colour: ["اللون", "Colour"], shape: ["الشكل", "Shape"], arabic_font: ["الخط العربي", "Arabic font"],
    latin_font: ["الخط الإنجليزي", "Latin font"], small_size: ["المقاس الصغير", "Small size"],
    allTypes: ["كل الأنواع", "All types"], allRoles: ["كل الأدوار", "All roles"], allScreens: ["كل الشاشات", "All screens"],
    searchPh: ["ابحث في الملاحظة أو الاسم أو الشاشة", "Search comment, name or screen"],
    general: ["عامة", "General"], screen: ["شاشة", "Screen"],
    doctor: ["طبيب", "Doctor"], reception_nurse: ["استقبال / تمريض", "Receptionist / Nurse"], owner_manager: ["مالك / مدير", "Owner / manager"], partner: ["شريك", "Partner"], other: ["أخرى", "Other"]
  };
  var ROLES = ["doctor", "reception_nurse", "owner_manager", "partner", "other"];
  function tr(k) { var v = T[k]; return v ? v[lang === "en" ? 1 : 0] : k; }
  function num(n) { var s = String(n); return lang === "en" ? s : s.replace(/\d/g, function (d) { return "٠١٢٣٤٥٦٧٨٩".charAt(+d); }); }
  /* Screen = stable id (screen_id; older records: derived from page_path / screenFile) + label from the
     shared registry in shell.js, never the stored page title (clinic-web-page's title is the clinic name). */
  var REG = window.Tamargi || {};
  function idFrom(p) { return REG.screenIdFrom ? REG.screenIdFrom(p) : String(p || "").replace(/^.*\//, "").replace(/\.html?$/, ""); }
  function screenIdOf(it) { return it.type === "general" ? "" : String(it.screen_id || (it.page_path && idFrom(it.page_path)) || (it.screenFile && idFrom(it.screenFile)) || ""); }
  function labelOf(id) {
    if (!id) return "";
    var l = REG.screenLabel ? REG.screenLabel(id) : null;
    return l ? (lang === "en" ? l.en : l.ar) || id : id;
  }
  function logoOf(it) { return typeof it.logo_id === "string" ? it.logo_id : ""; }
  function logoLabel(id) { var n = logoNames[id]; return n ? (lang === "en" ? n.en : n.ar) || id : id; }
  /* "other" is also a role key in T; aspects use the same Arabic/English word so the shared entry is fine. */
  function aspectsOf(it) { return Array.isArray(it.aspects) ? it.aspects.filter(function (a) { return typeof a === "string"; }) : []; }
  function aspectsText(it) { return aspectsOf(it).map(function (a) { return T[a] ? tr(a) : a; }).join("، "); }
  function pathOf(it) { return String(it.page_path || (it.screenFile ? "/" + it.screenFile : "")); }

  function setStatus(kind, msg, extra) {
    statusEl.textContent = "";
    if (!kind) return;
    var d = document.createElement("div"); d.className = "t-alert " + kind;
    var s = document.createElement("span"); s.textContent = msg; d.appendChild(s);
    if (extra) { var c = document.createElement("code"); c.dir = "ltr"; c.style.overflowWrap = "anywhere"; c.textContent = extra; d.appendChild(c); }
    statusEl.appendChild(d);
  }
  function errMsg(status) { return status === 401 ? tr("e401") : status === 429 ? tr("e429") : status === 503 ? tr("e503") : tr("eNet") + " (" + status + ")"; }
  function showKeyForm(show) { $("fa-keycard").hidden = !show; if (show) { keyIn.value = ""; setTimeout(function () { keyIn.focus(); }, 0); } }

  function call(format) {
    if (location.protocol === "file:") { setStatus("warning", tr("eFile")); return Promise.reject(new Error("file")); }
    if (!key) { showKeyForm(true); setStatus("warning", tr("needKey")); return Promise.reject(new Error("nokey")); }
    return fetch(API + "?format=" + format, { headers: { "x-admin-key": key }, cache: "no-store", credentials: "same-origin" })
      .then(function (r) {
        if (r.status === 401) {   // stored key is wrong: drop it and ask once
          key = ""; lsSet(KEY_STORE, ""); items = null; $("fa-result").hidden = true; showKeyForm(true);
        }
        if (!r.ok) { setStatus("danger", errMsg(r.status)); throw new Error("http " + r.status); }
        return r;
      }, function (e) { setStatus("danger", tr("eNet")); throw e; });
  }

  function fillSelect(sel, opts, value) {
    sel.textContent = "";
    opts.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; sel.appendChild(op); });
    sel.value = opts.some(function (o) { return o[0] === value; }) ? value : "";
  }
  function renderFilters() {
    fillSelect($("fa-ftype"), [["", tr("allTypes")], ["screen", tr("screen")], ["general", tr("general")]], f.type);
    var roles = ROLES.slice();
    items.forEach(function (it) { if (it.role && roles.indexOf(it.role) < 0) roles.push(String(it.role)); });
    fillSelect($("fa-frole"), [["", tr("allRoles")]].concat(roles.map(function (r) { return [r, T[r] ? tr(r) : r]; })), f.role);
    var ids = [];
    items.forEach(function (it) { var s = screenIdOf(it); if (s && ids.indexOf(s) < 0) ids.push(s); });
    var opts = ids.map(function (id) { return [id, labelOf(id) + (labelOf(id) !== id ? " (" + id + ")" : "")]; });
    opts.sort(function (a, b) { return a[1].localeCompare(b[1]); });
    fillSelect($("fa-fscreen"), [["", tr("allScreens")]].concat(opts), f.screen);
    var lids = [];
    items.forEach(function (it) { var l = logoOf(it); if (l && lids.indexOf(l) < 0) lids.push(l); });
    fillSelect($("fa-flogo"), [["", tr("allLogos")]].concat(lids.map(function (id) { return [id, logoLabel(id)]; })), f.logo);
    $("fa-fq").placeholder = tr("searchPh");
  }

  function cell(row, text, cls) { var td = document.createElement("td"); if (cls) td.className = cls; td.textContent = text == null ? "" : String(text); row.appendChild(td); return td; }
  function filtered() {
    var q = f.q.toLowerCase();
    return items.filter(function (it) {
      if (f.type && (it.type === "general" ? "general" : "screen") !== f.type) return false;
      if (f.role && it.role !== f.role) return false;
      if (f.screen && screenIdOf(it) !== f.screen) return false;
      if (f.logo && logoOf(it) !== f.logo) return false;
      if (q) {
        var sid = screenIdOf(it), l = sid && REG.screenLabel ? REG.screenLabel(sid) : null;
        var hay = [it.comment, it.name, sid, l ? l.ar + " " + l.en : "", pathOf(it), logoOf(it), logoOf(it) ? logoLabel(logoOf(it)) : "", aspectsText(it), it.org, it.branch, it.role, T[it.role] ? T[it.role].join(" ") : ""].join(" ").toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }
  function renderTable() {
    var shown = filtered();
    var tb = $("fa-rows"); tb.textContent = "";
    shown.forEach(function (it) {
      var row = document.createElement("tr");
      cell(row, String(it.receivedAt || "").replace("T", " ").slice(0, 16), "fa-nowrap");
      cell(row, tr(it.type === "general" ? "general" : "screen"));
      var sid = screenIdOf(it), td = cell(row, sid ? labelOf(sid) : "—");
      if (sid) { var sub = document.createElement("span"); sub.className = "fa-sub"; sub.textContent = sid + (pathOf(it) ? " · " + pathOf(it) : ""); td.appendChild(sub); }
      var lid = logoOf(it), ltd = cell(row, lid ? logoLabel(lid) : "—");
      if (lid && aspectsOf(it).length) { var as = document.createElement("span"); as.className = "fa-sub fa-aspects"; as.textContent = aspectsText(it); ltd.appendChild(as); }
      cell(row, T[it.role] ? tr(it.role) : it.role);
      cell(row, it.name);
      cell(row, [it.org, it.branch].filter(Boolean).join(" / "), "fa-nowrap");
      cell(row, it.lang);
      cell(row, it.comment, "fa-comment");
      tb.appendChild(row);
    });
    $("fa-count").textContent = shown.length !== items.length
      ? tr("countOf").replace("{s}", num(shown.length)).replace("{n}", num(items.length))
      : tr("count").replace("{n}", num(items.length));
    var empty = $("fa-empty");
    empty.hidden = shown.length > 0;
    empty.textContent = items.length ? tr("noMatch") : tr("none");
    $("fa-result").hidden = false;
  }

  function applyLang() {
    html.lang = lang; html.dir = lang === "en" ? "ltr" : "rtl";
    Array.prototype.forEach.call(document.querySelectorAll("[data-en]"), function (n) {
      if (!n.hasAttribute("data-ar")) n.setAttribute("data-ar", n.textContent);
      n.textContent = lang === "en" ? n.getAttribute("data-en") : n.getAttribute("data-ar");
    });
    $("fa-lang").textContent = lang === "en" ? "عربي" : "English";
    if (items) { renderFilters(); renderTable(); }
  }

  function load() {
    setStatus("info", tr("loading"));
    return call("json").then(function (r) { return r.json(); }).then(function (d) {
      var list = Array.isArray(d.items) ? d.items : [];
      items = list.filter(function (it) { return it && typeof it === "object"; })
        .sort(function (a, b) { return String(b.receivedAt || "").localeCompare(String(a.receivedAt || "")); });   // newest first
      lsSet(KEY_STORE, key);   // only a key the server accepted is kept
      showKeyForm(false); setStatus(null);
      renderFilters(); renderTable();
    }).catch(function () { /* status already shown */ });
  }
  /* CSV is built here from the loaded list so the screen label follows the page language (and old records get one). */
  var CSV_COLS = ["receivedAt", "type", "role", "name", "comment", "logo_id", "logo_name", "aspects", "screen_id", "screen_label", "page_path", "screenState",
    "org", "branch", "viewAs", "lang", "viewport", "clientTs", "id"];
  function csvCell(v) { var s = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
  function saveFile(name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type })), a = document.createElement("a");
    a.href = url; a.download = name; a.style.display = "none"; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  function downloadCsv() {
    if (!items) return;
    var lines = [CSV_COLS.join(",")];
    items.slice().reverse().forEach(function (it) {
      var sid = screenIdOf(it), r = {};
      for (var k in it) r[k] = it[k];
      r.logo_name = logoOf(it) ? logoLabel(logoOf(it)) : ""; r.aspects = aspectsText(it);
      r.screen_id = sid; r.screen_label = sid ? labelOf(sid) : ""; r.page_path = sid ? pathOf(it) : "";
      lines.push(CSV_COLS.map(function (c) { return csvCell(r[c]); }).join(","));
    });
    saveFile("tamargi-feedback-" + new Date().toISOString().slice(0, 10) + "-" + lang + ".csv", "﻿" + lines.join("\r\n") + "\r\n", "text/csv;charset=utf-8");
  }
  function download(format) {
    if (format === "csv" && items) { downloadCsv(); return; }
    call(format).then(function (r) {
      var cd = r.headers.get("content-disposition") || "", mm = cd.match(/filename="([^"]+)"/);
      var name = mm ? mm[1] : "tamargi-feedback." + format;
      return r.blob().then(function (b) {
        var url = URL.createObjectURL(b), a = document.createElement("a");
        a.href = url; a.download = name; a.style.display = "none"; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
      });
    }).catch(function () { /* status already shown */ });
  }
  function copyLink() {
    if (!key) return;
    var link = location.origin + location.pathname + "#key=" + encodeURIComponent(key);
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = link; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove();
      if (ok) setStatus("success", tr("copied")); else setStatus("warning", tr("copyFail"), link);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(function () { setStatus("success", tr("copied")); }, fallback);
    else fallback();
  }

  $("fa-form").addEventListener("submit", function (e) { e.preventDefault(); key = keyIn.value.trim(); if (key) load(); });
  $("fa-forget").addEventListener("click", function () {
    key = ""; lsSet(KEY_STORE, ""); items = null; $("fa-result").hidden = true; $("fa-rows").textContent = "";
    showKeyForm(true); setStatus("info", tr("forgot"));
  });
  $("fa-copy").addEventListener("click", copyLink);
  $("fa-reload").addEventListener("click", load);
  $("fa-ftype").addEventListener("change", function (e) { f.type = e.target.value; renderTable(); });
  $("fa-frole").addEventListener("change", function (e) { f.role = e.target.value; renderTable(); });
  $("fa-fscreen").addEventListener("change", function (e) { f.screen = e.target.value; renderTable(); });
  $("fa-flogo").addEventListener("change", function (e) { f.logo = e.target.value; renderTable(); });
  $("fa-fq").addEventListener("input", function (e) { f.q = e.target.value.trim(); renderTable(); });
  $("fa-lang").addEventListener("click", function () { lang = lang === "en" ? "ar" : "en"; lsSet("tamargi.lang", lang); applyLang(); });
  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-dl]"); if (b) download(b.getAttribute("data-dl")); });

  /* Logo names for comments made on the logo vote page; textContent only. */
  fetch("assets/logos/logos.json", { cache: "no-cache", credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    (d && Array.isArray(d.logos) ? d.logos : []).forEach(function (l) {
      if (l && typeof l.id === "string" && l.name && typeof l.name.ar === "string" && typeof l.name.en === "string") logoNames[l.id] = { ar: l.name.ar, en: l.name.en };
    });
    if (items) { renderFilters(); renderTable(); }
  }).catch(function () { /* names fall back to ids */ });

  applyLang();
  if (key) load(); else showKeyForm(true);
})();

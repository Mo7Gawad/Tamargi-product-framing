/* feedback-admin.html — founder download of all tester feedback via GET /api/feedback-export.
   The admin key lives in memory and sessionStorage only (this tab). Table cells use textContent. */
(function () {
  "use strict";
  var API = "/api/feedback-export";
  var html = document.documentElement;
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch (e) { /* ignore */ } }

  var lang = ls("tamargi.lang") === "en" ? "en" : "ar";
  var theme = ls("tamargi.theme");
  if (theme === "dark" || theme === "light") html.setAttribute("data-theme", theme);
  var key = ssGet("tamargi.adminKey") || "";
  var items = null;

  var $ = function (id) { return document.getElementById(id); };
  var keyIn = $("fa-keyin"), statusEl = $("fa-status");
  keyIn.value = key;

  var T = {
    count: ["{n} ملاحظة", "{n} comments"],
    loading: ["جاري التحميل…", "Loading…"],
    e401: ["المفتاح غلط.", "Wrong key."],
    e429: ["محاولات كتير غلط. استنى شوية وجرّب تاني.", "Too many wrong attempts. Wait a few minutes and try again."],
    e503: ["التصدير مش متظبط أو التخزين مش متاح: راجع FEEDBACK_ADMIN_KEY ومخزن Blob في Vercel.", "Export is not configured or storage is unavailable: check FEEDBACK_ADMIN_KEY and the Blob store in Vercel."],
    eNet: ["معرفناش نوصل للسيرفر.", "Could not reach the server."],
    eFile: ["الصفحة دي بتشتغل على رابط Vercel بس، مش كملف على الجهاز.", "This page works on the Vercel link only, not as a local file."],
    needKey: ["اكتب مفتاح الإدارة الأول.", "Enter the admin key first."],
    general: ["عامة", "General"], screen: ["شاشة", "Screen"],
    doctor: ["طبيب", "Doctor"], reception_nurse: ["استقبال / تمريض", "Receptionist / Nurse"], owner_manager: ["مالك / مدير", "Owner / manager"], partner: ["شريك", "Partner"], other: ["أخرى", "Other"]
  };
  function tr(k) { var v = T[k]; return v ? v[lang === "en" ? 1 : 0] : k; }

  function applyLang() {
    html.lang = lang; html.dir = lang === "en" ? "ltr" : "rtl";
    Array.prototype.forEach.call(document.querySelectorAll("[data-en]"), function (n) {
      if (!n.hasAttribute("data-ar")) n.setAttribute("data-ar", n.textContent);
      n.textContent = lang === "en" ? n.getAttribute("data-en") : n.getAttribute("data-ar");
    });
    $("fa-lang").textContent = lang === "en" ? "عربي" : "English";
    if (items) renderTable();
  }
  function setStatus(kind, msg) {
    statusEl.textContent = "";
    if (!kind) return;
    var d = document.createElement("div"); d.className = "t-alert " + kind; d.textContent = msg; statusEl.appendChild(d);
  }
  function errMsg(status) { return status === 401 ? tr("e401") : status === 429 ? tr("e429") : status === 503 ? tr("e503") : tr("eNet") + " (" + status + ")"; }

  function call(format) {
    if (location.protocol === "file:") { setStatus("warning", tr("eFile")); return Promise.reject(new Error("file")); }
    if (!key) { setStatus("warning", tr("needKey")); keyIn.focus(); return Promise.reject(new Error("nokey")); }
    setStatus("info", tr("loading"));
    return fetch(API + "?format=" + format, { headers: { "x-admin-key": key }, cache: "no-store", credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) { setStatus("danger", errMsg(r.status)); throw new Error("http " + r.status); }
        setStatus(null);
        return r;
      }, function (e) { setStatus("danger", tr("eNet")); throw e; });
  }

  function cell(tr_, text, cls) { var td = document.createElement("td"); if (cls) td.className = cls; td.textContent = text == null ? "" : String(text); tr_.appendChild(td); }
  function renderTable() {
    var tb = $("fa-rows"); tb.textContent = "";
    var n = String(items.length);
    if (lang !== "en") n = n.replace(/\d/g, function (d) { return "٠١٢٣٤٥٦٧٨٩".charAt(+d); });
    $("fa-count").textContent = tr("count").replace("{n}", n);
    items.slice().reverse().slice(0, 500).forEach(function (it) {
      var row = document.createElement("tr");
      cell(row, (it.receivedAt || "").replace("T", " ").slice(0, 16), "fa-nowrap");
      cell(row, tr(it.type === "general" ? "general" : "screen"));
      cell(row, T[it.role] ? tr(it.role) : it.role);
      cell(row, it.name);
      cell(row, it.comment, "fa-comment");
      cell(row, it.type === "general" ? "—" : (it.screenTitle || it.screenFile));
      cell(row, [it.org, it.branch].filter(Boolean).join(" / "), "fa-nowrap");
      cell(row, it.lang);
      tb.appendChild(row);
    });
    $("fa-result").hidden = false;
  }

  function load() {
    call("json").then(function (r) { return r.json(); }).then(function (d) {
      items = Array.isArray(d.items) ? d.items : []; renderTable();
    }).catch(function () { /* status already shown */ });
  }
  function download(format) {
    call(format).then(function (r) {
      var cd = r.headers.get("content-disposition") || "", m = cd.match(/filename="([^"]+)"/);
      var name = m ? m[1] : "tamargi-feedback." + format;
      return r.blob().then(function (b) {
        var url = URL.createObjectURL(b), a = document.createElement("a");
        a.href = url; a.download = name; a.style.display = "none"; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
      });
    }).catch(function () { /* status already shown */ });
  }

  $("fa-form").addEventListener("submit", function (e) { e.preventDefault(); key = keyIn.value.trim(); ssSet("tamargi.adminKey", key); load(); });
  $("fa-forget").addEventListener("click", function () { key = ""; keyIn.value = ""; ssSet("tamargi.adminKey", ""); items = null; $("fa-result").hidden = true; setStatus(null); keyIn.focus(); });
  $("fa-lang").addEventListener("click", function () { lang = lang === "en" ? "ar" : "en"; try { localStorage.setItem("tamargi.lang", lang); } catch (e) { /* ignore */ } applyLang(); });
  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-dl]"); if (b) download(b.getAttribute("data-dl")); });

  applyLang();
  if (key) load();
})();

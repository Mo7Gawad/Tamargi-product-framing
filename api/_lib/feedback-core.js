/* Shared logic for the prototype feedback API (api/feedback.js, api/feedback-export.js).
   Files under api/_lib are not deployed as functions. Blob calls are injected so tests can mock them. */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/* 16 KB, not 8 KB: 4000 Arabic characters are ~8000 bytes in UTF-8 on their own. */
export const MAX_BODY_BYTES = 16 * 1024;
export const MAX_COMMENT = 4000;
export const PREFIX = "feedback/";
export const ROLES = ["doctor", "reception_nurse", "owner_manager", "partner", "other"];
export const TYPES = ["screen", "general"];

const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export function json(status, data, extra) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, NO_STORE, extra || {})
  });
}

/* ---------- Sanitizing ---------- */
// C0 controls except \t \n \r, DEL, C1 controls, and bidi embedding/override/isolate marks.
const CTRL_MULTI = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‪-‮⁦-⁩]/g;
const CTRL_LINE = /[\u0000-\u001F\u007F-\u009F‪-‮⁦-⁩]/g;

export function cleanText(v, max, multiline) {
  if (typeof v !== "string") return null;
  let s = v.replace(multiline ? CTRL_MULTI : CTRL_LINE, multiline ? "" : " ");
  if (multiline) s = s.replace(/\r\n?/g, "\n");
  s = s.trim();
  return s.length > max ? null : s;
}

/* ---------- Validation ---------- */
// field -> [maxLength, required, multiline]
const STRING_FIELDS = {
  name: [80, false], comment: [MAX_COMMENT, true, true], screenFile: [120, false], screenTitle: [200, false],
  screenState: [40, false], org: [40, false], branch: [40, false], viewAs: [20, false],
  clientTs: [40, false], viewport: [20, false], clientId: [64, false], website: [200, false]
};
const ENUM_FIELDS = { type: TYPES, role: ROLES, lang: ["ar", "en"] };
const ALLOWED = new Set(Object.keys(STRING_FIELDS).concat(Object.keys(ENUM_FIELDS)));

/* Returns { ok: true, value } or { ok: false, error }. value.website is the honeypot. */
export function validateFeedback(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "body must be a JSON object" };
  for (const k of Object.keys(input)) if (!ALLOWED.has(k)) return { ok: false, error: "unknown field: " + k.slice(0, 40) };
  const out = {};
  for (const [k, allowed] of Object.entries(ENUM_FIELDS)) {
    const v = input[k];
    if (v === undefined && k === "lang") { out.lang = "ar"; continue; }
    if (typeof v !== "string" || !allowed.includes(v)) return { ok: false, error: "invalid " + k };
    out[k] = v;
  }
  for (const [k, [max, required, multi]] of Object.entries(STRING_FIELDS)) {
    const v = input[k];
    if (v === undefined || v === null) { if (required) return { ok: false, error: k + " is required" }; out[k] = ""; continue; }
    const s = cleanText(v, max, multi);
    if (s === null) return { ok: false, error: "invalid " + k };
    if (required && !s) return { ok: false, error: k + " is required" };
    out[k] = s;
  }
  if (out.clientTs && Number.isNaN(Date.parse(out.clientTs))) return { ok: false, error: "invalid clientTs" };
  if (out.viewport && !/^\d{1,5}x\d{1,5}$/.test(out.viewport)) return { ok: false, error: "invalid viewport" };
  if (out.clientId && !/^[A-Za-z0-9_-]+$/.test(out.clientId)) return { ok: false, error: "invalid clientId" };
  return { ok: true, value: out };
}

/* ---------- Body reading with a hard size cap ---------- */
export async function readJsonBody(request, max = MAX_BODY_BYTES) {
  const ct = (request.headers.get("content-type") || "").toLowerCase();
  if (!ct.startsWith("application/json")) return { ok: false, status: 415, error: "content-type must be application/json" };
  const len = Number(request.headers.get("content-length") || "0");
  if (len > max) return { ok: false, status: 413, error: "body too large" };
  if (!request.body) return { ok: false, status: 400, error: "empty body" };
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { try { await reader.cancel(); } catch { /* ignore */ } return { ok: false, status: 413, error: "body too large" }; }
    chunks.push(value);
  }
  const buf = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { return { ok: false, status: 400, error: "body must be UTF-8" }; }
  try { return { ok: true, value: JSON.parse(text) }; } catch { return { ok: false, status: 400, error: "invalid JSON" }; }
}

/* ---------- Best-effort per-IP rate limit (per function instance, in memory) ---------- */
export function createRateLimiter({ limit, windowMs, maxKeys = 5000 }) {
  const hits = new Map();
  return function hit(key, now = Date.now()) {
    let e = hits.get(key);
    if (!e || now - e.start >= windowMs) {
      if (hits.size >= maxKeys) { for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k); if (hits.size >= maxKeys) hits.clear(); }
      e = { start: now, count: 0 };
      hits.set(key, e);
    }
    e.count += 1;
    return { allowed: e.count <= limit, retryAfter: Math.ceil((e.start + windowMs - now) / 1000) };
  };
}

export function clientIp(request) {
  const h = request.headers;
  return (h.get("x-real-ip") || (h.get("x-forwarded-for") || "").split(",")[0] || "unknown").trim().slice(0, 64);
}

/* Reject cross-site browser posts (best effort: only when the browser tells us). */
export function isCrossSite(request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  try { return new URL(origin).host !== host; } catch { return true; }
}

/* ---------- Admin key ---------- */
export function keyMatches(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string" || !given || !expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/* ---------- Storage naming ---------- */
export function newPathname(now = new Date()) {
  const id = randomBytes(16).toString("hex");
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return { id, pathname: PREFIX + stamp + "-" + id + ".json" };
}

/* ---------- CSV ---------- */
export const CSV_COLUMNS = ["receivedAt", "type", "role", "name", "comment", "screenFile", "screenTitle", "screenState",
  "org", "branch", "viewAs", "lang", "viewport", "clientTs", "id"];

export function csvCell(v) {
  let s = v === undefined || v === null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;   // block spreadsheet formula injection
  return '"' + s.replace(/"/g, '""') + '"';
}

export function toCsv(items) {
  const lines = [CSV_COLUMNS.join(",")];
  for (const it of items) lines.push(CSV_COLUMNS.map((c) => csvCell(it[c])).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/* ---------- Handlers ---------- */
const postLimiter = createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 });
const authFailLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });

export function blobAccess(env) {
  return env.FEEDBACK_BLOB_ACCESS === "public" ? "public" : "private";
}

/* deps: { put, env, limiter, now } */
export function createFeedbackHandler(deps) {
  const env = deps.env || process.env;
  const limiter = deps.limiter || postLimiter;
  return async function handle(request) {
    if (request.method !== "POST") return json(405, { ok: false, error: "method not allowed" }, { Allow: "POST" });
    if (isCrossSite(request)) return json(403, { ok: false, error: "cross-site request" });
    const rl = limiter(clientIp(request));
    if (!rl.allowed) return json(429, { ok: false, error: "too many requests" }, { "Retry-After": String(rl.retryAfter) });
    const body = await readJsonBody(request);
    if (!body.ok) return json(body.status, { ok: false, error: body.error });
    const v = validateFeedback(body.value);
    if (!v.ok) return json(400, { ok: false, error: v.error });
    const { website, ...item } = v.value;
    if (website) return json(200, { ok: true, id: "ok" });   // honeypot: look successful, store nothing
    const now = deps.now ? deps.now() : new Date();
    const { id, pathname } = newPathname(now);
    const ua = (request.headers.get("user-agent") || "").replace(CTRL_LINE, " ").slice(0, 300);
    const record = Object.assign({ id, receivedAt: now.toISOString() }, item, { userAgent: ua });
    try {
      await deps.put(pathname, JSON.stringify(record), {
        access: blobAccess(env), contentType: "application/json", addRandomSuffix: false, allowOverwrite: false
      });
    } catch (err) {
      console.error("feedback: storage failed:", err && err.name);
      return json(503, { ok: false, error: "storage unavailable" });
    }
    return json(201, { ok: true, id, receivedAt: record.receivedAt });
  };
}

async function mapLimit(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  });
  await Promise.all(workers);
  return out;
}

/* deps: { list, get, env, limiter } */
export function createExportHandler(deps) {
  const env = deps.env || process.env;
  const limiter = deps.limiter || authFailLimiter;
  return async function handle(request) {
    if (request.method !== "GET") return json(405, { ok: false, error: "method not allowed" }, { Allow: "GET" });
    const expected = env.FEEDBACK_ADMIN_KEY || "";
    if (expected.length < 12) return json(503, { ok: false, error: "export is not configured (FEEDBACK_ADMIN_KEY missing or shorter than 12 characters)" });
    const ip = clientIp(request);
    if (!keyMatches(request.headers.get("x-admin-key") || "", expected)) {
      const rl = limiter(ip);
      if (!rl.allowed) return json(429, { ok: false, error: "too many attempts" }, { "Retry-After": String(rl.retryAfter) });
      return json(401, { ok: false, error: "unauthorized" });
    }
    const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";
    const access = blobAccess(env);
    let blobs = [];
    try {
      let cursor;
      do {
        const page = await deps.list({ prefix: PREFIX, cursor, limit: 1000 });
        blobs = blobs.concat(page.blobs || []);
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
    } catch (err) {
      console.error("feedback-export: list failed:", err && err.name);
      return json(503, { ok: false, error: "storage unavailable" });
    }
    const files = blobs.filter((b) => /^feedback\/[\w-]+\.json$/.test(b.pathname));
    const read = await mapLimit(files, 8, async (b) => {
      try {
        const r = await deps.get(b.pathname, { access });
        if (!r || r.statusCode !== 200 || !r.stream) return null;
        const text = await new Response(r.stream).text();
        const o = JSON.parse(text);
        return o && typeof o === "object" ? o : null;
      } catch { return null; }
    });
    const seen = new Set();
    const items = read.filter(Boolean)
      .sort((a, b) => String(a.receivedAt).localeCompare(String(b.receivedAt)))
      .filter((it) => { if (!it.clientId) return true; if (seen.has(it.clientId)) return false; seen.add(it.clientId); return true; });
    const day = new Date().toISOString().slice(0, 10);
    const headers = Object.assign({}, NO_STORE, { "Content-Disposition": 'attachment; filename="tamargi-feedback-' + day + "." + format + '"' });
    if (format === "csv") {
      return new Response(toCsv(items), { status: 200, headers: Object.assign({ "Content-Type": "text/csv; charset=utf-8" }, headers) });
    }
    return new Response(JSON.stringify({ count: items.length, exportedAt: new Date().toISOString(), items }, null, 2),
      { status: 200, headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, headers) });
  };
}

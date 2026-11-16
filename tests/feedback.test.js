/* node --test — feedback API validation, storage and export auth. @vercel/blob is injected as mocks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createFeedbackHandler, createExportHandler, createRateLimiter, validateFeedback, cleanText,
  csvCell, toCsv, keyMatches, MAX_BODY_BYTES
} from "../api/_lib/feedback-core.js";

const BASE = "https://proto.example.com";
const good = () => ({
  type: "screen", role: "doctor", name: "د. أحمد", comment: "الزرار ده مش واضح\nسطر تاني",
  screenFile: "screens/reception-queue.html", screenTitle: "الدور المباشر", org: "nile", branch: "tor",
  lang: "ar", clientTs: "2026-11-16T10:00:00.000Z", viewport: "390x844", clientId: "c_abc123", website: ""
});
const post = (body, headers = {}) => new Request(BASE + "/api/feedback", {
  method: "POST",
  headers: Object.assign({ "content-type": "application/json", host: "proto.example.com", "x-real-ip": "1.2.3.4" }, headers),
  body: typeof body === "string" ? body : JSON.stringify(body)
});
const openLimiter = () => ({ allowed: true, retryAfter: 0 });
function mkPost(opts = {}) {
  const calls = [];
  const put = opts.put || (async (pathname, body, o) => { calls.push({ pathname, body, o }); return { pathname }; });
  return { calls, handle: createFeedbackHandler({ put, env: opts.env || {}, limiter: opts.limiter || openLimiter }) };
}

test("valid feedback is stored privately under feedback/ with server id and timestamp", async () => {
  const { calls, handle } = mkPost();
  const res = await handle(post(good()));
  assert.equal(res.status, 201);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const out = await res.json();
  assert.equal(calls.length, 1);
  const { pathname, body, o } = calls[0];
  assert.match(pathname, /^feedback\/\d{4}-\d{2}-\d{2}T[\d-]+Z-[0-9a-f]{32}\.json$/);
  assert.equal(o.access, "private");
  assert.equal(o.allowOverwrite, false);
  const rec = JSON.parse(body);
  assert.equal(rec.id, out.id);
  assert.ok(!Number.isNaN(Date.parse(rec.receivedAt)));
  assert.equal(rec.comment, "الزرار ده مش واضح\nسطر تاني");
  assert.equal(rec.website, undefined);
  assert.ok(!JSON.stringify(out).includes("blob.vercel-storage.com"));
});

test("general feedback without screen fields is accepted", async () => {
  const { handle } = mkPost();
  const res = await handle(post({ type: "general", role: "partner", comment: "Overall logic is fine", lang: "en" }));
  assert.equal(res.status, 201);
});

test("schema violations are rejected with 400", async () => {
  const { calls, handle } = mkPost();
  const cases = [
    Object.assign(good(), { role: "admin" }),
    Object.assign(good(), { type: "page" }),
    Object.assign(good(), { comment: "   " }),
    Object.assign(good(), { comment: "x".repeat(4001) }),
    Object.assign(good(), { name: "n".repeat(81) }),
    Object.assign(good(), { extra: 1 }),
    Object.assign(good(), { comment: 42 }),
    Object.assign(good(), { viewport: "<script>" }),
    Object.assign(good(), { clientTs: "yesterday" }),
    Object.assign(good(), { clientId: "a b" }),
    (() => { const g = good(); delete g.role; return g; })(),
    [1, 2]
  ];
  for (const c of cases) {
    const res = await handle(post(c));
    assert.equal(res.status, 400, JSON.stringify(c).slice(0, 80));
  }
  assert.equal(calls.length, 0);
});

test("malformed JSON, wrong content type and oversized bodies are rejected", async () => {
  const { calls, handle } = mkPost();
  assert.equal((await handle(post("{not json"))).status, 400);
  assert.equal((await handle(post(good(), { "content-type": "text/plain" }))).status, 415);
  const raw = JSON.stringify(good()) + " ".repeat(MAX_BODY_BYTES);
  assert.equal((await handle(post(raw))).status, 413);
  assert.equal(calls.length, 0);
});

test("a full 4000-character Arabic comment fits in the body limit", async () => {
  const { handle } = mkPost();
  const res = await handle(post(Object.assign(good(), { comment: "ض".repeat(4000), name: "ن".repeat(80), screenTitle: "ع".repeat(200) })));
  assert.equal(res.status, 201);
});

test("control and bidi characters are stripped", () => {
  assert.equal(cleanText("a\u0000b‮c\u0007", 10, false), "a b c");
  assert.equal(cleanText("line1\r\nline2\u0001", 50, true), "line1\nline2");
  assert.equal(validateFeedback(Object.assign(good(), { name: "x\u0000y" })).value.name, "x y");
});

test("honeypot: filled hidden field returns 200 and stores nothing", async () => {
  const { calls, handle } = mkPost();
  const res = await handle(post(Object.assign(good(), { website: "http://spam" })));
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
});

test("method, cross-site and rate limit guards", async () => {
  const { handle } = mkPost();
  assert.equal((await handle(new Request(BASE + "/api/feedback"))).status, 405);
  assert.equal((await handle(post(good(), { origin: "https://evil.example" }))).status, 403);
  assert.equal((await handle(post(good(), { "sec-fetch-site": "cross-site" }))).status, 403);
  assert.equal((await handle(post(good(), { origin: "https://proto.example.com", "sec-fetch-site": "same-origin" }))).status, 201);

  const limiter = createRateLimiter({ limit: 2, windowMs: 60000 });
  const h2 = mkPost({ limiter }).handle;
  assert.equal((await h2(post(good()))).status, 201);
  assert.equal((await h2(post(good()))).status, 201);
  const r = await h2(post(good()));
  assert.equal(r.status, 429);
  assert.ok(Number(r.headers.get("retry-after")) > 0);
  assert.equal((await h2(post(good(), { "x-real-ip": "5.6.7.8" }))).status, 201);
});

test("storage failure returns 503 without leaking details", async () => {
  const { handle } = mkPost({ put: async () => { throw new Error("token secret-xyz invalid"); } });
  const res = await handle(post(good()));
  assert.equal(res.status, 503);
  assert.ok(!(await res.text()).includes("secret-xyz"));
});

/* ---------- Export ---------- */
const KEY = "correct-horse-battery-staple";
function mkExport(records, opts = {}) {
  const store = new Map(records.map((r, i) => ["feedback/2026-11-16T10-00-0" + i + "-000Z-" + String(i).padStart(32, "0") + ".json", r]));
  store.set("other/ignore.json", { id: "nope" });
  const getCalls = [];
  const list = async ({ prefix, cursor }) => {
    const all = [...store.keys()].filter((k) => k.startsWith(prefix)).map((pathname) => ({ pathname, url: "https://x.private.blob.vercel-storage.com/" + pathname }));
    const start = cursor ? Number(cursor) : 0;
    const page = all.slice(start, start + 2);
    return { blobs: page, hasMore: start + 2 < all.length, cursor: String(start + 2) };
  };
  const get = async (pathname, o) => { getCalls.push(o); const r = store.get(pathname); return r ? { statusCode: 200, stream: new Response(JSON.stringify(r)).body } : null; };
  return { getCalls, handle: createExportHandler({ list, get, env: { FEEDBACK_ADMIN_KEY: KEY, ...(opts.env || {}) }, limiter: opts.limiter || openLimiter }) };
}
const exp = (q = "", headers = {}) => new Request(BASE + "/api/feedback-export" + q, { headers: Object.assign({ "x-real-ip": "9.9.9.9" }, headers) });
const recs = [
  { id: "b", receivedAt: "2026-11-16T10:00:02.000Z", type: "screen", role: "doctor", comment: "=HYPERLINK(\"http://x\")", clientId: "c1" },
  { id: "a", receivedAt: "2026-11-16T10:00:01.000Z", type: "general", role: "partner", name: "سارة", comment: "منطق النظام \"كويس\"", clientId: "c0" },
  { id: "dup", receivedAt: "2026-11-16T10:00:03.000Z", type: "screen", role: "doctor", comment: "retry dup", clientId: "c1" }
];

test("export requires the admin key", async () => {
  const { handle } = mkExport(recs);
  assert.equal((await handle(exp())).status, 401);
  assert.equal((await handle(exp("", { "x-admin-key": "wrong" }))).status, 401);
  assert.equal((await handle(exp("?key=" + KEY))).status, 401);
  const res = await handle(exp("", { "x-admin-key": KEY }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("export refuses to run when the key is not configured or too short", async () => {
  const h = createExportHandler({ list: async () => ({ blobs: [] }), get: async () => null, env: {}, limiter: openLimiter });
  assert.equal((await h(exp("", { "x-admin-key": "" }))).status, 503);
  const h2 = createExportHandler({ list: async () => ({ blobs: [] }), get: async () => null, env: { FEEDBACK_ADMIN_KEY: "short" }, limiter: openLimiter });
  assert.equal((await h2(exp("", { "x-admin-key": "short" }))).status, 503);
});

test("repeated wrong keys are rate limited", async () => {
  const limiter = createRateLimiter({ limit: 3, windowMs: 60000 });
  const { handle } = mkExport(recs, { limiter });
  for (let i = 0; i < 3; i++) assert.equal((await handle(exp("", { "x-admin-key": "bad" + i }))).status, 401);
  assert.equal((await handle(exp("", { "x-admin-key": "bad" }))).status, 429);
});

test("export JSON: all pages, sorted, deduplicated by clientId, private reads, attachment", async () => {
  const { handle, getCalls } = mkExport(recs);
  const res = await handle(exp("?format=json", { "x-admin-key": KEY }));
  assert.match(res.headers.get("content-disposition"), /^attachment; filename="tamargi-feedback-\d{4}-\d{2}-\d{2}\.json"$/);
  const data = await res.json();
  assert.equal(data.count, 2);
  assert.deepEqual(data.items.map((i) => i.id), ["a", "b"]);
  assert.ok(getCalls.every((o) => o.access === "private"));
});

test("export CSV: BOM, escaping and formula-injection guard", async () => {
  const { handle } = mkExport(recs);
  const res = await handle(exp("?format=csv", { "x-admin-key": KEY }));
  assert.match(res.headers.get("content-type"), /^text\/csv; charset=utf-8/);
  assert.match(res.headers.get("content-disposition"), /\.csv"$/);
  const buf = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual([...buf.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  const text = new TextDecoder().decode(buf);
  assert.ok(text.includes('"\'=HYPERLINK(""http://x"")"'));
  assert.ok(text.includes('"منطق النظام ""كويس"""'));
  assert.ok(text.includes('"سارة"'));
});

test("csvCell guards every formula prefix", () => {
  for (const p of ["=", "+", "-", "@", "\t", "\r"]) assert.equal(csvCell(p + "1"), '"\'' + p + '1"');
  assert.equal(csvCell("ok"), '"ok"');
  assert.equal(csvCell(null), '""');
  assert.ok(toCsv([]).startsWith("﻿receivedAt,"));
});

test("keyMatches is exact", () => {
  assert.equal(keyMatches(KEY, KEY), true);
  assert.equal(keyMatches(KEY + "x", KEY), false);
  assert.equal(keyMatches("", ""), false);
  assert.equal(keyMatches(undefined, KEY), false);
});

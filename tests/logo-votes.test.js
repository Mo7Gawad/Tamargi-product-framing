/* node --test — logo vote API (validation, vote/unvote/count with an in-memory Blob mock) and the logo files. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  createLogoVotesHandler, validateVote, countVotes, loadLogoIds, votePath, MAX_VOTE_BODY, COUNT_TTL_MS
} from "../api/_lib/logo-votes-core.js";

const BASE = "https://proto.example.com";
const IDS = loadLogoIds();
const zeros = () => Object.fromEntries(IDS.map((id) => [id, 0]));
const DEV = "d_0123456789abcdef0123";
const DEV2 = "d_fedcba9876543210fedc";
const openLimiter = () => ({ allowed: true, retryAfter: 0 });

function mockBlob() {
  const store = new Map();
  const calls = { put: [], del: [], list: 0 };
  return {
    store, calls,
    put: async (pathname, body, o) => {
      calls.put.push({ pathname, body, o });
      if (store.has(pathname) && !o.allowOverwrite) throw new Error("This blob already exists");
      store.set(pathname, body);
      return { pathname };
    },
    del: async (pathname) => { calls.del.push(pathname); store.delete(pathname); },
    list: async ({ prefix, cursor, limit }) => {
      calls.list += 1;
      const all = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = all.slice(start, start + (limit || 1000));
      const next = start + page.length;
      return { blobs: page.map((pathname) => ({ pathname })), hasMore: next < all.length, cursor: next < all.length ? String(next) : undefined };
    }
  };
}
function mk(opts = {}) {
  const blob = opts.blob || mockBlob();
  let t = 1_700_000_000_000;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const handle = createLogoVotesHandler({
    put: blob.put, del: blob.del, list: blob.list, env: {}, logoIds: IDS,
    limiter: opts.limiter || openLimiter, readLimiter: openLimiter, now: clock.now
  });
  return { blob, clock, handle };
}
const post = (body, headers = {}) => new Request(BASE + "/api/logo-votes", {
  method: "POST",
  headers: Object.assign({ "content-type": "application/json", host: "proto.example.com", "x-real-ip": "1.2.3.4" }, headers),
  body: typeof body === "string" ? body : JSON.stringify(body)
});
const get = () => new Request(BASE + "/api/logo-votes", { headers: { host: "proto.example.com" } });

test("logos.json ids load and match the shortlist", () => {
  assert.deepEqual(IDS.slice(0, 4), ["care-cradle", "two-hands", "called-dots", "word-seal"]);
  assert.equal(new Set(IDS).size, IDS.length);
});

test("every logo file exists and is a safe SVG (no script, foreignObject, external refs or handlers)", () => {
  const data = JSON.parse(readFileSync(new URL("../assets/logos/logos.json", import.meta.url), "utf8"));
  for (const l of data.logos) {
    assert.ok(l.name.ar && l.name.en && l.idea.ar && l.idea.en, l.id + " text");
    for (const k of ["symbol", "symbolOnInk", "lockup"]) assert.ok(l.files[k], l.id + " " + k);
    for (const f of Object.values(l.files)) {
      assert.match(f, /^[a-z0-9-]+\.svg$/);
      const url = new URL("../assets/logos/" + f, import.meta.url);
      assert.ok(existsSync(url), f);
      const svg = readFileSync(url, "utf8");
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="[\d. ]+"/, f);
      assert.doesNotMatch(svg, /<script|foreignObject|<image|<iframe|<use|href|url\(|@import|javascript:|\son[a-z]+\s*=/i, f);
    }
  }
});

test("validateVote accepts the right shape and rejects everything else", () => {
  assert.equal(validateVote({ logoId: "two-hands", deviceId: DEV, action: "vote" }, IDS).ok, true);
  assert.equal(validateVote({ logoId: "two-hands", deviceId: DEV, action: "unvote" }, IDS).ok, true);
  const bad = [
    null, [1], "x",
    { logoId: "nope", deviceId: DEV, action: "vote" },
    { logoId: "__proto__", deviceId: DEV, action: "vote" },
    { logoId: "two-hands", deviceId: "short", action: "vote" },
    { logoId: "two-hands", deviceId: "../../feedback/x-aaaaaaaaaaaa", action: "vote" },
    { logoId: "two-hands", deviceId: "a".repeat(65), action: "vote" },
    { logoId: "two-hands", deviceId: DEV, action: "delete" },
    { logoId: "two-hands", deviceId: DEV },
    { logoId: "two-hands", deviceId: DEV, action: "vote", extra: 1 },
    { logoId: 1, deviceId: DEV, action: "vote" }
  ];
  for (const b of bad) assert.equal(validateVote(b, IDS).ok, false, JSON.stringify(b));
});

test("countVotes counts only known logos and well-formed names", () => {
  const c = countVotes([
    { pathname: votePath("two-hands", DEV) }, { pathname: votePath("two-hands", DEV2) }, { pathname: votePath("word-seal", DEV) },
    { pathname: "votes/other-logo/" + DEV + ".json" }, { pathname: "votes/two-hands/bad.json" }, { pathname: "feedback/x.json" }
  ], IDS);
  assert.deepEqual(c, { ...zeros(), "two-hands": 2, "word-seal": 1 });
});

test("vote stores one private blob per device and logo; second vote is idempotent; unvote deletes", async () => {
  const { blob, handle } = mk();
  let res = await handle(post({ logoId: "called-dots", deviceId: DEV, action: "vote" }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { ok: true, logoId: "called-dots", voted: true, alreadyVoted: false, count: 1 });
  const p = blob.calls.put[0];
  assert.equal(p.pathname, "votes/called-dots/" + DEV + ".json");
  assert.equal(p.o.access, "private");
  assert.equal(p.o.allowOverwrite, false);
  assert.equal(p.o.addRandomSuffix, false);

  res = await handle(post({ logoId: "called-dots", deviceId: DEV, action: "vote" }));
  assert.deepEqual(await res.json(), { ok: true, logoId: "called-dots", voted: true, alreadyVoted: true, count: 1 });

  res = await handle(post({ logoId: "called-dots", deviceId: DEV2, action: "vote" }));
  assert.equal((await res.json()).count, 2);

  res = await handle(post({ logoId: "called-dots", deviceId: DEV, action: "unvote" }));
  assert.deepEqual(await res.json(), { ok: true, logoId: "called-dots", voted: false, alreadyVoted: false, count: 1 });
  assert.deepEqual(blob.calls.del, ["votes/called-dots/" + DEV + ".json"]);
  assert.ok(!blob.store.has("votes/called-dots/" + DEV + ".json"));
});

test("GET returns counts for every logo, paginates the listing, and is cached for at most 10 s", async () => {
  const { blob, clock, handle } = mk();
  for (let i = 0; i < 1203; i++) blob.store.set(votePath("word-seal", "dev_" + String(i).padStart(16, "0")), "{}");
  blob.store.set(votePath("two-hands", DEV), "{}");
  let res = await handle(get());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "public, max-age=0, s-maxage=10");
  let out = await res.json();
  assert.deepEqual(out.counts, { ...zeros(), "two-hands": 1, "word-seal": 1203 });
  assert.equal(out.total, 1204);
  assert.ok(!JSON.stringify(out).includes(DEV), "device ids are never exposed");
  const listsAfterFirst = blob.calls.list;
  assert.equal(listsAfterFirst, 2);

  blob.store.set(votePath("care-cradle", DEV), "{}");
  out = await (await handle(get())).json();
  assert.equal(blob.calls.list, listsAfterFirst, "served from cache");
  assert.equal(out.counts["care-cradle"], 0);
  clock.advance(COUNT_TTL_MS);
  out = await (await handle(get())).json();
  assert.equal(out.counts["care-cradle"], 1);
});

test("a vote refreshes the cached count for that logo", async () => {
  const { handle } = mk();
  await handle(get());
  await handle(post({ logoId: "two-hands", deviceId: DEV, action: "vote" }));
  const out = await (await handle(get())).json();
  assert.equal(out.counts["two-hands"], 1);
});

test("bad requests: 400 validation, 415 content type, 413 size, 400 JSON, 405 method, 403 cross-site", async () => {
  const { blob, handle } = mk();
  assert.equal((await handle(post({ logoId: "x", deviceId: DEV, action: "vote" }))).status, 400);
  assert.equal((await handle(post("{bad"))).status, 400);
  assert.equal((await handle(post({ logoId: "two-hands", deviceId: DEV, action: "vote" }, { "content-type": "text/plain" }))).status, 415);
  assert.equal((await handle(post(JSON.stringify({ logoId: "two-hands", deviceId: DEV, action: "vote" }) + " ".repeat(MAX_VOTE_BODY)))).status, 413);
  const del = new Request(BASE + "/api/logo-votes", { method: "DELETE" });
  const r405 = await handle(del);
  assert.equal(r405.status, 405);
  assert.equal(r405.headers.get("allow"), "GET, POST");
  assert.equal((await handle(post({ logoId: "two-hands", deviceId: DEV, action: "vote" }, { "sec-fetch-site": "cross-site" }))).status, 403);
  assert.equal((await handle(post({ logoId: "two-hands", deviceId: DEV, action: "vote" }, { origin: "https://evil.example" }))).status, 403);
  assert.equal(blob.calls.put.length, 0);
});

test("per-IP rate limit returns 429 with Retry-After and stores nothing", async () => {
  const { blob, handle } = mk({ limiter: () => ({ allowed: false, retryAfter: 42 }) });
  const res = await handle(post({ logoId: "two-hands", deviceId: DEV, action: "vote" }));
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("retry-after"), "42");
  assert.equal(blob.calls.put.length, 0);
});

test("storage failures return 503 without leaking details", async () => {
  const blob = mockBlob();
  blob.put = async () => { throw new Error("secret token xyz"); };
  blob.list = async () => { throw new Error("secret token xyz"); };
  const { handle } = mk({ blob });
  const orig = console.error; console.error = () => {};
  try {
    const r1 = await handle(post({ logoId: "two-hands", deviceId: DEV, action: "vote" }));
    assert.equal(r1.status, 503);
    assert.ok(!(await r1.text()).includes("secret"));
    assert.equal((await handle(get())).status, 503);
  } finally { console.error = orig; }
});

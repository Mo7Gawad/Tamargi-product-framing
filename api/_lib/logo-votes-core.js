/* Shared logic for the logo vote API (api/logo-votes.js). Blob calls are injected so tests can mock them.
   Storage: one tiny private blob per vote, votes/<logoId>/<deviceId>.json. Vote = put (no overwrite),
   undo = delete, count = list by prefix. No read-modify-write, so concurrent votes cannot clobber each other. */
import { readFileSync } from "node:fs";
import { json, readJsonBody, createRateLimiter, clientIp, isCrossSite, blobAccess } from "./feedback-core.js";

export const VOTE_PREFIX = "votes/";
export const MAX_VOTE_BODY = 1024;
export const COUNT_TTL_MS = 10 * 1000;
export const ACTIONS = ["vote", "unvote"];
const LOGO_ID = /^[a-z0-9-]{1,40}$/;
const DEVICE_ID = /^[A-Za-z0-9_-]{16,64}$/;

/* The shortlist lives in one data file; adding a logo there needs no code change. */
export function loadLogoIds(url = new URL("../../assets/logos/logos.json", import.meta.url)) {
  const data = JSON.parse(readFileSync(url, "utf8"));
  const ids = (data && Array.isArray(data.logos) ? data.logos : []).map((l) => l && l.id).filter((id) => typeof id === "string" && LOGO_ID.test(id));
  if (!ids.length) throw new Error("logos.json has no valid logos");
  return ids;
}

/* Returns { ok: true, value } or { ok: false, error }. */
export function validateVote(input, logoIds) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "body must be a JSON object" };
  for (const k of Object.keys(input)) if (!["logoId", "deviceId", "action"].includes(k)) return { ok: false, error: "unknown field: " + k.slice(0, 40) };
  const { logoId, deviceId, action } = input;
  if (typeof logoId !== "string" || !logoIds.includes(logoId)) return { ok: false, error: "invalid logoId" };
  if (typeof deviceId !== "string" || !DEVICE_ID.test(deviceId)) return { ok: false, error: "invalid deviceId" };
  if (typeof action !== "string" || !ACTIONS.includes(action)) return { ok: false, error: "invalid action" };
  return { ok: true, value: { logoId, deviceId, action } };
}

export function votePath(logoId, deviceId) { return VOTE_PREFIX + logoId + "/" + deviceId + ".json"; }

async function listAll(list, prefix) {
  let blobs = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    blobs = blobs.concat(page.blobs || []);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

/* Counts per known logo; unknown folders and malformed names are ignored. */
export function countVotes(blobs, logoIds) {
  const counts = Object.fromEntries(logoIds.map((id) => [id, 0]));
  const re = /^votes\/([a-z0-9-]{1,40})\/[A-Za-z0-9_-]{16,64}\.json$/;
  for (const b of blobs) {
    const m = re.exec(b && b.pathname);
    if (m && Object.prototype.hasOwnProperty.call(counts, m[1])) counts[m[1]] += 1;
  }
  return counts;
}

const voteLimiter = createRateLimiter({ limit: 40, windowMs: 10 * 60 * 1000 });
const readLimiter = createRateLimiter({ limit: 120, windowMs: 60 * 1000 });

/* deps: { put, del, list, env, logoIds, limiter, readLimiter, now } */
export function createLogoVotesHandler(deps) {
  const env = deps.env || process.env;
  const limiter = deps.limiter || voteLimiter;
  const rLimiter = deps.readLimiter || readLimiter;
  const now = deps.now || (() => Date.now());
  let ids = deps.logoIds || null;
  let cache = null;   // { at, counts } — per function instance

  function logoIds() {
    if (!ids) ids = loadLogoIds();
    return ids;
  }

  async function handleGet(request) {
    if (!rLimiter(clientIp(request)).allowed) return json(429, { ok: false, error: "too many requests" }, { "Retry-After": "60" });
    const known = logoIds();
    if (!cache || now() - cache.at >= COUNT_TTL_MS) {
      try { cache = { at: now(), counts: countVotes(await listAll(deps.list, VOTE_PREFIX), known) }; }
      catch (err) { console.error("logo-votes: list failed:", err && err.name); return json(503, { ok: false, error: "storage unavailable" }); }
    }
    const total = Object.values(cache.counts).reduce((a, b) => a + b, 0);
    return json(200, { ok: true, counts: cache.counts, total, updatedAt: new Date(cache.at).toISOString() },
      { "Cache-Control": "public, max-age=0, s-maxage=10" });
  }

  async function handlePost(request) {
    if (isCrossSite(request)) return json(403, { ok: false, error: "cross-site request" });
    const rl = limiter(clientIp(request));
    if (!rl.allowed) return json(429, { ok: false, error: "too many requests" }, { "Retry-After": String(rl.retryAfter) });
    const body = await readJsonBody(request, MAX_VOTE_BODY);
    if (!body.ok) return json(body.status, { ok: false, error: body.error });
    const v = validateVote(body.value, logoIds());
    if (!v.ok) return json(400, { ok: false, error: v.error });
    const { logoId, deviceId, action } = v.value;
    const pathname = votePath(logoId, deviceId);
    const access = blobAccess(env);
    let alreadyVoted = false;
    try {
      if (action === "vote") {
        try {
          await deps.put(pathname, JSON.stringify({ logoId, votedAt: new Date(now()).toISOString() }), {
            access, contentType: "application/json", addRandomSuffix: false, allowOverwrite: false
          });
        } catch (err) {
          // Soft server-side check: this device already voted for this logo (put refuses to overwrite).
          const page = await deps.list({ prefix: pathname, limit: 1 });
          if (!(page.blobs || []).some((b) => b.pathname === pathname)) throw err;
          alreadyVoted = true;
        }
      } else {
        await deps.del(pathname);
      }
      const count = countVotes(await listAll(deps.list, VOTE_PREFIX + logoId + "/"), [logoId])[logoId];
      if (cache) cache.counts = Object.assign({}, cache.counts, { [logoId]: count });
      return json(200, { ok: true, logoId, voted: action === "vote", alreadyVoted, count });
    } catch (err) {
      console.error("logo-votes: storage failed:", err && err.name);
      return json(503, { ok: false, error: "storage unavailable" });
    }
  }

  return async function handle(request) {
    try {
      if (request.method === "GET") return await handleGet(request);
      if (request.method === "POST") return await handlePost(request);
      return json(405, { ok: false, error: "method not allowed" }, { Allow: "GET, POST" });
    } catch (err) {
      console.error("logo-votes: failed:", err && err.name);
      return json(500, { ok: false, error: "server error" });
    }
  };
}

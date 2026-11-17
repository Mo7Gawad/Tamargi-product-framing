/* GET /api/logo-votes — public vote counts per logo (cached ~10 s).
   POST /api/logo-votes {logoId, deviceId, action: vote|unvote} — one private blob per vote: votes/<logoId>/<deviceId>.json. */
import { put, del, list } from "@vercel/blob";
import { createLogoVotesHandler } from "./_lib/logo-votes-core.js";

const handle = createLogoVotesHandler({ put, del, list });

export default { fetch: handle };

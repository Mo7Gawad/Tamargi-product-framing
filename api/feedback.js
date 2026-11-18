/* POST /api/feedback — stores one tester comment as its own private blob (feedback/<iso>-<id>.json). */
import { put } from "@vercel/blob";
import { createFeedbackHandler } from "./_lib/feedback-core.js";
import { loadLogoIds } from "./_lib/logo-votes-core.js";

const handle = createFeedbackHandler({ put, logoIds: loadLogoIds() });

export default { fetch: handle };

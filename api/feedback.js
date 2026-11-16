/* POST /api/feedback — stores one tester comment as its own private blob (feedback/<iso>-<id>.json). */
import { put } from "@vercel/blob";
import { createFeedbackHandler } from "./_lib/feedback-core.js";

const handle = createFeedbackHandler({ put });

export default { fetch: handle };

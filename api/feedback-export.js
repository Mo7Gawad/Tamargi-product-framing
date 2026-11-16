/* GET /api/feedback-export?format=csv|json — founder download of all feedback. Header x-admin-key required. */
import { get, list } from "@vercel/blob";
import { createExportHandler } from "./_lib/feedback-core.js";

const handle = createExportHandler({ get, list });

export default { fetch: handle };

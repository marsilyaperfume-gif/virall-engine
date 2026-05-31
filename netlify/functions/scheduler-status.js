const corsHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };

function blobStore(name) {
  const { getStore } = require("@netlify/blobs");
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) return getStore({ name, siteID, token });
  return getStore(name);
}

exports.handler = async function() {
  try {
    const qStore = blobStore("publish_queue");
    const lStore = blobStore("scheduler_logs");
    const queue = (await qStore.get("queue", { type: "json" })) || [];
    const logs = (await lStore.get("logs", { type: "json" })) || [];
    const now = new Date();
    const due = queue.filter(item => item && !["published", "publishing", "deleted"].includes(item.status) && item.scheduledAt && new Date(item.scheduledAt) <= now);
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, now: now.toISOString(), queueCount: queue.length, dueCount: due.length, due: due.slice(0, 10), logs: logs.slice(0, 20) }, null, 2) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, error: err.message }, null, 2) };
  }
};

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json"
};

function blobStore(name) {
  const { getStore } = require("@netlify/blobs");
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) return getStore({ name, siteID, token });
  return getStore(name);
}

async function readQueue() {
  const store = blobStore("publish_queue");
  return (await store.get("queue", { type: "json" })) || [];
}

async function writeQueue(queue) {
  const store = blobStore("publish_queue");
  await store.setJSON("queue", Array.isArray(queue) ? queue : []);
}

function normalizeItem(item, index) {
  const now = new Date().toISOString();
  return {
    ...item,
    id: item.id || `${item.accountId || item.account || "acc"}_${item.videoId || item.video || "video"}_${item.scheduledAt || item.time || index}_${Date.now()}`,
    status: item.status === "published" ? "published" : (item.status === "failed" ? "failed" : "scheduled"),
    attempts: Number(item.attempts || 0),
    createdAt: item.createdAt || now,
    updatedAt: now
  };
}

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders };

  try {
    if (event.httpMethod === "GET") {
      const queue = await readQueue();
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, queue }) };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const incoming = Array.isArray(body.queue) ? body.queue : [];
      const queue = incoming.map(normalizeItem);
      await writeQueue(queue);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, count: queue.length, queue }) };
    }

    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};

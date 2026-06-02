const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,PATCH,OPTIONS",
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
  const allowed = new Set([
    "scheduled",
    "publishing",
    "waiting_publish",
    "publish_check",
    "published",
    "failed",
    "skipped"
  ]);
  const status = allowed.has(String(item.status || "")) ? String(item.status) : "scheduled";
  return {
    ...item,
    id: item.id || `${item.accountId || item.account || "acc"}_${item.videoId || item.video || "video"}_${item.scheduledAt || item.time || index}_${Date.now()}`,
    status,
    attempts: Number(item.attempts || 0),
    createdAt: item.createdAt || now,
    updatedAt: now
  };
}

function itemDay(item) {
  const d = new Date(item.scheduledAt || item.publishedAt || item.createdAt || 0);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function itemAccountKey(item) {
  return String(item && (item.accountId || item.account || item.username || item.user) || "");
}

function itemVideoKey(item) {
  return String(item && (item.videoId || item.video || item.name) || "");
}

function dedupeQueue(queue) {
  const seen = new Set();
  const out = [];
  const priority = { publishing: 6, waiting_publish: 5, publish_check: 4, published: 3, scheduled: 2, failed: 1, skipped: 0 };
  [...queue].sort((a, b) => {
    const base = new Date(a.scheduledAt || a.publishedAt || 0) - new Date(b.scheduledAt || b.publishedAt || 0);
    if (base) return base;
    return (priority[b.status] || 0) - (priority[a.status] || 0);
  }).forEach(item => {
    if (!item || item.status === "deleted") return;
    const key = [itemAccountKey(item), itemVideoKey(item), itemDay(item)].join("::");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
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
      const queue = dedupeQueue(incoming.map(normalizeItem));
      await writeQueue(queue);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, count: queue.length, queue }) };
    }

    if (event.httpMethod === "DELETE") {
      const body = JSON.parse(event.body || "{}");
      const id = String(body.id || event.queryStringParameters?.id || "");
      const before = await readQueue();
      const queue = id ? before.filter(item => String(item.id) !== id) : [];
      await writeQueue(queue);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, deleted: id || "all", count: queue.length, queue }) };
    }

    if (event.httpMethod === "PATCH") {
      const body = JSON.parse(event.body || "{}");
      const id = String(body.id || "");
      const patch = body.patch || {};
      const queue = await readQueue();
      const idx = queue.findIndex(item => String(item.id) === id);
      if (idx < 0) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ ok: false, error: "Queue item not found" }) };
      queue[idx] = { ...queue[idx], ...patch, updatedAt: new Date().toISOString() };
      await writeQueue(queue);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, item: queue[idx], queue }) };
    }

    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};

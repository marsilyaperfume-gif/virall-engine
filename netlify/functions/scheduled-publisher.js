const corsHeaders = { "Content-Type": "application/json" };

function blobStore(name) {
  const { getStore } = require("@netlify/blobs");
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) return getStore({ name, siteID, token });
  return getStore(name);
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function graphPost(path, params) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  const res = await fetch(url, { method: "POST" });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(JSON.stringify(data));
    err.graphData = data;
    throw err;
  }
  return data;
}

function isMediaNotReadyError(err) {
  const msg = err && err.message ? err.message : "";
  return msg.includes("Media ID is not available") || msg.includes('"code":9007') || msg.includes('"error_subcode":2207027');
}

async function attemptMediaPublish(instagramId, creationId, accessToken) {
  try {
    return await graphPost(`${instagramId}/media_publish`, { creation_id: creationId, access_token: accessToken });
  } catch (err) {
    if (isMediaNotReadyError(err)) {
      err.mediaNotReady = true;
    }
    throw err;
  }
}

async function readQueue() {
  const store = blobStore("publish_queue");
  return (await store.get("queue", { type: "json" })) || [];
}

async function writeQueue(queue) {
  const store = blobStore("publish_queue");
  await store.setJSON("queue", queue);
}

async function getAccount(accountId) {
  const store = blobStore("ig_accounts");
  return await store.get(accountId, { type: "json" });
}

function due(item, now) {
  if (!item || item.status === "published" || item.status === "publishing") return false;
  if (item.nextAttemptAt && new Date(item.nextAttemptAt) > now) return false;
  if (!item.scheduledAt) return false;
  return new Date(item.scheduledAt) <= now;
}

async function publishItem(item) {
  if (!item.accountId) throw new Error("Missing accountId");
  if (!item.videoUrl) throw new Error("Missing public videoUrl. أعد رفع الفيديو حتى يحصل على رابط Supabase عام قبل الجدولة.");
  if (String(item.videoUrl).startsWith("blob:")) throw new Error("Video URL is local blob, not public.");

  const account = await getAccount(item.accountId);
  if (!account) throw new Error("Instagram account not found. أعد ربط الحساب.");
  const accessToken = account.pageAccessToken;
  const instagramId = account.instagramId || account.id;
  if (!accessToken || !instagramId) throw new Error("Stored account is missing token or Instagram ID.");

  if (!item.creationId) {
    const container = await graphPost(`${instagramId}/media`, {
      media_type: "REELS",
      video_url: item.videoUrl,
      caption: item.caption || item.hook || "",
      access_token: accessToken
    });
    if (!container.id) throw new Error("No creation container ID returned");
    item.creationId = container.id;
    item.containerCreatedAt = new Date().toISOString();
    const wait = new Error("Instagram is processing the video container");
    wait.mediaNotReady = true;
    throw wait;
  }

  const published = await attemptMediaPublish(instagramId, item.creationId, accessToken);
  return { containerId: item.creationId, published };
}

exports.handler = async function() {
  const now = new Date();
  const lockStore = blobStore("publish_locks");
  const lock = await lockStore.get("scheduled-publisher", { type: "json" });
  if (lock && lock.expiresAt && new Date(lock.expiresAt) > now) {
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, skipped: "locked" }) };
  }
  await lockStore.setJSON("scheduled-publisher", { lockedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 4 * 60 * 1000).toISOString() });

  const results = [];
  try {
    const queue = await readQueue();
    let changed = false;

    for (const item of queue) {
      if (!due(item, now)) continue;
      item.status = "publishing";
      item.updatedAt = new Date().toISOString();
      changed = true;
      await writeQueue(queue);

      try {
        const result = await publishItem(item);
        item.status = "published";
        item.publishedAt = new Date().toISOString();
        item.result = result;
        results.push({ id: item.id, ok: true });
      } catch (err) {
        if (err.mediaNotReady) {
          item.status = "scheduled";
          item.error = "Instagram is still processing the video. سيتم التحقق مرة أخرى تلقائياً.";
          item.nextAttemptAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
        } else {
          item.attempts = Number(item.attempts || 0) + 1;
          item.status = item.attempts >= 3 ? "failed" : "scheduled";
          item.error = err.message || String(err);
          item.nextAttemptAt = new Date(Date.now() + Math.min(60, item.attempts * 15) * 60 * 1000).toISOString();
        }
        results.push({ id: item.id, ok: false, error: item.error });
      }
      item.updatedAt = new Date().toISOString();
      changed = true;
      await writeQueue(queue);
    }

    if (changed) await writeQueue(queue);
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, processed: results.length, results }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, error: err.message }) };
  } finally {
    await lockStore.delete("scheduled-publisher").catch(() => {});
  }
};


exports.config = { schedule: "*/5 * * * *" };

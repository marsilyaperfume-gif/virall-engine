const corsHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};

function blobStore(name) {
  const { getStore } = require("@netlify/blobs");
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) return getStore({ name, siteID, token });
  return getStore(name);
}

async function graphPost(path, params) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  const res = await fetch(url, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(JSON.stringify(data));
    err.graphData = data;
    throw err;
  }
  return data;
}

function isMediaNotReadyError(err) {
  const msg = err && err.message ? err.message : "";
  return (
    msg.includes("Media ID is not available") ||
    msg.includes("الوسائط غير جاهزة") ||
    msg.includes('"code":9007') ||
    msg.includes('"error_subcode":2207027') ||
    msg.toLowerCase().includes("processing") ||
    msg.toLowerCase().includes("not ready") ||
    msg.toLowerCase().includes("wait")
  );
}

async function readQueue() {
  const store = blobStore("publish_queue");
  return (await store.get("queue", { type: "json" })) || [];
}

async function writeQueue(queue) {
  const store = blobStore("publish_queue");
  await store.setJSON("queue", Array.isArray(queue) ? queue : []);
}

async function writeSchedulerLog(entry) {
  const store = blobStore("scheduler_logs");
  const current = (await store.get("logs", { type: "json" })) || [];
  current.unshift({ at: new Date().toISOString(), ...entry });
  await store.setJSON("logs", current.slice(0, 200));
}

async function getAccount(accountId) {
  const store = blobStore("ig_accounts");
  return await store.get(accountId, { type: "json" });
}

function itemTime(item) {
  const raw = item && (item.nextAttemptAt || item.scheduledAt);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function due(item, now) {
  if (!item || item.deleted) return false;
  if (["published", "deleted", "failed"].includes(item.status)) return false;

  // Recover items stuck in publishing after 3 minutes.
  if (item.status === "publishing" && item.updatedAt) {
    const updated = new Date(item.updatedAt);
    if (!Number.isNaN(updated.getTime()) && now.getTime() - updated.getTime() < 3 * 60 * 1000) return false;
  }

  const d = itemTime(item);
  return !!d && d <= now;
}

async function publishStep(item) {
  if (!item.accountId) throw new Error("Missing accountId");
  if (!item.videoUrl) throw new Error("Missing public videoUrl. أعد رفع الفيديو حتى يحصل على رابط Supabase عام قبل الجدولة.");
  if (String(item.videoUrl).startsWith("blob:")) throw new Error("Video URL is local blob, not public.");

  const account = await getAccount(item.accountId);
  if (!account) throw new Error("Instagram account not found. أعد ربط الحساب.");
  const accessToken = account.pageAccessToken;
  const instagramId = account.instagramId || account.id;
  if (!accessToken || !instagramId) throw new Error("Stored account is missing token or Instagram ID.");

  // Cron-safe strategy:
  // First run creates the Instagram media container only.
  // Later runs publish that container when Instagram finishes processing.
  // This avoids long sleeps that can make scheduled functions time out silently.
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
    const wait = new Error("Instagram container created. Waiting for Instagram processing before publish.");
    wait.mediaNotReady = true;
    wait.containerCreated = true;
    throw wait;
  }

  try {
    const published = await graphPost(`${instagramId}/media_publish`, {
      creation_id: item.creationId,
      access_token: accessToken
    });
    return { containerId: item.creationId, published };
  } catch (err) {
    if (isMediaNotReadyError(err)) err.mediaNotReady = true;
    throw err;
  }
}

async function coreRun(source = "scheduled", opts = {}) {
  const startedAt = new Date();
  const now = new Date();
  const maxItems = Number(opts.maxItems || 2); // keep cron fast and reliable
  const lockStore = blobStore("publish_locks");
  const lock = await lockStore.get("scheduled-publisher", { type: "json" });

  if (lock && lock.expiresAt && new Date(lock.expiresAt) > now) {
    const out = { ok: true, skipped: "locked", lock };
    await writeSchedulerLog({ source, ...out });
    return out;
  }

  await lockStore.setJSON("scheduled-publisher", {
    lockedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 60 * 1000).toISOString()
  });

  const results = [];
  try {
    const queue = await readQueue();
    let changed = false;
    let dueCount = 0;
    let processed = 0;

    for (const item of queue) {
      if (!due(item, now)) continue;
      dueCount++;
      if (processed >= maxItems) continue;
      processed++;

      item.status = "publishing";
      item.updatedAt = new Date().toISOString();
      changed = true;
      await writeQueue(queue);

      try {
        const result = await publishStep(item);
        item.status = "published";
        item.publishedAt = new Date().toISOString();
        item.error = "";
        item.nextAttemptAt = "";
        item.result = result;
        results.push({ id: item.id, video: item.video, account: item.account, ok: true, status: item.status });
      } catch (err) {
        if (err.mediaNotReady) {
          item.status = "processing";
          item.error = err.containerCreated
            ? "تم إنشاء حاوية Instagram، وسيتم النشر تلقائياً بعد أن يجهز الفيديو."
            : "Instagram ما زال يعالج الفيديو. سيحاول محرك الجدولة مرة أخرى تلقائياً.";
          item.nextAttemptAt = new Date(Date.now() + 60 * 1000).toISOString();
          results.push({ id: item.id, video: item.video, account: item.account, ok: true, status: item.status, nextAttemptAt: item.nextAttemptAt });
        } else {
          item.attempts = Number(item.attempts || 0) + 1;
          item.status = item.attempts >= 5 ? "failed" : "scheduled";
          item.error = err.message || String(err);
          item.nextAttemptAt = new Date(Date.now() + Math.min(60, Math.max(2, item.attempts * 5)) * 60 * 1000).toISOString();
          results.push({ id: item.id, video: item.video, account: item.account, ok: false, status: item.status, error: item.error, nextAttemptAt: item.nextAttemptAt });
        }
      }
      item.updatedAt = new Date().toISOString();
      changed = true;
      await writeQueue(queue);
    }

    if (changed) await writeQueue(queue);
    const out = {
      ok: true,
      source,
      now: now.toISOString(),
      queueCount: queue.length,
      dueCount,
      processed: results.length,
      maxItems,
      results,
      durationMs: Date.now() - startedAt.getTime()
    };
    await writeSchedulerLog(out);
    return out;
  } catch (err) {
    const out = { ok: false, source, error: err.message || String(err) };
    await writeSchedulerLog(out).catch(() => {});
    return out;
  } finally {
    await lockStore.delete("scheduled-publisher").catch(() => {});
  }
}

exports.handler = async function(event) {
  if (event && event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders };
  const source = event && event.headers && event.headers["x-nf-event"] ? "netlify-cron-toml" : "http/manual";
  const out = await coreRun(source, { maxItems: 2 });
  return { statusCode: out.ok ? 200 : 500, headers: corsHeaders, body: JSON.stringify(out, null, 2) };
};

exports._coreRun = coreRun;

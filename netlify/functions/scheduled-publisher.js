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
  await store.setJSON("logs", current.slice(0, 300));
}

function scheduledDate(item) {
  const raw = item && (item.nextAttemptAt || item.scheduledAt);
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function isDue(item, now) {
  if (!item || item.deleted) return false;
  if (["published", "deleted", "failed"].includes(item.status)) return false;
  const d = scheduledDate(item);
  return !!d && d.getTime() <= now.getTime();
}

function itemCaption(item) {
  return item.caption || item.hook || "";
}

async function coreRun(source = "scheduled", opts = {}) {
  const startedAt = Date.now();
  const now = new Date();
  const maxItems = Number(opts.maxItems || 1); // exact same publish path can wait; one item per tick is safer.
  const lockStore = blobStore("publish_locks");
  const lock = await lockStore.get("scheduled-publisher-v43", { type: "json" });

  if (lock && lock.expiresAt && new Date(lock.expiresAt) > now) {
    const out = { ok: true, skipped: "locked", lock, now: now.toISOString() };
    await writeSchedulerLog({ source, ...out });
    return out;
  }

  await lockStore.setJSON("scheduled-publisher-v43", {
    lockedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 4 * 60 * 1000).toISOString()
  });

  const results = [];
  try {
    const queue = await readQueue();
    let dueCount = 0;
    let processed = 0;

    for (const item of queue) {
      if (!isDue(item, now)) continue;
      dueCount++;
      if (processed >= maxItems) continue;
      processed++;

      item.status = "publishing";
      item.autoStartedAt = new Date().toISOString();
      item.updatedAt = new Date().toISOString();
      item.error = "";
      await writeQueue(queue);

      try {
        const reel = require("./publish-reel.js");
        let result;

        // Netlify scheduled functions must finish quickly.
        // Step 1 creates the Instagram media container. Step 2 publishes it on the next tick.
        // This avoids the old 25s + retry loop that made autopublish fail silently.
        if (!item.creationId) {
          result = await reel.createReelContainer({
            accountId: item.accountId,
            videoUrl: item.videoUrl,
            caption: itemCaption(item)
          });
          item.creationId = result.containerId;
          item.status = "waiting_publish";
          item.nextAttemptAt = new Date(Date.now() + 60 * 1000).toISOString();
          item.error = "";
          results.push({ id: item.id, ok: true, status: "waiting_publish", creationId: item.creationId, nextAttemptAt: item.nextAttemptAt });
        } else {
          result = await reel.publishExistingContainer({
            accountId: item.accountId,
            creationId: item.creationId
          }, { initialDelayMs: 0, attempts: 1, retryDelayMs: 0 });

          item.status = "published";
          item.publishedAt = new Date().toISOString();
          item.result = result;
          item.error = "";
          item.nextAttemptAt = "";
          results.push({ id: item.id, ok: true, status: "published", video: item.video, account: item.account });
        }
      } catch (err) {
        item.attempts = Number(item.attempts || 0) + 1;
        const emsg = err.message || String(err);
        const lower = String(emsg).toLowerCase();
        const notReady = lower.includes("media id is not available") || lower.includes("not ready") || lower.includes("processing") || lower.includes("9007") || lower.includes("2207027");
        item.status = notReady ? "waiting_publish" : (item.attempts >= 6 ? "failed" : "scheduled");
        item.error = notReady ? "Instagram ما زال يجهز الفيديو؛ سيتم التحقق مرة أخرى تلقائياً." : emsg;
        item.nextAttemptAt = new Date(Date.now() + (notReady ? 2 : 5) * 60 * 1000).toISOString();
        results.push({ id: item.id, ok: false, status: item.status, error: item.error, nextAttemptAt: item.nextAttemptAt });
      }

      item.updatedAt = new Date().toISOString();
      await writeQueue(queue);
    }

    const out = { ok: true, source, now: now.toISOString(), queueCount: queue.length, dueCount, processed: results.length, maxItems, results, durationMs: Date.now() - startedAt };
    await writeSchedulerLog(out);
    return out;
  } catch (err) {
    const out = { ok: false, source, now: now.toISOString(), error: err.message || String(err), durationMs: Date.now() - startedAt };
    await writeSchedulerLog(out).catch(() => {});
    return out;
  } finally {
    await lockStore.delete("scheduled-publisher-v43").catch(() => {});
  }
}

exports.handler = async function(event) {
  if (event && event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders };
  const source = event && event.headers && event.headers["x-nf-event"] ? "netlify-cron" : "manual-test";
  const out = await coreRun(source, { maxItems: 1 });
  return { statusCode: out.ok ? 200 : 500, headers: corsHeaders, body: JSON.stringify(out, null, 2) };
};

exports._coreRun = coreRun;

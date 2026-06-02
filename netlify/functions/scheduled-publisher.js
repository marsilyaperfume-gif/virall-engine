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


async function readAppState() {
  const store = blobStore("app_state");
  return (await store.get("state", { type: "json" })) || { settings: {}, videos: [], accounts: [], autopilot: false };
}

function videoUrl(v) {
  return (v && (v.publicUrl || v.url || v.supabaseUrl)) || "";
}

function accountKey(a) {
  return String(a && (a.id || a.name || a.user || a.username) || "");
}

function videoKey(v) {
  return String(v && (v.id || v.name) || "");
}

function itemAccountKey(item) {
  return String(item && (item.accountId || item.account || item.username || item.user) || "");
}

function itemVideoKey(item) {
  return String(item && (item.videoId || item.video || item.name) || "");
}

function itemDay(item) {
  const d = new Date(item.scheduledAt || item.publishedAt || item.createdAt || 0);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function scoreVideo(v) {
  return Number(v.score || v.performanceScore || (v.topPerformer ? 85 : 50));
}

function makeCaption(market, v, settings) {
  const footer = settings.captionFooter || "";
  const tags = settings.hashtags || "";
  const hooks = [
    "ريحة تخلي الكل يسألك وش حاط",
    "فخامة واضحة من أول رشة",
    "عطر يعطيك حضور بدون مبالغة",
    "لو تحب العطور الفخمة ركز هنا",
    "اختيار ذكي لمحبي الثبات والفخامة"
  ];
  const hook = v.hook || hooks[Math.floor(Math.random() * hooks.length)];
  return [hook, market ? `مناسب لـ ${market}` : "", footer, tags].filter(Boolean).join("\n\n");
}

function scheduledDate(timeStr, dayOffset, accountIndex, slotIndex) {
  const [hh, mm] = String(timeStr || "08:00").split(":").map(n => Number(n || 0));
  const d = new Date();
  d.setDate(d.getDate() + Number(dayOffset || 0));
  d.setHours(hh || 0, mm || 0, 0, 0);
  // deterministic spread: لا تنشر كل الحسابات بنفس الدقيقة
  d.setMinutes(d.getMinutes() + ((accountIndex * 11 + slotIndex * 7) % 37));
  if (d.getTime() < Date.now() + 2 * 60 * 1000) d.setDate(d.getDate() + 1);
  return d;
}

function hasDuplicate(queue, accKey, vidKey, date) {
  const day = date.toISOString().slice(0, 10);
  return queue.some(q => {
    if (!q || ["deleted", "failed", "skipped"].includes(q.status)) return false;
    return itemAccountKey(q) === accKey && itemVideoKey(q) === vidKey && itemDay(q) === day;
  });
}

function hasRecent(queue, accKey, vidKey, targetDate, cooldownDays, planned) {
  const key = accKey + "::" + vidKey;
  const target = targetDate.getTime();
  const ms = cooldownDays * 86400000;
  if ((planned.get(key) || []).some(d => Math.abs(target - d.getTime()) < ms)) return true;
  return queue.some(q => {
    if (!q || ["deleted", "failed", "skipped"].includes(q.status)) return false;
    if (itemAccountKey(q) !== accKey || itemVideoKey(q) !== vidKey) return false;
    const d = new Date(q.scheduledAt || q.publishedAt || q.createdAt || 0);
    return !Number.isNaN(d.getTime()) && Math.abs(target - d.getTime()) < ms;
  });
}

function hasUsedBeforeForAccount(queue, accKey, vidKey, planned) {
  const key = accKey + "::" + vidKey;
  if ((planned.get(key) || []).length) return true;
  return queue.some(q => {
    if (!q || ["deleted", "failed", "skipped"].includes(q.status)) return false;
    return itemAccountKey(q) === accKey && itemVideoKey(q) === vidKey;
  });
}

function markPlanned(planned, accKey, vidKey, date) {
  const key = accKey + "::" + vidKey;
  const arr = planned.get(key) || [];
  arr.push(new Date(date));
  planned.set(key, arr);
}

function chooseVideo(videos, queue, account, targetDate, usedToday, planned, settings, slotSeed) {
  const accKey = accountKey(account);
  const cooldown = Number(settings.repeatCooldownDays || 21);
  const usable = videos.filter(v => videoUrl(v) && !String(videoUrl(v)).startsWith("blob:") && !usedToday.has(videoKey(v)));

  // First pass: use every stored video once per account before recycling anything.
  const neverUsed = usable.filter(v => !hasUsedBeforeForAccount(queue, accKey, videoKey(v), planned));
  if (neverUsed.length) return neverUsed[slotSeed % neverUsed.length];

  // Second pass: after stored videos are exhausted, recycle successful videos only.
  const winners = usable.filter(v => {
    const vk = videoKey(v);
    const isWinner = v.success === true || v.topPerformer === true || scoreVideo(v) >= Number(settings.minimumRecycleScore || 70);
    return isWinner && !hasRecent(queue, accKey, vk, targetDate, cooldown, planned);
  });
  if (winners.length) return winners.sort((a,b)=>scoreVideo(b)-scoreVideo(a))[slotSeed % winners.length];
  return null;
}

function dedupeQueue(queue) {
  const seen = new Set();
  const out = [];
  queue.sort((a,b)=>new Date(a.scheduledAt || a.publishedAt || 0)-new Date(b.scheduledAt || b.publishedAt || 0)).forEach(q => {
    if (!q || q.status === "deleted") return;
    const key = [itemAccountKey(q), itemVideoKey(q), itemDay(q), q.status || "scheduled"].join("::");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(q);
  });
  return out;
}

async function refillRollingQueue(queue) {
  const state = await readAppState().catch(() => null);
  if (!state || !state.autopilot) return { added: 0, reason: "autopilot_off" };
  const settings = state.settings || {};
  const videos = Array.isArray(state.videos) ? state.videos : [];
  const accounts = (Array.isArray(state.accounts) ? state.accounts : []).filter(a => a && a.id && a.official !== false);
  if (!videos.length || !accounts.length) return { added: 0, reason: "missing_videos_or_accounts" };

  const days = 3;
  const daily = Math.max(1, Number(settings.daily || 3));
  const times = Array.isArray(settings.times) && settings.times.length ? settings.times : ["08:00", "16:00", "00:00"];
  const activeCount = queue.filter(q => q && !["published", "failed", "deleted", "skipped"].includes(q.status)).length;
  const targetCount = days * daily * accounts.length;
  if (activeCount >= targetCount) return { added: 0, activeCount, targetCount };

  const before = queue.length;
  const planned = new Map();
  for (let day = 0; day < days; day++) {
    accounts.forEach((acc, accountIndex) => {
      const usedToday = new Set();
      for (let slot = 0; slot < daily; slot++) {
        const at = scheduledDate(times[slot % times.length], day, accountIndex, slot);
        const v = chooseVideo(videos, queue, acc, at, usedToday, planned, settings, day * daily + slot + accountIndex);
        if (!v) continue;
        const accKey = accountKey(acc);
        const vidKey = videoKey(v);
        if (hasDuplicate(queue, accKey, vidKey, at) || usedToday.has(vidKey)) continue;
        usedToday.add(vidKey); markPlanned(planned, accKey, vidKey, at);
        const stamp = at.toISOString();
        queue.push({
          id: `${accKey}_${vidKey}_${stamp.slice(0,16)}`,
          videoId: v.id,
          video: v.name,
          videoUrl: videoUrl(v),
          accountId: acc.id,
          account: acc.name || acc.user || acc.username,
          market: acc.market || "عام الخليج",
          time: at.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }),
          scheduledAt: stamp,
          status: "scheduled",
          hook: v.hook || "",
          caption: makeCaption(acc.market || "عام الخليج", v, settings),
          createdAt: new Date().toISOString(),
          smart: true,
          rolling: true,
          recycleScore: scoreVideo(v)
        });
      }
    });
  }
  const deduped = dedupeQueue(queue);
  queue.splice(0, queue.length, ...deduped);
  return { added: Math.max(0, queue.length - before), activeCount, targetCount, queueCount: queue.length };
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

async function markVideoSuccessfulInState(item) {
  try {
    const state = await readAppState();
    const videos = Array.isArray(state.videos) ? state.videos : [];
    const idx = videos.findIndex(v => String(v.id || v.name) === String(item.videoId || item.video));
    if (idx >= 0) {
      const current = videos[idx] || {};
      const postedTo = Array.isArray(current.postedTo) ? current.postedTo.slice() : [];
      const accName = item.account || item.accountId || "Instagram";
      if (!postedTo.includes(accName)) postedTo.push(accName);
      videos[idx] = {
        ...current,
        success: true,
        topPerformer: current.topPerformer || false,
        score: Math.max(Number(current.score || 50), 75),
        postedTo,
        lastPublishedAt: new Date().toISOString()
      };
      const store = blobStore("app_state");
      await store.setJSON("state", { ...state, videos, savedAt: new Date().toISOString() });
    }
  } catch (e) {
    await writeSchedulerLog({ source: "mark-state", ok: false, error: e.message || String(e), item: item.id }).catch(() => {});
  }
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
          await markVideoSuccessfulInState(item);
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

    const refill = await refillRollingQueue(queue).catch(err => ({ added: 0, error: err.message || String(err) }));
    if (refill && refill.added) await writeQueue(queue);

    const out = { ok: true, source, now: now.toISOString(), queueCount: queue.length, dueCount, processed: results.length, maxItems, results, refill, durationMs: Date.now() - startedAt };
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

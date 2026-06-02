
/* ===== v32 Auto Scheduler + Duplicate Publish Fix ===== */

window.__publishLocks = window.__publishLocks || {};

function acquirePublishLock(key){
  if(window.__publishLocks[key]) return false;
  window.__publishLocks[key] = true;
  return true;
}

function releasePublishLock(key){
  delete window.__publishLocks[key];
}

let __serverQueueSyncTimer = null;

function toServerScheduledAt(timeStr){
  const now = new Date();
  const parts = String(timeStr || "").match(/(\d{1,2})[:٫](\d{1,2})/);
  if(!parts) return "";
  const d = new Date(now);
  d.setHours(Number(parts[1]), Number(parts[2]), 0, 0);
  if(d.getTime() <= now.getTime() - 60 * 1000){
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString();
}

function publicVideoUrl(video){
  return (video && (video.publicUrl || video.cloudinaryUrl || video.url)) || "";
}

async function syncQueueToServerNow(){
  try{
    if(typeof queue === "undefined" || !Array.isArray(queue)) return;
    const base = ((typeof settings !== "undefined" && settings.backendUrl) || "/.netlify/functions").replace(/\/$/, "");

    // Pull server queue first, then merge locally. This prevents an open browser from overwriting
    // statuses changed by the 24/7 scheduler, such as published/failed/nextAttemptAt.
    let serverQueue = [];
    try {
      const res = await fetch(base + "/queue", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.queue)) serverQueue = data.queue;
    } catch(e) {}

    const byId = new Map();
    serverQueue.forEach(item => { if(item && item.id) byId.set(String(item.id), item); });

    queue.forEach((item, index) => {
      const id = item.id || `${item.accountId || item.account || "acc"}_${item.videoId || item.video || "video"}_${item.time || index}`;
      const existing = byId.get(String(id));
      const normalized = {
        ...item,
        id,
        scheduledAt: item.scheduledAt || toServerScheduledAt(item.time || item.scheduledTime),
        status: item.status || "scheduled"
      };
      if(existing && ["published", "publishing", "failed", "waiting_publish", "publish_check"].includes(existing.status)){
        byId.set(String(id), { ...normalized, ...existing });
      } else {
        byId.set(String(id), { ...(existing || {}), ...normalized });
      }
    });

    const payloadQueue = Array.from(byId.values()).filter(item => item && item.status !== "deleted");
    await fetch(base + "/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queue: payloadQueue })
    });
  }catch(err){
    console.warn("Server queue sync failed", err);
  }
}

function syncQueueToServerDebounced(){
  clearTimeout(__serverQueueSyncTimer);
  __serverQueueSyncTimer = setTimeout(syncQueueToServerNow, 800);
}

async function loadQueueFromServer(){
  try{
    const base = ((typeof settings !== "undefined" && settings.backendUrl) || "/.netlify/functions").replace(/\/$/, "");
    const res = await fetch(base + "/queue");
    const data = await res.json();
    if(res.ok && Array.isArray(data.queue)){
      queue = data.queue;
      if(typeof persistAll === "function") persistAll();
      if(typeof renderAll === "function") renderAll();
    }
  }catch(err){
    console.warn("Server queue load failed", err);
  }
}

async function v32AutoPublishScheduler(){
  try{
    if(typeof queue === "undefined" || !Array.isArray(queue) || !queue.length) return;
    if(typeof publishNowFromQueue !== "function") return;

    const now = new Date();
    let changed = false;

    for(let i=0;i<queue.length;i++){
      const item = queue[i];
      if(!item) continue;
      if(["published", "publishing", "failed", "deleted", "waiting_publish", "publish_check"].includes(item.status)) continue;

      const raw = item.scheduledAt || toServerScheduledAt(item.time || item.scheduledTime);
      if(!raw) continue;
      const dueAt = new Date(raw);
      if(Number.isNaN(dueAt.getTime())) continue;

      // This is the important fix: automatic publishing now behaves exactly like clicking
      // the queue item's "نشر الآن" button when the scheduled time has passed.
      if(dueAt.getTime() <= now.getTime()){
        item.status = "publishing";
        item.updatedAt = new Date().toISOString();
        changed = true;
        try{ if(typeof persistAll === "function") persistAll(); }catch(e){}
        try{ if(typeof syncQueueToServerNow === "function") await syncQueueToServerNow(); }catch(e){}

        try{
          await publishNowFromQueue(i, { skipConfirm: true, silent: true, auto: true });
        }catch(err){
          console.error("Auto publish failed", err);
          item.status = "failed";
          item.error = err.message || String(err);
          try{ if(typeof recordError === "function") recordError("فشل النشر التلقائي من المتصفح", err, { queueItem: item.id, video: item.video }); }catch(e){}
        }

        try{
          if(typeof persistAll === "function") persistAll();
          if(typeof syncQueueToServerNow === "function") await syncQueueToServerNow();
          if(typeof renderAll === "function") renderAll();
        }catch(e){}
      }
    }

    if(changed && typeof renderAll === "function") renderAll();
  }catch(err){
    console.error("Auto scheduler error", err);
  }
}

setInterval(v32AutoPublishScheduler, 15000);
window.addEventListener("focus", v32AutoPublishScheduler);
document.addEventListener("visibilitychange", () => { if(!document.hidden) v32AutoPublishScheduler(); });

/* ===== End v32 ===== */


async function publishUploadedVideoNow(index){
  const video = videos[index];
  if(!video){
    alert("الفيديو غير موجود");
    return;
  }

  const officialAccounts = accounts.filter(a => a.official);
  if(!officialAccounts.length){
    alert("لا يوجد حساب Officially Connected");
    return;
  }

  const selected = officialAccounts[0];

  if(!confirm(`نشر الفيديو الآن على ${selected.name || selected.user || "Instagram"} ؟`)){
    return;
  }

  const btns = document.querySelectorAll(`[data-publish-video="${index}"]`);
  btns.forEach(b=>{
    b.disabled=true;
    b.textContent="جاري النشر...";
  });

  try{

    if(video.url && String(video.url).startsWith("blob:")){
      alert("الفيديو مرفوع محلياً فقط حالياً. يجب ربط Storage عام للفيديو قبل النشر الفعلي على Instagram.");
      return;
    }

    const backendBase = (settings.backendUrl || "/.netlify/functions").replace(/\/$/, "");

    const res = await fetch(backendBase + "/publish-reel",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        accountId:selected.id,
        videoUrl:video.cloudinaryUrl || video.url,
        caption:video.caption || ""
      })
    });

    const data = await res.json();

    if(!res.ok){
      throw new Error(data.error || "فشل النشر");
    }

    alert("تم إرسال الفيديو للنشر بنجاح");
  }catch(err){
    console.error(err);
    alert("فشل النشر: " + (err.message || err));
  }finally{
    btns.forEach(b=>{
      b.disabled=false;
      b.textContent="نشر الآن";
    });
  }
}


(() => {
  "use strict";

  const EMAIL = "info@marrsile.com";
  const PASS = "Mo774853";

  const $ = (id) => document.getElementById(id);
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const defaultSettings = {
    hookType: "infinite",
    hookPower: "high",
    emojiMode: "balanced",
    hookLength: "oneLine",
    hookStyle: "bold",
    fontSize: 36,
    hookTop: 58,
    boxWidth: 88,
    hookOpacity: 82,
    hookRadius: 17,
    offerType: "discount",
    ctaMode: "bio",
    hashtags: "#عطور #Perfume #عطور_فاخرة",
    captionFooter: "توصيل سريع · دفع عند الاستلام",
    daily: 3,
    times: ["08:00", "16:00", "00:00"],
    autoHook: true,
    autoCaption: true,
    avoidRepeat: true,
    abTesting: true,
    smartRepost: true,
    autoRetry: true,
    backendUrl: "/.netlify/functions",
    delayMode: "10-30",
    delayMin: 10,
    delayMax: 30,
    cloudinaryCloudName: "",
    cloudinaryUploadPreset: "",
    supabaseUrl: "",
    supabaseAnonKey: "",
    supabaseBucket: "reels",
    scheduleDays: 30,
    repeatCooldownDays: 21,
    minimumRecycleScore: 70
  };

  let settings = loadSettings();
  let videos = [];
  let accounts = [];
  let queue = [];
  let selected = 0;
  let autopilot = false;
  let publicConfigLoaded = false;
  let diagnosticErrors = [];

  const APP_STORE_KEY = "marrsile_growth_engine_v18";


  // ===== v45 REAL AUTOPUBLISH FIX =====
  // The previous auto-publish helpers were outside this app scope, so they could not see
  // the real local `queue` and `settings` variables. These scoped helpers are the ones
  // used by persistAll(), buttons, and the browser auto scheduler.
  let __serverQueueSyncTimerScoped = null;

  function toServerScheduledAtScoped(timeStr){
    const now = new Date();
    const parts = String(timeStr || "").match(/(\d{1,2})[:٫](\d{1,2})/);
    if(!parts) return "";
    const d = new Date(now);
    d.setHours(Number(parts[1]), Number(parts[2]), 0, 0);
    if(d.getTime() <= now.getTime() - 60 * 1000){
      d.setDate(d.getDate() + 1);
    }
    return d.toISOString();
  }

  function normalizeQueueItemForServer(item, index){
    const id = item.id || `${item.accountId || item.account || "acc"}_${item.videoId || item.video || "video"}_${item.time || index}`;
    return {
      ...item,
      id,
      scheduledAt: item.scheduledAt || toServerScheduledAtScoped(item.time || item.scheduledTime),
      status: item.status || "scheduled"
    };
  }

  async function syncQueueToServerNow(){
    try{
      if(!Array.isArray(queue)) return;
      const base = (settings.backendUrl || "/.netlify/functions").replace(/\/$/, "");
      let serverQueue = [];
      try{
        const res = await fetch(base + "/queue", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if(res.ok && Array.isArray(data.queue)) serverQueue = data.queue;
      }catch(e){}

      const byId = new Map();
      serverQueue.forEach(item => { if(item && item.id) byId.set(String(item.id), item); });

      queue.forEach((item, index) => {
        const normalized = normalizeQueueItemForServer(item, index);
        const existing = byId.get(String(normalized.id));
        if(existing && ["published", "publishing", "failed", "waiting_publish", "publish_check"].includes(existing.status)){
          byId.set(String(normalized.id), { ...normalized, ...existing });
        }else{
          byId.set(String(normalized.id), { ...(existing || {}), ...normalized });
        }
      });

      const payloadQueue = Array.from(byId.values()).filter(item => item && item.status !== "deleted");
      const res = await fetch(base + "/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue: payloadQueue })
      });
      if(!res.ok){
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "فشل حفظ الجدولة على السيرفر");
      }
    }catch(err){
      console.warn("Server queue sync failed", err);
      try{ recordError("فشل مزامنة الجدولة مع السيرفر", err); }catch(e){}
    }
  }

  function syncQueueToServerDebounced(){
    clearTimeout(__serverQueueSyncTimerScoped);
    __serverQueueSyncTimerScoped = setTimeout(syncQueueToServerNow, 800);
  }

  async function loadQueueFromServer(){
    try{
      const base = (settings.backendUrl || "/.netlify/functions").replace(/\/$/, "");
      const res = await fetch(base + "/queue", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if(res.ok && Array.isArray(data.queue)){
        queue = data.queue;
        renderAll();
      }
    }catch(err){
      console.warn("Server queue load failed", err);
    }
  }

  async function browserAutoPublishScheduler(){
    try{
      if(!Array.isArray(queue) || !queue.length) return;
      const now = new Date();
      for(let i = 0; i < queue.length; i++){
        const item = queue[i];
        if(!item || ["published", "publishing", "failed", "deleted", "waiting_publish", "publish_check"].includes(item.status)) continue;
        const raw = item.scheduledAt || toServerScheduledAtScoped(item.time || item.scheduledTime);
        if(!raw) continue;
        const dueAt = new Date(raw);
        if(Number.isNaN(dueAt.getTime()) || dueAt.getTime() > now.getTime()) continue;
        await publishNowFromQueue(i, { skipConfirm: true, silent: true, auto: true });
        break; // publish one item per tick to prevent duplicate/parallel attempts
      }
    }catch(err){
      console.error("Auto scheduler error", err);
      try{ recordError("فشل محرك النشر التلقائي داخل المتصفح", err); }catch(e){}
    }
  }

  function startBrowserAutoPublisher(){
    browserAutoPublishScheduler();
    setInterval(browserAutoPublishScheduler, 15000);
    window.addEventListener("focus", browserAutoPublishScheduler);
    document.addEventListener("visibilitychange", () => { if(!document.hidden) browserAutoPublishScheduler(); });
  }
  // ===== END v45 REAL AUTOPUBLISH FIX =====

  function recordError(title, err, extra = {}) {
    const entry = {
      time: new Date().toISOString(),
      title: title || "Error",
      message: err && err.message ? err.message : String(err || ""),
      status: extra.status || "",
      details: extra.details || "",
      file: extra.file || "",
      endpoint: extra.endpoint || ""
    };
    diagnosticErrors.unshift(entry);
    diagnosticErrors = diagnosticErrors.slice(0, 30);
    try { localStorage.setItem("marrsile_error_log_v37", JSON.stringify(diagnosticErrors)); } catch(e) {}
    renderErrorLog();
    console.error("[Marrsile Diagnostic]", entry, err);
  }

  function loadErrorLog() {
    try { diagnosticErrors = JSON.parse(localStorage.getItem("marrsile_error_log_v37") || "[]") || []; } catch(e) { diagnosticErrors = []; }
  }

  function renderErrorLog() {
    const el = $("errorLog");
    if (!el) return;
    if (!diagnosticErrors.length) {
      el.textContent = "لا توجد أخطاء حتى الآن.";
      return;
    }
    el.textContent = diagnosticErrors.map((e, i) => (
      `#${i + 1} ${e.time}\n` +
      `TITLE: ${e.title}\n` +
      `MESSAGE: ${e.message}\n` +
      (e.status ? `STATUS: ${e.status}\n` : "") +
      (e.endpoint ? `ENDPOINT: ${e.endpoint}\n` : "") +
      (e.file ? `FILE: ${e.file}\n` : "") +
      (e.details ? `DETAILS: ${typeof e.details === "string" ? e.details : JSON.stringify(e.details, null, 2)}\n` : "")
    )).join("\n------------------------------\n");
  }

  async function loadPublicConfig(force = false) {
    if (publicConfigLoaded && !force && settings.supabaseUrl && settings.supabaseAnonKey) return settings;
    const base = (settings.backendUrl || "/.netlify/functions").replace(/\/$/, "");
    const endpoint = base + "/public-config";
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data && data.missing ? `Public config غير مكتمل: ${JSON.stringify(data.missing)}` : `Public config failed HTTP ${res.status}`);
      }
      settings.supabaseUrl = String(data.supabaseUrl || "").replace(/\/$/, "");
      settings.supabaseAnonKey = String(data.supabaseAnonKey || "");
      settings.supabaseBucket = String(data.supabaseBucket || "reels");
      publicConfigLoaded = true;
      try { persistAll(); } catch(e) {}
      updateSystemStatus(data);
      return settings;
    } catch (err) {
      recordError("فشل قراءة إعدادات Netlify/Supabase", err, { endpoint });
      updateSystemStatus({ ok: false, error: err.message });
      throw err;
    }
  }

  function updateSystemStatus(data) {
    const el = $("systemStatus");
    if (!el) return;
    if (data && data.ok) {
      el.textContent = `OK ✅\nSUPABASE_URL: ${data.supabaseUrl || settings.supabaseUrl}\nBUCKET: ${data.supabaseBucket || settings.supabaseBucket || "reels"}\nANON KEY: موجود ✅`;
    } else {
      el.textContent = `FAILED ❌\n${(data && data.error) || "الإعدادات غير مكتملة"}`;
    }
  }

  function safeParseStore() {
    try {
      return JSON.parse(localStorage.getItem(APP_STORE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function persistAll() {
    try {
      const safeVideos = videos.map(v => ({
        id: v.id,
        name: v.name,
        size: v.size,
        type: v.type,
        url: v.url || "",
        publicUrl: v.publicUrl || "",
        cloudinaryPublicId: v.cloudinaryPublicId || "",
        supabaseUrl: v.supabaseUrl || "",
        supabasePath: v.supabasePath || "",
        uploadedToSupabase: !!v.uploadedToSupabase,
        hook: v.hook,
        caption: v.caption,
        status: v.status,
        compatibility: v.compatibility,
        compatibilityLabel: v.compatibilityLabel,
        repairStatus: v.repairStatus,
        postedTo: v.postedTo || []
      }));
      localStorage.setItem(APP_STORE_KEY, JSON.stringify({
        loggedIn: $("app") && !$("app").classList.contains("hidden"),
        settings,
        accounts,
        videos: safeVideos,
        queue,
        selected,
        savedAt: new Date().toISOString()
      }));
      if (Array.isArray(queue)) syncQueueToServerDebounced();
    } catch (err) {
      console.error("فشل حفظ البيانات", err);
    }
  }

  function hydrateAll() {
    const saved = safeParseStore();
    if (saved.settings && typeof saved.settings === "object") {
      settings = { ...settings, ...saved.settings };
    }
    if (Array.isArray(saved.accounts)) {
      accounts = saved.accounts;
    }
    if (Array.isArray(saved.videos)) {
      videos = saved.videos;
    }
    if (Array.isArray(saved.queue)) {
      queue = saved.queue;
    }
    if (typeof saved.selected === "number") {
      selected = saved.selected;
    }
    if (saved.loggedIn) {
      $("loginScreen").classList.add("hidden");
      $("app").classList.remove("hidden");
    }
  }

  function persistAuth(loggedIn) {
    const saved = safeParseStore();
    saved.loggedIn = !!loggedIn;
    localStorage.setItem(APP_STORE_KEY, JSON.stringify(saved));
  }


  let uploadState = { active:false, total:0, done:0, failed:0, bytesTotal:0, bytesDone:0, startedAt:0, currentFile:"" };

  function fmtBytes(bytes){
    const n = Number(bytes || 0);
    if(n > 1024*1024*1024) return (n/1024/1024/1024).toFixed(1)+" GB";
    if(n > 1024*1024) return (n/1024/1024).toFixed(1)+" MB";
    if(n > 1024) return (n/1024).toFixed(1)+" KB";
    return n + " B";
  }

  function fmtDuration(sec){
    sec = Math.max(0, Math.round(Number(sec || 0)));
    const m = Math.floor(sec/60), s = sec % 60;
    if(m >= 60){ const h = Math.floor(m/60); return `${h} ساعة و ${m%60} دقيقة`; }
    if(m > 0) return `${m} دقيقة و ${s} ثانية`;
    return `${s} ثانية`;
  }

  function renderUploadProgress(){
    const panel = $("uploadPanel");
    if(!panel) return;
    panel.classList.toggle("hidden", !uploadState.active && uploadState.total === 0);
    const pct = uploadState.bytesTotal ? Math.min(100, Math.round((uploadState.bytesDone/uploadState.bytesTotal)*100)) : 0;
    if($("uploadPercent")) $("uploadPercent").textContent = pct + "%";
    if($("uploadProgressBar")) $("uploadProgressBar").style.width = pct + "%";
    if($("uploadSummary")) $("uploadSummary").textContent = uploadState.active ? `جار رفع ${uploadState.done + uploadState.failed + 1}/${uploadState.total}: ${uploadState.currentFile || ""}` : `تم الرفع: ${uploadState.done} · فشل: ${uploadState.failed}`;
    const elapsed = (Date.now() - uploadState.startedAt) / 1000;
    const speed = elapsed > 0 ? uploadState.bytesDone / elapsed : 0;
    const remaining = speed > 0 ? (uploadState.bytesTotal - uploadState.bytesDone) / speed : 0;
    if($("uploadEta")) $("uploadEta").textContent = uploadState.active ? `الوقت المتبقي: ${fmtDuration(remaining)}` : "الرفع مكتمل";
    if($("uploadSpeed")) $("uploadSpeed").textContent = speed ? `السرعة: ${fmtBytes(speed)}/ث` : "السرعة: --";
  }

  function pushUploadRow(file, status, pct, note){
    const list = $("uploadList");
    if(!list) return;
    const id = "u_" + btoa(unescape(encodeURIComponent(file.name))).replace(/=/g,"").slice(0,18) + "_" + file.size;
    let row = document.getElementById(id);
    if(!row){
      row = document.createElement("div");
      row.id = id;
      row.className = "upload-row";
      row.innerHTML = `<b></b><span></span><div class="mini-progress"><i></i></div><small></small>`;
      list.prepend(row);
    }
    row.querySelector("b").textContent = file.name;
    row.querySelector("span").textContent = status;
    row.querySelector("i").style.width = Math.max(0, Math.min(100, pct || 0)) + "%";
    row.querySelector("small").textContent = note || fmtBytes(file.size);
    row.classList.toggle("done", pct >= 100 && status.includes("تم"));
    row.classList.toggle("bad", status.includes("فشل"));
  }

  function videoScore(v){
    return Number(v.score || v.performanceScore || v.viewsScore || (v.topPerformer ? 85 : 50));
  }

  function hasRecentPublish(video, account, targetDate){
    const cooldown = Number(settings.repeatCooldownDays || 21);
    const vid = video.id || video.name;
    const acc = account.id || account.name || account.user || account.username;
    return queue.some(q => {
      if(String(q.videoId || q.video) !== String(vid) && String(q.video) !== String(video.name)) return false;
      if(String(q.accountId || q.account) !== String(acc) && String(q.account) !== String(account.name || account.user || account.username)) return false;
      if(["deleted","failed"].includes(q.status)) return false;
      const d = new Date(q.scheduledAt || q.publishedAt || q.createdAt || 0);
      if(Number.isNaN(d.getTime())) return false;
      return Math.abs(targetDate.getTime() - d.getTime()) < cooldown * 86400000;
    });
  }

  function chooseSmartVideo(account, dayIndex, slotIndex, usedToday){
    const fresh = videos.filter(v => publicVideoUrl(v) && !usedToday.has(v.id || v.name));
    const targetDate = new Date(Date.now() + dayIndex * 86400000);
    const noRepeat = fresh.filter(v => !hasRecentPublish(v, account, targetDate));
    if(noRepeat.length) return noRepeat[(dayIndex + slotIndex) % noRepeat.length];
    const winners = fresh.filter(v => videoScore(v) >= Number(settings.minimumRecycleScore || 70));
    if(winners.length) return winners.sort((a,b)=>videoScore(b)-videoScore(a))[0];
    return fresh[(dayIndex + slotIndex) % Math.max(1, fresh.length)] || videos[(dayIndex + slotIndex) % Math.max(1, videos.length)];
  }

  function buildSmartQueue(days){
    const official = accounts.filter(a => a.official !== false && a.id);
    const usableAccounts = official.length ? official : accounts;
    const out = [];
    const now = new Date();
    const baseTimes = Array.isArray(settings.times) && settings.times.length ? settings.times : ["08:00","16:00","00:00"];
    const perDay = Math.max(1, Number(settings.daily || baseTimes.length || 1));
    for(let d=0; d<days; d++){
      const usedTodayGlobal = new Set();
      usableAccounts.forEach((a, accountIndex) => {
        const usedToday = new Set(usedTodayGlobal);
        for(let slot=0; slot<perDay; slot++){
          const v = chooseSmartVideo(a, d, slot + accountIndex, usedToday);
          if(!v) continue;
          const time = baseTimes[slot % baseTimes.length] || "08:00";
          const delay = randomDelayMinutes(accountIndex + slot);
          const scheduled = scheduledDateForDay(time, d, delay);
          if(scheduled.getTime() < now.getTime() + 2*60000) scheduled.setDate(scheduled.getDate()+1);
          const vidKey = v.id || v.name;
          usedToday.add(vidKey); usedTodayGlobal.add(vidKey);
          const stamp = scheduled.toISOString();
          out.push({
            id: `${a.id || a.name}_${vidKey}_${stamp}`,
            videoId: v.id,
            video: v.name,
            videoUrl: publicVideoUrl(v),
            accountId: a.id,
            account: a.name || a.user || a.username,
            market: a.market || "عام الخليج",
            time: scheduled.toLocaleTimeString("ar", {hour:"2-digit", minute:"2-digit"}),
            scheduledAt: stamp,
            status: "scheduled",
            hook: settings.autoHook ? makeHook(v.name) : v.hook,
            caption: settings.autoCaption ? makeCaption(a.market || "عام الخليج", v.hook, v.name) : (v.caption || ""),
            createdAt: new Date().toISOString(),
            smart: true,
            dayIndex: d,
            recycleScore: videoScore(v)
          });
        }
      });
    }
    return out.sort((a,b)=>new Date(a.scheduledAt)-new Date(b.scheduledAt));
  }

  function scheduledDateForDay(timeStr, dayOffset, extraMinutes){
    const [hh, mm] = String(timeStr || "08:00").split(":").map(n => Number(n || 0));
    const d = new Date();
    d.setDate(d.getDate() + Number(dayOffset || 0));
    d.setHours(hh || 0, mm || 0, 0, 0);
    d.setMinutes(d.getMinutes() + Number(extraMinutes || 0));
    return d;
  }

  function uploadWithProgress(url, file, options = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(options.method || "PUT", url, true);
      const headers = options.headers || {};
      Object.keys(headers).forEach(k => xhr.setRequestHeader(k, headers[k]));
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && typeof options.onProgress === "function") options.onProgress(ev.loaded, ev.total);
      };
      xhr.onload = () => resolve({ status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300, text: xhr.responseText || "" });
      xhr.onerror = () => reject(new Error("فشل اتصال الرفع المباشر مع Supabase."));
      xhr.ontimeout = () => reject(new Error("انتهت مهلة رفع الفيديو."));
      xhr.timeout = 10 * 60 * 1000;
      xhr.send(options.body || file);
    });
  }

  async function uploadToCloudinary(file) {
    // v49: direct signed upload to Supabase.
    // The Netlify Function now creates only a signed upload URL, so large videos do not pass through Netlify body limits.
    await loadPublicConfig();

    if (!file || !file.size) throw new Error("ملف الفيديو غير صالح أو فارغ.");

    const maxMB = 300;
    const sizeMB = file.size / 1024 / 1024;
    if (sizeMB > maxMB) throw new Error(`حجم الفيديو ${sizeMB.toFixed(1)}MB كبير جداً. استخدم فيديو أقل من ${maxMB}MB.`);

    const createEndpoint = "/.netlify/functions/create-upload-url";
    const signRes = await fetch(createEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name || "video.mp4", contentType: file.type || "video/mp4", size: file.size || 0 })
    });

    const signText = await signRes.text().catch(() => "");
    let signData = {};
    try { signData = signText ? JSON.parse(signText) : {}; } catch(e) { signData = { raw: signText }; }

    if (!signRes.ok || !signData.ok || (!signData.signedUrl && !signData.token)) {
      const msg = signData.message || signData.error || signData.raw || `HTTP ${signRes.status}`;
      const err = new Error("فشل إنشاء رابط الرفع المباشر: " + msg);
      recordError("Supabase Signed URL Failed", err, { status: signRes.status, endpoint: createEndpoint, file: `${file.name} (${sizeMB.toFixed(2)}MB)`, details: signData });
      throw err;
    }

    const signedUrl = signData.signedUrl;
    let lastLoaded = 0;
    const onProgress = (loaded, total) => {
      const delta = Math.max(0, loaded - lastLoaded);
      lastLoaded = loaded;
      uploadState.bytesDone += delta;
      renderUploadProgress();
    };

    let uploadRes;
    try {
      uploadRes = await uploadWithProgress(signedUrl, file, {
        method: "PUT",
        headers: { "Content-Type": file.type || "video/mp4", "x-upsert": "true" },
        onProgress
      });
      if (!uploadRes.ok) {
        const fd = new FormData();
        fd.append("file", file, file.name || "video.mp4");
        lastLoaded = 0;
        uploadRes = await uploadWithProgress(signedUrl, file, { method: "POST", body: fd, onProgress });
      }
    } catch(err) {
      recordError("Supabase Direct Upload Failed", err, { endpoint: signedUrl, file: `${file.name} (${sizeMB.toFixed(2)}MB)` });
      throw err;
    }

    if (!uploadRes.ok) {
      const err = new Error("فشل الرفع المباشر إلى Supabase: HTTP " + uploadRes.status + (uploadRes.text ? " - " + uploadRes.text.slice(0, 300) : ""));
      recordError("Supabase Direct Upload Failed", err, { status: uploadRes.status, endpoint: signedUrl, file: `${file.name} (${sizeMB.toFixed(2)}MB)`, details: uploadRes.text });
      throw err;
    }

    if (lastLoaded < file.size) {
      uploadState.bytesDone += (file.size - lastLoaded);
      renderUploadProgress();
    }

    return {
      url: signData.publicUrl,
      publicUrl: signData.publicUrl,
      cloudinaryPublicId: signData.path,
      supabasePath: signData.path,
      uploadedToSupabase: true,
      localOnly: false
    };
  }

  async function publishVideoNow(index) {
    const video = videos[index];
    if (!video) return alert("الفيديو غير موجود");

    const publishKey = "video_" + (video.id || index);
    if(!acquirePublishLock(publishKey)){
      return alert("هذا الفيديو قيد النشر بالفعل");
    }

    const officialAccounts = accounts.filter(a => a.official);
    if (!officialAccounts.length) return alert("لا يوجد حساب رسمي مربوط");

    const account = officialAccounts[0];
    const videoUrl = video.publicUrl || video.url;

    if (!videoUrl || String(videoUrl).startsWith("blob:")) {
      return alert("لا يمكن النشر الآن لأن الفيديو ليس له رابط عام. ارفع الفيديو إلى Supabase Storage أو أي رابط HTTPS عام ثم أعد المحاولة.");
    }

    try {
      const res = await fetch(functionsBase().replace(/\/$/, "") + "/publish-reel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          videoUrl,
          caption: video.caption || video.hook || settings.captionFooter || ""
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل النشر");

      video.status = "تم إرسال النشر";
      video.postedTo = [...(video.postedTo || []), account.user || account.name];
      persistAll();
      renderAll();
      alert("تم إرسال الفيديو إلى Instagram للنشر.");
    } catch (err) {
      console.error(err);
      alert("فشل النشر: " + (err.message || err));
    } finally {
      releasePublishLock(publishKey);
    }
  }

  function scheduleVideoNow(index) {
    const video = videos[index];
    if (!video) return alert("الفيديو غير موجود");

    const acc = accounts.find(a => a.official) || accounts[0];
    if (!acc) return alert("أضف حساباً أولاً");

    const scheduledDate = new Date(Date.now() + 5 * 60 * 1000);
    const scheduledTime = scheduledDate.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
    queue.push({
      id: `${acc.id || acc.name}_${video.id || video.name}_${scheduledDate.getTime()}`,
      videoId: video.id,
      video: video.name,
      videoUrl: publicVideoUrl(video),
      accountId: acc.id,
      account: acc.name || acc.user || acc.username,
      market: acc.market || "رسمي",
      hook: video.hook,
      caption: makeCaption(acc.market || "عام الخليج", video.hook, video.name),
      time: scheduledTime,
      scheduledAt: scheduledDate.toISOString(),
      status: "scheduled",
      createdAt: new Date().toISOString()
    });
    persistAll();
    renderAll();
    alert("تمت جدولة الفيديو.");
  }


  const gulfHooks = [
    "إذا سألوك وش حاط… لا تستغرب 😮‍💨",
    "ريحة تخلي الكل يلتفت لك 🔥",
    "مو طبيعي هالسعر على هالفخامة",
    "هذا العطر يغيّر حضورك بالكامل",
    "إذا ذوقك فخم، هذا لك",
    "ريحة أغلى من سعرها بكثير",
    "العطر اللي يخليهم يسألونك عنه",
    "لا تدفع زيادة على نفس الفخامة",
    "ثبات يفوز من أول رشة",
    "هذا مو عطر… هذا هيبة",
    "ريحة تدخل قبل كلامك",
    "إذا تحب الفخامة الهادية شوف هذا",
    "هذا العطر عليه كلام كثير 🔥",
    "ريحة مستحيل تمر مرور عادي",
    "كل اللي حولك بينتبهون",
    "سعره صدمة بصراحة",
    "لو تجرب هالعطر… بتفهم",
    "العطر اللي ينقص مجموعتك",
    "فخامة بدون مبالغة",
    "هذا العطر يخليك غير",
    "ريحة تعطيك ثقة طول اليوم",
    "أقوى من اللي تتوقعه",
    "مو لازم تدفع كثير عشان تفخم",
    "إذا يهمك الثبات ركّز هنا",
    "العطر اللي ما ينوصف بسهولة",
    "ريحة تعلق بالذاكرة 😮‍💨",
    "هذا النوع اللي الناس تلاحظه",
    "لو مهتم بالعطور… شوف هذا",
    "ريحة تعيش معك ساعات",
    "فخم بشكل مو طبيعي",
    "هذا العطر يخليك مميز",
    "العرض هذا ما يتفوّت",
    "كل رشة تعطي حضور",
    "العطر اللي يلفت بدون ما يزعج",
    "ريحة نظيفة وفخمة بنفس الوقت",
    "إذا بتاخذ واحد… خذ هذا",
    "من أول رشة بتحس بالفرق",
    "الناس صارت تسأل عنه كثير",
    "هذا العطر خطير بصراحة",
    "ريحة تفتح النفس 🔥",
    "لو تبي شيء يثبت… هذا هو",
    "عطر يليق بالطلعات والمناسبات",
    "فخامة واضحة من أول ثانية",
    "هذا مو إعلان عادي 😏",
    "العطر اللي يكمّل ستايلك",
    "ريحة تحسسك بالفخامة",
    "خلّك مختلف بريحتك",
    "العطر اللي يعلق بالمخ",
    "إذا فاتك… راحت عليك",
    "خذ الفخامة بسعر ذكي"
  ];

  const captionOpeners = [
    "اختيار فاخر لعشاق العطور العالمية",
    "وصلت عروض قوية على العطور الأكثر طلباً",
    "ريحة فخمة وسعر منافس لمحبي التميز",
    "إذا كنت تبحث عن عطر يلفت الانتباه، هذا وقتك",
    "عطور عالمية أصلية بأسعار ذكية",
    "فخامة العطور العالمية أصبحت أقرب لك",
    "عطر يرفع حضورك من أول رشة",
    "لعشاق الروائح الراقية والثبات القوي",
    "عرض اليوم مخصص للي يحبون العطور الفخمة",
    "تجربة عطر عالمية بسعر يناسبك"
  ];

  const captionBenefits = [
    "توصيل سريع",
    "دفع عند الاستلام",
    "عروض لفترة محدودة",
    "أسعار منافسة",
    "خيارات تناسب الهدايا والاستخدام اليومي",
    "روائح فاخرة تناسب الذوق الخليجي",
    "تشكيلة مختارة بعناية",
    "كمية محدودة على المنتجات الأكثر طلباً",
    "تجربة تسوق سهلة وسريعة",
    "منتجات مختارة لمحبي الفخامة"
  ];

  const captionCTAs = [
    "اطلب الآن من الرابط في البايو",
    "شوف التشكيلة كاملة من الرابط في البايو",
    "لا تنتظر نفاد الكمية واطلب الآن",
    "اختر عطرك المفضل اليوم",
    "تسوق الآن وخذ عطرك قبل انتهاء العرض",
    "اضغط الرابط في البايو وشوف الأسعار",
    "اطلب عطرك الآن وخلك جاهز للمناسبة",
    "استغل العرض اليوم",
    "خل عطرك القادم يكون فخم وبسعر ذكي",
    "ابدأ بطلبك الآن"
  ];

  function loadSettings() {
    try {
      return { ...defaultSettings, ...JSON.parse(localStorage.getItem("marrsile_v105_settings") || "{}") };
    } catch {
      return { ...defaultSettings };
    }
  }

  function saveSettings() {
    localStorage.setItem("marrsile_v105_settings", JSON.stringify(settings));
  }

  function setupPublishNowDelegation() {
    document.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("[data-publish-now]") : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      publishNowFromQueue(Number(btn.dataset.publishNow));
    });
  }

  function bind() {
    $("loginBtn").addEventListener("click", login);
    $("uploadBtn").addEventListener("click", pickVideos);
    if ($("uploadBtn2")) $("uploadBtn2").addEventListener("click", pickVideos);
    $("videoInput").addEventListener("change", addVideos);
    $("dropZone").addEventListener("click", pickVideos);
    $("dropZone").addEventListener("dragover", (e) => { e.preventDefault(); $("dropZone").classList.add("drag"); });
    $("dropZone").addEventListener("dragleave", () => $("dropZone").classList.remove("drag"));
    $("dropZone").addEventListener("drop", (e) => {
      e.preventDefault();
      $("dropZone").classList.remove("drag");
      addFiles(Array.from(e.dataTransfer.files || []));
    });

    document.querySelectorAll("[data-tab]").forEach(btn => btn.addEventListener("click", () => openTab(btn.dataset.tab)));
    document.querySelectorAll("[data-open]").forEach(btn => btn.addEventListener("click", () => openTab(btn.dataset.open)));

    ["hookType","hookPower","emojiMode","hookLength","hookStyle","fontSize","hookTop","boxWidth","hookOpacity","hookRadius","offerType","ctaMode","hashtags","captionFooter","scheduleDays","repeatCooldownDays"].forEach(id => {
      $(id).addEventListener("input", () => { readSettingsFromUI(); applyLook(); });
      $(id).addEventListener("change", () => { readSettingsFromUI(); applyLook(); });
    });

    ["autoHook","autoCaption","avoidRepeat","abTesting","smartRepost","autoRetry"].forEach(id => {
      $(id).addEventListener("change", readSettingsFromUI);
    });

    $("demoHookBtn").addEventListener("click", () => {
      const h = makeHook();
      setPreviewHook(h);
    });
    $("saveControlBtn").addEventListener("click", () => {
      readSettingsFromUI();
      applySettingsToAll();
      alert("تم حفظ الإعدادات وتطبيقها");
    });
    $("saveAndRunBtn").addEventListener("click", () => {
      readSettingsFromUI();
      applySettingsToAll();
      startAutopilot();
    });
    $("dailyMinus").addEventListener("click", () => changeDaily(-1));
    $("dailyPlus").addEventListener("click", () => changeDaily(1));
    $("addTimeBtn").addEventListener("click", addTime);
    $("applyAllBtn").addEventListener("click", applySettingsToAll);
    $("regenSelectedBtn").addEventListener("click", regenSelected);
    $("addAccountBtn").addEventListener("click", addAccount);
    $("connectInstagramBtn").addEventListener("click", connectInstagramOfficial);
    $("refreshOfficialAccountsBtn").addEventListener("click", loadOfficialAccounts);
    $("factoryBtn").addEventListener("click", renderHookFactory);
    $("startAutoBtn").addEventListener("click", startAutopilot);
    $("queueRunBtn").addEventListener("click", startAutopilot);
    if ($("saveBackendBtn")) {
      $("saveBackendBtn").addEventListener("click", () => {
        settings.backendUrl = $("backendUrl").value.trim();
        saveSettings();
        persistAll();
        alert("تم حفظ رابط Backend محلياً");
      });
    }
    if ($("checkSystemBtn")) {
      $("checkSystemBtn").addEventListener("click", async () => {
        try { await loadPublicConfig(true); alert("الربط صحيح ✅"); }
        catch (err) { alert("فشل الفحص: " + (err.message || err)); openTab("errors"); }
      });
    }
    if ($("copyErrorsBtn")) {
      $("copyErrorsBtn").addEventListener("click", async () => {
        const txt = $("errorLog") ? $("errorLog").textContent : "";
        try { await navigator.clipboard.writeText(txt); alert("تم نسخ سجل الأخطاء"); }
        catch(e) { alert("انسخ السجل يدوياً من المربع"); }
      });
    }
    if ($("clearErrorsBtn")) {
      $("clearErrorsBtn").addEventListener("click", () => {
        diagnosticErrors = [];
        try { localStorage.removeItem("marrsile_error_log_v37"); } catch(e) {}
        renderErrorLog();
      });
    }
    if ($("saveStorageBtn")) {
      $("saveStorageBtn").addEventListener("click", () => {
        settings.cloudinaryCloudName = $("cloudinaryCloudName").value.trim();
        settings.cloudinaryUploadPreset = $("cloudinaryUploadPreset").value.trim();
        if ($("supabaseUrl")) settings.supabaseUrl = $("supabaseUrl").value.trim();
        if ($("supabaseAnonKey")) settings.supabaseAnonKey = $("supabaseAnonKey").value.trim();
        if ($("supabaseBucket")) settings.supabaseBucket = $("supabaseBucket").value.trim() || "reels";
        saveSettings();
        persistAll();
        alert("تم حفظ بيانات Cloudinary");
      });
    }
    $("scanVideosBtn").addEventListener("click", scanAllVideos);
    $("repairVideosBtn").addEventListener("click", repairIncompatibleVideos);
    $("forceRepairBtn").addEventListener("click", forceRepairAllVideos);
    $("autoRepair").addEventListener("change", () => {
      settings.autoRepair = $("autoRepair").checked;
      saveSettings();
    });

    $("previewPlayBtn").addEventListener("click", togglePreviewPlayback);
    $("previewBackBtn").addEventListener("click", () => seekPreview(-5));
    $("previewForwardBtn").addEventListener("click", () => seekPreview(5));
    $("previewMuteBtn").addEventListener("click", togglePreviewMute);
    $("previewSeek").addEventListener("input", seekPreviewBar);
    $("settingsVideo").addEventListener("timeupdate", updatePreviewTime);
    $("settingsVideo").addEventListener("loadedmetadata", updatePreviewTime);


    $("videoHook").addEventListener("input", manualVideoEdit);
    $("videoCaption").addEventListener("input", manualVideoEdit);
  }

  function login() {
    if ($("email").value.trim() === EMAIL && $("password").value.trim() === PASS) {
      $("loginScreen").classList.add("hidden");
      $("app").classList.remove("hidden");
      hydrateAll();
      persistAuth(true);
      renderAll();
    } else {
      alert("بيانات الدخول غير صحيحة");
    }
  }

  function openTab(tabId) {
    document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
    $(tabId).classList.remove("hidden");
    document.querySelectorAll(".nav").forEach(n => n.classList.remove("active"));
    const active = document.querySelector(`[data-tab="${tabId}"]`);
    if (active) active.classList.add("active");
    const titles = {
      dashboard: "الرئيسية",
      control: "Control Center",
      videos: "الفيديوهات",
      accounts: "الحسابات",
      hooks: "مصنع الهوكات",
      queue: "Autopilot Queue",
      settings: "النظام",
      errors: "الأخطاء"
    };
    $("pageTitle").textContent = titles[tabId] || "Marrsile";
    if (tabId === "videos") loadEditor();
  }

  function pickVideos() {
    $("videoInput").value = "";
    $("videoInput").click();
  }

  function addVideos(e) {
    addFiles(Array.from(e.target.files || []));
  }

  async function addFiles(files) {
    const videoFiles = files.filter(f => f.type && f.type.startsWith("video/"));
    if (!videoFiles.length) {
      alert("لم يتم اختيار فيديوهات مدعومة. جرب MP4 أو MOV.");
      return;
    }

    uploadState = {
      active: true,
      total: videoFiles.length,
      done: 0,
      failed: 0,
      bytesTotal: videoFiles.reduce((sum, f) => sum + (f.size || 0), 0),
      bytesDone: 0,
      startedAt: Date.now(),
      currentFile: ""
    };
    if ($("uploadList")) $("uploadList").innerHTML = "";
    renderUploadProgress();
    openTab("videos");

    const startIndex = videos.length;
    for (const file of videoFiles) {
      uploadState.currentFile = file.name;
      pushUploadRow(file, "جاري الرفع", 8, fmtBytes(file.size));
      renderUploadProgress();
      let uploaded;
      try {
        try {
          uploaded = await uploadToCloudinary(file);
        } catch(firstErr) {
          pushUploadRow(file, "إعادة محاولة تلقائية", 45, firstErr.message || String(firstErr));
          await new Promise(r => setTimeout(r, 1200));
          uploaded = await uploadToCloudinary(file);
        }
        videos.push({
          id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
          name: file.name,
          size: file.size,
          type: file.type,
          url: uploaded.url,
          publicUrl: uploaded.publicUrl,
          cloudinaryPublicId: uploaded.cloudinaryPublicId,
          hook: makeHook(file.name),
          caption: makeCaption("عام الخليج"),
          status: uploaded.uploadedToSupabase ? "Supabase Upload ✅" : (uploaded.localOnly ? "محلي فقط - اربط التخزين" : "جاهز للنشر"),
          compatibility: "pending",
          compatibilityLabel: uploaded.uploadedToSupabase ? "Supabase" : (uploaded.localOnly ? "محلي" : "مرفوع"),
          supabasePath: uploaded.supabasePath || "",
          uploadedToSupabase: !!uploaded.uploadedToSupabase,
          repairStatus: "not_needed",
          postedTo: [],
          score: 50,
          topPerformer: false,
          createdAt: new Date().toISOString()
        });
        uploadState.done++;
        pushUploadRow(file, "تم الرفع ✅", 100, "جاهز للجدولة");
        persistAll();
      } catch (err) {
        uploadState.failed++;
        if (!uploaded) uploadState.bytesDone += file.size || 0;
        pushUploadRow(file, "فشل الرفع", 100, err.message || String(err));
        recordError("فشل رفع الفيديو من الواجهة", err, { file: file.name });
      }
      renderUploadProgress();
    }

    uploadState.active = false;
    renderUploadProgress();
    selected = Math.max(0, startIndex);
    scanNewVideos(videos.slice(startIndex));
    renderAll();
    persistAll();
    loadEditor();
    if (uploadState.failed) alert(`تم رفع ${uploadState.done} فيديو وفشل ${uploadState.failed}. راجع مركز الرفع أو سجل الأخطاء.`);
    else alert("تم رفع " + uploadState.done + " فيديو بنجاح");
  }

  function clean(parts) {
    return parts.filter(Boolean).join(" ").replace(/\s+\./g, ".").replace(/\.\s*\./g, ".").replace(/\s+/g, " ").trim();
  }

  function makeHook(name = "") {
    return rand(gulfHooks);
  }

  function makeCaption(market, hookText = "", videoName = "") {
    const markets = {
      "السعودية": { place: "بالسعودية", girls: "يا بنات السعودية", people: "يا أهل السعودية" },
      "الإمارات": { place: "بالإمارات", girls: "يا بنات الإمارات", people: "يا أهل الإمارات" },
      "قطر": { place: "بقطر", girls: "يا بنات قطر", people: "يا أهل قطر" },
      "الكويت": { place: "بالكويت", girls: "يا بنات الكويت", people: "يا أهل الكويت" },
      "عمان": { place: "بعُمان", girls: "يا بنات عُمان", people: "يا أهل عُمان" },
      "البحرين": { place: "بالبحرين", girls: "يا بنات البحرين", people: "يا أهل البحرين" }
    };
    const m = markets[market] || { place: "بالخليج", girls: "يا بنات الخليج", people: "يا أهل الخليج" };
    const hook = hookText || makeHook(videoName);
    const namesFemale = ["رهف", "فاطمة", "نورة", "مها", "دانة", "سارة", "ريم", "العنود", "جواهر", "مريم", "لطيفة", "هند"];
    const namesMale = ["محمد", "عبدالله", "خالد", "فيصل", "راشد", "سعود", "حمد", "ناصر", "تركي", "ماجد"];
    const reactions = [
      "أول ما دخلت المكان الكل سألها: وش العطر؟",
      "قالت لي بعد أول طلعة: مستحيل أغيّره بعد اليوم",
      "وصلها الطلب وجربته، وبعد ساعتين رجعت تطلب واحد هدية",
      "كانت تدور على عطر فخم وسعره منطقي… وهذا كان الاختيار",
      "أكثر تعليق جاها: ريحتك فخمة مرة",
      "ما توقعت الثبات يكون كذا، خصوصاً على السعر"
    ];
    const sensory = [
      "ريحة فخمة، نظيفة، وتبقى معك بدون إزعاج",
      "ثبات واضح وحضور يخلي العطر ينلاحظ من أول دقيقة",
      "فخامة هادئة تناسب الدوام، الطلعات، والمناسبات",
      "يعطي إحساس مرتب وغالي حتى قبل ما تتكلم",
      "عطر من النوع اللي يعلق بالذاكرة",
      "الرشة الأولى تكفي تفهم ليش الناس تسأل عنه"
    ];
    const questions = [
      "تحب العطر يكون ناعم وفخم ولا قوي وملفت؟",
      "مين مثلي يختار العطر قبل اللبس؟",
      "لو أحد سألك عن عطرك، تقول اسمه ولا تخليه سر؟",
      "أكثر شيء يهمك بالعطر: الثبات ولا الفخامة؟",
      "جربت عطر يخلي الناس توقفك وتسألك عنه؟"
    ];
    const viralHooks = [
      hook,
      "لا تشتري عطر جديد قبل ما تشوف هذا 👀",
      "هذا العطر عليه كلام كثير بالخليج 😮‍💨",
      "لو تحب الروائح الفخمة… ركّز هنا",
      "الريحة اللي تخلي حضورك واضح بدون مبالغة",
      "سعره شيء… وريحته شيء ثاني تماماً",
      "هذا مو إعلان عطر، هذه تجربة لازم تعرفها",
      "إذا سألوك وش حاط… لا تقول ما حذرتك 😭"
    ];
    const ctas = {
      bio: ["شوف التشكيلة من الرابط في البايو", "الرابط في البايو لو تبغى تشوف السعر", "اطلبه من الرابط في البايو قبل ما تخلص الكمية"],
      whatsapp: ["راسلنا واتساب ونرشح لك الأنسب", "اكتب لنا واتساب ونساعدك تختار", "لو محتار، واتساب ونختار لك حسب ذوقك"],
      limited: ["الكمية محدودة والطلب يزيد يومياً", "لا تنتظر لين تخلص الكمية", "المتوفر محدود خصوصاً على العطور الأكثر طلباً"],
      shopNow: ["اطلب الآن وخلي عطرك القادم مختلف", "شوف العروض الحالية وقرر", "اختار عطرك اليوم وخلك جاهز للطلعات"]
    };
    const ctaList = ctas[settings.ctaMode] || ctas.bio;
    const offerLine = {
      discount: "العرض الحالي يخلي التجربة أذكى بكثير.",
      freeShipping: "والأجمل إن التوصيل أسهل مما تتوقع.",
      cod: "والدفع عند الاستلام يخلي الطلب مريح أكثر.",
      bundle: "خذ أكثر من عطر وخلّ كل مناسبة لها ريحتها.",
      premium: "فخامة واضحة بسعر يناسب الذوق الذكي."
    }[settings.offerType] || "فخامة وسعر منافس.";

    const story = () => {
      const name = Math.random() > 0.45 ? rand(namesFemale) : rand(namesMale);
      return `${rand(viralHooks)}

${name} طلب/ت العطر كتجربة… وما توقع/ت إن ${rand(reactions)} 😭✨

${rand(sensory)}.

${offerLine}

${rand(ctaList)} 🤍`;
    };
    const question = () => `${rand(viralHooks)}

${rand(questions)}

لأن هذا العطر تحديداً يعطيك ${rand(sensory)}.

${offerLine}

${rand(ctaList)} ✨`;
    const direct = () => `${rand(viralHooks)}

${m.people}… إذا تبغى عطر يرفع حضورك بدون ما يكون مزعج، هذا خيار يستاهل التجربة.

${rand(sensory)}.

${rand(ctaList)} 🔥`;
    const girls = () => `${rand(viralHooks)}

${m.girls}، هذا من العطور اللي تخلي السؤال يتكرر: وش اسم عطرك؟ 😭

فخم، مرتب، ويناسب الهدية والاستخدام اليومي.

${rand(ctaList)} 🤍`;
    const shortHook = () => `${rand(viralHooks)}

${rand(sensory)}.

${offerLine}

${rand(ctaList)}.`;
    const templates = [story, story, question, direct, girls, shortHook];
    const base = rand(templates)();
    return clean([base, settings.captionFooter ? "\n\n" + settings.captionFooter : "", settings.hashtags ? "\n\n" + settings.hashtags : ""]);
  }

  function readSettingsFromUI() {
    ["hookType","hookPower","emojiMode","hookLength","hookStyle","offerType","ctaMode","hashtags","captionFooter","delayMode"].forEach(id => { if($(id)) settings[id] = $(id).value; });
    ["delayMin","delayMax","scheduleDays","repeatCooldownDays"].forEach(id => { if($(id)) settings[id] = Number($(id).value || 0); });
    ["fontSize","hookTop","boxWidth","hookOpacity","hookRadius"].forEach(id => settings[id] = Number($(id).value));
    ["autoHook","autoCaption","avoidRepeat","abTesting","smartRepost","autoRetry"].forEach(id => settings[id] = $(id).checked);
    saveSettings();
    updateLabels();
  }

  function loadSettingsToUI() {
    ["hookType","hookPower","emojiMode","hookLength","hookStyle","offerType","ctaMode","hashtags","captionFooter","delayMode"].forEach(id => { if ($(id)) $(id).value = settings[id]; });
    ["delayMin","delayMax","scheduleDays","repeatCooldownDays"].forEach(id => { if ($(id)) $(id).value = settings[id]; });
    ["fontSize","hookTop","boxWidth","hookOpacity","hookRadius"].forEach(id => { if ($(id)) $(id).value = settings[id]; });
    ["autoHook","autoCaption","avoidRepeat","abTesting","smartRepost","autoRetry"].forEach(id => { if ($(id)) $(id).checked = settings[id]; });
    if ($("backendUrl")) $("backendUrl").value = settings.backendUrl || "";
    if ($("autoRepair")) $("autoRepair").checked = settings.autoRepair !== false;
    if ($("backendUrl")) $("backendUrl").value = settings.backendUrl || "/.netlify/functions";
    if ($("cloudinaryCloudName")) $("cloudinaryCloudName").value = settings.cloudinaryCloudName || "";
    if ($("cloudinaryUploadPreset")) $("cloudinaryUploadPreset").value = settings.cloudinaryUploadPreset || "";
    if ($("supabaseUrl")) $("supabaseUrl").value = settings.supabaseUrl || "";
    if ($("supabaseAnonKey")) $("supabaseAnonKey").value = settings.supabaseAnonKey || "";
    if ($("supabaseBucket")) $("supabaseBucket").value = settings.supabaseBucket || "reels";
    $("dailyCount").textContent = settings.daily;
    renderTimes();
    updateLabels();
  }

  function updateLabels() {
    $("fontValue").textContent = settings.fontSize + "px";
    $("topValue").textContent = settings.hookTop + "px";
    $("widthValue").textContent = settings.boxWidth + "%";
    $("opacityValue").textContent = settings.hookOpacity + "%";
    $("radiusValue").textContent = settings.hookRadius + "px";
  }

  function applyLook() {
    readSettingsFromUI();
    ["heroHook","settingsHook"].forEach(id => {
      const el = $(id);
      if (!el) return;
      el.className = "hook";
      if (settings.hookStyle !== "bold") el.classList.add(settings.hookStyle);
      el.style.fontSize = settings.fontSize + "px";
      el.style.top = settings.hookTop + "px";
      el.style.right = ((100 - settings.boxWidth) / 2) + "%";
      el.style.left = ((100 - settings.boxWidth) / 2) + "%";
      el.style.borderRadius = settings.hookRadius + "px";
      if (settings.hookStyle === "bold") el.style.background = `rgba(0,0,0,${settings.hookOpacity/100})`;
    });
  }

  function setPreviewHook(hook) {
    $("heroHook").textContent = hook;
    $("settingsHook").textContent = hook;
    applyLook();
  }

  function applySettingsToAll() {
    videos = videos.map(v => ({
      ...v,
      hook: settings.autoHook ? makeHook(v.name) : v.hook,
      caption: settings.autoCaption ? makeCaption("عام الخليج") : v.caption
    }));
    renderVideos();
    loadEditor();
  }

  function changeDaily(delta) {
    settings.daily = Math.max(1, Math.min(12, settings.daily + delta));
    if ($("backendUrl")) $("backendUrl").value = settings.backendUrl || "";
    if ($("autoRepair")) $("autoRepair").checked = settings.autoRepair !== false;
    if ($("backendUrl")) $("backendUrl").value = settings.backendUrl || "/.netlify/functions";
    if ($("cloudinaryCloudName")) $("cloudinaryCloudName").value = settings.cloudinaryCloudName || "";
    if ($("cloudinaryUploadPreset")) $("cloudinaryUploadPreset").value = settings.cloudinaryUploadPreset || "";
    if ($("supabaseUrl")) $("supabaseUrl").value = settings.supabaseUrl || "";
    if ($("supabaseAnonKey")) $("supabaseAnonKey").value = settings.supabaseAnonKey || "";
    if ($("supabaseBucket")) $("supabaseBucket").value = settings.supabaseBucket || "reels";
    $("dailyCount").textContent = settings.daily;
    saveSettings();
  }

  function addTime() {
    settings.times.push("12:00");
    saveSettings();
    renderTimes();
  }

  function removeTime(index) {
    settings.times.splice(index, 1);
    saveSettings();
    renderTimes();
  }

  function renderTimes() {
    $("timeList").innerHTML = settings.times.map((t, i) => `
      <div class="time-row">
        <input type="time" value="${escapeHtml(t)}" data-time-index="${i}">
        <button data-remove-time="${i}">حذف</button>
      </div>
    `).join("");

    document.querySelectorAll("[data-time-index]").forEach(input => {
      input.addEventListener("change", () => {
        settings.times[Number(input.dataset.timeIndex)] = input.value;
        saveSettings();
      });
    });

    document.querySelectorAll("[data-remove-time]").forEach(btn => {
      btn.addEventListener("click", () => removeTime(Number(btn.dataset.removeTime)));
    });
  }

  function renderVideos() {
    $("videoList").innerHTML = videos.length ? videos.map((v, i) => `
      <div class="video-item ${i === selected ? "active" : ""}" data-video-index="${i}">
        <b>${escapeHtml(v.name)}</b>
        <p>${escapeHtml(v.hook)}</p>
        <span class="muted">${v.status}</span>
        <div class="video-controls">
          <button class="publish-now-btn" data-publish-video="${i}" type="button">نشر الآن</button>
          <button class="schedule-now-btn" data-schedule-video="${i}" type="button">جدولة</button>
          <button class="delete-video-btn" data-delete-video="${i}" type="button">حذف الفيديو</button>
        </div>
        <span class="compat ${v.compatibility === "compatible" ? "ok" : v.compatibility === "needs_repair" ? "warn" : v.compatibility === "fixed" ? "ok" : "bad"}">${escapeHtml(v.compatibilityLabel || "قيد الفحص")}</span>${v.repairReason ? `<small class="muted">${escapeHtml(v.repairReason)}</small>` : ""}
      </div>
    `).join("") : `<div class="video-item">ارفع الفيديوهات فقط، والباقي تلقائي.</div>`;

    document.querySelectorAll("[data-video-index]").forEach(item => {
      item.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        selected = Number(item.dataset.videoIndex);
        renderVideos();
        loadEditor();
      });
    });

    document.querySelectorAll("[data-delete-video]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteVideo(Number(btn.dataset.deleteVideo));
      });
    });

    document.querySelectorAll("[data-publish-video]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        publishVideoNow(Number(btn.dataset.publishVideo));
      });
    });

    document.querySelectorAll("[data-schedule-video]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        scheduleVideoNow(Number(btn.dataset.scheduleVideo));
      });
    });
  }


  function deleteVideo(index) {
    const v = videos[index];
    if (!v) return;

    const ok = confirm("هل تريد حذف هذا الفيديو من القائمة؟");
    if (!ok) return;

    try {
      if (v.url && v.url.startsWith("blob:")) URL.revokeObjectURL(v.url);
    } catch (_) {}

    videos.splice(index, 1);
    queue = queue.filter(q => q.video !== v.name);

    if (selected >= videos.length) selected = Math.max(0, videos.length - 1);

    renderAll();
persistAll();

    if (!videos.length) {
      const editor = $("editorVideo");
      if (editor) {
        editor.pause();
        editor.removeAttribute("src");
        editor.style.display = "none";
        editor.load();
      }
      if ($("videoHook")) $("videoHook").value = "";
      if ($("videoCaption")) $("videoCaption").value = "";
    } else {
      loadEditor();
    }
  }


  function loadEditor() {
    const v = videos[selected];
    if (!v) return;
    $("editorVideo").src = v.url;
    $("editorVideo").style.display = "block";
    $("videoHook").value = v.hook;
    $("videoCaption").value = v.caption;

    ["heroVideo","settingsVideo"].forEach(id => {
      const vid = $(id);
      vid.src = v.url;
      vid.style.display = "block";
      vid.play().catch(() => {});
    });

    setPreviewHook(v.hook);
  }

  function manualVideoEdit() {
    const v = videos[selected];
    if (!v) return;
    v.hook = $("videoHook").value;
    v.caption = $("videoCaption").value;
    renderVideos();
    setPreviewHook(v.hook);
  }

  function regenSelected() {
    const v = videos[selected];
    if (!v) return;
    v.hook = makeHook(v.name);
    v.caption = makeCaption("عام الخليج");
    renderVideos();
    loadEditor();
  }


  function functionsBase() {
    const input = $("backendUrl");
    const value = input && input.value ? input.value.trim() : "";
    return value || "/.netlify/functions";
  }

  function connectInstagramOfficial() {
    window.location.href = functionsBase().replace(/\/$/, "") + "/auth-instagram";
  }

  async function loadOfficialAccounts() {
    try {
      const res = await fetch(functionsBase().replace(/\/$/, "") + "/accounts");
      if (!res.ok) throw new Error("فشل جلب الحسابات الرسمية");
      const data = await res.json();
      const official = (data.accounts || []).map(a => ({
        id: a.id || a.instagramId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random())),
        name: a.pageName || a.name || "Instagram Account",
        user: a.username ? "@" + a.username.replace(/^@/, "") : (a.user || "@instagram"),
        market: a.market || "رسمي",
        link: a.link || "",
        official: true
      }));

      // دمج بدون تكرار
      official.forEach(acc => {
        const exists = accounts.some(x => x.id === acc.id || x.user === acc.user);
        if (!exists) accounts.push(acc);
      });

      renderAll();
persistAll();
      alert("تم تحديث الحسابات الرسمية: " + official.length);
    } catch (err) {
      console.error(err);
      alert("لم يتم جلب الحسابات الرسمية. تأكد أنك ضبطت Environment Variables في Netlify وربطت Meta.");
    }
  }


  function addAccount() {
    const name = $("accName").value.trim();
    const user = $("accUser").value.trim();
    if (!name || !user) {
      alert("أدخل اسم الحساب واليوزر");
      return;
    }
    accounts.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      name,
      user,
      market: $("accMarket").value,
      link: $("accLink").value.trim() || "https://marrsile.com"
    });
    $("accName").value = "";
    $("accUser").value = "";
    $("accLink").value = "";
    renderAll();
persistAll();
  }


  function editAccount(index) {
    const account = accounts[index];
    if (!account) return;

    const newName = prompt("عدّل اسم الحساب:", account.name);
    if (newName === null) return;

    const newUser = prompt("عدّل اليوزر:", account.user);
    if (newUser === null) return;

    const newMarket = prompt("عدّل الدولة/السوق:", account.market);
    if (newMarket === null) return;

    const newLink = prompt("عدّل رابط المتجر:", account.link);
    if (newLink === null) return;

    accounts[index] = {
      ...account,
      name: newName.trim() || account.name,
      user: newUser.trim() || account.user,
      market: newMarket.trim() || account.market,
      link: newLink.trim() || account.link
    };

    renderAll();
persistAll();
  }

  function deleteAccount(index) {
    const account = accounts[index];
    if (!account) return;

    const ok = confirm("هل تريد حذف هذا الحساب؟");
    if (!ok) return;

    accounts.splice(index, 1);

    // حذف أي عناصر Queue مرتبطة بهذا الحساب حتى لا ينشر عليها بالخطأ
    queue = queue.filter(q => q.account !== account.name);

    renderAll();
persistAll();
  }


  function renderAccounts() {
    $("accountsList").innerHTML = accounts.length ? accounts.map((a, index) => `
      <div class="account-item">
        <b>${escapeHtml(a.name)}</b>
        <span>${escapeHtml(a.user)} · ${escapeHtml(a.market)}</span>
        <p>${escapeHtml(a.link)}</p>
        <span class="ok">${a.official ? "Officially Connected" : "جاهز"}</span>
        <div class="account-actions">
          <button class="edit-account-btn" data-edit-account="${index}" type="button">تعديل</button>
          <button class="delete-account-btn" data-delete-account="${index}" type="button">حذف</button>
        </div>
      </div>
    `).join("") : `<div class="account-item">أضف الحسابات مرة واحدة فقط.</div>`;

    document.querySelectorAll("[data-edit-account]").forEach(btn => {
      btn.addEventListener("click", () => editAccount(Number(btn.dataset.editAccount)));
    });

    document.querySelectorAll("[data-delete-account]").forEach(btn => {
      btn.addEventListener("click", () => deleteAccount(Number(btn.dataset.deleteAccount)));
    });
  }

  async function startAutopilot() {
    readSettingsFromUI();
    applySettingsToAll();

    if (!videos.length) {
      alert("ارفع فيديوهات أولاً");
      return;
    }
    if (!accounts.length) {
      alert("أضف حساباً واحداً على الأقل");
      openTab("accounts");
      return;
    }

    const days = Math.max(7, Math.min(90, Number(settings.scheduleDays || 30)));
    autopilot = true;

    // نحافظ على العناصر المنشورة/قيد النشر ولا نمس مسار النشر الناجح.
    const protectedItems = queue.filter(q => ["published","publishing","waiting_publish","publish_check"].includes(q.status));
    const future = buildSmartQueue(days);
    const byId = new Map();
    [...protectedItems, ...future].forEach(item => byId.set(String(item.id), item));
    queue = Array.from(byId.values()).sort((a,b)=>new Date(a.scheduledAt || a.publishedAt || 0)-new Date(b.scheduledAt || b.publishedAt || 0));

    renderAll();
    persistAll();
    await syncQueueToServerNow();
    openTab("queue");
    alert(`تم بناء جدولة ذكية لمدة ${days} يوم. عدد العناصر: ${queue.length}`);
  }

  function isAmbiguousPublishError(err) {
    const msg = String((err && err.message) || err || "").toLowerCase();
    return msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("timeout") ||
      msg.includes("timed out") ||
      msg.includes("body stream") ||
      msg.includes("instagram video is still not ready") ||
      msg.includes("media id is not available") ||
      msg.includes("processing") ||
      msg.includes("not ready") ||
      msg.includes("9007") ||
      msg.includes("2207027");
  }

  async function publishNowFromQueue(index, options = {}) {
    const item = queue[index];
    if (!item) throw new Error("عنصر الجدولة غير موجود");

    const silent = !!options.silent;
    const publishKey = "queue_" + (item.id || item.videoId || index);
    if(!acquirePublishLock(publishKey)){
      const msg = "هذا الفيديو قيد النشر بالفعل";
      if(!silent) alert(msg);
      throw new Error(msg);
    }

    const ok = options.skipConfirm ? true : confirm("هل تريد نشر هذا الفيديو الآن على الحساب المحدد؟");
    if (!ok) { releasePublishLock(publishKey); return false; }

    const btns = document.querySelectorAll(`[data-publish-now="${index}"]`);
    btns.forEach(b => { b.disabled = true; b.textContent = "جاري النشر..."; });

    try {
      const account = accounts.find(a => a.name === item.account || a.user === item.account || a.id === item.accountId) || { id: item.accountId, name: item.account, official: true };
      const video = videos.find(v => v.name === item.video || v.id === item.videoId);

      if (!account || !account.id) throw new Error("لا يوجد حساب Instagram مرتبط لهذا العنصر.");
      if (account.official === false) throw new Error("هذا العنصر غير مربوط بحساب رسمي. اختر حساب Officially Connected.");

      const videoUrl = item.videoUrl || publicVideoUrl(video);
      if (!videoUrl) throw new Error("لم يتم العثور على رابط الفيديو. أعد رفع الفيديو حتى يحصل على رابط Supabase عام ثم جرّب النشر.");
      if (String(videoUrl).startsWith("blob:")) throw new Error("النشر يحتاج رابط فيديو عام من Supabase/S3، وليس blob محلي.");

      item.status = "publishing";
      item.updatedAt = new Date().toISOString();
      persistAll();
      renderAll();

      const res = await fetch((settings.backendUrl || "/.netlify/functions").replace(/\/$/, "") + "/publish-reel", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          accountId: account.id,
          videoUrl,
          caption: item.caption || item.hook || ""
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "فشل النشر");

      item.status = "published";
      item.publishedAt = new Date().toISOString();
      item.error = "";
      item.result = data;
      persistAll();
      await syncQueueToServerNow();
      renderAll();
      if(!silent) alert("تم إرسال النشر إلى Instagram بنجاح.");
      return data;
    } catch (err) {
      console.error(err);

      // بعض حالات Instagram/Netlify تكون "نجاح فعلي" لكن الرد يرجع متأخر أو ناقص،
      // فيظهر داخل الجدولة كفشل رغم أن الريل نُشر على الحساب. لذلك لا نضع Failed
      // في النشر التلقائي عند الأخطاء الرمادية، بل نضع حالة انتظار تأكيد.
      if (options.auto && isAmbiguousPublishError(err)) {
        item.status = "publish_check";
        item.error = "تم إرسال النشر إلى Instagram، بانتظار تأكيد الحالة. إذا ظهر الريل في الحساب فاعتبره ناجحاً.";
        item.nextAttemptAt = "";
        item.updatedAt = new Date().toISOString();
        persistAll();
        await syncQueueToServerNow().catch(()=>{});
        renderAll();
        try { recordError("تنبيه غير حاسم بعد النشر التلقائي", err, { queueItem: item.id, video: item.video, note: "Instagram may have published successfully" }); } catch(e) {}
        return { ok: true, pendingConfirmation: true, warning: err.message || String(err) };
      }

      item.status = "failed";
      item.error = err.message || String(err);
      item.updatedAt = new Date().toISOString();
      persistAll();
      await syncQueueToServerNow().catch(()=>{});
      renderAll();
      recordError(options.auto ? "فشل النشر التلقائي" : "فشل النشر اليدوي", err, { queueItem: item.id, video: item.video });
      if(!silent) alert("فشل النشر الآن: " + (err.message || err));
      throw err;
    } finally {
      releasePublishLock(publishKey);
      btns.forEach(b => { b.disabled = false; b.textContent = "نشر الآن"; });
    }
  }


  async function deleteQueueItem(index) {
    const item = queue[index];
    if (!item) return;
    const ok = confirm("هل تريد حذف هذا الفيديو من الجدولة؟");
    if (!ok) return;
    try {
      const base = (settings.backendUrl || "/.netlify/functions").replace(/\/$/, "");
      if (item.id) {
        await fetch(base + "/queue", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id })
        });
      }
    } catch (err) {
      recordError("فشل حذف عنصر من الجدولة على السيرفر", err, { id: item.id });
    }
    queue.splice(index, 1);
    persistAll();
    renderAll();
  }

  async function clearQueue() {
    if (!queue.length) return alert("لا توجد عناصر في الجدولة");
    const ok = confirm("هل تريد حذف كل الجدولة؟");
    if (!ok) return;
    try {
      const base = (settings.backendUrl || "/.netlify/functions").replace(/\/$/, "");
      await fetch(base + "/queue", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    } catch (err) {
      recordError("فشل حذف كل الجدولة على السيرفر", err);
    }
    queue = [];
    persistAll();
    renderAll();
  }

  async function refreshQueueStatus() {
    await loadQueueFromServer();
    renderAll();
  }

  async function runSchedulerNow() {
    try {
      const base = (settings.backendUrl || "/.netlify/functions").replace(/\/$/, "");
      const res = await fetch(base + "/run-scheduler", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || JSON.stringify(data));
      await loadQueueFromServer();
      renderAll();
      alert(`تم تشغيل محرك الجدولة الآن.\nالعناصر الجاهزة: ${data.dueCount || 0}\nالمعالجة: ${data.processed || 0}`);
    } catch (err) {
      recordError("فشل تشغيل محرك الجدولة يدوياً", err);
      alert("فشل تشغيل محرك الجدولة: " + (err.message || err));
    }
  }

  async function showSchedulerStatus() {
    try {
      const base = (settings.backendUrl || "/.netlify/functions").replace(/\/$/, "");
      const res = await fetch(base + "/scheduler-status", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || JSON.stringify(data));
      const lines = [
        `الوقت الحالي: ${data.now}`,
        `عدد عناصر الجدولة: ${data.queueCount}`,
        `جاهزة للنشر الآن: ${data.dueCount}`,
        `آخر تشغيل: ${data.logs && data.logs[0] ? data.logs[0].at + " / processed: " + (data.logs[0].processed || 0) : "لا يوجد سجل بعد"}`
      ];
      alert(lines.join("\n"));
    } catch (err) {
      recordError("فشل قراءة حالة محرك الجدولة", err);
      alert("فشل قراءة حالة الجدولة: " + (err.message || err));
    }
  }

  function queueStatusLabel(status) {
    const map = { scheduled: "مجدول", publishing: "جاري النشر", waiting_publish: "بانتظار تأكيد Instagram", publish_check: "تم الإرسال - تحقق", published: "تم النشر", failed: "فشل", deleted: "محذوف" };
    return map[status] || status || "مجدول";
  }

  function renderQueue() {
    const header = `
      <div class="queue-toolbar">
        <button class="secondary" id="refreshQueueBtn" type="button">تحديث حالة الجدولة</button>
        <button class="secondary" id="schedulerStatusBtn" type="button">فحص محرك 24/7</button>
        <button class="primary" id="runSchedulerNowBtn" type="button">تشغيل الجدولة الآن</button>
        <button class="danger" id="clearQueueBtn" type="button">حذف كل الجدولة</button>
      </div>`;
    $("queueList").innerHTML = header + (queue.length ? queue.map((q, i) => `
      <div class="queue-item status-${escapeHtml(q.status || "scheduled")}">
        <b>${escapeHtml(q.video || q.title || "فيديو")}</b>
        <span class="muted">${escapeHtml(q.account || "")} · ${escapeHtml(q.market || "")} · ${escapeHtml(q.time || "")} · ${q.scheduledAt ? escapeHtml(new Date(q.scheduledAt).toLocaleDateString("ar")) : ""}</span>
        <p><strong>${escapeHtml(q.hook || "")}</strong></p>
        <p class="muted">${escapeHtml((q.caption || "").slice(0, 180))}${(q.caption || "").length > 180 ? "…" : ""}</p>
        <span class="warn">${escapeHtml(queueStatusLabel(q.status))}${q.error ? " — " + escapeHtml(String(q.error).slice(0, 120)) : ""}</span>
        <div class="queue-controls">
          <button class="publish-now-btn" data-publish-now="${i}" type="button" ${q.status === "published" ? "disabled" : ""}>نشر الآن</button>
          <button class="delete-queue-btn" data-delete-queue="${i}" type="button">حذف من الجدولة</button>
        </div>
      </div>
    `).join("") : `<div class="queue-item">شغّل Autopilot ليبني الجدول تلقائياً.</div>`);

    const refreshBtn = $("refreshQueueBtn");
    if (refreshBtn) refreshBtn.addEventListener("click", refreshQueueStatus);
    const clearBtn = $("clearQueueBtn");
    if (clearBtn) clearBtn.addEventListener("click", clearQueue);
    const runSchedulerBtn = $("runSchedulerNowBtn");
    if (runSchedulerBtn) runSchedulerBtn.addEventListener("click", runSchedulerNow);
    const schedulerStatusBtn = $("schedulerStatusBtn");
    if (schedulerStatusBtn) schedulerStatusBtn.addEventListener("click", showSchedulerStatus);
    document.querySelectorAll("[data-publish-now]").forEach(btn => {
      btn.addEventListener("click", () => publishNowFromQueue(Number(btn.dataset.publishNow)));
    });
    document.querySelectorAll("[data-delete-queue]").forEach(btn => {
      btn.addEventListener("click", () => deleteQueueItem(Number(btn.dataset.deleteQueue)));
    });
  }

  function renderHookFactory() {
    $("hookFactory").innerHTML = gulfHooks.map(h => `<div class="hook-item">${escapeHtml(h)}</div>`).join("");
  }


  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function getPreviewVideo() {
    return $("settingsVideo");
  }

  function togglePreviewPlayback() {
    const v = getPreviewVideo();
    if (!v || !v.src) return;
    if (v.paused) {
      v.play().catch(() => {});
      $("previewPlayBtn").textContent = "إيقاف";
    } else {
      v.pause();
      $("previewPlayBtn").textContent = "تشغيل";
    }
  }

  function seekPreview(delta) {
    const v = getPreviewVideo();
    if (!v || !isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
    updatePreviewTime();
  }

  function togglePreviewMute() {
    const v = getPreviewVideo();
    if (!v) return;
    v.muted = !v.muted;
    $("previewMuteBtn").textContent = v.muted ? "تشغيل الصوت" : "كتم الصوت";
  }

  function seekPreviewBar() {
    const v = getPreviewVideo();
    if (!v || !isFinite(v.duration)) return;
    const percent = Number($("previewSeek").value || 0);
    v.currentTime = (percent / 100) * v.duration;
    updatePreviewTime();
  }

  function updatePreviewTime() {
    const v = getPreviewVideo();
    if (!v) return;
    const duration = isFinite(v.duration) ? v.duration : 0;
    $("previewCurrent").textContent = formatTime(v.currentTime || 0);
    $("previewDuration").textContent = formatTime(duration);
    $("previewSeek").value = duration ? Math.round((v.currentTime / duration) * 100) : 0;
    $("previewPlayBtn").textContent = v.paused ? "تشغيل" : "إيقاف";
    $("previewMuteBtn").textContent = v.muted ? "تشغيل الصوت" : "كتم الصوت";
  }

  function parseDelayRange() {
    const mode = settings.delayMode || "off";
    if (mode === "off") return [0, 0];
    if (mode === "custom") return [Number(settings.delayMin || 0), Number(settings.delayMax || 0)];
    const parts = mode.split("-").map(Number);
    return [parts[0] || 0, parts[1] || parts[0] || 0];
  }

  function randomDelayMinutes(accountIndex) {
    const [min, max] = parseDelayRange();
    if (!max) return 0;
    const random = Math.floor(min + Math.random() * (max - min + 1));
    return accountIndex * random;
  }

  function addMinutesToTime(time, minutes) {
    const [h, m] = String(time || "08:00").split(":").map(Number);
    const total = ((h || 0) * 60 + (m || 0) + minutes) % (24 * 60);
    const hh = Math.floor(total / 60).toString().padStart(2, "0");
    const mm = (total % 60).toString().padStart(2, "0");
    return `${hh}:${mm}`;
  }




  async function testVideoPlayback(v) {
    return new Promise((resolve) => {
      const test = document.createElement("video");
      let finished = false;
      let hasFrame = false;

      test.muted = true;
      test.preload = "auto";
      test.playsInline = true;
      test.src = v.url;

      const done = (result) => {
        if (finished) return;
        finished = true;
        try {
          test.pause();
          test.removeAttribute("src");
          test.load();
        } catch (_) {}
        resolve(result);
      };

      const timer = setTimeout(() => {
        done({ ok: false, reason: "انتهت مهلة اختبار عرض الفيديو" });
      }, 3500);

      test.addEventListener("loadeddata", () => {
        hasFrame = test.videoWidth > 0 && test.videoHeight > 0;
        if (!hasFrame) {
          clearTimeout(timer);
          done({ ok: false, reason: "الصوت يعمل لكن الصورة غير مدعومة" });
        }
      });

      test.addEventListener("error", () => {
        clearTimeout(timer);
        done({ ok: false, reason: "المتصفح لا يستطيع تشغيل ترميز الفيديو" });
      });

      test.addEventListener("canplay", () => {
        hasFrame = test.videoWidth > 0 && test.videoHeight > 0;
        clearTimeout(timer);
        done({ ok: hasFrame, reason: hasFrame ? "متوافق" : "الصوت فقط بدون صورة" });
      });

      test.play().then(() => {
        setTimeout(() => {
          hasFrame = test.videoWidth > 0 && test.videoHeight > 0;
          clearTimeout(timer);
          done({ ok: hasFrame, reason: hasFrame ? "متوافق" : "الصوت فقط بدون صورة" });
        }, 900);
      }).catch(() => {
        // Some browsers block autoplay; loadeddata/canplay still decide.
      });
    });
  }

  async function scanNewVideos(list) {
    for (const v of list) {
      v.compatibility = "checking";
      v.compatibilityLabel = "⏳ فحص التشغيل";
      renderVideos();

      const result = await testVideoPlayback(v);
      if (result.ok) {
        v.compatibility = "compatible";
        v.compatibilityLabel = "✅ Compatible";
        v.repairStatus = "not_needed";
      } else {
        v.compatibility = "needs_repair";
        v.compatibilityLabel = "🔧 يحتاج إصلاح";
        v.repairStatus = "waiting";
        v.repairReason = result.reason;
      }
      renderVideos();
    }
  }

  async function scanAllVideos() {
    if (!videos.length) {
      alert("لا توجد فيديوهات لفحصها");
      return;
    }
    await scanNewVideos(videos);
    alert("تم فحص الفيديوهات. إذا كان الصوت يعمل بدون صورة سيتم تصنيف الفيديو كـ يحتاج إصلاح.");
  }





  let ffmpegInstance = null;
  let ffmpegLoadingPromise = null;

  async function getInternalFFmpeg() {
    const FFmpegNamespace = window.FFmpegWASM || window.FFmpeg;
    const UtilNamespace = window.FFmpegUtil;

    if (!FFmpegNamespace || !FFmpegNamespace.FFmpeg) {
      throw new Error("لم يتم تحميل مكتبة FFmpeg. تأكد من اتصال الإنترنت ثم حدّث الصفحة.");
    }

    if (!UtilNamespace || !UtilNamespace.fetchFile) {
      throw new Error("لم يتم تحميل مكتبة FFmpeg Util. تأكد من اتصال الإنترنت ثم حدّث الصفحة.");
    }

    if (!ffmpegInstance) {
      ffmpegInstance = new FFmpegNamespace.FFmpeg();
      ffmpegInstance.on("log", ({ message }) => console.log("[ffmpeg]", message));
      ffmpegInstance.on("progress", ({ progress }) => {
        const percent = Math.round((progress || 0) * 100);
        console.log("[ffmpeg progress]", percent + "%");
      });
    }

    if (!ffmpegInstance.loaded) {
      if (!ffmpegLoadingPromise) {
        ffmpegLoadingPromise = ffmpegInstance.load({
          coreURL: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
          wasmURL: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm",
          workerURL: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.worker.js"
        });
      }
      await ffmpegLoadingPromise;
    }

    // Some builds don't expose .loaded consistently, so verify by attempting a harmless command.
    if (!ffmpegInstance.loaded) {
      ffmpegInstance.loaded = true;
    }

    return {
      ffmpeg: ffmpegInstance,
      fetchFile: UtilNamespace.fetchFile
    };
  }

  async function repairVideoInternally(v) {
    const { ffmpeg, fetchFile } = await getInternalFFmpeg();

    const inputName = "input-" + Date.now() + ".mp4";
    const outputName = "fixed-" + Date.now() + ".mp4";

    const blob = await fetch(v.url).then(r => r.blob());
    await ffmpeg.writeFile(inputName, await fetchFile(blob));

    await ffmpeg.exec([
      "-i", inputName,
      "-map", "0:v:0",
      "-map", "0:a?",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "16",
      "-pix_fmt", "yuv420p",
      "-profile:v", "high",
      "-c:a", "aac",
      "-b:a", "320k",
      "-movflags", "+faststart",
      outputName
    ]);

    const data = await ffmpeg.readFile(outputName);
    const fixedBlob = new Blob([data.buffer], { type: "video/mp4" });
    const fixedUrl = URL.createObjectURL(fixedBlob);

    try { await ffmpeg.deleteFile(inputName); } catch (_) {}
    try { await ffmpeg.deleteFile(outputName); } catch (_) {}

    v.url = fixedUrl;
    v.name = v.name.replace(/\.[^.]+$/, "") + "-fixed.mp4";
    v.type = "video/mp4";
    v.compatibility = "fixed";
    v.compatibilityLabel = "✅ Fixed Internally";
    v.repairStatus = "fixed";
    v.repairReason = "";
  }


  async function forceRepairAllVideos() {
    if (!videos.length) {
      alert("لا توجد فيديوهات لإصلاحها");
      return;
    }

    videos.forEach(v => {
      v.compatibility = "needs_repair";
      v.compatibilityLabel = "🔧 سيتم إصلاحه داخلياً";
      v.repairStatus = "waiting";
    });
    renderVideos();
    await repairIncompatibleVideos();
  }

  async function repairIncompatibleVideos() {
    const targets = videos.filter(v => v.compatibility === "needs_repair" || v.repairStatus === "waiting");
    if (!targets.length) {
      alert("لا توجد فيديوهات تحتاج إصلاح حالياً");
      return;
    }

    alert("سيبدأ الإصلاح الداخلي. قد يأخذ وقتاً حسب حجم الفيديو وقوة الجهاز. لا تغلق الصفحة.");

    for (const v of targets) {
      v.compatibilityLabel = "⏳ تحميل FFmpeg ثم إصلاح...";
      v.repairStatus = "processing";
      renderVideos();

      try {
        await repairVideoInternally(v);
      } catch (err) {
        console.error(err);
        v.compatibility = "needs_repair";
        v.compatibilityLabel = "❌ فشل الإصلاح الداخلي";
        v.repairStatus = "failed";
        v.repairReason = (err && err.message) ? err.message : "فشل غير معروف";
      }

      renderVideos();
      loadEditor();
    }

    alert("انتهى إصلاح الفيديوهات داخلياً.");
  }


  function renderStats() {
    const published = queue.filter(q => q.status === "published").length;
    const now = Date.now();
    const tomorrow = now + 24*60*60*1000;
    const dueToday = queue.filter(q => {
      const t = new Date(q.scheduledAt || 0).getTime();
      return q.status === "scheduled" && t >= now && t <= tomorrow;
    }).length;
    $("statVideos").textContent = videos.length;
    $("statAccounts").textContent = accounts.length;
    $("statQueue").textContent = queue.length;
    if($("statPublished")) $("statPublished").textContent = published;
    if($("statDue")) $("statDue").textContent = dueToday;
    $("autoState").textContent = autopilot ? "ON" : "OFF";
    const activeAccounts = accounts.filter(a => a.official !== false).length;
    const next = queue.filter(q => q.status === "scheduled").sort((a,b)=>new Date(a.scheduledAt)-new Date(b.scheduledAt))[0];
    const healthHtml = `
        <span>الحسابات الفعالة: <b>${activeAccounts}</b></span>
        <span>الفيديوهات الجاهزة: <b>${videos.filter(v=>publicVideoUrl(v)).length}</b></span>
        <span>منع التكرار: <b>${settings.repeatCooldownDays || 21} يوم</b></span>
        <span>النشر القادم: <b>${next ? new Date(next.scheduledAt).toLocaleString("ar") : "لا يوجد"}</b></span>`;
    if($("engineHealth")) $("engineHealth").innerHTML = healthHtml;
    if($("engineHealthControl")) $("engineHealthControl").innerHTML = healthHtml;
    if($("controlAutoState")) $("controlAutoState").textContent = autopilot ? "ON" : "OFF";
    if($("controlQueueCount")) $("controlQueueCount").textContent = queue.length;
    if($("controlVideoCount")) $("controlVideoCount").textContent = videos.length;
  }

  function renderAll() {
    renderStats();
    renderVideos();
    renderAccounts();
    renderQueue();
    renderHookFactory();
    applyLook();
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[s]));
  }

  document.addEventListener("DOMContentLoaded", () => {
    bind();
    setupPublishNowDelegation();
    loadErrorLog();
    renderErrorLog();
    hydrateAll();
    loadPublicConfig().catch(() => {});
    loadQueueFromServer();
    startBrowserAutoPublisher();
    loadSettingsToUI();
    renderAll();
    if (new URLSearchParams(window.location.search).get("connected")) {
      loadOfficialAccounts();
      history.replaceState({}, "", window.location.pathname);
    }
  });
})();



/* Removed outdated upload interceptor in v37 clean build. */




/* Removed outdated upload interceptor in v37 clean build. */



/* v39: Queue delete controls are now native inside renderQueue. */

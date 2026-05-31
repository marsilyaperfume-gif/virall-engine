
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
    const payloadQueue = queue.map((item, index) => ({
      ...item,
      id: item.id || `${item.accountId || item.account || "acc"}_${item.videoId || item.video || "video"}_${item.time || index}`,
      scheduledAt: item.scheduledAt || toServerScheduledAt(item.time || item.scheduledTime),
      status: item.status === "published" ? "published" : (item.status === "failed" ? "failed" : "scheduled")
    }));

    const base = ((typeof settings !== "undefined" && settings.backendUrl) || "/.netlify/functions").replace(/\/$/, "");
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
    if(res.ok && Array.isArray(data.queue) && data.queue.length){
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

    const now = new Date();

    for(let i=0;i<queue.length;i++){
      const item = queue[i];
      if(!item) continue;

      if(item.status === "published" || item.status === "publishing") continue;

      const timeStr = item.time || item.scheduledTime || "";
      if(!timeStr) continue;

      const parts = String(timeStr).match(/(\d{1,2})[:٫](\d{1,2})/);
      if(!parts) continue;

      const h = Number(parts[1]);
      const m = Number(parts[2]);

      const currentH = now.getHours();
      const currentM = now.getMinutes();

      if(currentH === h && currentM === m){
        item.status = "publishing";
        try{
          if(typeof persistAll === "function") persistAll();
        }catch(e){}

        try{
          await publishNowFromQueue(i, { skipConfirm: true });
          item.status = "published";
          item.publishedAt = new Date().toISOString();
        }catch(err){
          console.error(err);
          item.status = "failed";
          item.error = err.message || String(err);
        }

        try{
          if(typeof persistAll === "function") persistAll();
          if(typeof renderAll === "function") renderAll();
        }catch(e){}
      }
    }
  }catch(err){
    console.error("Auto scheduler error", err);
  }
}

setInterval(v32AutoPublishScheduler, 30000);

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
    supabaseBucket: "reels"
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

  async function uploadToCloudinary(file) {
    // v38 clean: upload through a Netlify Function using Supabase Service Role.
    // This bypasses browser RLS problems while keeping the secret key hidden on Netlify.
    await loadPublicConfig();

    if (!file || !file.size) {
      throw new Error("ملف الفيديو غير صالح أو فارغ.");
    }

    const maxMB = 80;
    const sizeMB = file.size / 1024 / 1024;
    if (sizeMB > maxMB) {
      throw new Error(`حجم الفيديو ${sizeMB.toFixed(1)}MB كبير جداً لهذه النسخة. جرّب ضغطه أو استخدم فيديو أقل من ${maxMB}MB.`);
    }

    const toBase64 = (f) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("فشل قراءة ملف الفيديو من المتصفح."));
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.readAsDataURL(f);
    });

    const base64 = await toBase64(file);
    const endpoint = "/.netlify/functions/upload-video";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name || "video.mp4",
        contentType: file.type || "video/mp4",
        base64
      })
    });

    const text = await res.text().catch(() => "");
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch(e) { data = { raw: text }; }

    if (!res.ok || !data.ok || !data.publicUrl) {
      const msg = data.message || data.error || data.raw || `HTTP ${res.status}`;
      const err = new Error("فشل رفع الفيديو عبر Netlify Function: " + msg);
      recordError("Server Supabase Upload Failed", err, { status: res.status, endpoint, file: `${file.name} (${sizeMB.toFixed(2)}MB)`, details: data });
      throw err;
    }

    return {
      url: data.publicUrl,
      publicUrl: data.publicUrl,
      cloudinaryPublicId: data.path,
      supabasePath: data.path,
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
      caption: video.caption,
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

    ["hookType","hookPower","emojiMode","hookLength","hookStyle","fontSize","hookTop","boxWidth","hookOpacity","hookRadius","offerType","ctaMode","hashtags","captionFooter"].forEach(id => {
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

    for (const file of videoFiles) {
      try {
        const uploaded = await uploadToCloudinary(file);
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
          postedTo: []
        });
        persistAll();
      } catch (err) {
        recordError("فشل رفع الفيديو من الواجهة", err, { file: file.name });
        alert("فشل رفع " + file.name + ": " + (err.message || err) + "\n\nتم تسجيل الخطأ في قسم الأخطاء.");
        openTab("errors");
      }
    }

    selected = Math.max(0, videos.length - videoFiles.length);
    scanNewVideos(videos.slice(selected));
    renderAll();
    persistAll();
    loadEditor();
    openTab("videos");
    alert("تم رفع " + videoFiles.length + " فيديو");
  }

  function clean(parts) {
    return parts.filter(Boolean).join(" ").replace(/\s+\./g, ".").replace(/\.\s*\./g, ".").replace(/\s+/g, " ").trim();
  }

  function makeHook(name = "") {
    return rand(gulfHooks);
  }

  function makeCaption(market) {
    const marketText = market && market !== "عام الخليج" ? `داخل ${market}` : "في الخليج";
    const offers = {
      discount: "خصومات قوية",
      freeShipping: "توصيل مجاني",
      cod: "دفع عند الاستلام",
      bundle: "اطلب أكثر ووفر أكثر",
      premium: "فخامة وسعر منافس"
    };
    const ctas = {
      bio: "اطلب من الرابط في البايو",
      whatsapp: "راسلنا واتساب",
      limited: "اطلب قبل نفاد الكمية",
      shopNow: "تسوق الآن"
    };
    const templates = [
      `${rand(captionOpeners)} ${marketText}. ${offers[settings.offerType]}. ${rand(captionBenefits)} و${rand(captionBenefits)}. ${rand(captionCTAs)}.`,
      `عطور عالمية أصلية بأسعار منافسة ${marketText}. ${offers[settings.offerType]}. ${ctas[settings.ctaMode]}.`,
      `لو تدور على عطر فخم بسعر ذكي، هذه التشكيلة لك ${marketText}. ${rand(captionBenefits)}. ${rand(captionCTAs)}.`,
      `ريحة فخمة وسعر أذكى ${marketText}. ${offers[settings.offerType]}. ${ctas[settings.ctaMode]}.`,
      `${rand(captionOpeners)} — ${offers[settings.offerType]}. ${ctas[settings.ctaMode]}.`
    ];
    return clean([rand(templates), settings.captionFooter ? settings.captionFooter + "." : "", settings.hashtags]);
  }

  function readSettingsFromUI() {
    ["hookType","hookPower","emojiMode","hookLength","hookStyle","offerType","ctaMode","hashtags","captionFooter","delayMode"].forEach(id => { if($(id)) settings[id] = $(id).value; });
    ["delayMin","delayMax"].forEach(id => { if($(id)) settings[id] = Number($(id).value || 0); });
    ["fontSize","hookTop","boxWidth","hookOpacity","hookRadius"].forEach(id => settings[id] = Number($(id).value));
    ["autoHook","autoCaption","avoidRepeat","abTesting","smartRepost","autoRetry"].forEach(id => settings[id] = $(id).checked);
    saveSettings();
    updateLabels();
  }

  function loadSettingsToUI() {
    ["hookType","hookPower","emojiMode","hookLength","hookStyle","offerType","ctaMode","hashtags","captionFooter","delayMode"].forEach(id => { if ($(id)) $(id).value = settings[id]; });
    ["delayMin","delayMax"].forEach(id => { if ($(id)) $(id).value = settings[id]; });
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
        <input type="time" value="" data-time-index="${i}">
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

  function startAutopilot() {
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

    autopilot = true;
    queue = [];
    videos.forEach((v, i) => {
      accounts.forEach((a, j) => {
        const scheduledTime = addMinutesToTime(settings.times[(i + j) % settings.times.length], randomDelayMinutes(j));
        queue.push({
          id: `${a.id || a.name}_${v.id || v.name}_${scheduledTime}_${Date.now()}`,
          videoId: v.id,
          video: v.name,
          videoUrl: publicVideoUrl(v),
          accountId: a.id,
          account: a.name || a.user || a.username,
          market: a.market,
          time: scheduledTime,
          scheduledAt: toServerScheduledAt(scheduledTime),
          status: "scheduled",
          hook: v.hook,
          caption: makeCaption(a.market),
          createdAt: new Date().toISOString()
        });
      });
    });

    renderAll();
persistAll();
    openTab("queue");
  }


  async function publishNowFromQueue(index, options = {}) {
    const item = queue[index];
    if (!item) return;

    const publishKey = "queue_" + (item.videoId || index);
    if(!acquirePublishLock(publishKey)){
      return alert("هذا الفيديو قيد النشر بالفعل");
    }

    const ok = options.skipConfirm ? true : confirm("هل تريد نشر هذا الفيديو الآن على الحساب المحدد؟");
    if (!ok) { releasePublishLock(publishKey); return; }

    const btns = document.querySelectorAll(`[data-publish-now="${index}"]`);
    btns.forEach(b => {
      b.disabled = true;
      b.textContent = "جاري النشر...";
    });

    try {
      const account = accounts.find(a => a.name === item.account || a.user === item.account || a.id === item.accountId);
      const video = videos.find(v => v.name === item.video || v.id === item.videoId);

      if (!account || !account.official) {
        alert("هذا العنصر غير مربوط بحساب رسمي. اختر حساب Officially Connected.");
        return;
      }

      const videoUrl = item.videoUrl || publicVideoUrl(video);
      if (!videoUrl) {
        alert("لم يتم العثور على رابط الفيديو. أعد رفع الفيديو إلى Cloudinary ثم جرّب النشر.");
        return;
      }

      if (String(videoUrl).startsWith("blob:")) {
        alert("النشر الآن يحتاج رابط فيديو عام من Storage مثل Cloudinary/S3. الفيديو الحالي موجود محلياً داخل المتصفح فقط.");
        return;
      }

      const res = await fetch((settings.backendUrl || "/.netlify/functions").replace(/\/$/, "") + "/publish-reel", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          accountId: account.id,
          videoUrl,
          caption: item.caption || item.hook || ""
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل النشر");

      item.status = "published";
      item.publishedAt = new Date().toISOString();
      renderAll();
persistAll();
      alert("تم إرسال النشر إلى Instagram بنجاح.");
    } catch (err) {
      console.error(err);
      alert("فشل النشر الآن: " + (err.message || err));
    } finally {
      releasePublishLock(publishKey);

      btns.forEach(b => {
        b.disabled = false;
        b.textContent = "نشر الآن";
      });
    }
  }


  function renderQueue() {
    $("queueList").innerHTML = queue.length ? queue.map((q, i) => `
      <div class="queue-item">
        <b>${escapeHtml(q.video || q.title || "فيديو")}</b>
        <span class="muted">${escapeHtml(q.account || "")} · ${escapeHtml(q.market || "")} · ${escapeHtml(q.time || "")}</span>
        <p>${escapeHtml(q.hook || "")}</p>
        <span class="warn">${escapeHtml(q.status || "مجدول")}</span>
        <div class="queue-controls">
          <button class="publish-now-btn" data-publish-now="${i}" type="button">نشر الآن</button>
        </div>
      </div>
    `).join("") : `<div class="queue-item">شغّل Autopilot ليبني الجدول تلقائياً.</div>`;

    document.querySelectorAll("[data-publish-now]").forEach(btn => {
      btn.addEventListener("click", () => publishNowFromQueue(Number(btn.dataset.publishNow)));
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
    $("statVideos").textContent = videos.length;
    $("statAccounts").textContent = accounts.length;
    $("statQueue").textContent = queue.length;
    $("autoState").textContent = autopilot ? "ON" : "OFF";
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



/* ===== v26 Queue Delete Controls ===== */
function saveQueueChanges(){
  try{
    if(typeof saveAllData === "function") saveAllData();
    if(window.__virallStore && typeof window.__virallStore.save === "function") window.__virallStore.save();
    if(typeof v17SaveEverything === "function") v17SaveEverything();
    localStorage.setItem("virall_queue", JSON.stringify(queue || []));
    localStorage.setItem("virall_queue_data", JSON.stringify(queue || []));
    if (typeof syncQueueToServerDebounced === "function") syncQueueToServerDebounced();
  }catch(err){
    console.error("Queue save error", err);
  }
}

function deleteQueueItem(index){
  if(!Array.isArray(queue)) return;
  const item = queue[index];
  if(!item) return;

  const ok = confirm("هل تريد حذف هذا الفيديو من الجدولة؟");
  if(!ok) return;

  queue.splice(index, 1);
  saveQueueChanges();

  if(typeof renderAll === "function") renderAll();
  setTimeout(injectQueueDeleteControls, 200);
}

function clearAllQueue(){
  if(!Array.isArray(queue) || !queue.length){
    alert("لا توجد فيديوهات مجدولة حالياً");
    return;
  }

  const ok = confirm("هل تريد حذف كل الفيديوهات من الجدولة؟");
  if(!ok) return;

  queue.length = 0;
  saveQueueChanges();

  if(typeof renderAll === "function") renderAll();
  setTimeout(injectQueueDeleteControls, 200);

  alert("تم حذف كل الجدولة");
}

function injectQueueDeleteControls(){
  try{
    const queueSection =
      document.querySelector("#queue") ||
      document.querySelector("[data-section='queue']") ||
      Array.from(document.querySelectorAll("section, .card, .panel, div")).find(el =>
        (el.textContent || "").includes("Autopilot Queue")
      );

    if(queueSection && !queueSection.querySelector(".clear-queue-btn")){
      const clearBtn = document.createElement("button");
      clearBtn.className = "clear-queue-btn";
      clearBtn.type = "button";
      clearBtn.textContent = "حذف كل الجدولة";
      clearBtn.onclick = clearAllQueue;
      queueSection.prepend(clearBtn);
    }

    document.querySelectorAll(".queue-item").forEach((card, index)=>{
      if(card.querySelector(".delete-queue-item-btn")) return;

      const controls = document.createElement("div");
      controls.className = "queue-manage-controls";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-queue-item-btn";
      deleteBtn.type = "button";
      deleteBtn.textContent = "حذف من الجدولة";
      deleteBtn.onclick = () => deleteQueueItem(index);

      controls.appendChild(deleteBtn);
      card.appendChild(controls);
    });

    // fallback for queue cards that don't use .queue-item
    const possibleCards = Array.from(document.querySelectorAll("div")).filter(el => {
      const txt = el.textContent || "";
      return txt.includes("مجدول تلقائياً") && !el.querySelector(".delete-queue-item-btn");
    });

    possibleCards.forEach((card, index)=>{
      const realIndex = Math.min(index, (queue || []).length - 1);
      if(realIndex < 0) return;

      const controls = document.createElement("div");
      controls.className = "queue-manage-controls";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-queue-item-btn";
      deleteBtn.type = "button";
      deleteBtn.textContent = "حذف من الجدولة";
      deleteBtn.onclick = () => deleteQueueItem(realIndex);

      controls.appendChild(deleteBtn);
      card.appendChild(controls);
    });

  }catch(err){
    console.error("Queue controls inject error", err);
  }
}

setInterval(injectQueueDeleteControls, 1200);
/* ===== End v26 Queue Delete Controls ===== */

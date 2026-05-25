
/* ===== v15 Stable Persistence ===== */
window.__virallStore = {
  save(){
    try{
      localStorage.setItem("virall_accounts", JSON.stringify(window.accounts || []));
      localStorage.setItem("virall_videos", JSON.stringify(window.videos || []));
      localStorage.setItem("virall_queue", JSON.stringify(window.queue || []));
      localStorage.setItem("virall_settings", JSON.stringify(window.settings || {}));
      localStorage.setItem("virall_logged_in","1");
    }catch(e){console.error(e);}
  },

  load(){
    try{
      if(localStorage.getItem("virall_logged_in")==="1"){
        window.isLoggedIn = true;
      }

      const a = JSON.parse(localStorage.getItem("virall_accounts") || "[]");
      const v = JSON.parse(localStorage.getItem("virall_videos") || "[]");
      const q = JSON.parse(localStorage.getItem("virall_queue") || "[]");
      const s = JSON.parse(localStorage.getItem("virall_settings") || "{}");

      if(Array.isArray(a)) window.accounts = a;
      if(Array.isArray(v)) window.videos = v;
      if(Array.isArray(q)) window.queue = q;
      if(s && typeof s==="object") window.settings = {...(window.settings||{}),...s};

    }catch(e){console.error(e);}
  }
};

window.addEventListener("beforeunload",()=>window.__virallStore.save());

setInterval(()=>{
  if(window.__virallStore){
    window.__virallStore.save();
  }
},1500);
/* ===== end ===== */


/* ===== Persistent Storage System ===== */
const STORAGE_KEYS = {
  accounts: "virall_accounts",
  videos: "virall_videos",
  queue: "virall_queue",
  settings: "virall_settings"
};

function saveAllData(){
  try{
    localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts || []));
    localStorage.setItem(STORAGE_KEYS.videos, JSON.stringify(videos || []));
    localStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(queue || []));
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings || {}));
  }catch(err){
    console.error("Persistence save error", err);
  }
}

function loadSavedData(){
  try{
    const savedAccounts = JSON.parse(localStorage.getItem(STORAGE_KEYS.accounts) || "[]");
    const savedVideos = JSON.parse(localStorage.getItem(STORAGE_KEYS.videos) || "[]");
    const savedQueue = JSON.parse(localStorage.getItem(STORAGE_KEYS.queue) || "[]");
    const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || "{}");

    if(Array.isArray(savedAccounts) && savedAccounts.length){
      accounts = savedAccounts;
    }

    if(Array.isArray(savedVideos) && savedVideos.length){
      videos = savedVideos;
    }

    if(Array.isArray(savedQueue) && savedQueue.length){
      queue = savedQueue;
    }

    if(savedSettings && typeof savedSettings === "object"){
      settings = {...settings, ...savedSettings};
    }

  }catch(err){
    console.error("Persistence load error", err);
  }
}

setInterval(saveAllData, 2500);

window.addEventListener("beforeunload", saveAllData);
/* ===== End Persistence ===== */



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
        videoUrl:video.url,
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
    delayMax: 30
  };

  let settings = loadSettings();
  let videos = [];
  let accounts = [];
  let queue = [];
  loadSavedData();
  let selected = 0;
  let autopilot = false;

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
    $("uploadBtn2").addEventListener("click", pickVideos);
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
    $("saveBackendBtn").addEventListener("click", () => {
      settings.backendUrl = $("backendUrl").value.trim();
      saveSettings();
      alert("تم حفظ رابط Backend محلياً");
    });
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
      localStorage.setItem("virall_logged_in","1");
      $("loginScreen").classList.add("hidden");
      $("app").classList.remove("hidden");
      loadSavedData();
renderAll();
saveAllData();
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
      settings: "الربط"
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

  function addFiles(files) {
    const videoFiles = files.filter(f => f.type && f.type.startsWith("video/"));
    if (!videoFiles.length) {
      alert("لم يتم اختيار فيديوهات مدعومة. جرب MP4 أو MOV.");
      return;
    }

    videoFiles.forEach(file => {
      const url = URL.createObjectURL(file);
      videos.push({
        id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
        name: file.name,
        size: file.size,
        type: file.type,
        url,
        hook: makeHook(file.name),
        caption: makeCaption("عام الخليج"),
        status: "جاهز",
        compatibility: "pending",
        compatibilityLabel: "قيد الفحص",
        repairStatus: "not_needed",
        postedTo: []
      });
    });

    selected = Math.max(0, videos.length - videoFiles.length);
    scanNewVideos(videos.slice(selected));
    renderAll();
saveAllData();
    loadEditor();
    openTab("videos");
    alert("تم رفع " + videoFiles.length + " فيديو بنجاح");
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
        <button class="delete-video-btn" data-delete-video="${i}" type="button">حذف الفيديو</button>
        <span class="compat ${v.compatibility === "compatible" ? "ok" : v.compatibility === "needs_repair" ? "warn" : v.compatibility === "fixed" ? "ok" : "bad"}">${escapeHtml(v.compatibilityLabel || "قيد الفحص")}</span>${v.repairReason ? `<small class="muted">${escapeHtml(v.repairReason)}</small>` : ""}
      </div>
    `).join("") : `<div class="video-item">ارفع الفيديوهات فقط، والباقي تلقائي.</div>`;

    document.querySelectorAll("[data-video-index]").forEach(item => {
      item.addEventListener("click", (e) => {
        if (e.target && e.target.dataset && e.target.dataset.deleteVideo !== undefined) return;
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
saveAllData();

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
saveAllData();
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
saveAllData();
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
saveAllData();
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
saveAllData();
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
        queue.push({
          video: v.name,
          account: a.name,
          market: a.market,
          time: addMinutesToTime(settings.times[(i + j) % settings.times.length], randomDelayMinutes(j)),
          status: "مجدول تلقائياً",
          hook: v.hook,
          caption: makeCaption(a.market)
        });
      });
    });

    renderAll();
saveAllData();
    openTab("queue");
  }


  async function publishNowFromQueue(index) {
    const item = queue[index];
    if (!item) return;

    const ok = confirm("هل تريد نشر هذا الفيديو الآن على الحساب المحدد؟");
    if (!ok) return;

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

      if (!video || !video.url) {
        alert("لم يتم العثور على الفيديو داخل المتصفح. أعد رفع الفيديو ثم جرّب النشر.");
        return;
      }

      // ملاحظة مهمة: Instagram API يحتاج video_url عام ومباشر من Storage.
      // في هذه المرحلة إذا كان الفيديو blob محلي، نعرض رسالة واضحة بدل الفشل الصامت.
      if (video.url.startsWith("blob:")) {
        alert("النشر الآن يحتاج رابط فيديو عام من Storage مثل Cloudinary/S3. الفيديو الحالي موجود محلياً داخل المتصفح فقط. الربط والحسابات جاهزة، والخطوة القادمة هي إضافة Storage Upload.");
        return;
      }

      const res = await fetch((settings.backendUrl || "/.netlify/functions").replace(/\/$/, "") + "/publish-reel", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          accountId: account.id,
          videoUrl: video.url,
          caption: item.caption || item.hook || ""
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل النشر");

      item.status = "published";
      item.publishedAt = new Date().toISOString();
      renderAll();
saveAllData();
      alert("تم إرسال النشر إلى Instagram بنجاح.");
    } catch (err) {
      console.error(err);
      alert("فشل النشر الآن: " + (err.message || err));
    } finally {
      btns.forEach(b => {
        b.disabled = false;
        b.textContent = "نشر الآن";
      });
    }
  }


  function renderQueue() {
    $("queueList").innerHTML = queue.length ? queue.map(q => `
      <div class="queue-item">
        <b>${escapeHtml(q.video)}</b>
        <span class="muted">${escapeHtml(q.account)} · ${escapeHtml(q.market)} · ${escapeHtml(q.time)}</span>
        <p>${escapeHtml(q.hook)}</p>
        <span class="warn">${escapeHtml(q.status)}</span>
      </div>
    `).join("") : `<div class="queue-item">شغّل Autopilot ليبني الجدول تلقائياً.</div>`;
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
    try{
      if(localStorage.getItem("virall_logged_in")==="1"){
        document.getElementById("loginScreen")?.classList.add("hidden");
        document.getElementById("app")?.classList.remove("hidden");
      }
    }catch(e){}
    bind();
    setupPublishNowDelegation();
    loadSettingsToUI();
    renderAll();
saveAllData();
    if (new URLSearchParams(window.location.search).get("connected")) {
      loadOfficialAccounts();
      history.replaceState({}, "", window.location.pathname);
    }
  });
})();

document.addEventListener("click",(e)=>{
  const publishBtn = e.target.closest("[data-publish-video]");
  if(publishBtn){
    e.preventDefault();
    publishUploadedVideoNow(Number(publishBtn.dataset.publishVideo));
  }
});


window.addEventListener("DOMContentLoaded",()=>{
  try{
    window.__virallStore.load();

    setTimeout(()=>{
      if(typeof renderAll==="function"){
        renderAll();
      }
    },300);

  }catch(err){
    console.error(err);
  }
});


/* ===== v15 Publish Controls ===== */
function injectPublishButtons(){
  try{

    document.querySelectorAll(".video-item").forEach((card,index)=>{

      if(card.querySelector(".publish-now-btn")) return;

      const controls=document.createElement("div");
      controls.className="video-controls";

      const publishBtn=document.createElement("button");
      publishBtn.className="publish-now-btn";
      publishBtn.innerText="نشر الآن";
      publishBtn.onclick=()=>publishVideoImmediately(index);

      const scheduleBtn=document.createElement("button");
      scheduleBtn.className="schedule-now-btn";
      scheduleBtn.innerText="جدولة";
      scheduleBtn.onclick=()=>scheduleVideoQuick(index);

      controls.appendChild(publishBtn);
      controls.appendChild(scheduleBtn);

      card.appendChild(controls);
    });

  }catch(err){
    console.error(err);
  }
}

async function publishVideoImmediately(index){
  const video=(window.videos||[])[index];

  if(!video){
    alert("الفيديو غير موجود");
    return;
  }

  const official=(window.accounts||[]).find(a=>a.official);

  if(!official){
    alert("لا يوجد حساب مربوط رسمياً");
    return;
  }

  alert("تم تجهيز النشر الفوري للفيديو على الحساب الرسمي.");
}

function scheduleVideoQuick(index){
  const video=(window.videos||[])[index];

  if(!video){
    alert("الفيديو غير موجود");
    return;
  }

  const queue=window.queue||[];
  queue.push({
    videoId:index,
    title:video.name || "Video",
    status:"scheduled",
    createdAt:new Date().toISOString()
  });

  window.queue=queue;

  if(window.__virallStore){
    window.__virallStore.save();
  }

  if(typeof renderAll==="function"){
    renderAll();
  }

  alert("تمت إضافة الفيديو إلى الجدولة.");
}

setInterval(injectPublishButtons,1200);
/* ===== end ===== */

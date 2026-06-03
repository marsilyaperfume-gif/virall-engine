const corsHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Telegram-Bot-Api-Secret-Token"
};

function json(statusCode, body){ return { statusCode, headers: corsHeaders, body: JSON.stringify(body, null, 2) }; }

function blobStore(name){
  const { getStore } = require("@netlify/blobs");
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) return getStore({ name, siteID, token });
  return getStore(name);
}

async function readState(){
  const store = blobStore("app_state");
  return (await store.get("state", { type: "json" })) || { settings: {}, videos: [], accounts: [], autopilot: false };
}
async function writeState(state){
  const store = blobStore("app_state");
  await store.setJSON("state", state && typeof state === "object" ? state : {});
}

async function readAllowedUsers(){
  const store = blobStore("telegram_access");
  const data = (await store.get("allowed", { type: "json" })) || [];
  return Array.isArray(data) ? data.map(x => String(x || "").trim().replace(/^@+/, "").toLowerCase()).filter(Boolean) : [];
}
function senderAllowed(message, allowed){
  if(!allowed || !allowed.length) return true; // open mode until you add allowed users from the site
  const from = (message && message.from) || {};
  const username = String(from.username || "").trim().replace(/^@+/, "").toLowerCase();
  const id = String(from.id || "").trim().toLowerCase();
  return (!!username && allowed.includes(username)) || (!!id && allowed.includes(id));
}

async function appendTelegramLog(entry){
  const store = blobStore("telegram_uploads");
  const current = (await store.get("uploads", { type: "json" })) || [];
  current.unshift({ at: new Date().toISOString(), ...entry });
  await store.setJSON("uploads", current.slice(0, 300));
}

function safeFileName(name){
  return String(name || "telegram_video.mp4").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120) || "telegram_video.mp4";
}
function randomId(){
  try { return crypto.randomUUID(); } catch(_) { return `tg_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
}
function caption(){
  const hooks = [
    "ريحة تخلي الكل يسألك وش حاط 😮‍💨",
    "لو ذوقك فخم، هذا العطر لك",
    "ثبات وفخامة بسعر أذكى مما تتوقع",
    "العطر اللي يغيّر حضورك من أول رشة",
    "اختيار مرتب للدوام والطلعات والهدايا"
  ];
  const bodies = [
    "يا أهل الخليج… إذا تبغى عطر يعطي حضور بدون إزعاج، هذا خيار يستاهل التجربة.",
    "ريحة نظيفة وفخمة وتبقى معك بشكل مرتب. مناسب للاستخدام اليومي والهدية.",
    "الناس تلاحظ التفاصيل، والعطر أول تفصيل ينحفظ بالذاكرة."
  ];
  return `${hooks[Math.floor(Math.random()*hooks.length)]}\n\n${bodies[Math.floor(Math.random()*bodies.length)]}\n\nاطلبه من الرابط في البايو قبل نفاد الكمية.\nتوصيل سريع · دفع عند الاستلام\n#عطور #Perfume #عطور_خليجية #Marrsile`;
}

async function telegram(method, params = {}){
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if(!token) throw new Error("TELEGRAM_BOT_TOKEN is missing");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok || data.ok === false) throw new Error(data.description || `Telegram ${method} failed`);
  return data.result;
}

async function reply(chatId, text){
  if(!chatId) return;
  try { await telegram("sendMessage", { chat_id: chatId, text }); } catch(_) {}
}

function pickVideoMessage(message){
  if(!message) return null;
  if(message.video) return { kind: "video", fileId: message.video.file_id, fileName: message.video.file_name || `telegram_${message.message_id}.mp4`, mime: message.video.mime_type || "video/mp4", size: message.video.file_size || 0 };
  const doc = message.document;
  if(doc && String(doc.mime_type || "").startsWith("video/")) return { kind: "document", fileId: doc.file_id, fileName: doc.file_name || `telegram_${message.message_id}.mp4`, mime: doc.mime_type || "video/mp4", size: doc.file_size || 0 };
  return null;
}

async function uploadToSupabase(buffer, originalName, contentType){
  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
  const bucket = process.env.SUPABASE_BUCKET || "reels";
  if(!supabaseUrl || !serviceKey) throw new Error("Supabase env is missing");
  const ext = originalName.includes(".") ? originalName.split(".").pop() : "mp4";
  const path = `telegram-reels/${new Date().toISOString().slice(0,10)}/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
  const endpoint = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${path}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": contentType || "video/mp4", "x-upsert": "true" },
    body: buffer
  });
  const text = await res.text().catch(() => "");
  if(!res.ok) throw new Error(text || `Supabase upload failed ${res.status}`);
  return { bucket, path, publicUrl: `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path}` };
}

exports.handler = async function(event){
  if(event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders };
  if(event.httpMethod === "GET") return json(200, { ok: true, name: "telegram-webhook", message: "Telegram webhook is ready. Send POST updates from Telegram." });
  if(event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  const gotSecret = event.headers["x-telegram-bot-api-secret-token"] || event.headers["X-Telegram-Bot-Api-Secret-Token"] || "";
  if(expectedSecret && gotSecret !== expectedSecret) return json(401, { ok: false, error: "Invalid Telegram secret" });

  let update;
  try { update = JSON.parse(event.body || "{}"); } catch(err) { return json(400, { ok: false, error: "Invalid JSON" }); }
  const message = update.message || update.channel_post || null;
  const chatId = message && message.chat && message.chat.id;
  const from = (message && message.from) || {};
  const uploader = {
    userId: from.id ? String(from.id) : "",
    username: String(from.username || "").replace(/^@+/, ""),
    firstName: from.first_name || "",
    lastName: from.last_name || "",
    displayName: [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || (from.id ? String(from.id) : "Telegram")
  };

  const allowedUsers = await readAllowedUsers().catch(() => []);
  if(message && !senderAllowed(message, allowedUsers)){
    const from = message.from || {};
    await appendTelegramLog({ ok: false, stage: "blocked_user", fileName: "blocked", error: `Blocked Telegram sender @${from.username || ""} ${from.id || ""}`, userId: uploader.userId, username: uploader.username, firstName: uploader.firstName, lastName: uploader.lastName, uploaderName: uploader.displayName }).catch(() => {});
    await reply(chatId, "غير مسموح لك بإرسال فيديوهات لهذا البوت. تواصل مع المسؤول لإضافتك.");
    return json(200, { ok: true, blocked: true });
  }

  const video = pickVideoMessage(message);

  if(!video){
    if(message && message.text && /^\/start/.test(message.text)) await reply(chatId, "أرسل فيديو MP4 هنا، وسأرفعه تلقائياً إلى Marrsile Growth Engine وأدخله مكتبة الجدولة.");
    return json(200, { ok: true, ignored: true, reason: "no_video" });
  }

  const maxMb = Number(process.env.TELEGRAM_MAX_VIDEO_MB || 200);
  if(video.size && video.size > maxMb * 1024 * 1024){
    await appendTelegramLog({ ok: false, stage: "size_limit", fileName: video.fileName, size: video.size, userId: uploader.userId, username: uploader.username, firstName: uploader.firstName, lastName: uploader.lastName, uploaderName: uploader.displayName });
    await reply(chatId, `حجم الفيديو كبير (${Math.round(video.size/1024/1024)}MB). الحد الحالي ${maxMb}MB.`);
    return json(200, { ok: false, error: "file_too_large" });
  }

  await reply(chatId, `استلمت الفيديو: ${video.fileName}\nجاري رفعه إلى الموقع...`);

  try{
    const fileInfo = await telegram("getFile", { file_id: video.fileId });
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
    const fileRes = await fetch(downloadUrl);
    if(!fileRes.ok) throw new Error(`Telegram download failed ${fileRes.status}`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const safeName = safeFileName(video.fileName);
    const uploaded = await uploadToSupabase(buffer, safeName, video.mime || "video/mp4");

    const state = await readState();
    const videos = Array.isArray(state.videos) ? state.videos : [];
    const newVideo = {
      id: randomId(),
      name: safeName,
      size: buffer.length,
      type: video.mime || "video/mp4",
      url: uploaded.publicUrl,
      publicUrl: uploaded.publicUrl,
      supabasePath: uploaded.path,
      uploadedToSupabase: true,
      source: "telegram",
      telegramFileId: video.fileId,
      telegramChatId: String(chatId || ""),
      telegramUserId: uploader.userId,
      telegramUsername: uploader.username,
      telegramFirstName: uploader.firstName,
      telegramLastName: uploader.lastName,
      telegramUploaderName: uploader.displayName,
      uploadedByName: uploader.displayName,
      hook: "فيديو جديد من تلجرام",
      caption: caption(),
      status: "Telegram Upload ✅",
      compatibility: "ok",
      compatibilityLabel: "Telegram + Supabase",
      repairStatus: "not_needed",
      postedTo: [],
      score: 50,
      topPerformer: false,
      createdAt: new Date().toISOString()
    };
    videos.push(newVideo);
    await writeState({ ...state, videos, savedAt: new Date().toISOString() });
    await appendTelegramLog({ ok: true, stage: "uploaded", fileName: safeName, size: buffer.length, publicUrl: uploaded.publicUrl, videoId: newVideo.id, userId: uploader.userId, username: uploader.username, firstName: uploader.firstName, lastName: uploader.lastName, uploaderName: uploader.displayName });
    await reply(chatId, `تم رفع الفيديو بنجاح ✅\nدخل مكتبة الفيديوهات وسيتم أخذه تلقائياً في الجدولة القادمة.`);
    return json(200, { ok: true, video: newVideo });
  }catch(err){
    await appendTelegramLog({ ok: false, stage: "error", fileName: video.fileName, error: err.message || String(err), userId: uploader.userId, username: uploader.username, firstName: uploader.firstName, lastName: uploader.lastName, uploaderName: uploader.displayName }).catch(() => {});
    await reply(chatId, `فشل رفع الفيديو ❌\n${err.message || String(err)}`);
    return json(200, { ok: false, error: err.message || String(err) });
  }
};

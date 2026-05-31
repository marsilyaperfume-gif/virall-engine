function json(statusCode, body){
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

function safeFileName(name){
  return String(name || "video.mp4").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120) || "video.mp4";
}

exports.handler = async function(event){
  if(event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if(event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
  const bucket = process.env.SUPABASE_BUCKET || "reels";

  if(!supabaseUrl || !serviceKey){
    return json(500, {
      ok: false,
      error: "Supabase server upload is not configured",
      message: "أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY داخل Netlify Environment Variables. لا تضع service role في الواجهة أبداً.",
      missing: {
        SUPABASE_URL: !supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: !serviceKey
      }
    });
  }

  let payload = {};
  try{
    payload = JSON.parse(event.body || "{}");
  }catch(err){
    return json(400, { ok: false, error: "Invalid JSON body", message: err.message });
  }

  const base64 = String(payload.base64 || "");
  const originalName = safeFileName(payload.filename || "video.mp4");
  const contentType = payload.contentType || "video/mp4";
  if(!base64){
    return json(400, { ok: false, error: "Missing file data", message: "لم يصل ملف الفيديو إلى السيرفر." });
  }

  let buffer;
  try{
    buffer = Buffer.from(base64, "base64");
  }catch(err){
    return json(400, { ok: false, error: "Invalid base64 file", message: err.message });
  }

  if(!buffer.length){
    return json(400, { ok: false, error: "Empty file", message: "ملف الفيديو فارغ." });
  }

  const ext = originalName.includes(".") ? originalName.split(".").pop() : "mp4";
  const path = `marrsile-reels/${new Date().toISOString().slice(0,10)}/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
  const endpoint = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${path}`;

  let uploadRes, text, data;
  try{
    uploadRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
        "Content-Type": contentType,
        "x-upsert": "true"
      },
      body: buffer
    });
    text = await uploadRes.text().catch(() => "");
    try{ data = text ? JSON.parse(text) : {}; }catch(e){ data = { raw: text }; }
  }catch(err){
    return json(502, { ok: false, error: "Supabase upload request failed", message: err.message, endpoint });
  }

  if(!uploadRes.ok){
    return json(uploadRes.status, {
      ok: false,
      error: "Supabase upload failed",
      message: data.message || data.error || data.raw || `HTTP ${uploadRes.status}`,
      status: uploadRes.status,
      endpoint,
      details: data
    });
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path}`;
  return json(200, {
    ok: true,
    bucket,
    path,
    publicUrl,
    size: buffer.length,
    contentType
  });
};

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
      error: "Supabase signed upload is not configured",
      message: "أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY داخل Netlify Environment Variables.",
      missing: { SUPABASE_URL: !supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: !serviceKey }
    });
  }

  let payload = {};
  try{ payload = JSON.parse(event.body || "{}"); }
  catch(err){ return json(400, { ok: false, error: "Invalid JSON body", message: err.message }); }

  const originalName = safeFileName(payload.filename || "video.mp4");
  const ext = originalName.includes(".") ? originalName.split(".").pop() : "mp4";
  const path = `marrsile-reels/${new Date().toISOString().slice(0,10)}/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;

  const signEndpoint = `${supabaseUrl}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`;

  let signRes, text, data;
  try{
    signRes = await fetch(signEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ upsert: true })
    });
    text = await signRes.text().catch(() => "");
    try{ data = text ? JSON.parse(text) : {}; }catch(e){ data = { raw: text }; }
  }catch(err){
    return json(502, { ok: false, error: "Create signed upload URL request failed", message: err.message });
  }

  if(!signRes.ok){
    return json(signRes.status, {
      ok: false,
      error: "Create signed upload URL failed",
      message: data.message || data.error || data.raw || `HTTP ${signRes.status}`,
      details: data
    });
  }

  let signedUrl = data.signedUrl || data.url || data.path || "";
  const token = data.token || "";
  if(signedUrl && signedUrl.startsWith("/")) signedUrl = supabaseUrl + "/storage/v1" + signedUrl;
  if(!signedUrl && token){
    signedUrl = `${supabaseUrl}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(token)}`;
  }

  if(!signedUrl && !token){
    return json(500, { ok:false, error:"Signed upload response missing url/token", details:data });
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`;
  return json(200, { ok:true, bucket, path, signedUrl, token, publicUrl, details:data });
};

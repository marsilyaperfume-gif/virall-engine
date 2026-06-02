const corsHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
function json(statusCode, body){ return { statusCode, headers: corsHeaders, body: JSON.stringify(body, null, 2) }; }
function blobStore(name){
  const { getStore } = require("@netlify/blobs");
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if(siteID && token) return getStore({ name, siteID, token });
  return getStore(name);
}
function normalizeUser(value){
  return String(value || "").trim().replace(/^@+/, "").toLowerCase();
}
async function readAllowed(){
  const store = blobStore("telegram_access");
  const data = (await store.get("allowed", { type: "json" })) || [];
  return Array.isArray(data) ? data.map(normalizeUser).filter(Boolean) : [];
}
async function writeAllowed(list){
  const clean = Array.from(new Set((Array.isArray(list) ? list : []).map(normalizeUser).filter(Boolean)));
  const store = blobStore("telegram_access");
  await store.setJSON("allowed", clean);
  return clean;
}
exports.handler = async function(event){
  if(event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders };
  try{
    if(event.httpMethod === "GET"){
      const allowed = await readAllowed();
      return json(200, { ok: true, allowed, mode: allowed.length ? "restricted" : "open" });
    }
    if(event.httpMethod === "POST"){
      const body = JSON.parse(event.body || "{}");
      const current = await readAllowed();
      let next = current;
      if(Array.isArray(body.allowed)) next = body.allowed;
      else if(body.user) next = [...current, body.user];
      else if(body.username) next = [...current, body.username];
      const allowed = await writeAllowed(next);
      return json(200, { ok: true, allowed, mode: allowed.length ? "restricted" : "open" });
    }
    if(event.httpMethod === "DELETE"){
      const body = JSON.parse(event.body || "{}");
      const remove = normalizeUser(body.user || body.username || "");
      const current = await readAllowed();
      const allowed = await writeAllowed(remove ? current.filter(u => u !== remove) : []);
      return json(200, { ok: true, allowed, mode: allowed.length ? "restricted" : "open" });
    }
    return json(405, { ok: false, error: "Method not allowed" });
  }catch(err){
    return json(500, { ok: false, error: err.message || String(err) });
  }
};

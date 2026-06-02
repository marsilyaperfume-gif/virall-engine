const corsHeaders = { "Content-Type":"application/json", "Cache-Control":"no-store", "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"GET,OPTIONS" };
function blobStore(name){ const { getStore } = require("@netlify/blobs"); const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID; const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN; if(siteID && token) return getStore({ name, siteID, token }); return getStore(name); }
exports.handler = async function(event){
  if(event.httpMethod === "OPTIONS") return { statusCode:204, headers:corsHeaders };
  try { const store = blobStore("telegram_uploads"); const uploads = (await store.get("uploads", { type:"json" })) || []; return { statusCode:200, headers:corsHeaders, body: JSON.stringify({ ok:true, uploads }) }; }
  catch(err){ return { statusCode:500, headers:corsHeaders, body: JSON.stringify({ ok:false, error:err.message || String(err) }) }; }
};

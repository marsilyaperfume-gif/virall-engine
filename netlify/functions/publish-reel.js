
const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json"
};

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(cookieHeader.split(";").map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf("=");
    return [v.slice(0, i), decodeURIComponent(v.slice(i + 1))];
  }));
}

function frontendUrl() {
  return process.env.FRONTEND_URL || "https://virall-gcc.netlify.app";
}

function callbackUrl() {
  return process.env.META_REDIRECT_URI || `${frontendUrl()}/.netlify/functions/instagram-callback`;
}

function blobStore(name) {
  const { getStore } = require("@netlify/blobs");
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) return getStore({ name, siteID, token });
  return getStore(name);
}

async function graphGet(path, params) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(params || {}).forEach(([k,v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function graphPost(path, params) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(params || {}).forEach(([k,v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  try {
    const body = JSON.parse(event.body || "{}");
    const { accountId, videoUrl, caption } = body;
    if (!accountId || !videoUrl || !caption) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "accountId, videoUrl and caption are required" }) };
    const store = blobStore("ig_accounts");
    const account = await store.get(accountId, { type: "json" });
    if (!account) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Instagram account not found" }) };

    const container = await graphPost(`${account.instagramId}/media`, {
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      access_token: account.pageAccessToken
    });
    const published = await graphPost(`${account.instagramId}/media_publish`, {
      creation_id: container.id,
      access_token: account.pageAccessToken
    });
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, published }) };
  } catch (err) {
    return { 
      statusCode: 500, 
      headers: corsHeaders, 
      body: JSON.stringify({ 
        error: err.message,
        hint: err.message && err.message.includes("instagram_content_publish") 
          ? "أعد ربط الحساب من الموقع بعد رفع هذه النسخة حتى يحصل التوكن الجديد على صلاحية instagram_content_publish." 
          : undefined
      }) 
    };
  }
};

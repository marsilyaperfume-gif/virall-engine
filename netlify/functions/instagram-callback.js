
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

  if (siteID && token) {
    return getStore({ name, siteID, token });
  }

  return getStore(name);
}

async function getJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function graphGet(path, params) {
  const url = new URL(`https://graph.instagram.com/v21.0/${path}`);
  Object.entries(params || {}).forEach(([k,v]) => url.searchParams.set(k, v));
  return getJson(url);
}

async function graphPost(path, params) {
  const url = new URL(`https://graph.instagram.com/v21.0/${path}`);
  Object.entries(params || {}).forEach(([k,v]) => url.searchParams.set(k, v));
  return getJson(url, { method: "POST" });
}

exports.handler = async function(event) {
  try {
    const { code, state } = event.queryStringParameters || {};
    const cookies = parseCookies(event.headers.cookie || "");
    if (!code || !state || cookies.ig_oauth_state !== state) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid OAuth state" }) };
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) throw new Error("Missing META_APP_ID or META_APP_SECRET");

    const form = new URLSearchParams();
    form.set("client_id", appId);
    form.set("client_secret", appSecret);
    form.set("grant_type", "authorization_code");
    form.set("redirect_uri", callbackUrl());
    form.set("code", code);

    const shortTokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form
    });

    const shortToken = await shortTokenRes.json();
    if (!shortTokenRes.ok) throw new Error(JSON.stringify(shortToken));

    const longUrl = new URL("https://graph.instagram.com/access_token");
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("access_token", shortToken.access_token);

    const longToken = await getJson(longUrl);

    const profile = await graphGet("me", {
      fields: "user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count",
      access_token: longToken.access_token
    });

    const instagramId = String(profile.user_id || profile.id || shortToken.user_id);
    const record = {
      id: instagramId,
      instagramId,
      username: profile.username || "",
      name: profile.name || profile.username || "Instagram Account",
      accountType: profile.account_type || "",
      profilePicture: profile.profile_picture_url || "",
      followersCount: profile.followers_count || 0,
      mediaCount: profile.media_count || 0,
      accessToken: longToken.access_token,
      tokenType: "instagram_login",
      expiresIn: longToken.expires_in || null,
      connectedAt: new Date().toISOString()
    };

    const store = blobStore("ig_accounts");
    await store.setJSON(instagramId, record);

    return {
      statusCode: 302,
      headers: {
        "Location": `${frontendUrl()}?connected=1`,
        "Set-Cookie": "ig_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
      },
      body: ""
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};

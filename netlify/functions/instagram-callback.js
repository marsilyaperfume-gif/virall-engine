
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
  return process.env.FRONTEND_URL || "https://virall-engine.netlify.app";
}

function callbackUrl() {
  return process.env.META_REDIRECT_URI || `${frontendUrl()}/.netlify/functions/instagram-callback`;
}

async function graphGet(path, params) {
  const url = new URL(`https://graph.facebook.com/v20.0/${path}`);
  Object.entries(params || {}).forEach(([k,v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function graphPost(path, params) {
  const url = new URL(`https://graph.facebook.com/v20.0/${path}`);
  Object.entries(params || {}).forEach(([k,v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

const { getStore } = require("@netlify/blobs");

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

    const shortToken = await graphGet("oauth/access_token", {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: callbackUrl(),
      code
    });

    const longToken = await graphGet("oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortToken.access_token
    });

    const pages = await graphGet("me/accounts", {
      access_token: longToken.access_token,
      fields: "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}"
    });

    const store = getStore("ig_accounts");
    let count = 0;

    for (const page of pages.data || []) {
      if (!page.instagram_business_account) continue;
      const ig = page.instagram_business_account;
      const record = {
        id: ig.id,
        instagramId: ig.id,
        username: ig.username,
        name: ig.name || ig.username,
        profilePicture: ig.profile_picture_url || "",
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        connectedAt: new Date().toISOString()
      };
      await store.setJSON(ig.id, record);
      count++;
    }

    return {
      statusCode: 302,
      headers: {
        "Location": `${frontendUrl()}?connected=${count}`,
        "Set-Cookie": "ig_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
      },
      body: ""
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};

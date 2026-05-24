
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
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders };

  const appId = process.env.META_APP_ID;
  if (!appId) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "Missing META_APP_ID" }) };
  }

  const state = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());

  // Instagram API with Instagram Login permissions.
  // Old permissions like instagram_basic/pages_show_list are invalid in this new flow.
  const scopes = [
    "instagram_business_basic",
    "instagram_business_content_publish"
  ].join(",");

  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", callbackUrl());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", state);
  url.searchParams.set("enable_fb_login", "0");
  url.searchParams.set("force_authentication", "1");

  return {
    statusCode: 302,
    headers: {
      "Location": url.toString(),
      "Set-Cookie": `ig_oauth_state=${encodeURIComponent(state)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    },
    body: ""
  };
};

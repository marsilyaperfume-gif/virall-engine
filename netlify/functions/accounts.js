
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

  try {
    const store = blobStore("ig_accounts");
    const listed = await store.list();
    const accounts = [];

    for (const blob of listed.blobs || []) {
      if (blob.key === "health-check") continue;
      const item = await store.get(blob.key, { type: "json" });
      if (item) {
        accounts.push({
          id: item.instagramId,
          instagramId: item.instagramId,
          username: item.username,
          name: item.name,
          accountType: item.accountType,
          profilePicture: item.profilePicture,
          followersCount: item.followersCount,
          mediaCount: item.mediaCount,
          connectedAt: item.connectedAt
        });
      }
    }

    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ accounts }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};

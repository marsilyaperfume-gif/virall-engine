const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

function blobStore(name) {
  const { getStore } = require("@netlify/blobs");
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) return getStore({ name, siteID, token });
  return getStore(name);
}

async function readState() {
  const store = blobStore("app_state");
  return (await store.get("state", { type: "json" })) || { settings: {}, videos: [], accounts: [], autopilot: false };
}

async function writeState(state) {
  const store = blobStore("app_state");
  await store.setJSON("state", state && typeof state === "object" ? state : {});
}

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders };
  try {
    if (event.httpMethod === "GET") {
      const state = await readState();
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, state }) };
    }
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const state = {
        settings: body.settings || {},
        videos: Array.isArray(body.videos) ? body.videos : [],
        accounts: Array.isArray(body.accounts) ? body.accounts : [],
        autopilot: !!body.autopilot,
        savedAt: body.savedAt || new Date().toISOString()
      };
      await writeState(state);
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, counts: { videos: state.videos.length, accounts: state.accounts.length }, savedAt: state.savedAt }) };
    }
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ ok: false, error: "Method not allowed" }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, error: err.message || String(err) }) };
  }
};


const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json"
};

function blobStore(name) {
  const { getStore } = require("@netlify/blobs");
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;

  if (siteID && token) {
    return getStore({ name, siteID, token });
  }

  return getStore(name);
}

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders };

  try {
    const store = blobStore("ig_accounts");
    await store.setJSON("health-check", {
      ok: true,
      checkedAt: new Date().toISOString()
    });
    const data = await store.get("health-check", { type: "json" });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        blobs: "working",
        manualConfig: Boolean((process.env.NETLIFY_SITE_ID || process.env.SITE_ID) && (process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN)),
        data
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: false,
        error: err.message,
        requiredEnvironmentVariables: [
          "NETLIFY_SITE_ID",
          "NETLIFY_AUTH_TOKEN"
        ]
      })
    };
  }
};


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

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders };

  try {
    const accountId = event.queryStringParameters && event.queryStringParameters.accountId;
    const store = blobStore("ig_accounts");

    let account = null;
    if (accountId) {
      account = await store.get(accountId, { type: "json" });
    } else {
      const listed = await store.list();
      for (const blob of listed.blobs || []) {
        if (blob.key === "health-check") continue;
        account = await store.get(blob.key, { type: "json" });
        if (account) break;
      }
    }

    if (!account) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "No stored Instagram account found" }) };
    }

    const appToken = `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`;
    const debug = await graphGet("debug_token", {
      input_token: account.pageAccessToken,
      access_token: appToken
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        instagramId: account.instagramId,
        username: account.username,
        pageName: account.pageName,
        tokenType: account.tokenType,
        scopes: debug.data && debug.data.scopes,
        isValid: debug.data && debug.data.is_valid,
        expiresAt: debug.data && debug.data.expires_at,
        hasPublishPermission: Boolean(debug.data && debug.data.scopes && debug.data.scopes.includes("instagram_content_publish")),
        note: "إذا hasPublishPermission=false احذف الحساب من الموقع ثم اربطه من جديد بعد نشر نسخة v19."
      }, null, 2)
    };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};

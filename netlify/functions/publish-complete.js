
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

async function graphPost(path, params) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const res = await fetch(url, { method: "POST" });
  const data = await res.json();

  if (!res.ok) {
    const err = new Error(JSON.stringify(data));
    err.data = data;
    throw err;
  }

  return data;
}

function mediaNotReady(msg) {
  return String(msg || "").includes("Media ID is not available") ||
         String(msg || "").includes("الوسائط غير جاهزة") ||
         String(msg || "").includes('"code":9007') ||
         String(msg || "").includes('"error_subcode":2207027');
}

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { accountId, creationId } = body;

    if (!accountId || !creationId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "accountId and creationId are required" }) };
    }

    const store = blobStore("ig_accounts");
    const account = await store.get(accountId, { type: "json" });

    if (!account) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "Instagram account not found. أعد ربط الحساب." }) };
    }

    const accessToken = account.pageAccessToken;
    const instagramId = account.instagramId || account.id;

    const published = await graphPost(`${instagramId}/media_publish`, {
      creation_id: creationId,
      access_token: accessToken
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, published })
    };

  } catch (err) {
    if (mediaNotReady(err.message)) {
      return {
        statusCode: 202,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: false,
          retry: true,
          message: "Instagram لا يزال يجهز الفيديو. سيتم إعادة المحاولة."
        })
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message })
    };
  }
};

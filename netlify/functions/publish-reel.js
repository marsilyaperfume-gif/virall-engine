
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    err.graphData = data;
    throw err;
  }

  return data;
}

function isMediaNotReadyError(err) {
  const msg = err && err.message ? err.message : "";
  return (
    msg.includes("Media ID is not available") ||
    msg.includes("الوسائط غير جاهزة") ||
    msg.includes('"code":9007') ||
    msg.includes('"error_subcode":2207027')
  );
}

async function publishWithRetry(instagramId, creationId, accessToken) {
  let lastError = null;

  // Instagram video containers often need time before media_publish.
  // We do not call container status endpoint because some accounts return GraphMethodException 100/33.
  await sleep(25000);

  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      return await graphPost(`${instagramId}/media_publish`, {
        creation_id: creationId,
        access_token: accessToken
      });
    } catch (err) {
      lastError = err;

      if (!isMediaNotReadyError(err)) {
        throw err;
      }

      await sleep(15000);
    }
  }

  throw new Error(JSON.stringify({
    error: "Instagram video is still not ready after retries",
    message: "الفيديو لم يجهز داخل Instagram بعد عدة محاولات. جرّب فيديو أقصر أو انتظر دقيقة ثم أعد النشر.",
    lastError: lastError ? lastError.message : null
  }));
}

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { accountId, videoUrl, caption } = body;

    if (!accountId || !videoUrl) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "accountId and videoUrl are required" })
      };
    }

    const store = blobStore("ig_accounts");
    const account = await store.get(accountId, { type: "json" });

    if (!account) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Instagram account not found. أعد ربط الحساب من الموقع." })
      };
    }

    const accessToken = account.pageAccessToken;
    const instagramId = account.instagramId || account.id;

    if (!accessToken || !instagramId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Stored account is missing token or Instagram ID. أعد ربط الحساب." })
      };
    }

    const container = await graphPost(`${instagramId}/media`, {
      media_type: "REELS",
      video_url: videoUrl,
      caption: caption || "",
      access_token: accessToken
    });

    if (!container.id) {
      throw new Error(JSON.stringify({ error: "No creation container ID returned", container }));
    }

    const published = await publishWithRetry(instagramId, container.id, accessToken);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        containerId: container.id,
        published
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: err.message,
        note: "v24 uses retry publishing without reading container status to avoid Authorization Error 100/33."
      })
    };
  }
};

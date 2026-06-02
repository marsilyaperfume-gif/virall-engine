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

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function graphPost(path, params) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  const res = await fetch(url, { method: "POST" });
  const data = await res.json().catch(() => ({}));
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
    msg.includes('"error_subcode":2207027') ||
    msg.toLowerCase().includes("processing") ||
    msg.toLowerCase().includes("not ready")
  );
}

async function publishWithRetry(instagramId, creationId, accessToken, opts = {}) {
  let lastError = null;
  const initialDelayMs = Number(opts.initialDelayMs ?? 25000);
  const attempts = Number(opts.attempts ?? 12);
  const retryDelayMs = Number(opts.retryDelayMs ?? 15000);

  if (initialDelayMs > 0) await sleep(initialDelayMs);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await graphPost(`${instagramId}/media_publish`, { creation_id: creationId, access_token: accessToken });
    } catch (err) {
      lastError = err;
      if (!isMediaNotReadyError(err)) throw err;
      if (attempt < attempts) await sleep(retryDelayMs);
    }
  }

  throw new Error(JSON.stringify({
    error: "Instagram video is still not ready after retries",
    message: "الفيديو لم يجهز داخل Instagram بعد عدة محاولات.",
    lastError: lastError ? lastError.message : null
  }));
}

async function publishDirect({ accountId, videoUrl, caption }, opts = {}) {
  if (!accountId || !videoUrl) throw new Error("accountId and videoUrl are required");
  if (String(videoUrl).startsWith("blob:")) throw new Error("Video URL is local blob, not public.");

  const store = blobStore("ig_accounts");
  const account = await store.get(accountId, { type: "json" });
  if (!account) throw new Error("Instagram account not found. أعد ربط الحساب من الموقع.");

  const accessToken = account.pageAccessToken;
  const instagramId = account.instagramId || account.id;
  if (!accessToken || !instagramId) throw new Error("Stored account is missing token or Instagram ID. أعد ربط الحساب.");

  const container = await graphPost(`${instagramId}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption: caption || "",
    access_token: accessToken
  });

  if (!container.id) throw new Error(JSON.stringify({ error: "No creation container ID returned", container }));

  const published = await publishWithRetry(instagramId, container.id, accessToken, opts);
  return { ok: true, containerId: container.id, published };
}

exports.publishDirect = publishDirect;

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const result = await publishDirect(body, { initialDelayMs: 25000, attempts: 12, retryDelayMs: 15000 });
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};

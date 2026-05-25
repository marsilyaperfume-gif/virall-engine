
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
    throw new Error(JSON.stringify(data));
  }

  return data;
}

async function graphGet(path, params) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

async function waitForMediaContainer(creationId, accessToken) {
  let lastStatus = null;

  for (let attempt = 1; attempt <= 60; attempt++) {
    const status = await graphGet(creationId, {
      fields: "status_code,status",
      access_token: accessToken
    });

    lastStatus = status;

    if (status.status_code === "FINISHED") {
      return status;
    }

    if (status.status_code === "ERROR") {
      throw new Error(JSON.stringify({
        error: "Instagram media processing failed",
        status
      }));
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  throw new Error(JSON.stringify({
    error: "Media processing timeout",
    message: "Instagram لم يجهز الفيديو خلال المهلة. جرّب فيديو أقصر أو انتظر وأعد المحاولة.",
    lastStatus
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

    // Step 1: create Reel media container
    const container = await graphPost(`${instagramId}/media`, {
      media_type: "REELS",
      video_url: videoUrl,
      caption: caption || "",
      access_token: accessToken
    });

    if (!container.id) {
      throw new Error(JSON.stringify({ error: "No creation container ID returned", container }));
    }

    // Step 2: wait until Instagram finishes video processing
    const finalStatus = await waitForMediaContainer(container.id, accessToken);

    // Step 3: publish only after FINISHED
    const published = await graphPost(`${instagramId}/media_publish`, {
      creation_id: container.id,
      access_token: accessToken
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        containerId: container.id,
        finalStatus,
        published
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: err.message,
        note: "إذا ظهر Media ID is not available فهذا يعني أن Instagram لم يجهز الفيديو بعد، وهذه النسخة تنتظر تلقائياً قبل النشر."
      })
    };
  }
};

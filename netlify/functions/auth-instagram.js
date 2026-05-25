
const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json"
};

function frontendUrl() {
  return process.env.FRONTEND_URL || "https://virall-gcc.netlify.app";
}

function callbackUrl() {
  return process.env.META_REDIRECT_URI || `${frontendUrl()}/.netlify/functions/instagram-callback`;
}

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders };
  }

  const appId = process.env.META_APP_ID;
  if (!appId) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Missing META_APP_ID" })
    };
  }

  const state = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());

  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
    "business_management"
  ].join(",");

  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", callbackUrl());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("response_type", "code");

  return {
    statusCode: 302,
    headers: {
      "Location": url.toString(),
      "Set-Cookie": `ig_oauth_state=${encodeURIComponent(state)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    },
    body: ""
  };
};

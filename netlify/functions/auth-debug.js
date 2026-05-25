
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
  const appId = process.env.META_APP_ID || "";
  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
    "business_management"
  ];

  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", callbackUrl());
  url.searchParams.set("state", "debug");
  url.searchParams.set("scope", scopes.join(","));
  url.searchParams.set("response_type", "code");

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      ok: true,
      flow: "Facebook Login + Instagram Graph API",
      appId,
      redirectUriUsed: callbackUrl(),
      scopes,
      oauthUrl: url.toString()
    }, null, 2)
  };
};

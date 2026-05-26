
const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json"
};

exports.handler = async function() {
  const scopes = [
    "instagram_basic",
    "pages_show_list",
    "pages_read_engagement",
    "business_management"
  ];

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      ok: true,
      message: "OAuth scopes are clean. Publish permission is not requested in login dialog.",
      appId: process.env.META_APP_ID || null,
      redirectUri: process.env.META_REDIRECT_URI || null,
      scopes,
      excludedPublishScopes: [
        "instagram publish permission",
        "instagram business publish permission"
      ]
    }, null, 2)
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json"
};

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    const body = JSON.parse(event.body || "{}");
    const adminEmail = process.env.ADMIN_EMAIL || "info@marrsile.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "Mo774853";

    if (String(body.email || "").trim() === adminEmail && String(body.password || "") === adminPassword) {
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ ok: false, error: "بيانات الدخول غير صحيحة" }) };
  } catch (err) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: "طلب غير صالح" }) };
  }
};

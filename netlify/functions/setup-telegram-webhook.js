const headers = { "Content-Type":"application/json", "Cache-Control":"no-store", "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"GET,POST,OPTIONS" };
function json(statusCode, body){ return { statusCode, headers, body: JSON.stringify(body, null, 2) }; }
exports.handler = async function(event){
  if(event.httpMethod === "OPTIONS") return { statusCode:204, headers };
  try{
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if(!token) return json(500, { ok:false, error:"TELEGRAM_BOT_TOKEN is missing" });
    const siteUrl = (process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.FRONTEND_URL || "https://virall-gcc.netlify.app").replace(/\/$/, "");
    const webhookUrl = `${siteUrl}/.netlify/functions/telegram-webhook`;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ url: webhookUrl, allowed_updates:["message","channel_post"], drop_pending_updates:false, secret_token: secret }) });
    const data = await res.json().catch(() => ({}));
    return json(res.ok && data.ok !== false ? 200 : 500, { ok: !!data.ok, webhookUrl, telegram: data });
  }catch(err){ return json(500, { ok:false, error:err.message || String(err) }); }
};

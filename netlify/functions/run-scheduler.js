const corsHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };

exports.handler = async function() {
  try {
    const scheduler = require("./scheduled-publisher.js");
    const coreRun = scheduler._coreRun;
    if (!coreRun) throw new Error("Scheduler core is not available");
    const out = await coreRun("manual");
    return { statusCode: out.ok ? 200 : 500, headers: corsHeaders, body: JSON.stringify(out, null, 2) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, error: err.message }, null, 2) };
  }
};

const { _coreRun } = require("./scheduled-publisher.js");
exports.handler = async function() {
  const out = await _coreRun("manual-button-same-as-cron", { maxItems: 1 });
  return {
    statusCode: out.ok ? 200 : 500,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(out, null, 2)
  };
};

const { schedule } = require("@netlify/functions");
const scheduler = require("./scheduled-publisher.js");

async function cronHandler() {
  const out = await scheduler._coreRun("netlify-schedule-helper", { maxItems: 2 });
  return {
    statusCode: out.ok ? 200 : 500,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(out, null, 2)
  };
}

exports.handler = schedule("*/1 * * * *", cronHandler);

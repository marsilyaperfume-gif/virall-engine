// Disabled in v44: scheduled-publisher is already scheduled from netlify.toml.
// Keeping a second scheduled function caused duplicate/competing autopublish runs.
exports.handler = async function() {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ ok: true, disabled: true, reason: "Use scheduled-publisher only" })
  };
};

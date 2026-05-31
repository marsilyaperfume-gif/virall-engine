exports.handler = async function () {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
  const supabaseBucket = process.env.SUPABASE_BUCKET || "reels";
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify({
      ok: Boolean(supabaseUrl && supabaseAnonKey),
      supabaseUrl,
      supabaseAnonKey,
      supabaseBucket,
      serverUploadReady: hasServiceRole,
      missing: {
        SUPABASE_URL: !supabaseUrl,
        SUPABASE_ANON_KEY: !supabaseAnonKey,
        SUPABASE_SERVICE_ROLE_KEY: !hasServiceRole
      }
    })
  };
};

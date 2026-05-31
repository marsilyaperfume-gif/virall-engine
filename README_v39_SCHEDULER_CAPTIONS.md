# v39 Scheduler + Viral Gulf Captions

Changes:
- Native queue delete button inside the queue UI.
- Clear all queue button.
- Refresh queue status button.
- Netlify Scheduled Function schedule declared in both netlify.toml and function config.
- Queue API supports GET, POST, DELETE, PATCH.
- Captions now include the hook as the first line and rotate between story, question, direct-response, girls-focused, and short-hook formats.
- Captions vary by Gulf market and include soft CTA + hashtags/footer.
- Manual publish failures now update queue status and write to the Errors section.

Required Netlify env vars:
- SUPABASE_URL
- SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_BUCKET=reels
- META_APP_ID
- META_APP_SECRET
- FRONTEND_URL

V51 Rolling Autopilot Plus

What changed:
- Kept the working Instagram publish flow unchanged.
- Added server app-state sync so Netlify Scheduled Function can keep the rolling queue alive.
- Queue now stays small: 3 days ahead only, instead of huge 30-day queues.
- Target remains: 3 videos per day per account.
- Queue API now preserves statuses like waiting_publish/publishing/publish_check instead of resetting them to scheduled.
- Queue API deduplicates by account + video + day to prevent 450+ duplicate queues.
- After a successful publish from browser, the video is marked successful and rolling queue is topped up.
- Netlify scheduled-publisher now refills the queue from saved app state when active queue gets low.

Important:
- Do not remove netlify/functions/state.js.
- Keep Netlify environment variables for Supabase and Instagram as they were.
- Publishing logic was not changed; only queue/state reliability was improved.

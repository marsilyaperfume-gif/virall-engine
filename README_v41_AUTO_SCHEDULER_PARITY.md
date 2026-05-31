# v41 Auto Scheduler Parity Fix

Fixes automatic scheduled publishing by making the Netlify cron scheduler use the same Instagram publishing flow as the manual "نشر الآن" button:

- Explicit Netlify cron in `netlify.toml`.
- Scheduler creates Instagram Reel container once and saves `creationId`.
- Scheduler waits before `media_publish`, like the manual publish function.
- If Instagram is still processing, item becomes `processing` with `nextAttemptAt`, then cron retries automatically.
- Stuck `publishing` items recover after 10 minutes.
- Scheduler logs show due/processed/results.

After deploy use **Clear cache and deploy site**.

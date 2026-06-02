# v42 Cron-Safe Scheduler Fix

This version fixes auto scheduling by making scheduled publishing safe for Netlify cron execution.

Key changes:
- Adds a dedicated `cron-scheduler` function using Netlify's `schedule()` helper.
- Keeps the old `scheduled-publisher` cron in `netlify.toml` as a second fallback.
- Removes long sleeps from cron publishing.
- Cron now creates the Instagram container first, marks the job as `processing`, then publishes it on the next cron runs when Instagram is ready.
- Processes only a small number of due items per run to avoid serverless timeout.
- Logs every cron run into `scheduler_logs` so the dashboard can prove whether Netlify actually triggered the scheduler.

After deploying:
1. Netlify → Deploys → Clear cache and deploy site.
2. Open `/.netlify/functions/scheduler-status` and check logs.
3. Use the dashboard button: فحص محرك 24/7.
4. Schedule a video 2-3 minutes ahead.

Expected statuses:
- scheduled
- publishing
- processing
- published

If Netlify cron still does not show logs, use an external ping service to call:
`https://YOUR-SITE.netlify.app/.netlify/functions/run-scheduler`
Every 1-5 minutes.

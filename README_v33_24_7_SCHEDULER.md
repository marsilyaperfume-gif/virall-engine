# Virall Engine v33 — 24/7 Scheduler Upgrade

## What changed
- Added persistent server queue using Netlify Blobs: `/.netlify/functions/queue`.
- Added Netlify Scheduled Function: `/.netlify/functions/scheduled-publisher`.
- The scheduled function runs every 5 minutes via `netlify.toml`.
- Queue items now store `accountId`, `videoUrl`, `scheduledAt`, attempts, and publish status.
- Added lock protection to reduce duplicate automatic publishes.
- Auto publishing no longer needs the browser tab to remain open.
- Manual queue publish no longer keeps the lock if the user cancels.
- Browser-side queue changes sync to the server queue automatically.

## Important requirements
1. Videos must be uploaded to a public URL, preferably Cloudinary. Local `blob:` videos cannot be published by Instagram when the browser is closed.
2. Netlify environment variables should be set:
   - `META_APP_ID`
   - `META_APP_SECRET`
   - `META_REDIRECT_URI`
   - `FRONTEND_URL`
   - `NETLIFY_SITE_ID` or `SITE_ID`
   - `NETLIFY_AUTH_TOKEN` or `NETLIFY_BLOBS_TOKEN`
3. Deploy to Netlify. Scheduled functions do not run from a static local file.

## How it works
1. You upload videos and create the Autopilot queue.
2. The browser sends the queue to Netlify Blobs.
3. Netlify calls `scheduled-publisher` every 5 minutes.
4. The function finds due items, creates an Instagram Reels media container, waits until a later scheduled run, then publishes it.
5. Failed items retry automatically up to 3 times.

## Testing
After deploy, open:
- `/.netlify/functions/queue` to confirm the queue is saved.
- Netlify > Functions > scheduled-publisher logs to confirm automatic runs.

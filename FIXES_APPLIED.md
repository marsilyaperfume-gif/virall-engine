# Marrsile Auto Reels v20 Daily Scheduler - Fixes Applied

## Main fixes
- Fixed Autopilot queue logic: uploaded videos are distributed as daily slots instead of all videos on the same day.
- Default logic is now: 3 videos per day per officially connected Instagram account.
- Added `scheduledAt` ISO timestamps to queue items.
- Added a browser-side scheduler loop that checks due queue items every minute while the dashboard is open.
- Removed duplicate publish button handler that could trigger publish twice.
- Fixed time inputs so saved posting times display correctly.
- Queue items now include `videoId` and `accountId` to avoid matching the wrong video/account by name.
- Manual hook/caption edits now persist.
- Version labels updated to v20 Daily Scheduler.
- Frontend login no longer stores email/password directly inside `script.js`; login is handled by Netlify Function `auth-login`.

## Instagram/Meta fixes
- OAuth scope now includes `instagram_content_publish`.
- Publish function now waits for Instagram media container status to become `FINISHED` before calling `media_publish`.
- Error message for missing publish permission is clearer.

## Important notes
- Fully automatic publishing only runs while the web dashboard is open because the queue is stored in browser localStorage.
- For true 24/7 background publishing, the queue must be moved to a server database/Netlify Blobs and a scheduled Netlify Function must run it.
- Real Instagram publishing still requires official Meta App setup, approved permissions, connected Instagram Business/Creator account, and a public video URL such as Cloudinary/S3.


## v20.1 Login Fetch Fix
- Added a local-preview fallback so opening `index.html` directly does not fail with `Failed to fetch`.
- Kept Netlify Function authentication for deployed Netlify sites.
- Improved the error message to explain when Netlify Functions are unavailable.

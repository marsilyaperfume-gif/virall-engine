# Marrsile Auto Reels v10.5 Clean Fixed

Login:
info@marrsile.com
Mo774853

Fixed:
- Video upload rebuilt cleanly.
- Hook generation button works.
- Upload button and drag/drop work.
- JS syntax checked.
- 100+ Gulf sales hooks.
- Dynamic captions that change every time.
- One-time Control Center settings.
- Autopilot Queue.

Notes:
This is still a frontend prototype. Real publishing requires:
- Backend OAuth with Meta
- Cloudinary/S3 for public video URLs
- Instagram Graph API publish endpoint


v10.7 Exact Hooks:
- Replaced hook bank with the exact 50 approved hooks only.
- Removed hook modifications, extra emojis, and suffixes.
- Hook factory displays the exact 50 hooks.
- JS syntax checked.


v10.8:
- Removed @marrsile.perfumes overlay بالكامل من المعاينة والفيديوهات.


v10.9:
- Added video preview controls in Control Center: play/pause, -5s, +5s, mute/unmute, seek bar.
- Added random publishing delay between accounts.
- Queue now applies randomized account delay to publishing times.


v11 Video Repair:
- Added video compatibility scan during upload.
- Added Video Repair panel.
- Added backend endpoint /api/video/repair using FFmpeg.
- Converts incompatible videos to MP4 H.264 + AAC.
- Keeps same resolution.
- Uses CRF 16 high quality and AAC 320k; no intentional downscaling.
- Requires deployed backend for actual repair.


v11.1 Codec Detection Fix:
- Browser playback test now detects audio-only/video-not-visible cases.
- Videos with sound but no image are marked as needs repair.
- Added Force Repair All Videos button.
- Repair button can now process all uploaded videos, not only flagged ones.


v12 Internal FFmpeg Repair:
- Added browser-only video repair using FFmpeg WebAssembly.
- No backend/server required.
- Converts video to MP4 H.264 + AAC.
- Keeps original resolution; no intentional downscaling.
- Uses CRF 16 high quality.
- Requires internet first time to load FFmpeg libraries from CDN.
- Processing speed depends on user's computer and video size.


v12.1 FFmpeg Load Fix:
- Fixed FFmpeg WebAssembly loading flow.
- Uses explicit coreURL/wasmURL/workerURL.
- Waits for load promise before exec.
- Better error message if CDN is not loaded.


Glass Style Fix:
- Updated only the modern glass hook style to look truly translucent/glassy.
- No other functionality changed.


v12.2 Delete Video:
- Added delete button for uploaded videos.
- Removing a video also removes its queued posts.
- No other functionality changed.


v12.3 Edit/Delete Accounts:
- Added edit and delete buttons for Instagram demo accounts.
- Deleting an account also removes its queued posts.
- No other functionality changed.


v13 Netlify Functions Integration:
- Added Netlify Functions for Instagram OAuth.
- No Render required.
- Functions:
  /.netlify/functions/auth-instagram
  /.netlify/functions/instagram-callback
  /.netlify/functions/accounts
  /.netlify/functions/publish-reel
- Stores connected Instagram accounts using Netlify Blobs.
- Add these Netlify Environment Variables:
  FRONTEND_URL=https://virall-engine.netlify.app
  META_APP_ID=your_meta_app_id
  META_APP_SECRET=your_meta_app_secret
  META_REDIRECT_URI=https://virall-engine.netlify.app/.netlify/functions/instagram-callback


v13.1 Netlify Blobs Manual Config:
- Fixed Netlify Blobs configuration by supporting manual siteID/token.
- Functions now use NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN when available.
- Added /.netlify/functions/blobs-health diagnostic endpoint.
- Required Netlify Environment Variables:
  FRONTEND_URL=https://virall-gcc.netlify.app
  NETLIFY_SITE_ID=your_site_id
  NETLIFY_AUTH_TOKEN=your_personal_access_token
  META_APP_ID=later
  META_APP_SECRET=later
  META_REDIRECT_URI=https://virall-gcc.netlify.app/.netlify/functions/instagram-callback


v13.3 Facebook Login Correct Flow:
- Restored Facebook Login + Instagram Graph API flow.
- Added auth-debug endpoint to show exact redirect_uri.


v13.6 Meta OAuth Compliant:
- Updated OAuth scopes according to Meta behavior.
- OAuth login now requests connection/account discovery scopes only:
  instagram_basic
  pages_show_list
  pages_read_engagement
  business_management
- Removed instagram_content_publish and instagram_business_content_publish from the login dialog.
- Kept publish-reel function in place for the next publishing phase.
- Added clearer auth-debug output.


v13.7 OAuth Scope Cleanup:
- OAuth login requests only account discovery scopes.
- Auth scopes:
  instagram_basic
  pages_show_list
  pages_read_engagement
  business_management
- Added /.netlify/functions/scope-check.
- Improved Invalid OAuth state message.
- After deploying, do not reuse old Meta error pages or old OAuth links. Start from the website button only.


v13.8 Publish Now + Luxury Glass:
- Added Publish Now button to Autopilot Queue items.
- Publish Now calls publish-reel when the video has a public Storage URL.
- Shows clear message when video is local blob and Storage is not configured yet.
- Refreshed UI with luxury transparent glassmorphism style.
- No OAuth or account connection changes.

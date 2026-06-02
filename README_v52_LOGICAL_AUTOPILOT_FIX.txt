v52 Logical Autopilot Fix

What changed:
- Browser no longer publishes queue items directly; it only nudges backend scheduler.
- Backend scheduler is now the single source of truth to prevent duplicate posts.
- Queue dedupe now prevents same account + same video + same day duplicates regardless of status.
- Smart scheduler now posts 3 distinct videos per account per day.
- Each account uses all stored videos once before recycling.
- Recycling uses successful/top-performing videos only.
- When backend publishes successfully, it marks the video as successful in app_state so recycling can work automatically.
- Old duplicate browser auto-publisher was disabled.

Not changed:
- Meta/Instagram connection.
- publish-reel flow.
- account tokens.
- Supabase upload flow.

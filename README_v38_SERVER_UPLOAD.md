# v38 Clean Server Upload Fix

هذه النسخة تلغي الرفع المباشر من المتصفح إلى Supabase لأن Supabase RLS كان يمنع العملية.

الجديد:
- رفع الفيديو يمر عبر Netlify Function: `/.netlify/functions/upload-video`
- الرفع يستخدم `SUPABASE_SERVICE_ROLE_KEY` داخل Netlify فقط، ولا يظهر في الواجهة.
- لم يعد الرفع يعتمد على anon policy، وبالتالي يتجاوز خطأ: `new row violates row-level security policy`.
- قسم الأخطاء سيعرض أي نقص في Service Role أو مشكلة رفع بشكل واضح.

## Environment Variables المطلوبة في Netlify

SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=sb_publishable_xxx
SUPABASE_BUCKET=reels
SUPABASE_SERVICE_ROLE_KEY=ضع service_role secret key هنا

مهم: لا تضع Service Role داخل الواجهة أو GitHub. فقط داخل Netlify Environment Variables مع Secret enabled.

بعد الإضافة:
Netlify → Deploys → Clear cache and deploy site

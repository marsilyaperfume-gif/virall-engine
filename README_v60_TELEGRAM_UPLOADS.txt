MARRSILE Growth Engine v60 - Telegram Uploads

ما الجديد:
- إضافة Telegram Uploads بدون تغيير ربط Instagram أو محرك النشر.
- Function: telegram-webhook تستقبل الفيديوهات من بوت تلجرام.
- Function: setup-telegram-webhook تربط البوت بالموقع من داخل الواجهة.
- Function: telegram-uploads تعرض آخر الفيديوهات المستلمة.
- الفيديو المرسل لتلجرام يُرفع إلى Supabase ثم يدخل مكتبة الفيديوهات تلقائيًا.
- Autopilot سيستخدم الفيديو ضمن الجدولة القادمة حسب نظام 3 فيديو يوميًا لكل حساب.

المطلوب في Netlify Environment Variables:
- TELEGRAM_BOT_TOKEN = توكن البوت
- TELEGRAM_BOT_USERNAME = Reels_Virall_Bot اختياري
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_BUCKET = reels

طريقة التشغيل:
1. ارفع النسخة إلى Netlify.
2. افتح الموقع.
3. ادخل قسم Telegram Uploads.
4. اضغط ربط Webhook مرة واحدة.
5. أرسل فيديو للبوت.
6. بعد رسالة النجاح، سيظهر الفيديو في قسم الفيديوهات ويدخل الجدولة تلقائيًا.

ملاحظة أمان:
يفضل لاحقًا تغيير TELEGRAM_BOT_TOKEN بعد التأكد من العمل، لأنه سبق إرساله كنص.

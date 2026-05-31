# v34 Supabase Storage + 24/7 Scheduler

هذه النسخة تجعل الفيديوهات صالحة للنشر التلقائي على Instagram Graph API لأن كل فيديو يتم رفعه إلى Supabase Storage ويحصل على رابط HTTPS عام مباشر.

## ما الذي تغير؟
- إضافة إعدادات Supabase Storage داخل تبويب الربط.
- رفع الفيديو إلى Bucket عام بدلاً من `blob:` المحلي.
- حفظ `publicUrl` مع الفيديو والـ Queue.
- Scheduled Function تستخدم `videoUrl` العام نفسه عند إنشاء Reel container في Meta.
- بقي Cloudinary كخيار احتياطي فقط إذا لم تُدخل بيانات Supabase.

## المطلوب في Supabase
1. أنشئ Project في Supabase.
2. افتح Storage وأنشئ Bucket باسم `reels`.
3. اجعل Bucket Public.
4. انسخ Project URL و anon public key.
5. ضع القيم في الموقع: Settings / Storage.

## مهم جداً
Instagram يحتاج `video_url` عام HTTPS يمكن الوصول إليه من خوادم Meta. لذلك لا تستخدم روابط `blob:` أو ملفات محلية. بعد رفع الفيديو يجب أن تظهر شارة: `Supabase مرفوع ✅`.

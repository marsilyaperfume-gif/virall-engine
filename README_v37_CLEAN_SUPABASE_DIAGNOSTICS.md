# v37 Clean Supabase Diagnostics

هذه نسخة نظيفة بدون إدخال يدوي لـ Supabase داخل الواجهة.

## المطلوب في Netlify Environment Variables
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_BUCKET = reels

## المطلوب في Supabase
- Storage bucket باسم reels
- Public bucket
- Policy INSERT للـ anon على bucket_id = 'reels'
- Policy SELECT للـ anon على bucket_id = 'reels'

## الجديد
- public-config function لقراءة الإعدادات من Netlify
- رفع Supabase فقط بدون Cloudinary fallback
- قسم الأخطاء داخل الواجهة
- زر فحص الربط
- حذف واجهة إدخال مفاتيح Supabase اليدوية

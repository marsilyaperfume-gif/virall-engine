# v43 Same Button Auto Publish

هذه النسخة تعالج مشكلة النشر التلقائي بدون مسارات نشر متعددة.

## أهم تغيير
- زر نشر الآن والجدولة يستخدمان نفس دالة النشر `/publish-reel`.
- عند وصول وقت الجدولة، النظام يتصرف كأنه ضغط زر "نشر الآن" على نفس العنصر.
- تم حذف منطق الـ processing المختلف الذي كان يسبب اختلاف بين اليدوي والتلقائي.

## ما الذي تغير
1. `publish-reel.js`
   - صار يحتوي `publishDirect` مشترك.
   - الزر اليدوي والـ Scheduler يستخدمان نفس المنطق.

2. `scheduled-publisher.js`
   - يقرأ Queue.
   - إذا وصل وقت العنصر، يستدعي `publishDirect` بنفس بيانات زر نشر الآن.
   - يحدّث الحالة إلى `published` أو `failed`.

3. `script.js`
   - Auto scheduler داخل المتصفح أيضًا يستدعي `publishNowFromQueue(..., silent:true, auto:true)`.
   - يعني إذا الموقع مفتوح: يعمل كأنه ضغط زر نشر الآن.
   - وإذا الموقع مغلق: Netlify Cron يحاول نفس مسار النشر.

4. `netlify.toml`
   - تفعيل scheduled-publisher كل دقيقة.

## بعد الرفع
Netlify → Deploys → Clear cache and deploy site
ثم افتح الموقع واضغط Ctrl+Shift+R.

## اختبار سريع
- جدولة فيديو بعد 3 دقائق.
- اترك الموقع مفتوحًا أول اختبار.
- إذا نشر، جرّب بعدها والموقع مغلق للتأكد من Cron.

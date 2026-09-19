# Mono Chrome — دفتر الشركة

تطبيق حسابات للشركة: منتجات، مبيعات، مشتريات، تحصيلات، مصاريف، وصافي الصندوق بالجنيه المصري.

- المدير يضيف ويعدّل ويحذف
- المشاهد يرى نفس الأرقام ولا يعدّل
- أي حركة تظهر عند باقي أعضاء الشركة خلال ثوانٍ
- البيع يخصم من المخزون تلقائياً

## التشغيل

```bash
npm install
npm run dev
```

يفتح على المنفذ `8080`. بعد أول تسجيل دخول: أنشئ شركة كمدير، ثم ادعُ الفريق من شاشة **الفريق** بكود الدعوة.

للنشر تحتاج قاعدة Postgres في `DATABASE_URL`. جداول الحسابات في `migrations/`.

## تحويله إلى APK (أندرويد)

التطبيق ويب + قاعدة بيانات. ملف الـ APK يكون غلاف يفتح نفس التطبيق على الموبايل، والبيانات تفضل مشتركة بين الموظفين.

### الطريقة الأسهل — PWABuilder

1. انشر التطبيق على رابط HTTPS ثابت.
2. افتح [PWABuilder](https://www.pwabuilder.com) والصق الرابط.
3. اختَر Android ونزّل الـ APK أو حزمة المتجر.

### Capacitor (مشروع أندرويد في Android Studio)

بعد ما يبقى فيه رابط منشور:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Mono Chrome" com.monochrome.ledger --web-dir dist
npx cap add android
```

في `capacitor.config.ts` خلّي التطبيق يفتح الرابط المنشور:

```ts
server: {
  url: "https://YOUR-APP-URL",
  cleartext: false,
}
```

ثم:

```bash
npx cap sync android
npx cap open android
```

من Android Studio: **Build → Build APK**.

> الحسابات والمخزون والصلاحيات تشتغل على السيرفر. الـ APK واجهة للموبايل، مش نسخة منفصلة من البيانات.

## الصلاحيات

| الدور   | إضافة / تعديل / حذف | مشاهدة |
|---------|----------------------|--------|
| مدير    | نعم                  | نعم    |
| مشاهد   | لا                   | نعم    |

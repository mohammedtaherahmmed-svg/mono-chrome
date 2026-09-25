# Mono Chrome — دفتر الشركة

منتجات، مبيعات، مشتريات، تحصيلات، مصاريف، وصافي الصندوق بالجنيه المصري.

البيانات المشتركة بين الموظفين على **Supabase** (من غير رابط نشر Grok).

## إعداد السيرفر مرة واحدة

1. اعمل حساب مجاني على [supabase.com](https://supabase.com) → **New project**
2. Authentication → Providers → Email → أوقف **Confirm email**
3. SQL Editor → الصق محتوى `supabase/schema.sql` → **Run**
4. Settings → API → انسخ **Project URL** و **anon public** وابعتهما في الشات

بعد الربط نبني APK يفتح الدفتر مباشرة. المدير ينشئ الشركة، والموظف يدخل بكود الدعوة. أي منتج أو مبيعة تظهر عند الكل.

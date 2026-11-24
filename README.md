# تطبيق بن فيصل لتحليل البيانات الذكي — النسختان المنفصلتان (Offline & Online)

مشروع متكامل لتحليل ملفات CSV / JSON، إنشاء الرسوم البيانية التفاعلية الستة، التحليل الإحصائي، حفظ التقارير، وإصدار **سند الطباعة الرسمي** في المتصفح.

---

## 1) النسختان المنفصلتان

### أ) النسخة المحلية بدون إنترنت — `Dataset Analyzer Offline`
- **نقطة دخول الويب:** `/offline.html` (`src/offline/OfflineApp.tsx`)
- **نقطة دخول بايثون:** `python3 offline_app.py` (المنفذ `8765`)
- **قاعدة البيانات:** `IndexedDB` في المتصفح + `SQLite` محلية (`data/dataset_analyzer_offline.db`)
- **الحزمة المبنية المستقلة:** `build/offline/`
- **الاستقلالية:** خالية تماماً من Firebase أو Google Fonts أو أي اتصال خارجي بالإنترنت.

### ب) النسخة السحابية بالإنترنت — `Dataset Analyzer Online`
- **نقطة دخول الويب:** `/` (`index.html` → `src/App.tsx` → `src/components/OnlineAuthGate.tsx`)
- **نقطة دخول بايثون:** `python3 online_app.py` (المنفذ `8766`)
- **شاشة البداية:** تبدأ بصفحة تسجيل الدخول (`OnlineAuthGate`) وتشمل:
  - تسجيل الدخول بالبريد الإلكتروني وكلمة المرور
  - إنشاء حساب جديد
  - هل نسيت كلمة المرور؟
  - تسجيل الدخول عبر **Google** و **Facebook** و **Apple**
- **قاعدة البيانات:** Firebase Authentication + Firestore (عبر `firebase-applet-config.json` بدون أي مفاتيح سرية داخل الكود)
- **الحزمة المبنية المستقلة:** `build/online/`

---

## 2) سند الطباعة الرسمي (Browser Print Voucher)
- زر **🖨️ طباعة السند الآن** يطبع السند عبر `iframe` معزول بتنسيق A4 وترويسة الشركة ورقم السند والتوقيعات.
- زر **🌐 فتح السند في المتصفح** يفتح السند الكامل في تبويب متصفح مستقل مع أمر الطباعة المباشر.
- مسار بايثون `/print-voucher` يولّد السند مباشرة في المتصفح في كلتا النسختين (`http://127.0.0.1:8765/print-voucher` و `http://127.0.0.1:8766/print-voucher`).

---

## 3) البناء والتشغيل والاختبار

### بناء تطبيق الويب (Online + Offline + PWA):
```bash
npm run build
```

### تجميع الحزمتين المنفصلتين (`build/offline` و `build/online`):
```bash
python3 build_editions.py
```

### تشغيل الاختبارات الآلية في Python:
```bash
python3 tests/test_app.py
```

### تجهيز ملف تنفيذي `.exe` على جهاز ويندوز/سطح مكتب (اختياري):
```bash
pip install -r requirements.txt
python build_editions.py --pyinstaller
```

### تفعيل مزودي Facebook و Apple في Firebase Console (لنسخة Online):
- مزود البريد الإلكتروني و Google جاهزان في الكود (`src/firebase.ts`).
- لتفعيل أزرار **Facebook** و **Apple** في بيئة الإنتاج، يجب تفعيلهما في `Firebase Console → Authentication → Sign-in method` وإضافة App ID / Service ID والنطاق المصرّح به.

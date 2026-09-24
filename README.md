# Aeta FinTech Platform

پلتفرم فول‌استک مدیریت دارایی، معامله داخلی و سرمایه‌گذاری با رابط فارسی و طراحی responsive.

> **وضعیت فعلی: DEMO** — ارائه‌دهنده بازار، پرداخت و صرافی متصل نیست. رابط کاربری هیچ قیمت، سود یا موجودی ساختگی را به‌عنوان داده واقعی نمایش نمی‌دهد و عملیات مالی غیرفعال با `NOT_CONFIGURED` مشخص شده است.

## اجرا

```bash
cp .env.example .env
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:4000/api/health

## ساختار

- `frontend/` — React + TypeScript + Vite، رابط RTL، نمودارها و responsive
- `backend/` — Express + TypeScript، اعتبارسنجی Zod، JWT cookie، rate-limit و API
- `database/migrations/` — schema کامل PostgreSQL با NUMERIC دقیق و ledger دوبل
- `docs/` — مستندات API، معماری و استقرار
- `tests/` — تست‌های API

## دستورات

```bash
npm run dev       # اجرای هم‌زمان API و رابط
npm run build     # production build
npm test          # API tests
```

## اصول مالی و امنیتی

- مقادیر پولی در دیتابیس `NUMERIC(38,18)` و در منطق برنامه به‌صورت string/Decimal نگهداری می‌شوند؛ Float ممنوع است.
- هر تغییر موجودی باید داخل transaction سریال‌پذیر و همراه ledger entries متوازن ثبت شود.
- مدارک KYC باید در object storage خصوصی و فقط کلید فایل در دیتابیس ذخیره شود.
- secrets فقط در backend و environment نگهداری می‌شوند.
- در production باید PostgreSQL، secrets قوی، TLS، object storage خصوصی، providerهای واقعی و worker queue پیکربندی شود.

جزئیات در [راهنمای معماری](docs/ARCHITECTURE.md)، [API](docs/API.md) و [استقرار](docs/DEPLOYMENT.md).
## Android app

The repository now contains a Capacitor Android application in `frontend/android`.

```bash
npm run android:sync   # build Vite frontend and copy assets into Android
npm run android:open   # open native project in Android Studio
npm run android:build  # requires local JDK + Android SDK
```

For mobile/fullstack deployments set `VITE_API_URL` to the HTTPS backend URL. Do not use frontend secrets; all custody, database, AI and blockchain credentials remain backend-only.

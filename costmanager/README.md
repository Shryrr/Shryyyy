# منوبان — MenuBan CostManager

مدیریت هزینه، موجودی و فودکاست برای کافه و رستوران — کاملاً آفلاین و بدون بک‌اند.

یک Progressive Web App که به‌طور کامل در مرورگر و روی دستگاه کاربر اجرا می‌شود: انبار مواد اولیه، دستور پخت و فودکاست، هزینه‌ها و حقوق، فروش، حسابداری و سود و زیان، و لیست خرید. هیچ داده‌ای به سروری ارسال نمی‌شود؛ همه‌چیز در IndexedDB مرورگر ذخیره می‌شود.

## ویژگی‌ها

- ۱۰۰٪ آفلاین پس از اولین بار بارگذاری (Service Worker + پیش‌ذخیره‌سازی Workbox)
- قابل نصب روی iOS/Android/دسکتاپ به‌صورت PWA
- بدون نیاز به ورود/حساب کاربری/سرور — همه داده‌ها فقط روی همان دستگاه
- محاسبه خودکار میانگین وزنی قیمت مواد اولیه پس از هر خرید
- کسر خودکار موجودی مواد اولیه پس از هر فروش، بر اساس دستور پخت
- تولید خودکار لیست خرید بر اساس کسری موجودی
- نمودارها با Chart.js، حالت تیره/روشن، چیدمان واکنش‌گرا (موبایل تا دسکتاپ)
- خروجی/ورودی پشتیبان‌گیری کامل به‌صورت JSON
- رابط کاربری کاملاً فارسی (راست‌به‌چپ) با اعداد فارسی

## پیش‌نیازها

- Node.js نسخه ۱۸ یا بالاتر

## نصب و اجرا

```bash
npm install
npm run build     # یک‌بار build کامل: dist/app.js + sw.js
npm run preview    # اجرای سرور استاتیک روی http://localhost:3000
```

برای توسعه با rebuild خودکار هنگام تغییر فایل‌ها:

```bash
npm run dev
```

این دستور یک‌بار build کامل انجام می‌دهد (تا Service Worker بتواند `dist/app.js` را پیش‌ذخیره کند)، سپس esbuild را در حالت `--watch` و با یک سرور استاتیک (`--servedir=.`) روی پورت پیش‌فرض esbuild اجرا می‌کند.

> توجه: اپ باید از طریق HTTP سرو شود (نه باز کردن مستقیم `index.html` با `file://`)، چون Service Worker و IndexedDB به یک origin معتبر نیاز دارند.

## اسکریپت‌ها

| دستور | کاربرد |
|---|---|
| `npm run build` | build نهایی و minify شده (`dist/app.js`, `sw.js`) |
| `npm run dev` | build + اجرای esbuild watch با سرور استاتیک |
| `npm run build:sw` | فقط بازسازی `sw.js` (بعد از build اصلی) |
| `npm run preview` | اجرای یک سرور استاتیک ساده روی پورت ۳۰۰۰ |

## پشته فنی

- TypeScript خام (بدون فریم‌ورک) + esbuild برای bundle
- IndexedDB از طریق [`idb`](https://github.com/jakearchibald/idb)
- یک reactive store سبک و دست‌ساز (بدون Redux/Zustand)
- روتینگ مبتنی بر hash، بدون کتابخانه روتر
- [Chart.js](https://www.chartjs.org/) برای نمودارها
- Service Worker با Workbox (`workbox-core`/`precaching`/`routing`/`strategies`)، با manifest پیش‌ذخیره دست‌ساز در `scripts/build-sw.js`
- فونت [Vazirmatn](https://github.com/rastikerdar/vazirmatn) به‌صورت self-hosted (بدون CDN)

## ساختار پروژه

```
src/
  main.ts            نقطه ورود، بوت‌استرپ اپ، ثبت Service Worker
  db.ts               اسکیمای IndexedDB و عملیات CRUD
  store.ts            reactive store
  router.ts           روتر مبتنی بر hash
  sw.ts               منبع Service Worker (با esbuild bundle می‌شود)
  seed.ts             داده‌های نمونه برای اولین اجرا
  types.ts            تایپ‌های مشترک
  utils/              فرمت‌دهی فارسی، محاسبات کسب‌وکار، export/import
  components/         اجزای قابل‌استفاده‌مجدد (modal، toast، نمودار، ...)
  views/              صفحات اصلی اپ (داشبورد، انبار، منو، هزینه‌ها، فروش، ...)
scripts/
  copy-fonts.js       کپی فونت‌های Vazirmatn از node_modules
  gen-icons.js        رندر آیکون‌های PWA با Playwright/Chromium
  build-sw.js         bundle کردن sw.ts و تولید precache manifest
```

## ذخیره‌سازی و حریم خصوصی

تمام داده‌ها (مواد اولیه، دستور پخت، فروش، هزینه‌ها، تنظیمات) در یک پایگاه‌داده IndexedDB با نام `costmanager_db` روی همان مرورگر/دستگاه ذخیره می‌شوند. هیچ درخواست شبکه‌ای برای ذخیره یا همگام‌سازی داده ارسال نمی‌شود. برای پشتیبان‌گیری یا انتقال داده بین دستگاه‌ها از بخش «تنظیمات ← پشتیبان‌گیری و بازگردانی» برای خروجی/ورودی فایل JSON استفاده کنید.

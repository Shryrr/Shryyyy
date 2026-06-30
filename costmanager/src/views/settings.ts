import * as db from '../db';
import { daysUntilBusinessExpiry, isBusinessExpired, isBusinessExpiringSoon } from '../auth';
import { confirmModal, openModal } from '../components/modal';
import { showToast } from '../components/toast';
import { el, field, iconTextBtn, numberInput, parseNumberInput, selectEl } from '../utils/dom';
import { svgIcon } from '../utils/icons';
import type { IconName } from '../utils/icons';
import { downloadJSON, readFileAsJSON } from '../utils/export';
import { formatBusinessType, formatDate, formatDateTime, formatMoney, toPersian } from '../utils/format';
import { api } from '../utils/api';
import type { RouteCleanup } from '../router';
import { isOnline, refreshAll, refreshSettings, settings } from '../store';
import { seedDatabase } from '../seed';
import type { BusinessType, FullBackup, PaidSubscriptionPlan, Settings, SubscriptionPaymentRecord, SubscriptionPlan, Theme } from '../types';

const BUSINESS_TYPE_OPTIONS: BusinessType[] = ['cafe', 'restaurant', 'fast_food', 'bakery', 'other'];
const THEME_OPTIONS: { value: Theme; label: string; icon: IconName }[] = [
  { value: 'light', label: 'روشن', icon: 'sun' },
  { value: 'dark', label: 'تاریک', icon: 'moon' },
  { value: 'auto', label: 'خودکار (سیستم)', icon: 'monitor' },
];

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let appInstalled = false;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e as BeforeInstallPromptEvent;
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  appInstalled = true;
});

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${toPersian((bytes / (1024 * 1024 * 1024)).toFixed(2))} گیگابایت`;
  if (bytes >= 1024 * 1024) return `${toPersian((bytes / (1024 * 1024)).toFixed(1))} مگابایت`;
  if (bytes >= 1024) return `${toPersian((bytes / 1024).toFixed(1))} کیلوبایت`;
  return `${toPersian(bytes)} بایت`;
}

function settingsCard(title: string, body: HTMLElement): HTMLElement {
  return el('div', { class: 'settings-card' }, [el('h3', { class: 'settings-card__title' }, [title]), body]);
}

// ---------- Business profile ----------

function renderProfileSection(container: HTMLElement): () => void {
  const s = settings.get();
  const nameInput = el('input', { type: 'text', class: 'input', value: s?.businessName ?? '' });
  const typeSelect = selectEl(
    BUSINESS_TYPE_OPTIONS.map((t) => ({ value: t, label: formatBusinessType(t) })),
    s?.businessType ?? 'cafe',
  );
  const targetInput = numberInput(s?.targetFoodCostPercent ?? 30);

  const form = el('form', { class: 'form' }, [
    field('نام کسب‌وکار', nameInput),
    field('نوع کسب‌وکار', typeSelect),
    field('هدف فودکاست (٪)', targetInput),
    el('div', { class: 'modal-actions' }, [el('button', { type: 'submit', class: 'btn btn-primary' }, ['ذخیره تغییرات'])]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const businessName = nameInput.value.trim();
    if (!businessName) {
      showToast('نام کسب‌وکار الزامی است', 'error');
      return;
    }
    await db.updateSettings({
      businessName,
      businessType: typeSelect.value as BusinessType,
      targetFoodCostPercent: parseNumberInput(targetInput) || 30,
    });
    await refreshSettings();
    showToast('تغییرات ذخیره شد', 'success');
  });

  container.appendChild(settingsCard('پروفایل کسب‌وکار', form));
  return () => {};
}

// ---------- Theme ----------

function renderThemeSection(container: HTMLElement): () => void {
  const wrap = el('div', { class: 'theme-picker' });

  function render(): void {
    wrap.innerHTML = '';
    const current = settings.get()?.theme ?? 'auto';
    for (const opt of THEME_OPTIONS) {
      const iconEl = el('span', { class: 'theme-picker__icon' }, []);
      iconEl.appendChild(svgIcon(opt.icon, 16));
      wrap.appendChild(
        el(
          'button',
          {
            type: 'button',
            class: `theme-picker__btn${opt.value === current ? ' theme-picker__btn--active' : ''}`,
            onclick: async () => {
              await db.updateSettings({ theme: opt.value });
              await refreshSettings();
            },
          },
          [iconEl, opt.label],
        ),
      );
    }
  }

  container.appendChild(settingsCard('پوسته', wrap));
  const unsub = settings.subscribe(render);
  return () => unsub();
}

// ---------- Notifications ----------

function renderNotificationsSection(container: HTMLElement): () => void {
  const enabledCheckbox = el('input', { type: 'checkbox', checked: settings.get()?.notificationsEnabled !== false });

  const body = el('div', { class: 'form' }, [
    el('label', { class: 'toolbar__checkbox' }, [enabledCheckbox, ' اعلان کسری موجودی (در مرورگر و داخل اپ) فعال باشد']),
  ]);

  enabledCheckbox.addEventListener('change', async () => {
    await db.updateSettings({ notificationsEnabled: enabledCheckbox.checked });
    await refreshSettings();
    showToast('تنظیمات اعلان‌ها ذخیره شد', 'success');
  });

  container.appendChild(settingsCard('اعلان‌ها', body));
  return () => {};
}

// ---------- Subscription ----------

const PLAN_OPTIONS: { value: PaidSubscriptionPlan; label: string }[] = [
  { value: '1m', label: '۱ ماهه' },
  { value: '3m', label: '۳ ماهه' },
  { value: '6m', label: '۶ ماهه' },
  { value: '12m', label: '۱۲ ماهه' },
];
const PLAN_TOTAL_DAYS: Record<PaidSubscriptionPlan, number> = { '1m': 30, '3m': 90, '6m': 180, '12m': 365 };

function planLabel(plan: SubscriptionPlan): string {
  if (plan === 'unlimited') return 'نامحدود';
  return PLAN_OPTIONS.find((p) => p.value === plan)?.label ?? plan;
}

function subscriptionStatusLabel(status: Settings['subscriptionStatus']): string {
  if (status === 'trial') return 'دوره آزمایشی';
  if (status === 'pending_payment') return 'در انتظار پرداخت';
  if (status === 'expired') return 'منقضی‌شده';
  return 'فعال';
}

function paymentStatusLabel(status: SubscriptionPaymentRecord['status']): string {
  if (status === 'pending') return 'در انتظار بررسی';
  if (status === 'approved') return 'تایید شد';
  return 'رد شد';
}

function toCacheRecord(p: {
  id: string;
  plan: PaidSubscriptionPlan;
  amount: number;
  transfer_ref: string | null;
  description: string | null;
  status: SubscriptionPaymentRecord['status'];
  submitted_at: string;
  reviewed_at: string | null;
  note: string | null;
}): SubscriptionPaymentRecord {
  return {
    id: p.id,
    plan: p.plan,
    amount: p.amount,
    transferRef: p.transfer_ref ?? undefined,
    description: p.description ?? undefined,
    status: p.status,
    submittedAt: p.submitted_at,
    reviewedAt: p.reviewed_at ?? undefined,
    note: p.note ?? undefined,
  };
}

async function openSubmitPaymentModal(onDone: () => void): Promise<void> {
  let pricing: Record<PaidSubscriptionPlan, number>;
  try {
    const rows = await api.getSubscriptionPricing();
    pricing = { '1m': 0, '3m': 0, '6m': 0, '12m': 0 };
    for (const row of rows) pricing[row.plan] = row.amount;
  } catch {
    showToast('خطا در دریافت قیمت اشتراک', 'error');
    return;
  }

  const planSelect = selectEl(
    PLAN_OPTIONS.map((p) => ({ value: p.value, label: `${p.label} — ${formatMoney(pricing[p.value])}` })),
    '1m',
  );
  const amountInput = el('input', { type: 'text', class: 'input', value: formatMoney(pricing['1m']), disabled: true });
  const transferRefInput = el('input', { type: 'text', class: 'input', dir: 'ltr', placeholder: 'شماره پیگیری تراکنش' });
  const descInput = el('input', { type: 'text', class: 'input' });

  planSelect.addEventListener('change', () => {
    (amountInput as HTMLInputElement).value = formatMoney(pricing[planSelect.value as PaidSubscriptionPlan] ?? 0);
  });

  const body = el('form', { class: 'form' }, [
    el('p', { class: 'form-hint' }, ['پس از واریز مبلغ، اطلاعات تراکنش را ثبت کنید تا مدیر پلتفرم اشتراک شما را تایید و تمدید کند.']),
    field('پلن', planSelect),
    field('مبلغ (تومان)', amountInput),
    field('شماره پیگیری تراکنش (اختیاری)', transferRefInput),
    field('توضیحات (اختیاری)', descInput),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['ثبت پرداخت']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const plan = planSelect.value as PaidSubscriptionPlan;
    const amount = pricing[plan] ?? 0;
    if (amount <= 0) {
      showToast('قیمت این پلن هنوز توسط مدیر پلتفرم تنظیم نشده است', 'error');
      return;
    }
    try {
      const payment = await api.submitSubscriptionPayment({
        plan,
        amount,
        transferRef: transferRefInput.value.trim() || undefined,
        description: descInput.value.trim() || undefined,
      });
      await db.upsertSubscriptionPaymentCache(toCacheRecord(payment));
      showToast('درخواست پرداخت ثبت شد. پس از تایید مدیر پلتفرم، اشتراک شما تمدید می‌شود.', 'success');
      modal.close();
      onDone();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطا در ثبت پرداخت', 'error');
    }
  });

  const modal = openModal({ title: 'ثبت پرداخت اشتراک', body });
}

function renderSubscriptionSection(container: HTMLElement): () => void {
  const cardHost = el('div', { class: 'settings-card' });
  container.appendChild(cardHost);

  async function render(): Promise<void> {
    cardHost.innerHTML = '';
    const s = settings.get();
    if (!s) return;

    cardHost.appendChild(el('h3', { class: 'settings-card__title' }, ['اشتراک کسب‌وکار']));

    const expired = isBusinessExpired(s);
    const soon = !expired && isBusinessExpiringSoon(s);
    const days = daysUntilBusinessExpiry(s);
    const isUnlimited = s.subscriptionPlan === 'unlimited';

    cardHost.append(
      el('div', { class: 'subscription-status-row' }, [
        el('span', {}, [`${subscriptionStatusLabel(s.subscriptionStatus)} · ${planLabel(s.subscriptionPlan)}`]),
        el('span', {}, [isUnlimited ? 'بدون انقضا' : `انقضا: ${formatDate(s.subscriptionExpiry)}`]),
      ]),
    );

    if (!isUnlimited) {
      const totalDays = PLAN_TOTAL_DAYS[s.subscriptionPlan as PaidSubscriptionPlan] ?? db.TRIAL_DAYS;
      const remainingRatio = Math.max(0, Math.min(1, days / totalDays));
      const fillTone = expired ? 'danger' : soon ? 'warning' : '';
      cardHost.append(
        el('div', { class: 'subscription-progress' }, [
          el('div', {
            class: `subscription-progress__fill${fillTone ? ` subscription-progress__fill--${fillTone}` : ''}`,
            style: `width: ${remainingRatio * 100}%`,
          }),
        ]),
      );

      if (expired) {
        const iconEl = el('span', { class: 'alert-banner__icon' }, []);
        iconEl.appendChild(svgIcon('alert-circle', 18));
        cardHost.appendChild(
          el('div', { class: 'alert-banner alert-banner--danger' }, [
            iconEl,
            el('span', { class: 'alert-banner__text' }, ['اشتراک کسب‌وکار منقضی شده است. برای ادامه کار، اشتراک را تمدید کنید.']),
          ]),
        );
      } else if (soon) {
        const iconEl = el('span', { class: 'alert-banner__icon' }, []);
        iconEl.appendChild(svgIcon('alert-triangle', 18));
        cardHost.appendChild(
          el('div', { class: `alert-banner alert-banner--${days <= 3 ? 'danger' : 'warning'}` }, [
            iconEl,
            el('span', { class: 'alert-banner__text' }, [`اشتراک کسب‌وکار تا ${toPersian(days)} روز دیگر منقضی می‌شود.`]),
          ]),
        );
      }
    }

    let pendingPayment: SubscriptionPaymentRecord | null = null;
    if (isOnline.get()) {
      try {
        const status = await api.getSubscriptionStatus();
        if (status.pendingPayment) pendingPayment = toCacheRecord(status.pendingPayment);
        if (pendingPayment) await db.upsertSubscriptionPaymentCache(pendingPayment);
      } catch {
        // offline/unreachable — fall back to local cache below
      }
    }
    if (!pendingPayment) {
      const cached = await db.listSubscriptionPaymentsCache();
      pendingPayment =
        cached.filter((p) => p.status === 'pending').sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0] ??
        null;
    }

    if (pendingPayment) {
      const iconEl = el('span', { class: 'alert-banner__icon' }, []);
      iconEl.appendChild(svgIcon('clock', 18));
      cardHost.appendChild(
        el('div', { class: 'alert-banner alert-banner--info' }, [
          iconEl,
          el('span', { class: 'alert-banner__text' }, [
            `پرداخت ${formatMoney(pendingPayment.amount)} تومانی (${planLabel(pendingPayment.plan)}) ${paymentStatusLabel(pendingPayment.status)} — ثبت‌شده در ${formatDate(pendingPayment.submittedAt)}`,
          ]),
        ]),
      );
    } else {
      cardHost.appendChild(
        el(
          'button',
          {
            type: 'button',
            class: 'btn btn-primary',
            disabled: !isOnline.get(),
            onclick: () => openSubmitPaymentModal(() => render()),
          },
          ['ثبت پرداخت و تمدید اشتراک'],
        ),
      );
      if (!isOnline.get()) {
        cardHost.appendChild(el('p', { class: 'form-hint' }, ['برای ثبت پرداخت به اتصال اینترنت نیاز است.']));
      }
    }
  }

  void render();
  const unsubSettings = settings.subscribe(() => void render());
  const unsubOnline = isOnline.subscribe(() => void render());
  return () => {
    unsubSettings();
    unsubOnline();
  };
}

// ---------- PWA install ----------

function renderInstallSection(container: HTMLElement): () => void {
  const body = el('div');

  function render(): void {
    body.innerHTML = '';
    const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
    if (appInstalled || isStandalone) {
      body.appendChild(el('p', { class: 'form-hint' }, ['این اپلیکیشن روی دستگاه شما نصب شده است. ✅']));
    } else if (deferredInstallPrompt) {
      body.appendChild(
        iconTextBtn('smartphone', 'نصب منوبان روی دستگاه', 'btn btn-primary', async () => {
          if (!deferredInstallPrompt) return;
          await deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice;
          deferredInstallPrompt = null;
          render();
        }),
      );
    } else {
      body.appendChild(
        el('p', { class: 'form-hint' }, ['برای نصب، از منوی مرورگر گزینهٔ «Add to Home Screen» یا «نصب اپلیکیشن» را انتخاب کنید.']),
      );
    }
  }

  render();
  container.appendChild(settingsCard('نصب اپلیکیشن', body));
  return () => {};
}

// ---------- Storage estimate ----------

function renderStorageSection(container: HTMLElement): () => void {
  const body = el('p', { class: 'form-hint' }, ['در حال بررسی فضای ذخیره‌سازی...']);
  container.appendChild(settingsCard('فضای ذخیره‌سازی', body));

  navigator.storage
    ?.estimate?.()
    .then((estimate) => {
      const usage = estimate.usage ?? 0;
      const quota = estimate.quota ?? 0;
      const pct = quota > 0 ? (usage / quota) * 100 : 0;
      body.textContent = `${formatBytes(usage)} از ${formatBytes(quota)} استفاده شده (${toPersian(pct.toFixed(1))}٪)`;
    })
    .catch(() => {
      body.textContent = 'امکان بررسی فضای ذخیره‌سازی در این مرورگر وجود ندارد.';
    });

  return () => {};
}

// ---------- Data export / import / reset ----------

function openImportModeModal(backup: FullBackup): void {
  const modeSelect = selectEl(
    [
      { value: 'merge', label: 'ادغام با داده‌های فعلی' },
      { value: 'replace', label: 'جایگزینی کامل (حذف داده‌های فعلی)' },
    ],
    'merge',
  );
  const body = el('div', { class: 'form' }, [
    el('p', { class: 'form-hint' }, [`فایل پشتیبان مربوط به: ${formatDateTime(backup.exportedAt)}`]),
    field('روش بازگردانی', modeSelect),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-primary',
          onclick: async () => {
            await db.importAllData(backup, modeSelect.value as 'merge' | 'replace');
            await refreshAll();
            showToast('داده‌ها با موفقیت بازگردانی شد', 'success');
            modal.close();
          },
        },
        ['بازگردانی'],
      ),
    ]),
  ]);
  const modal = openModal({ title: 'بازگردانی داده‌ها', body });
}

function renderDataSection(container: HTMLElement): () => void {
  const fileInput = el('input', { type: 'file', accept: 'application/json', style: 'display:none' });

  async function handleExport(): Promise<void> {
    const backup = await db.exportAllData();
    downloadJSON(`menuban-backup-${new Date().toISOString().slice(0, 10)}.json`, backup);
    await db.updateSettings({ lastBackup: new Date().toISOString() });
    await refreshSettings();
    showToast('فایل پشتیبان دانلود شد', 'success');
  }

  fileInput.addEventListener('change', async () => {
    const fileToImport = fileInput.files?.[0];
    if (!fileToImport) return;
    try {
      const backup = await readFileAsJSON<FullBackup>(fileToImport);
      openImportModeModal(backup);
    } catch {
      showToast('فایل پشتیبان نامعتبر است', 'error');
    } finally {
      fileInput.value = '';
    }
  });

  async function handleReset(): Promise<void> {
    const confirmed = await confirmModal({
      title: 'بازنشانی کامل داده‌ها',
      message: 'تمام مواد اولیه، دستور پخت‌ها، فروش، هزینه‌ها و سایر داده‌ها برای همیشه حذف می‌شود. این عملیات قابل بازگشت نیست.',
      confirmLabel: 'حذف همه چیز',
      danger: true,
    });
    if (!confirmed) return;
    await db.resetAllData();
    await refreshAll();
    showToast('تمام داده‌ها بازنشانی شد', 'success');
  }

  container.appendChild(
    settingsCard(
      'پشتیبان‌گیری و بازگردانی',
      el('div', { class: 'settings-actions' }, [
        iconTextBtn('download', 'خروجی پشتیبان (JSON)', 'btn btn-secondary', handleExport),
        iconTextBtn('upload', 'بازگردانی از فایل', 'btn btn-secondary', () => fileInput.click()),
        iconTextBtn('trash', 'بازنشانی کامل', 'btn btn-danger', handleReset),
        fileInput,
      ]),
    ),
  );

  return () => {};
}

// ---------- Sample data ----------

function renderSampleDataSection(container: HTMLElement): () => void {
  async function handleLoadSampleData(): Promise<void> {
    const confirmed = await confirmModal({
      title: 'بارگذاری داده‌های نمونه',
      message: 'مواد اولیه، دستور پخت، فروش، هزینه و کارمند نمونه به داده‌های فعلی شما اضافه می‌شود. این کار را فقط برای آشنایی با امکانات برنامه انجام دهید.',
      confirmLabel: 'بارگذاری',
    });
    if (!confirmed) return;
    await seedDatabase();
    await refreshAll();
    showToast('داده‌های نمونه بارگذاری شد', 'success');
  }

  container.appendChild(
    settingsCard(
      'داده‌های نمونه',
      el('div', { class: 'settings-actions' }, [
        el('p', { class: 'form-hint' }, ['برای آشنایی با امکانات برنامه می‌توانید داده‌های نمونه (مواد اولیه، منو، فروش و...) بارگذاری کنید.']),
        el('button', { type: 'button', class: 'btn btn-secondary', onclick: handleLoadSampleData }, ['بارگذاری داده‌های نمونه']),
      ]),
    ),
  );

  return () => {};
}

// ---------- View shell ----------

export async function renderSettings(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-settings' });
  container.appendChild(root);

  root.append(el('div', { class: 'view-header' }, [el('h1', { class: 'view-header__title' }, ['تنظیمات'])]));

  const grid = el('div', { class: 'settings-grid' });
  root.append(grid);

  const cleanups = [
    renderProfileSection(grid),
    renderSubscriptionSection(grid),
    renderThemeSection(grid),
    renderNotificationsSection(grid),
    renderInstallSection(grid),
    renderStorageSection(grid),
    renderDataSection(grid),
    renderSampleDataSection(grid),
  ];

  return () => {
    for (const c of cleanups) c();
  };
}

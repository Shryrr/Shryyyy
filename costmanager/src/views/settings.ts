import * as db from '../db';
import { confirmModal, openModal } from '../components/modal';
import { showToast } from '../components/toast';
import { el, field, iconTextBtn, numberInput, parseNumberInput, selectEl } from '../utils/dom';
import { svgIcon } from '../utils/icons';
import type { IconName } from '../utils/icons';
import { downloadJSON, readFileAsJSON } from '../utils/export';
import { formatBusinessType, formatDateTime, toPersian } from '../utils/format';
import type { RouteCleanup } from '../router';
import { refreshAll, refreshSettings, settings } from '../store';
import { seedDatabase } from '../seed';
import type { BusinessType, FullBackup, Theme } from '../types';

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

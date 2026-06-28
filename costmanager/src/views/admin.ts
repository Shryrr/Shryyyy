import * as db from '../db';
import { daysUntilBusinessExpiry, isBusinessExpired, isBusinessExpiringSoon } from '../auth';
import { confirmModal, openModal } from '../components/modal';
import { showToast } from '../components/toast';
import { el, emptyState, field, selectEl } from '../utils/dom';
import { downloadJSON, readFileAsJSON } from '../utils/export';
import { formatBusinessType, formatDate, formatDateTime, formatMoney, toPersian } from '../utils/format';
import { generateSyncCode, importFromSyncCode, pullFromServer, pushToServer, testSyncConnection } from '../utils/sync';
import { getPlatformPaymentCard, getPlatformPricing } from '../platform-owner';
import type { RouteCleanup } from '../router';
import { refreshAll, refreshSettings, settings } from '../store';
import type { AppUser, BusinessType, FullBackup, PaidSubscriptionPlan, Settings, SubscriptionPlan, UserRole } from '../types';

type Tab = 'users' | 'subscriptions' | 'system';

const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'مدیر اصلی',
  manager: 'مدیر',
  warehouse: 'انباردار',
  buyer: 'خریدار',
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'manager', label: ROLE_LABELS.manager },
  { value: 'warehouse', label: ROLE_LABELS.warehouse },
  { value: 'buyer', label: ROLE_LABELS.buyer },
];

const PLAN_OPTIONS: { value: PaidSubscriptionPlan; label: string }[] = [
  { value: '1m', label: '۱ ماهه' },
  { value: '3m', label: '۳ ماهه' },
  { value: '6m', label: '۶ ماهه' },
  { value: '12m', label: '۱۲ ماهه' },
];

const EXTEND_OPTIONS: { months: number; plan: PaidSubscriptionPlan; label: string }[] = [
  { months: 1, plan: '1m', label: '+۱ ماه' },
  { months: 3, plan: '3m', label: '+۳ ماه' },
  { months: 6, plan: '6m', label: '+۶ ماه' },
  { months: 12, plan: '12m', label: '+۱۲ ماه' },
];

const BUSINESS_TYPE_OPTIONS: BusinessType[] = ['cafe', 'restaurant', 'fast_food', 'bakery', 'other'];

const RESET_PHRASE = 'حذف همه';

function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}
function planLabel(plan: SubscriptionPlan): string {
  if (plan === 'unlimited') return 'نامحدود';
  return PLAN_OPTIONS.find((p) => p.value === plan)?.label ?? plan;
}

function settingsCard(title: string, body: HTMLElement): HTMLElement {
  return el('div', { class: 'settings-card' }, [el('h3', { class: 'settings-card__title' }, [title]), body]);
}

async function loadUsers(): Promise<AppUser[]> {
  const config = await db.getAuthConfig();
  return config.users;
}

// ---------- Users tab ----------

function openUserFormModal(onSaved: () => void, existing?: AppUser): void {
  const isSuperadminUser = existing?.role === 'superadmin';
  const nameInput = el('input', { type: 'text', class: 'input', value: existing?.name ?? '', autocomplete: 'off' });
  const pinInput = el('input', {
    type: 'text', inputmode: 'numeric', class: 'input', autocomplete: 'off',
    placeholder: existing ? 'برای حفظ پین فعلی خالی بگذارید' : '',
  });
  const confirmPinInput = el('input', { type: 'text', inputmode: 'numeric', class: 'input', autocomplete: 'off' });
  const roleSelect = selectEl(ROLE_OPTIONS, existing && !isSuperadminUser ? existing.role : 'manager');
  const activeCheckbox = el('input', { type: 'checkbox', checked: existing?.isActive ?? true });

  const body = el('form', { class: 'form' }, [
    field('نام کاربر', nameInput),
    field(existing ? 'پین جدید (اختیاری)' : 'پین (۴ رقم)', pinInput),
    field('تکرار پین', confirmPinInput),
    isSuperadminUser ? el('p', { class: 'form-hint' }, ['نقش مدیر اصلی قابل تغییر نیست']) : field('نقش', roleSelect),
    !existing ? el('p', { class: 'form-hint' }, ['کارمندان رایگان اضافه می‌شوند و اشتراک جداگانه ندارند.']) : null,
    existing && !isSuperadminUser ? el('label', { class: 'toolbar__checkbox' }, [activeCheckbox, ' فعال']) : null,
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, [existing ? 'ذخیره تغییرات' : 'افزودن کاربر']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const pin = pinInput.value.trim();
    const confirmPin = confirmPinInput.value.trim();
    if (!name) {
      showToast('نام کاربر الزامی است', 'error');
      return;
    }
    if (!existing || pin) {
      if (!/^\d{4}$/.test(pin)) {
        showToast('پین باید دقیقاً ۴ رقم باشد', 'error');
        return;
      }
      if (pin !== confirmPin) {
        showToast('پین و تکرار آن یکسان نیستند', 'error');
        return;
      }
    }
    try {
      if (existing) {
        const patch: Partial<Omit<AppUser, 'id'>> = { name };
        if (pin) patch.pin = pin;
        if (!isSuperadminUser) {
          patch.role = roleSelect.value as UserRole;
          patch.isActive = activeCheckbox.checked;
        }
        await db.updateUser(existing.id, patch);
      } else {
        await db.createUser({ name, pin, role: roleSelect.value as UserRole });
      }
      showToast(existing ? 'تغییرات ذخیره شد' : 'کاربر افزوده شد', 'success');
      modal.close();
      onSaved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطایی رخ داد', 'error');
    }
  });

  const modal = openModal({ title: existing ? 'ویرایش کاربر' : 'افزودن کاربر', body });
}

async function handleDeleteUser(user: AppUser, onDone: () => void): Promise<void> {
  const confirmed = await confirmModal({
    title: 'حذف کاربر',
    message: `کاربر «${user.name}» برای همیشه حذف می‌شود.`,
    confirmLabel: 'حذف',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await db.deleteUser(user.id);
    showToast('کاربر حذف شد', 'success');
    onDone();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'خطایی رخ داد', 'error');
  }
}

function renderUserRow(user: AppUser, onChange: () => void): HTMLElement {
  const isSuperadminUser = user.role === 'superadmin';
  return el('div', { class: `expense-row${user.isActive ? '' : ' expense-row--inactive'}` }, [
    el('div', { class: 'expense-row__main' }, [
      el('div', { class: 'expense-row__title-row' }, [
        el('span', { class: 'expense-row__name' }, [user.name]),
        el('span', { class: `auth-role-badge auth-role-badge--${user.role}` }, [roleLabel(user.role)]),
        !user.isActive ? el('span', { class: 'badge badge--muted' }, ['غیرفعال']) : null,
      ]),
    ]),
    el('div', { class: 'expense-row__actions' }, [
      el('button', { class: 'icon-btn', type: 'button', title: 'ویرایش', onclick: () => openUserFormModal(onChange, user) }, ['✏️']),
      !isSuperadminUser
        ? el(
          'button',
          {
            class: 'icon-btn',
            type: 'button',
            title: user.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی',
            onclick: async () => {
              await db.updateUser(user.id, { isActive: !user.isActive });
              onChange();
            },
          },
          [user.isActive ? '👁️' : '🚫'],
        )
        : null,
      !isSuperadminUser
        ? el('button', { class: 'icon-btn', type: 'button', title: 'حذف', onclick: () => handleDeleteUser(user, onChange) }, ['🗑️'])
        : null,
    ]),
  ]);
}

function renderUsersTab(container: HTMLElement): () => void {
  const listEl = el('div', { class: 'expense-list' });
  container.append(
    el('div', { class: 'tab-toolbar' }, [
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => openUserFormModal(render) }, ['+ افزودن کاربر']),
    ]),
    listEl,
  );

  async function render(): Promise<void> {
    listEl.innerHTML = '';
    const users = (await loadUsers()).sort((a, b) => {
      if (a.role === 'superadmin') return -1;
      if (b.role === 'superadmin') return 1;
      return a.name.localeCompare(b.name, 'fa');
    });
    if (!users.length) {
      listEl.appendChild(emptyState({ icon: '👤', title: 'هنوز کاربری ثبت نشده است' }));
      return;
    }
    for (const user of users) listEl.appendChild(renderUserRow(user, render));
  }

  render();
  return () => {};
}

// ---------- Business subscription tab ----------

const PLAN_TOTAL_DAYS: Record<PaidSubscriptionPlan, number> = { '1m': 30, '3m': 90, '6m': 180, '12m': 365 };

function statusLabel(status: Settings['subscriptionStatus']): string {
  if (status === 'trial') return 'دوره آزمایشی';
  if (status === 'pending_payment') return 'در انتظار پرداخت';
  if (status === 'expired') return 'منقضی‌شده';
  return 'فعال';
}

function renderRenewalSection(container: HTMLElement): () => void {
  const cardHost = el('div', { class: 'settings-card' });
  container.appendChild(cardHost);

  function render(): void {
    cardHost.innerHTML = '';
    const s = settings.get();
    if (!s) return;

    const expired = isBusinessExpired(s);
    const soon = !expired && isBusinessExpiringSoon(s);
    const days = daysUntilBusinessExpiry(s);
    const isUnlimited = s.subscriptionPlan === 'unlimited';

    cardHost.appendChild(el('h3', { class: 'settings-card__title' }, ['وضعیت اشتراک کسب‌وکار']));

    cardHost.append(
      el('div', { class: 'subscription-status-row' }, [
        el('span', {}, [`${statusLabel(s.subscriptionStatus)} · ${planLabel(s.subscriptionPlan)}`]),
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
        cardHost.appendChild(
          el('div', { class: 'alert-banner alert-banner--danger' }, [
            el('span', { class: 'alert-banner__icon' }, ['⛔']),
            el('span', { class: 'alert-banner__text' }, ['اشتراک کسب‌وکار منقضی شده است. برای ادامه کار، اشتراک را تمدید کنید.']),
          ]),
        );
      } else if (soon) {
        cardHost.appendChild(
          el('div', { class: `alert-banner alert-banner--${days <= 3 ? 'danger' : 'warning'}` }, [
            el('span', { class: 'alert-banner__icon' }, ['⚠️']),
            el('span', { class: 'alert-banner__text' }, [`اشتراک کسب‌وکار تا ${toPersian(days)} روز دیگر منقضی می‌شود.`]),
          ]),
        );
      }
    }

    const pricing = getPlatformPricing();
    const card = getPlatformPaymentCard();

    cardHost.append(
      el('div', { class: 'admin-extend-grid' }, [
        ...EXTEND_OPTIONS.map((opt) =>
          el(
            'button',
            {
              type: 'button',
              class: 'btn btn-secondary btn-sm',
              onclick: async () => {
                await db.extendBusinessSubscription(opt.months, opt.plan);
                await refreshSettings();
                showToast('اشتراک کسب‌وکار تمدید شد', 'success');
                render();
              },
            },
            [`${opt.label} (${formatMoney(pricing[opt.plan] ?? 0)})`],
          ),
        ),
      ]),
    );

    if (card) {
      cardHost.appendChild(
        el('p', { class: 'form-hint' }, [`برای تمدید، مبلغ را به شماره کارت `, el('strong', { dir: 'ltr' }, [card]), ' واریز کنید.']),
      );
    }
  }

  render();
  return () => {};
}

function renderSubscriptionsTab(container: HTMLElement): () => void {
  const cleanups = [renderRenewalSection(container)];
  return () => {
    for (const c of cleanups) c();
  };
}

// ---------- System settings tab ----------

function renderChangePinSection(container: HTMLElement): () => void {
  const currentPinInput = el('input', { type: 'password', inputmode: 'numeric', class: 'input', autocomplete: 'off' });
  const newPinInput = el('input', { type: 'password', inputmode: 'numeric', class: 'input', autocomplete: 'off' });
  const confirmPinInput = el('input', { type: 'password', inputmode: 'numeric', class: 'input', autocomplete: 'off' });

  const form = el('form', { class: 'form' }, [
    field('پین فعلی', currentPinInput),
    field('پین جدید (۴ رقم)', newPinInput),
    field('تکرار پین جدید', confirmPinInput),
    el('div', { class: 'modal-actions' }, [el('button', { type: 'submit', class: 'btn btn-primary' }, ['تغییر پین'])]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPin = currentPinInput.value.trim();
    const pin = newPinInput.value.trim();
    const confirmPin = confirmPinInput.value.trim();
    if (!/^\d{4}$/.test(pin)) {
      showToast('پین جدید باید دقیقاً ۴ رقم باشد', 'error');
      return;
    }
    if (pin !== confirmPin) {
      showToast('پین و تکرار آن یکسان نیستند', 'error');
      return;
    }
    try {
      await db.changeSuperadminPin(currentPin, pin);
      currentPinInput.value = '';
      newPinInput.value = '';
      confirmPinInput.value = '';
      showToast('پین مدیر اصلی تغییر کرد', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطایی رخ داد', 'error');
    }
  });

  container.appendChild(settingsCard('تغییر پین مدیر اصلی', form));
  return () => {};
}

function renderBusinessSection(container: HTMLElement): () => void {
  const s = settings.get();
  const nameInput = el('input', { type: 'text', class: 'input', value: s?.businessName ?? '' });
  const typeSelect = selectEl(BUSINESS_TYPE_OPTIONS.map((t) => ({ value: t, label: formatBusinessType(t) })), s?.businessType ?? 'cafe');

  const form = el('form', { class: 'form' }, [
    field('نام کسب‌وکار', nameInput),
    field('نوع کسب‌وکار', typeSelect),
    el('div', { class: 'modal-actions' }, [el('button', { type: 'submit', class: 'btn btn-primary' }, ['ذخیره'])]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const businessName = nameInput.value.trim();
    if (!businessName) {
      showToast('نام کسب‌وکار الزامی است', 'error');
      return;
    }
    await db.updateSettings({ businessName, businessType: typeSelect.value as BusinessType });
    await refreshSettings();
    showToast('تغییرات ذخیره شد', 'success');
  });

  container.appendChild(settingsCard('نام و نوع کسب‌وکار', form));
  return () => {};
}

function renderSyncSection(container: HTMLElement): () => void {
  const s = settings.get();
  const serverInput = el('input', {
    type: 'text', class: 'input', autocomplete: 'off', value: s?.syncServerUrl ?? '', placeholder: 'http://91.107.249.240/sync', dir: 'ltr',
  });
  const businessIdInput = el('input', { type: 'text', class: 'input', value: s?.businessId ?? '', disabled: true, dir: 'ltr' });
  const statusEl = el('p', { class: 'form-hint' }, []);

  function refreshStatus(): void {
    const cur = settings.get();
    statusEl.textContent = cur?.lastSyncAt ? `آخرین همگام‌سازی: ${formatDateTime(cur.lastSyncAt)}` : 'هنوز همگام‌سازی انجام نشده است';
  }
  refreshStatus();

  const form = el('form', { class: 'form' }, [
    el('p', { class: 'form-hint' }, ['داده‌ها بین دستگاه‌های این کسب‌وکار از طریق سرور خود برنامه همگام می‌شوند، نه سرویس‌های خارجی.']),
    field('آدرس سرور همگام‌سازی', serverInput),
    field('شناسه کسب‌وکار (خودکار)', businessIdInput),
    statusEl,
    el('div', { class: 'settings-actions' }, [
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['ذخیره و تست اتصال']),
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-secondary',
          onclick: async () => {
            const result = await pushToServer();
            if (result.ok) refreshStatus();
          },
        },
        ['🔄 ارسال به سرور'],
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-secondary',
          onclick: async () => {
            const result = await pullFromServer();
            if (result.ok) refreshStatus();
          },
        },
        ['☁️ دریافت از سرور'],
      ),
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = serverInput.value.trim();
    if (!url) {
      showToast('آدرس سرور را وارد کنید', 'error');
      return;
    }
    await db.updateSettings({ syncServerUrl: url });
    await refreshSettings();
    const result = await testSyncConnection(url);
    if (result.ok) {
      showToast('اتصال به سرور موفق بود', 'success');
    } else {
      showToast('آدرس ذخیره شد، اما اتصال به سرور برقرار نشد (همگام‌سازی به‌صورت آفلاین ادامه می‌یابد)', 'info');
    }
    refreshStatus();
  });

  container.appendChild(settingsCard('همگام‌سازی با سرور', form));

  // ---- Sync code: quick one-time transfer between two devices ----
  const codeDisplay = el('div', { class: 'sync-code-display', hidden: true });
  const generateBtn = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-secondary',
      onclick: async () => {
        const code = await generateSyncCode();
        codeDisplay.hidden = false;
        codeDisplay.textContent = toPersian(code);
      },
    },
    ['🔢 ساخت کد همگام‌سازی'],
  );

  const importInput = el('input', {
    type: 'text', inputmode: 'numeric', class: 'input', placeholder: '۶ رقمی', dir: 'ltr', maxlength: 6,
  });
  const importBtn = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-primary',
      onclick: async () => {
        const code = importInput.value.trim();
        if (!code) {
          showToast('کد را وارد کنید', 'error');
          return;
        }
        const result = await importFromSyncCode(code);
        if (!result.ok && result.error) showToast(result.error, 'error');
        if (result.ok) {
          await refreshAll();
          refreshStatus();
        }
      },
    },
    ['دریافت با کد'],
  );

  container.appendChild(
    settingsCard(
      'انتقال سریع با کد همگام‌سازی',
      el('div', { class: 'form' }, [
        el('p', { class: 'form-hint' }, [
          'برای انتقال داده به دستگاه دیگر، یک کد بساز و در دستگاه مقصد وارد کن. این روش حتی بدون اتصال دائمی به سرور هم روی همان دستگاه کار می‌کند.',
        ]),
        el('div', { class: 'settings-actions' }, [generateBtn]),
        codeDisplay,
        el('div', { class: 'settings-actions' }, [importInput, importBtn]),
      ]),
    ),
  );

  return () => {};
}

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

function renderBackupSection(container: HTMLElement): () => void {
  const fileInput = el('input', { type: 'file', accept: 'application/json', style: 'display:none' });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const backup = await readFileAsJSON<FullBackup>(file);
      openImportModeModal(backup);
    } catch {
      showToast('فایل پشتیبان نامعتبر است', 'error');
    } finally {
      fileInput.value = '';
    }
  });

  container.appendChild(
    settingsCard(
      'پشتیبان‌گیری محلی',
      el('div', { class: 'settings-actions' }, [
        el(
          'button',
          {
            type: 'button',
            class: 'btn btn-secondary',
            onclick: async () => {
              const backup = await db.exportAllData();
              downloadJSON(`menuban-backup-${new Date().toISOString().slice(0, 10)}.json`, backup);
              showToast('فایل پشتیبان دانلود شد', 'success');
            },
          },
          ['⬇️ خروجی کامل (JSON)'],
        ),
        el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => fileInput.click() }, ['⬆️ بازگردانی از فایل']),
        fileInput,
      ]),
    ),
  );
  return () => {};
}

function renderResetSection(container: HTMLElement): () => void {
  const confirmInput = el('input', { type: 'text', class: 'input', placeholder: RESET_PHRASE });
  const resetBtn = el('button', { type: 'button', class: 'btn btn-danger', disabled: true }, ['🗑️ بازنشانی کامل داده‌ها']);

  confirmInput.addEventListener('input', () => {
    resetBtn.disabled = confirmInput.value.trim() !== RESET_PHRASE;
  });

  resetBtn.addEventListener('click', async () => {
    const confirmed = await confirmModal({
      title: 'بازنشانی کامل داده‌ها',
      message: 'تمام مواد اولیه، دستور پخت‌ها، فروش، هزینه‌ها و سایر داده‌ها برای همیشه حذف می‌شود. این عملیات قابل بازگشت نیست.',
      confirmLabel: 'حذف همه چیز',
      danger: true,
    });
    if (!confirmed) return;
    await db.resetAllData();
    await refreshAll();
    confirmInput.value = '';
    resetBtn.disabled = true;
    showToast('تمام داده‌ها بازنشانی شد', 'success');
  });

  container.appendChild(
    settingsCard(
      'منطقهٔ خطر',
      el('div', { class: 'form' }, [
        el('p', { class: 'form-hint' }, [`برای فعال‌سازی دکمه حذف، عبارت «${RESET_PHRASE}» را در کادر زیر تایپ کنید.`]),
        field('عبارت تایید', confirmInput),
        el('div', { class: 'settings-actions' }, [resetBtn]),
      ]),
    ),
  );
  return () => {};
}

function renderSystemTab(container: HTMLElement): () => void {
  const grid = el('div', { class: 'settings-grid' });
  container.appendChild(grid);
  const cleanups = [
    renderChangePinSection(grid),
    renderBusinessSection(grid),
    renderSyncSection(grid),
    renderBackupSection(grid),
    renderResetSection(grid),
  ];
  return () => {
    for (const c of cleanups) c();
  };
}

// ---------- View shell with tabs ----------

export async function renderAdmin(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-admin' });
  container.appendChild(root);

  const tabsEl = el('div', { class: 'tabs' });
  const contentEl = el('div', { class: 'tab-content' });

  root.append(el('div', { class: 'view-header' }, [el('h1', { class: 'view-header__title' }, ['پنل مدیریت'])]), tabsEl, contentEl);

  const tabs: { id: Tab; label: string; render: (c: HTMLElement) => () => void }[] = [
    { id: 'users', label: 'کاربران', render: renderUsersTab },
    { id: 'subscriptions', label: 'قیمت اشتراک‌ها', render: renderSubscriptionsTab },
    { id: 'system', label: 'تنظیمات سیستم', render: renderSystemTab },
  ];

  let activeTab: Tab = 'users';
  let activeCleanup: () => void = () => {};

  function renderTabs(): void {
    tabsEl.innerHTML = '';
    for (const tab of tabs) {
      tabsEl.appendChild(
        el(
          'button',
          { type: 'button', class: `tab-btn${tab.id === activeTab ? ' tab-btn--active' : ''}`, onclick: () => switchTab(tab.id) },
          [tab.label],
        ),
      );
    }
  }

  function switchTab(tab: Tab): void {
    activeTab = tab;
    activeCleanup();
    contentEl.innerHTML = '';
    renderTabs();
    activeCleanup = tabs.find((t) => t.id === tab)!.render(contentEl);
  }

  switchTab(activeTab);

  return () => activeCleanup();
}

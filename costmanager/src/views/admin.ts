import * as db from '../db';
import { daysUntilExpiry, isExpired, isExpiringSoon } from '../auth';
import { confirmModal, openModal } from '../components/modal';
import { showToast } from '../components/toast';
import { el, emptyState, field, numberInput, parseNumberInput, selectEl } from '../utils/dom';
import { downloadJSON, readFileAsJSON } from '../utils/export';
import { formatBusinessType, formatDate, formatDateTime, toPersian } from '../utils/format';
import { checkForNewerCloudVersion, syncFromCloud, syncToCloud, testConnection } from '../utils/sync';
import type { RouteCleanup } from '../router';
import { refreshAll, refreshSettings, settings } from '../store';
import type { AppUser, BusinessType, FullBackup, PaidSubscriptionPlan, SubscriptionPlan, UserRole } from '../types';

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
  const planSelect = existing ? null : selectEl(PLAN_OPTIONS, '1m');
  const activeCheckbox = el('input', { type: 'checkbox', checked: existing?.isActive ?? true });

  const extendSection = existing && !isSuperadminUser
    ? el('div', { class: 'field' }, [
      el('span', { class: 'field__label' }, [`تمدید اشتراک (انقضای فعلی: ${formatDate(existing.subscriptionExpiry)})`]),
      el(
        'div',
        { class: 'admin-extend-grid' },
        EXTEND_OPTIONS.map((opt) =>
          el(
            'button',
            {
              type: 'button',
              class: 'btn btn-secondary btn-sm',
              onclick: async () => {
                await db.extendSubscription(existing.id, opt.months, opt.plan);
                showToast('اشتراک تمدید شد', 'success');
                modal.close();
                onSaved();
              },
            },
            [opt.label],
          ),
        ),
      ),
    ])
    : null;

  const body = el('form', { class: 'form' }, [
    field('نام کاربر', nameInput),
    field(existing ? 'پین جدید (اختیاری)' : 'پین (۴ رقم)', pinInput),
    field('تکرار پین', confirmPinInput),
    isSuperadminUser ? el('p', { class: 'form-hint' }, ['نقش مدیر اصلی قابل تغییر نیست']) : field('نقش', roleSelect),
    planSelect ? field('دوره اشتراک اولیه', planSelect) : null,
    existing && !isSuperadminUser ? el('label', { class: 'toolbar__checkbox' }, [activeCheckbox, ' فعال']) : null,
    extendSection,
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
        await db.createUser({ name, pin, role: roleSelect.value as UserRole, subscriptionPlan: planSelect!.value as SubscriptionPlan });
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
  const expired = isExpired(user);
  const soon = !expired && isExpiringSoon(user);
  const days = daysUntilExpiry(user);
  return el('div', { class: `expense-row${user.isActive ? '' : ' expense-row--inactive'}` }, [
    el('div', { class: 'expense-row__main' }, [
      el('div', { class: 'expense-row__title-row' }, [
        el('span', { class: 'expense-row__name' }, [user.name]),
        el('span', { class: `auth-role-badge auth-role-badge--${user.role}` }, [roleLabel(user.role)]),
        !user.isActive ? el('span', { class: 'badge badge--muted' }, ['غیرفعال']) : null,
        expired ? el('span', { class: 'badge badge--danger' }, ['منقضی‌شده']) : null,
        soon ? el('span', { class: 'badge badge--warning' }, [`${toPersian(days)} روز تا انقضا`]) : null,
      ]),
      el('div', { class: 'expense-row__meta' }, [
        `${planLabel(user.subscriptionPlan)} · انقضا: ${formatDate(user.subscriptionExpiry)}`,
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

// ---------- Subscription prices tab ----------

function renderPricingSection(container: HTMLElement): () => void {
  const s = settings.get();
  const priceInputs = new Map<PaidSubscriptionPlan, HTMLInputElement>();
  const rows = PLAN_OPTIONS.map((p) => {
    const input = numberInput(s?.subscriptionPrices?.[p.value] ?? 0);
    priceInputs.set(p.value, input);
    return field(`قیمت اشتراک ${p.label} (تومان)`, input);
  });

  const form = el('form', { class: 'form' }, [
    ...rows,
    el('div', { class: 'modal-actions' }, [el('button', { type: 'submit', class: 'btn btn-primary' }, ['ذخیره قیمت‌ها'])]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subscriptionPrices = PLAN_OPTIONS.reduce(
      (acc, p) => ({ ...acc, [p.value]: parseNumberInput(priceInputs.get(p.value)!) }),
      {} as Record<PaidSubscriptionPlan, number>,
    );
    await db.updateSettings({ subscriptionPrices });
    await refreshSettings();
    showToast('قیمت‌ها ذخیره شد', 'success');
  });

  container.appendChild(settingsCard('قیمت اشتراک‌ها', form));
  return () => {};
}

function renderSubscriptionsTab(container: HTMLElement): () => void {
  const cleanups = [renderPricingSection(container)];
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
  const tokenInput = el('input', {
    type: 'password', class: 'input', autocomplete: 'off', value: s?.githubToken ?? '', placeholder: 'ghp_xxxxxxxxxxxxxxxx',
  });
  const gistIdInput = el('input', { type: 'text', class: 'input', value: s?.gistId ?? '', disabled: true });
  const statusEl = el('p', { class: 'form-hint' }, []);
  const bannerEl = el('p', { class: 'auth-lockout', hidden: true }, []);

  function refreshStatus(): void {
    const cur = settings.get();
    statusEl.textContent = cur?.lastSyncAt ? `آخرین همگام‌سازی: ${formatDateTime(cur.lastSyncAt)}` : 'هنوز همگام‌سازی انجام نشده است';
    gistIdInput.value = cur?.gistId ?? '';
  }
  refreshStatus();

  const form = el('form', { class: 'form' }, [
    el('p', { class: 'form-hint' }, [
      'برای همگام‌سازی چند دستگاهی، یک توکن GitHub با دسترسی gist بسازید: ',
      el('a', { href: 'https://github.com/settings/tokens', target: '_blank', rel: 'noopener' }, ['github.com/settings/tokens']),
    ]),
    field('توکن GitHub', tokenInput),
    field('شناسه Gist (خودکار)', gistIdInput),
    statusEl,
    bannerEl,
    el('div', { class: 'settings-actions' }, [
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['ذخیره و تست اتصال']),
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-secondary',
          onclick: async () => {
            await syncToCloud();
            refreshStatus();
          },
        },
        ['🔄 همگام‌سازی الان'],
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-secondary',
          onclick: async () => {
            await syncFromCloud();
            refreshStatus();
          },
        },
        ['☁️ دریافت از ابر'],
      ),
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = tokenInput.value.trim();
    if (!token) {
      showToast('توکن را وارد کنید', 'error');
      return;
    }
    const result = await testConnection(token);
    if (!result.ok) {
      showToast(result.error, 'error');
      return;
    }
    await db.updateSettings({ githubToken: token });
    await refreshSettings();
    showToast(`اتصال موفق — متصل به حساب ${result.login}`, 'success');
    refreshStatus();
  });

  container.appendChild(settingsCard('همگام‌سازی ابری (GitHub Gist)', form));

  checkForNewerCloudVersion().then((newer) => {
    if (!newer) return;
    bannerEl.hidden = false;
    bannerEl.textContent = 'نسخهٔ جدیدتری در ابر موجود است.';
    bannerEl.appendChild(
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-secondary btn-sm',
          onclick: async () => {
            await syncFromCloud({ skipConfirm: true });
            bannerEl.hidden = true;
            refreshStatus();
          },
        },
        [' دریافت '],
      ),
    );
    bannerEl.appendChild(
      el('button', { type: 'button', class: 'btn btn-secondary btn-sm', onclick: () => { bannerEl.hidden = true; } }, [' نادیده گرفتن ']),
    );
  });

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

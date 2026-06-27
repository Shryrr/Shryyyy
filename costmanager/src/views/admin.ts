import * as db from '../db';
import { daysUntilExpiry, isExpired, isExpiringSoon } from '../auth';
import { confirmModal, openModal } from '../components/modal';
import { showToast } from '../components/toast';
import { el, emptyState, field, numberInput, parseNumberInput, selectEl } from '../utils/dom';
import { formatBusinessType, formatDate, toPersian } from '../utils/format';
import type { RouteCleanup } from '../router';
import { refreshAll, refreshSettings, settings } from '../store';
import type { AppUser, BusinessType, SubscriptionPlan, UserRole } from '../types';

type Tab = 'users' | 'subscriptions' | 'system';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'مدیر' },
  { value: 'buyer', label: 'خریدار' },
  { value: 'viewer', label: 'مشاهده‌گر' },
];
const PLAN_OPTIONS: { value: SubscriptionPlan; label: string }[] = [
  { value: '1m', label: '۱ ماهه' },
  { value: '3m', label: '۳ ماهه' },
  { value: '6m', label: '۶ ماهه' },
  { value: '12m', label: '۱۲ ماهه' },
];
const BUSINESS_TYPE_OPTIONS: BusinessType[] = ['cafe', 'restaurant', 'fast_food', 'bakery', 'other'];

function roleLabel(role: UserRole): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}
function planLabel(plan: SubscriptionPlan): string {
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
  const nameInput = el('input', { type: 'text', class: 'input', value: existing?.name ?? '' });
  const pinInput = el('input', { type: 'text', inputmode: 'numeric', class: 'input', value: existing?.pin ?? '' });
  const roleSelect = selectEl(ROLE_OPTIONS, existing?.role ?? 'viewer');
  const planSelect = existing ? null : selectEl(PLAN_OPTIONS, '1m');
  const activeCheckbox = el('input', { type: 'checkbox', checked: existing?.isActive ?? true });

  const body = el('form', { class: 'form' }, [
    field('نام کاربر', nameInput),
    field('پین ورود', pinInput),
    field('نقش', roleSelect),
    planSelect ? field('دوره اشتراک اولیه', planSelect) : null,
    existing ? el('label', { class: 'toolbar__checkbox' }, [activeCheckbox, ' فعال']) : null,
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, [existing ? 'ذخیره تغییرات' : 'افزودن کاربر']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const pin = pinInput.value.trim();
    if (!name || pin.length < 4) {
      showToast('نام و پین (حداقل ۴ رقم) الزامی است', 'error');
      return;
    }
    if (existing) {
      await db.updateUser(existing.id, { name, pin, role: roleSelect.value as UserRole, isActive: activeCheckbox.checked });
    } else {
      await db.createUser({ name, pin, role: roleSelect.value as UserRole, subscriptionPlan: planSelect!.value as SubscriptionPlan });
    }
    showToast(existing ? 'تغییرات ذخیره شد' : 'کاربر افزوده شد', 'success');
    modal.close();
    onSaved();
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
  await db.deleteUser(user.id);
  showToast('کاربر حذف شد', 'success');
  onDone();
}

function renderUserRow(user: AppUser, onChange: () => void): HTMLElement {
  const expired = isExpired(user);
  const soon = !expired && isExpiringSoon(user);
  return el('div', { class: `expense-row${user.isActive ? '' : ' expense-row--inactive'}` }, [
    el('div', { class: 'expense-row__main' }, [
      el('div', { class: 'expense-row__title-row' }, [
        el('span', { class: 'expense-row__name' }, [user.name]),
        el('span', { class: 'badge' }, [roleLabel(user.role)]),
        !user.isActive ? el('span', { class: 'badge badge--muted' }, ['غیرفعال']) : null,
        expired ? el('span', { class: 'badge badge--danger' }, ['منقضی‌شده']) : null,
        soon ? el('span', { class: 'badge badge--warning' }, ['رو به انقضا']) : null,
      ]),
      el('div', { class: 'expense-row__meta' }, [
        `${planLabel(user.subscriptionPlan)} · انقضا: ${formatDate(user.subscriptionExpiry)} · پین: ${user.pin}`,
      ]),
    ]),
    el('div', { class: 'expense-row__actions' }, [
      el('button', { class: 'icon-btn', type: 'button', title: 'ویرایش', onclick: () => openUserFormModal(onChange, user) }, ['✏️']),
      el(
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
      ),
      el('button', { class: 'icon-btn', type: 'button', title: 'حذف', onclick: () => handleDeleteUser(user, onChange) }, ['🗑️']),
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
    const users = (await loadUsers()).sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    if (!users.length) {
      listEl.appendChild(emptyState({ icon: '👤', title: 'هنوز کاربری ثبت نشده است' }));
      return;
    }
    for (const user of users) listEl.appendChild(renderUserRow(user, render));
  }

  render();
  return () => {};
}

// ---------- Subscriptions tab ----------

function renderPricingSection(container: HTMLElement): () => void {
  const s = settings.get();
  const priceInputs = new Map<SubscriptionPlan, HTMLInputElement>();
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
      {} as Record<SubscriptionPlan, number>,
    );
    await db.updateSettings({ subscriptionPrices });
    await refreshSettings();
    showToast('قیمت‌ها ذخیره شد', 'success');
  });

  container.appendChild(settingsCard('قیمت‌گذاری اشتراک‌ها', form));
  return () => {};
}

function openExtendModal(user: AppUser, onDone: () => void): void {
  const monthsInput = numberInput(1);
  const planSelect = selectEl(PLAN_OPTIONS, user.subscriptionPlan);

  const body = el('form', { class: 'form' }, [
    el('p', { class: 'form-hint' }, [`اشتراک فعلی: ${planLabel(user.subscriptionPlan)} · انقضا: ${formatDate(user.subscriptionExpiry)}`]),
    field('تعداد ماه تمدید', monthsInput),
    field('دوره اشتراک جدید', planSelect),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['تمدید اشتراک']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const months = parseNumberInput(monthsInput);
    if (months <= 0) {
      showToast('تعداد ماه باید بیشتر از صفر باشد', 'error');
      return;
    }
    await db.extendSubscription(user.id, months, planSelect.value as SubscriptionPlan);
    showToast('اشتراک تمدید شد', 'success');
    modal.close();
    onDone();
  });

  const modal = openModal({ title: `تمدید اشتراک — ${user.name}`, body });
}

function renderSubscriptionsList(container: HTMLElement): () => void {
  const listEl = el('div', { class: 'expense-list' });
  container.appendChild(listEl);

  async function render(): Promise<void> {
    listEl.innerHTML = '';
    const users = (await loadUsers()).sort((a, b) => a.subscriptionExpiry.localeCompare(b.subscriptionExpiry));
    if (!users.length) {
      listEl.appendChild(emptyState({ icon: '📅', title: 'کاربری برای نمایش وجود ندارد' }));
      return;
    }
    for (const user of users) {
      const expired = isExpired(user);
      const soon = !expired && isExpiringSoon(user);
      const days = daysUntilExpiry(user);
      listEl.appendChild(
        el('div', { class: 'expense-row' }, [
          el('div', { class: 'expense-row__main' }, [
            el('div', { class: 'expense-row__title-row' }, [
              el('span', { class: 'expense-row__name' }, [user.name]),
              el('span', { class: 'badge' }, [roleLabel(user.role)]),
              expired ? el('span', { class: 'badge badge--danger' }, ['منقضی‌شده']) : null,
              soon ? el('span', { class: 'badge badge--warning' }, [`${toPersian(days)} روز تا انقضا`]) : null,
            ]),
            el('div', { class: 'expense-row__meta' }, [
              `${planLabel(user.subscriptionPlan)} · انقضا: ${formatDate(user.subscriptionExpiry)}`,
            ]),
          ]),
          el('div', { class: 'expense-row__actions' }, [
            el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => openExtendModal(user, render) }, ['تمدید']),
          ]),
        ]),
      );
    }
  }

  render();
  return () => {};
}

function renderSubscriptionsTab(container: HTMLElement): () => void {
  const cleanups = [renderPricingSection(container), renderSubscriptionsList(container)];
  return () => {
    for (const c of cleanups) c();
  };
}

// ---------- System settings tab ----------

function renderChangePinSection(container: HTMLElement): () => void {
  const newPinInput = el('input', { type: 'password', inputmode: 'numeric', class: 'input' });
  const confirmPinInput = el('input', { type: 'password', inputmode: 'numeric', class: 'input' });

  const form = el('form', { class: 'form' }, [
    field('پین جدید مدیر', newPinInput),
    field('تکرار پین جدید', confirmPinInput),
    el('div', { class: 'modal-actions' }, [el('button', { type: 'submit', class: 'btn btn-primary' }, ['تغییر پین'])]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = newPinInput.value.trim();
    const confirmPin = confirmPinInput.value.trim();
    if (pin.length < 4) {
      showToast('پین باید حداقل ۴ رقم باشد', 'error');
      return;
    }
    if (pin !== confirmPin) {
      showToast('پین و تکرار آن یکسان نیستند', 'error');
      return;
    }
    await db.changeAdminPin(pin);
    newPinInput.value = '';
    confirmPinInput.value = '';
    showToast('پین مدیر تغییر کرد', 'success');
  });

  container.appendChild(settingsCard('تغییر پین مدیر', form));
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

function renderResetSection(container: HTMLElement): () => void {
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
      'بازنشانی کامل',
      el('div', { class: 'settings-actions' }, [
        el('button', { type: 'button', class: 'btn btn-danger', onclick: handleReset }, ['🗑️ بازنشانی کامل داده‌ها']),
      ]),
    ),
  );
  return () => {};
}

function renderSystemTab(container: HTMLElement): () => void {
  const grid = el('div', { class: 'settings-grid' });
  container.appendChild(grid);
  const cleanups = [renderChangePinSection(grid), renderBusinessSection(grid), renderResetSection(grid)];
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
    { id: 'subscriptions', label: 'اشتراک‌ها', render: renderSubscriptionsTab },
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

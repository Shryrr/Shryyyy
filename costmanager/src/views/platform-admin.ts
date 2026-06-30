import { confirmModal } from '../components/modal';
import { showToast } from '../components/toast';
import { settings } from '../store';
import { el, emptyState, field, iconBtn, iconTextBtn, kpiCard, numberInput, parseNumberInput, selectEl } from '../utils/dom';
import { svgIcon } from '../utils/icons';
import { formatDateTime, formatMoney, toPersian } from '../utils/format';
import {
  DEFAULT_PLATFORM_USERNAME,
  addPlatformInvoice,
  deletePlatformInvoice,
  fetchPlatformBusinesses,
  getPlatformPaymentCard,
  getPlatformPricing,
  isDefaultPlatformCredentials,
  listPlatformBroadcasts,
  listPlatformInvoices,
  platformLockedUntil,
  recordPlatformFailedAttempt,
  resetPlatformLoginAttempts,
  sendPlatformBroadcast,
  setPlatformCredentials,
  setPlatformOwnerSession,
  setPlatformPaymentCard,
  setPlatformPricing,
  verifyPlatformCredentials,
  type PlatformPricing,
} from '../platform-owner';
import { passwordStrength, validatePassword, validateUsername } from '../utils/password';
import type { PaidSubscriptionPlan } from '../types';

const PLAN_OPTIONS: { value: PaidSubscriptionPlan; label: string }[] = [
  { value: '1m', label: '۱ ماهه' },
  { value: '3m', label: '۳ ماهه' },
  { value: '6m', label: '۶ ماهه' },
  { value: '12m', label: '۱۲ ماهه' },
];

type Tab = 'businesses' | 'pricing' | 'broadcast' | 'revenue';

function serverUrl(): string {
  return settings.get()?.syncServerUrl ?? '';
}

function planLabel(plan: PaidSubscriptionPlan): string {
  return PLAN_OPTIONS.find((p) => p.value === plan)?.label ?? plan;
}

function settingsCard(title: string, body: HTMLElement): HTMLElement {
  return el('div', { class: 'settings-card' }, [el('h3', { class: 'settings-card__title' }, [title]), body]);
}

/**
 * Entry point: reached via the dedicated `/platform-login` route (not a hidden gesture). Takes over
 * `container` entirely for username/password entry; on success the platform-owner session flag is set
 * (survives page reload via sessionStorage) and the panel renders directly, with its exit button reloading
 * back to the normal login.
 */
export function openPlatformOwnerGate(container: HTMLElement): void {
  renderLoginScreen(container);
}

/** Re-opens the panel for an already-unlocked session (e.g. the header icon), without requiring login again. */
export function openPlatformOwnerPanel(container: HTMLElement, onExit: () => void): void {
  renderPlatformAdminPanel(container, onExit);
}

function renderLoginScreen(container: HTMLElement): void {
  container.innerHTML = '';

  const usernameInput = el('input', { type: 'text', class: 'input', autocomplete: 'username', dir: 'ltr' }) as HTMLInputElement;
  const passwordInput = el('input', { type: 'password', class: 'input', autocomplete: 'current-password', dir: 'ltr' }) as HTMLInputElement;
  const errorEl = el('p', { class: 'auth-error', hidden: true }, []);
  const lockEl = el('p', { class: 'auth-lockout', hidden: true }, []);
  const submitBtn = el('button', { type: 'submit', class: 'btn btn-primary auth-submit' }, ['ورود']) as HTMLButtonElement;

  let lockTimer: ReturnType<typeof setInterval> | undefined;

  function showError(msg: string): void {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function tickLock(): void {
    const remaining = Math.ceil((platformLockedUntil() - Date.now()) / 1000);
    if (remaining <= 0) {
      lockEl.hidden = true;
      submitBtn.disabled = false;
      if (lockTimer) clearInterval(lockTimer);
      return;
    }
    lockEl.hidden = false;
    lockEl.textContent = `به دلیل ورود نادرست، ${toPersian(remaining)} ثانیه صبر کنید`;
    submitBtn.disabled = true;
  }

  if (Date.now() < platformLockedUntil()) {
    tickLock();
    lockTimer = setInterval(tickLock, 1000);
  }

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (Date.now() < platformLockedUntil()) return;
    errorEl.hidden = true;
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || !password) {
      showError('نام کاربری و رمز عبور را وارد کنید');
      return;
    }
    const valid = await verifyPlatformCredentials(username, password);
    if (!valid) {
      const until = recordPlatformFailedAttempt();
      if (until) {
        tickLock();
        lockTimer = setInterval(tickLock, 1000);
      } else {
        showError('نام کاربری یا رمز عبور اشتباه است');
      }
      return;
    }
    resetPlatformLoginAttempts();
    if (lockTimer) clearInterval(lockTimer);
    if (isDefaultPlatformCredentials()) renderForceChangeScreen(container);
    else {
      setPlatformOwnerSession(true);
      renderPlatformAdminPanel(container, () => { location.hash = ''; location.reload(); });
    }
  }

  const form = el('form', { class: 'auth-form', onsubmit: submit }, [
    field('نام کاربری', usernameInput),
    field('رمز عبور', passwordInput),
    errorEl,
    lockEl,
    submitBtn,
  ]);

  container.appendChild(
    el('div', { class: 'auth-screen' }, [
      el('div', { class: 'auth-card' }, [
        el('button', { type: 'button', class: 'auth-back-btn', onclick: () => { location.hash = ''; location.reload(); } }, ['→ بازگشت']),
        el('div', { class: 'boot-logo auth-logo' }, ['م']),
        el('span', { class: 'auth-brand' }, ['پنل پلتفرم']),
        el('h2', { class: 'auth-title' }, ['ورود مدیر پلتفرم']),
        form,
      ]),
    ]),
  );

  setTimeout(() => usernameInput.focus(), 50);
}

function renderForceChangeScreen(container: HTMLElement): void {
  container.innerHTML = '';

  const usernameInput = el('input', { type: 'text', class: 'input', autocomplete: 'username', dir: 'ltr', value: DEFAULT_PLATFORM_USERNAME }) as HTMLInputElement;
  const passwordInput = el('input', { type: 'password', class: 'input', autocomplete: 'new-password', dir: 'ltr' }) as HTMLInputElement;
  const confirmInput = el('input', { type: 'password', class: 'input', autocomplete: 'new-password', dir: 'ltr' }) as HTMLInputElement;
  const strengthEl = el('p', { class: 'auth-hint' }, ['']);

  passwordInput.addEventListener('input', () => {
    const { label } = passwordStrength(passwordInput.value);
    strengthEl.textContent = passwordInput.value ? `قدرت رمز عبور: ${label}` : '';
  });

  const form = el('form', { class: 'auth-form' }, [
    field('نام کاربری جدید', usernameInput),
    field('رمز عبور جدید', passwordInput),
    strengthEl,
    field('تکرار رمز عبور جدید', confirmInput),
    el('button', { type: 'submit', class: 'btn btn-primary auth-submit' }, ['تنظیم اطلاعات ورود و ادامه']),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;
    const usernameError = validateUsername(username);
    if (usernameError) {
      showToast(usernameError, 'error');
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      showToast(passwordError, 'error');
      return;
    }
    if (password !== confirm) {
      showToast('رمز عبور و تکرار آن یکسان نیستند', 'error');
      return;
    }
    await setPlatformCredentials(username, password);
    setPlatformOwnerSession(true);
    showToast('اطلاعات ورود پلتفرم تغییر کرد', 'success');
    renderPlatformAdminPanel(container, () => { location.hash = ''; location.reload(); });
  });

  container.appendChild(
    el('div', { class: 'auth-screen' }, [
      el('div', { class: 'auth-card' }, [
        el('div', { class: 'boot-logo auth-logo' }, ['م']),
        el('span', { class: 'auth-brand' }, ['پنل پلتفرم']),
        el('h2', { class: 'auth-title' }, ['تغییر اطلاعات ورود پیش‌فرض']),
        el('p', { class: 'auth-subtitle' }, ['برای امنیت بیشتر، نام کاربری و رمز عبور پیش‌فرض را تغییر دهید']),
        form,
      ]),
    ]),
  );
}

let statsHostRef: HTMLElement | null = null;

function refreshStats(): void {
  if (statsHostRef) renderStats(statsHostRef);
}

function renderPlatformAdminPanel(container: HTMLElement, onExit: () => void): void {
  container.innerHTML = '';

  const statsHost = el('div', { class: 'kpi-grid' });
  statsHostRef = statsHost;
  const tabsEl = el('div', { class: 'tabs' });
  const contentEl = el('div', { class: 'tab-content' });

  const root = el('div', { class: 'platform-admin-screen' }, [
    el('div', { class: 'platform-admin-header' }, [
      el('div', { class: 'platform-admin-header__title' }, [
        (() => {
          const badge = el('span', { class: 'platform-admin-header__badge' }, []);
          badge.append(svgIcon('wrench', 14), ' پنل پلتفرم');
          return badge;
        })(),
        el('h1', { class: 'view-header__title' }, ['مدیریت پلتفرم']),
      ]),
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: onExit }, ['بستن پنل']),
    ]),
    el('div', { class: 'view' }, [statsHost, tabsEl, contentEl]),
  ]);
  container.appendChild(root);

  renderStats(statsHost);

  const tabs: { id: Tab; label: string; render: (c: HTMLElement) => void }[] = [
    { id: 'businesses', label: 'کسب‌وکارها', render: renderBusinessesTab },
    { id: 'pricing', label: 'تعرفه‌های اشتراک', render: renderPricingTab },
    { id: 'broadcast', label: 'پیام‌رسانی', render: renderBroadcastTab },
    { id: 'revenue', label: 'گزارش درآمد', render: renderRevenueTab },
  ];

  let activeTab: Tab = 'businesses';

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
    contentEl.innerHTML = '';
    renderTabs();
    tabs.find((t) => t.id === tab)!.render(contentEl);
  }

  switchTab(activeTab);
}

function renderStats(host: HTMLElement): void {
  host.innerHTML = '';
  const invoices = listPlatformInvoices();
  const totalRevenue = invoices.reduce((sum, i) => sum + i.amount, 0);
  const broadcasts = listPlatformBroadcasts();

  const businessesCard = kpiCard('building', 'کسب‌وکارها', '…');
  host.append(
    businessesCard,
    kpiCard('wallet', 'درآمد کل پلتفرم', `${formatMoney(totalRevenue)} ت`),
    kpiCard('receipt', 'تعداد فاکتورها', toPersian(invoices.length)),
    kpiCard('mail', 'پیام‌های ارسالی', toPersian(broadcasts.length)),
  );

  void fetchPlatformBusinesses(serverUrl()).then((list) => {
    const valueEl = businessesCard.querySelector('.kpi-card__value');
    if (valueEl) valueEl.textContent = toPersian(list.length);
  });
}

function renderBusinessesTab(container: HTMLElement): void {
  const listHost = el('div', { class: 'platform-list' });
  const refreshBtn = iconTextBtn('refresh-cw', 'بروزرسانی', 'btn btn-secondary', () => void load());

  container.append(el('div', { class: 'settings-actions' }, [refreshBtn]), listHost);

  async function load(): Promise<void> {
    listHost.innerHTML = '';
    listHost.appendChild(el('p', { class: 'form-hint' }, ['در حال دریافت فهرست کسب‌وکارها…']));
    const businesses = await fetchPlatformBusinesses(serverUrl());
    listHost.innerHTML = '';
    if (!businesses.length) {
      listHost.appendChild(
        emptyState({
          icon: 'building',
          title: 'کسب‌وکاری یافت نشد',
          message: 'فهرست کسب‌وکارها از سرور همگام‌سازی دریافت می‌شود؛ اگر سرور در دسترس نباشد یا این قابلیت را هنوز نداشته باشد، این فهرست خالی نمایش داده می‌شود.',
        }),
      );
      return;
    }
    for (const b of businesses) {
      listHost.appendChild(
        el('div', { class: 'platform-row' }, [
          el('div', { class: 'platform-row__main' }, [
            el('span', { class: 'platform-row__name' }, [b.businessName]),
            el('span', { class: 'platform-row__meta' }, [
              [
                b.lastSyncAt ? `آخرین همگام‌سازی: ${formatDateTime(b.lastSyncAt)}` : 'هنوز همگام‌سازی نشده',
                b.userCount != null ? `${toPersian(b.userCount)} کاربر` : null,
              ]
                .filter(Boolean)
                .join(' · '),
            ]),
          ]),
        ]),
      );
    }
  }

  void load();
}

function renderPricingTab(container: HTMLElement): void {
  const pricing = getPlatformPricing();
  const inputs = new Map<PaidSubscriptionPlan, HTMLInputElement>();
  const rows = PLAN_OPTIONS.map((p) => {
    const input = numberInput(pricing[p.value] ?? 0);
    inputs.set(p.value, input);
    return field(`قیمت اشتراک ${p.label} (تومان)`, input);
  });

  const form = el('form', { class: 'form' }, [
    el('p', { class: 'form-hint' }, ['این تعرفه‌ها، قیمت پایه پلتفرم برای فروش اشتراک به کسب‌وکارهای جدید است.']),
    ...rows,
    el('div', { class: 'modal-actions' }, [el('button', { type: 'submit', class: 'btn btn-primary' }, ['ذخیره تعرفه‌ها'])]),
  ]);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const next = PLAN_OPTIONS.reduce(
      (acc, p) => ({ ...acc, [p.value]: parseNumberInput(inputs.get(p.value)!) }),
      {} as PlatformPricing,
    );
    setPlatformPricing(next);
    showToast('تعرفه‌های پلتفرم ذخیره شد', 'success');
  });

  container.appendChild(settingsCard('تعرفه‌های اشتراک پلتفرم', form));

  const cardInput = el('input', { type: 'text', class: 'input', dir: 'ltr', value: getPlatformPaymentCard(), placeholder: '۶۰۳۷-××××-××××-××××' });
  const cardForm = el('form', { class: 'form' }, [
    el('p', { class: 'form-hint' }, ['این شماره کارت برای واریز کسب‌وکارها هنگام تمدید اشتراک نمایش داده می‌شود.']),
    field('شماره کارت پلتفرم', cardInput),
    el('div', { class: 'modal-actions' }, [el('button', { type: 'submit', class: 'btn btn-primary' }, ['ذخیره شماره کارت'])]),
  ]);
  cardForm.addEventListener('submit', (e) => {
    e.preventDefault();
    setPlatformPaymentCard(cardInput.value.trim());
    showToast('شماره کارت ذخیره شد', 'success');
  });
  container.appendChild(settingsCard('شماره کارت دریافت وجه', cardForm));
}

function renderBroadcastTab(container: HTMLElement): void {
  const messageInput = el('textarea', { class: 'input', rows: 3, placeholder: 'متن پیام برای همه کسب‌وکارها…' });
  const sendBtn = iconTextBtn('mail', 'ارسال پیام', 'btn btn-primary', () => {});
  const historyHost = el('div', { class: 'platform-list' });

  function renderHistory(): void {
    historyHost.innerHTML = '';
    const items = listPlatformBroadcasts();
    if (!items.length) {
      historyHost.appendChild(emptyState({ icon: 'mail', title: 'پیامی ارسال نشده است' }));
      return;
    }
    for (const item of items) {
      historyHost.appendChild(
        el('div', { class: 'platform-row' }, [
          el('div', { class: 'platform-row__main' }, [
            el('span', { class: 'platform-row__name' }, [item.message]),
            el('span', { class: 'platform-row__meta' }, [formatDateTime(item.createdAt)]),
          ]),
        ]),
      );
    }
  }

  sendBtn.addEventListener('click', async () => {
    const message = messageInput.value.trim();
    if (!message) {
      showToast('متن پیام را وارد کنید', 'error');
      return;
    }
    const confirmed = await confirmModal({
      title: 'ارسال پیام همگانی',
      message: 'این پیام برای همه کسب‌وکارهای متصل به سرور ارسال می‌شود. ادامه می‌دهید؟',
      confirmLabel: 'ارسال',
    });
    if (!confirmed) return;
    const result = await sendPlatformBroadcast(serverUrl(), message);
    messageInput.value = '';
    renderHistory();
    refreshStats();
    showToast(result.ok ? 'پیام ارسال شد' : 'پیام به‌صورت محلی ثبت شد؛ ارسال به سرور ناموفق بود', result.ok ? 'success' : 'info');
  });

  container.append(
    settingsCard('ارسال پیام همگانی', el('div', { class: 'form' }, [field('متن پیام', messageInput), el('div', { class: 'modal-actions' }, [sendBtn])])),
    settingsCard('تاریخچه پیام‌ها', historyHost),
  );

  renderHistory();
}

function renderRevenueTab(container: HTMLElement): void {
  const nameInput = el('input', { type: 'text', class: 'input' });
  const planSelect = selectEl(PLAN_OPTIONS, '1m');
  const amountInput = numberInput(0);
  const totalEl = el('p', { class: 'form-hint' }, []);
  const listHost = el('div', { class: 'platform-list' });

  function refresh(): void {
    const invoices = listPlatformInvoices();
    totalEl.textContent = `جمع درآمد ثبت‌شده: ${formatMoney(invoices.reduce((sum, i) => sum + i.amount, 0))} تومان`;
    listHost.innerHTML = '';
    if (!invoices.length) {
      listHost.appendChild(emptyState({ icon: 'receipt', title: 'فاکتوری ثبت نشده است' }));
      return;
    }
    for (const inv of [...invoices].reverse()) {
      listHost.appendChild(
        el('div', { class: 'platform-row' }, [
          el('div', { class: 'platform-row__main' }, [
            el('span', { class: 'platform-row__name' }, [inv.businessName]),
            el('span', { class: 'platform-row__meta' }, [
              `${planLabel(inv.plan)} · ${formatMoney(inv.amount)} تومان · ${formatDateTime(inv.paidAt)}`,
            ]),
          ]),
          iconBtn('trash', 'حذف', async () => {
            const ok = await confirmModal({ title: 'حذف فاکتور', message: 'این فاکتور حذف شود؟', confirmLabel: 'حذف', danger: true });
            if (!ok) return;
            deletePlatformInvoice(inv.id);
            refresh();
            refreshStats();
          }),
        ]),
      );
    }
  }

  const form = el('form', { class: 'form' }, [
    field('نام کسب‌وکار', nameInput),
    field('پلن', planSelect),
    field('مبلغ (تومان)', amountInput),
    el('div', { class: 'modal-actions' }, [el('button', { type: 'submit', class: 'btn btn-primary' }, ['ثبت فاکتور'])]),
  ]);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const businessName = nameInput.value.trim();
    const amount = parseNumberInput(amountInput);
    if (!businessName || amount <= 0) {
      showToast('نام کسب‌وکار و مبلغ معتبر را وارد کنید', 'error');
      return;
    }
    addPlatformInvoice({ businessName, plan: planSelect.value as PaidSubscriptionPlan, amount, paidAt: new Date().toISOString() });
    nameInput.value = '';
    amountInput.value = '';
    refresh();
    refreshStats();
    showToast('فاکتور ثبت شد', 'success');
  });

  container.append(settingsCard('ثبت فاکتور جدید', form), settingsCard('گزارش درآمد پلتفرم', el('div', { class: 'form' }, [totalEl, listHost])));

  refresh();
}

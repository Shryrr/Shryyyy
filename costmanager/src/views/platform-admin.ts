import { confirmModal, openModal } from '../components/modal';
import { showToast } from '../components/toast';
import { el, emptyState, field, iconBtn, iconTextBtn, kpiCard, numberInput, parseNumberInput, selectEl } from '../utils/dom';
import { svgIcon } from '../utils/icons';
import { formatBusinessType, formatDateTime, formatMoney, toPersian } from '../utils/format';
import {
  addPlatformInvoice,
  deletePlatformInvoice,
  getPlatformPaymentCard,
  listPlatformBroadcasts,
  listPlatformInvoices,
  platformLockedUntil,
  recordPlatformBroadcast,
  recordPlatformFailedAttempt,
  resetPlatformLoginAttempts,
  setPlatformOwnerSession,
  setPlatformPaymentCard,
  setPlatformPricing,
} from '../platform-owner';
import { api, ApiError } from '../utils/api';
import type { ApiPlatformBusiness, ApiSubscriptionPayment } from '../utils/api';
import type { BusinessType, PaidSubscriptionPlan } from '../types';

const PLAN_OPTIONS: { value: PaidSubscriptionPlan; label: string }[] = [
  { value: '1m', label: '۱ ماهه' },
  { value: '3m', label: '۳ ماهه' },
  { value: '6m', label: '۶ ماهه' },
  { value: '12m', label: '۱۲ ماهه' },
];

type Tab = 'businesses' | 'pending' | 'pricing' | 'broadcast' | 'revenue';

function planLabel(plan: PaidSubscriptionPlan): string {
  return PLAN_OPTIONS.find((p) => p.value === plan)?.label ?? plan;
}

function subscriptionStatusLabel(status: string): string {
  if (status === 'trial') return 'دوره آزمایشی';
  if (status === 'pending_payment') return 'در انتظار پرداخت';
  if (status === 'expired') return 'منقضی‌شده';
  return 'فعال';
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
    try {
      await api.platformLogin(username, password);
    } catch (err) {
      const until = recordPlatformFailedAttempt();
      if (until) {
        tickLock();
        lockTimer = setInterval(tickLock, 1000);
      } else {
        showError(err instanceof ApiError ? err.message || 'نام کاربری یا رمز عبور اشتباه است' : 'نام کاربری یا رمز عبور اشتباه است');
      }
      return;
    }
    resetPlatformLoginAttempts();
    if (lockTimer) clearInterval(lockTimer);
    setPlatformOwnerSession(true);
    renderPlatformAdminPanel(container, () => { location.hash = ''; location.reload(); });
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
    { id: 'pending', label: 'پرداخت‌های در انتظار', render: renderPendingPaymentsTab },
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
  const broadcasts = listPlatformBroadcasts();

  const businessesCard = kpiCard('building', 'کسب‌وکارها', '…');
  const activeCard = kpiCard('check', 'فعال', '…');
  const trialCard = kpiCard('clock', 'دوره آزمایشی', '…');
  const revenueCard = kpiCard('wallet', 'درآمد کل پلتفرم', '…');
  host.append(businessesCard, activeCard, trialCard, revenueCard, kpiCard('mail', 'پیام‌های ارسالی', toPersian(broadcasts.length)));

  void api.platformMetrics().then((metrics) => {
    const set = (card: HTMLElement, text: string) => {
      const valueEl = card.querySelector('.kpi-card__value');
      if (valueEl) valueEl.textContent = text;
    };
    set(businessesCard, toPersian(metrics.total));
    set(activeCard, toPersian(metrics.active));
    set(trialCard, toPersian(metrics.trial));
    set(revenueCard, `${formatMoney(metrics.totalRevenue)} ت`);
  }).catch(() => {});
}

function renderBusinessesTab(container: HTMLElement): void {
  const listHost = el('div', { class: 'platform-list' });
  const refreshBtn = iconTextBtn('refresh-cw', 'بروزرسانی', 'btn btn-secondary', () => void load());

  container.append(el('div', { class: 'settings-actions' }, [refreshBtn]), listHost);

  function editSubscription(b: ApiPlatformBusiness): void {
    const planSelect = selectEl(PLAN_OPTIONS, (b.subscriptionPlan as PaidSubscriptionPlan) ?? '1m');
    const statusSelect = selectEl(
      [
        { value: 'trial', label: 'دوره آزمایشی' },
        { value: 'pending_payment', label: 'در انتظار پرداخت' },
        { value: 'active', label: 'فعال' },
        { value: 'expired', label: 'منقضی‌شده' },
      ],
      b.subscriptionStatus,
    );
    const expiryInput = el('input', { type: 'date', class: 'input', value: b.subscriptionExpires.slice(0, 10) }) as HTMLInputElement;

    const body = el('form', { class: 'form' }, [
      field('پلن اشتراک', planSelect),
      field('وضعیت', statusSelect),
      field('تاریخ انقضا', expiryInput),
      el('div', { class: 'modal-actions' }, [
        el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
        el('button', { type: 'submit', class: 'btn btn-primary' }, ['ذخیره']),
      ]),
    ]);

    body.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api.updateBusinessSubscription(b.id, {
          plan: planSelect.value,
          status: statusSelect.value,
          expiresAt: expiryInput.value ? new Date(expiryInput.value).toISOString() : undefined,
        });
        showToast('اشتراک بروزرسانی شد', 'success');
        modal.close();
        refreshStats();
        void load();
      } catch (err) {
        showToast(err instanceof ApiError ? err.message || 'خطا در بروزرسانی اشتراک' : 'خطا در بروزرسانی اشتراک', 'error');
      }
    });

    const modal = openModal({ title: `ویرایش اشتراک — ${b.name}`, body });
  }

  async function load(): Promise<void> {
    listHost.innerHTML = '';
    listHost.appendChild(el('p', { class: 'form-hint' }, ['در حال دریافت فهرست کسب‌وکارها…']));
    let businesses: ApiPlatformBusiness[];
    try {
      businesses = await api.listBusinesses();
    } catch (err) {
      listHost.innerHTML = '';
      showToast(err instanceof ApiError ? err.message || 'خطا در دریافت فهرست کسب‌وکارها' : 'خطا در دریافت فهرست کسب‌وکارها', 'error');
      return;
    }
    listHost.innerHTML = '';
    if (!businesses.length) {
      listHost.appendChild(emptyState({ icon: 'building', title: 'کسب‌وکاری یافت نشد' }));
      return;
    }
    for (const b of businesses) {
      listHost.appendChild(
        el('div', { class: 'platform-row' }, [
          el('div', { class: 'platform-row__main' }, [
            el('span', { class: 'platform-row__name' }, [b.name]),
            el('span', { class: 'platform-row__meta' }, [
              [
                formatBusinessType(b.type as BusinessType),
                `${subscriptionStatusLabel(b.subscriptionStatus)} · ${planLabel(b.subscriptionPlan as PaidSubscriptionPlan)}`,
                `انقضا: ${formatDateTime(b.subscriptionExpires)}`,
                `${toPersian(b.userCount)} کاربر`,
                b.lastSyncAt ? `آخرین همگام‌سازی: ${formatDateTime(b.lastSyncAt)}` : 'هنوز همگام‌سازی نشده',
              ].join(' · '),
            ]),
          ]),
          iconBtn('edit', 'ویرایش اشتراک', () => void editSubscription(b)),
        ]),
      );
    }
  }

  void load();
}

function renderPendingPaymentsTab(container: HTMLElement): void {
  const listHost = el('div', { class: 'platform-list' });
  const refreshBtn = iconTextBtn('refresh-cw', 'بروزرسانی', 'btn btn-secondary', () => void load());
  container.append(el('div', { class: 'settings-actions' }, [refreshBtn]), listHost);

  async function decide(payment: ApiSubscriptionPayment, approve: boolean): Promise<void> {
    const confirmed = await confirmModal({
      title: approve ? 'تایید پرداخت' : 'رد پرداخت',
      message: approve
        ? `پرداخت ${formatMoney(payment.amount)} تومانی برای «${payment.business_name ?? payment.business_id}» تایید و اشتراک تمدید شود؟`
        : `پرداخت «${payment.business_name ?? payment.business_id}» رد شود؟`,
      confirmLabel: approve ? 'تایید' : 'رد کردن',
      danger: !approve,
    });
    if (!confirmed) return;
    try {
      if (approve) await api.approvePayment(payment.id);
      else await api.rejectPayment(payment.id);
      showToast(approve ? 'پرداخت تایید و اشتراک تمدید شد' : 'پرداخت رد شد', 'success');
      refreshStats();
      void load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message || 'خطایی رخ داد' : 'خطایی رخ داد', 'error');
    }
  }

  async function load(): Promise<void> {
    listHost.innerHTML = '';
    listHost.appendChild(el('p', { class: 'form-hint' }, ['در حال دریافت پرداخت‌های در انتظار…']));
    let payments: ApiSubscriptionPayment[];
    try {
      payments = await api.listPendingPayments();
    } catch (err) {
      listHost.innerHTML = '';
      showToast(err instanceof ApiError ? err.message || 'خطا در دریافت پرداخت‌ها' : 'خطا در دریافت پرداخت‌ها', 'error');
      return;
    }
    listHost.innerHTML = '';
    if (!payments.length) {
      listHost.appendChild(emptyState({ icon: 'receipt', title: 'پرداخت در انتظاری وجود ندارد' }));
      return;
    }
    for (const p of payments) {
      listHost.appendChild(
        el('div', { class: 'platform-row' }, [
          el('div', { class: 'platform-row__main' }, [
            el('span', { class: 'platform-row__name' }, [p.business_name ?? p.business_id]),
            el('span', { class: 'platform-row__meta' }, [
              [
                `${planLabel(p.plan)} · ${formatMoney(p.amount)} تومان`,
                p.transfer_ref ? `پیگیری: ${p.transfer_ref}` : null,
                formatDateTime(p.submitted_at),
              ]
                .filter(Boolean)
                .join(' · '),
            ]),
          ]),
          el('div', { class: 'settings-actions' }, [
            iconBtn('check', 'تایید', () => void decide(p, true)),
            iconBtn('x', 'رد', () => void decide(p, false)),
          ]),
        ]),
      );
    }
  }

  void load();
}

function renderPricingTab(container: HTMLElement): void {
  const inputs = new Map<PaidSubscriptionPlan, HTMLInputElement>();
  const rows = PLAN_OPTIONS.map((p) => {
    const input = numberInput(0);
    inputs.set(p.value, input);
    return field(`قیمت اشتراک ${p.label} (تومان)`, input);
  });

  const form = el('form', { class: 'form' }, [
    el('p', { class: 'form-hint' }, ['این تعرفه‌ها، قیمت پایه پلتفرم برای فروش اشتراک به کسب‌وکارهای جدید است.']),
    ...rows,
    el('div', { class: 'modal-actions' }, [el('button', { type: 'submit', class: 'btn btn-primary' }, ['ذخیره تعرفه‌ها'])]),
  ]);

  void api.getPlatformPricing().then((rows) => {
    for (const row of rows) inputs.get(row.plan)!.value = String(row.amount);
  }).catch(() => {});

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const local = {} as Record<PaidSubscriptionPlan, number>;
      for (const p of PLAN_OPTIONS) {
        const amount = parseNumberInput(inputs.get(p.value)!);
        await api.setPlatformPricing(p.value, amount);
        local[p.value] = amount;
      }
      setPlatformPricing(local);
      showToast('تعرفه‌های پلتفرم ذخیره شد', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message || 'خطا در ذخیره تعرفه‌ها' : 'خطا در ذخیره تعرفه‌ها', 'error');
    }
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
    try {
      await api.sendBroadcast(message);
      recordPlatformBroadcast(message);
      messageInput.value = '';
      renderHistory();
      refreshStats();
      showToast('پیام ارسال شد', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message || 'ارسال پیام ناموفق بود' : 'ارسال پیام ناموفق بود', 'error');
    }
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

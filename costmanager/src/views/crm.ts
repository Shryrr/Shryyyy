import * as db from '../db';
import { confirmModal, openModal } from '../components/modal';
import { destroyChart, palette, renderChart } from '../components/chart';
import { showToast } from '../components/toast';
import { customers, refreshCustomers, refreshSettings, refreshSmsLogs, settings, smsLogs } from '../store';
import { el, emptyState, field, kpiCard, numberInput, parseNumberInput, selectEl } from '../utils/dom';
import { formatDateTime, formatMoney, toPersian } from '../utils/format';
import { sendBulkSms } from '../utils/sms';
import type { RouteCleanup } from '../router';
import type { Customer, CustomerSegment, SmsLog } from '../types';

type Tab = 'customers' | 'segments' | 'sms' | 'loyalty' | 'report';

const DAY_MS = 24 * 60 * 60 * 1000;
const VIP_SPEND_THRESHOLD = 5_000_000;
const INACTIVE_DAYS = 60;
const NEW_CUSTOMER_DAYS = 30;
const SEGMENTS: CustomerSegment[] = ['vip', 'regular', 'new', 'inactive'];

const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  vip: 'ویژه (VIP)',
  regular: 'عادی',
  new: 'مشتری جدید',
  inactive: 'غیرفعال',
};
const SEGMENT_ICONS: Record<CustomerSegment, string> = { vip: '👑', regular: '🙂', new: '✨', inactive: '😴' };

/** Customers selected in the segmentation tab, carried over as the default recipient set in the bulk-SMS tab. */
const smsSelection = new Set<string>();

function daysSince(iso?: string): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / DAY_MS;
}

function customerSegment(c: Customer): CustomerSegment {
  if (daysSince(c.createdAt) <= NEW_CUSTOMER_DAYS && c.visitCount <= 1) return 'new';
  if (daysSince(c.lastVisitAt) > INACTIVE_DAYS) return 'inactive';
  if (c.totalSpent >= VIP_SPEND_THRESHOLD) return 'vip';
  return 'regular';
}

function settingsCard(title: string, body: HTMLElement): HTMLElement {
  return el('div', { class: 'settings-card' }, [el('h3', { class: 'settings-card__title' }, [title]), body]);
}

// ---------- Customers tab ----------

function openCustomerFormModal(existing?: Customer): void {
  const nameInput = el('input', { type: 'text', class: 'input', value: existing?.name ?? '' });
  const phoneInput = el('input', { type: 'tel', class: 'input', value: existing?.phone ?? '' });
  const notesInput = el('input', { type: 'text', class: 'input', value: existing?.notes ?? '' });

  const body = el('form', { class: 'form' }, [
    field('نام مشتری', nameInput),
    field('شماره موبایل', phoneInput),
    field('یادداشت (اختیاری)', notesInput),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, [existing ? 'ذخیره تغییرات' : 'افزودن مشتری']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    if (!name || !phone) {
      showToast('نام و شماره موبایل الزامی است', 'error');
      return;
    }
    const notes = notesInput.value.trim() || undefined;
    if (existing) await db.updateCustomer(existing.id, { name, phone, notes });
    else await db.createCustomer({ name, phone, notes });
    await refreshCustomers();
    showToast(existing ? 'تغییرات ذخیره شد' : 'مشتری افزوده شد', 'success');
    modal.close();
  });

  const modal = openModal({ title: existing ? 'ویرایش مشتری' : 'افزودن مشتری', body });
}

async function handleDeleteCustomer(customer: Customer): Promise<void> {
  const confirmed = await confirmModal({
    title: 'حذف مشتری',
    message: `مشتری «${customer.name}» برای همیشه حذف می‌شود.`,
    confirmLabel: 'حذف',
    danger: true,
  });
  if (!confirmed) return;
  smsSelection.delete(customer.id);
  await db.deleteCustomer(customer.id);
  await refreshCustomers();
  showToast('مشتری حذف شد', 'success');
}

function openRecordVisitModal(customer: Customer): void {
  const amountInput = numberInput(0);
  const body = el('form', { class: 'form' }, [
    field('مبلغ خرید (تومان)', amountInput, 'به ازای هر ۱۰٬۰۰۰ تومان، ۱ امتیاز وفاداری ثبت می‌شود.'),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['ثبت بازدید']),
    ]),
  ]);
  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseNumberInput(amountInput);
    await db.recordCustomerVisit(customer.id, amount);
    await refreshCustomers();
    showToast('بازدید ثبت شد', 'success');
    modal.close();
  });
  const modal = openModal({ title: `ثبت بازدید — ${customer.name}`, body });
}

function renderCustomerRow(customer: Customer): HTMLElement {
  const segment = customerSegment(customer);
  return el('div', { class: 'expense-row' }, [
    el('div', { class: 'expense-row__main' }, [
      el('div', { class: 'expense-row__title-row' }, [
        el('span', { class: 'expense-row__name' }, [customer.name]),
        el('span', { class: 'badge' }, [`${SEGMENT_ICONS[segment]} ${SEGMENT_LABELS[segment]}`]),
      ]),
      el('div', { class: 'expense-row__meta' }, [
        `${customer.phone} · ${toPersian(customer.visitCount)} بازدید · ${formatMoney(customer.totalSpent)} · ${toPersian(customer.loyaltyPoints)} امتیاز`,
      ]),
    ]),
    el('div', { class: 'expense-row__actions' }, [
      el('button', { class: 'icon-btn', type: 'button', title: 'ثبت بازدید', onclick: () => openRecordVisitModal(customer) }, ['🧾']),
      el('button', { class: 'icon-btn', type: 'button', title: 'ویرایش', onclick: () => openCustomerFormModal(customer) }, ['✏️']),
      el('button', { class: 'icon-btn', type: 'button', title: 'حذف', onclick: () => handleDeleteCustomer(customer) }, ['🗑️']),
    ]),
  ]);
}

function renderCustomersTab(container: HTMLElement): () => void {
  const searchInput = el('input', { type: 'search', class: 'input', placeholder: 'جستجو بر اساس نام یا شماره موبایل' });
  const listEl = el('div', { class: 'expense-list' });
  container.append(
    el('div', { class: 'tab-toolbar' }, [
      searchInput,
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => openCustomerFormModal() }, ['+ افزودن مشتری']),
    ]),
    listEl,
  );

  function render(): void {
    listEl.innerHTML = '';
    const all = customers.get();
    const query = searchInput.value.trim();
    const list = [...all]
      .filter((c) => !query || c.name.includes(query) || c.phone.includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    if (!list.length) {
      listEl.appendChild(
        emptyState({
          icon: '👤',
          title: all.length ? 'موردی یافت نشد' : 'هنوز مشتری‌ای ثبت نشده است',
          message: all.length ? 'عبارت جستجو را تغییر دهید.' : 'اولین مشتری را اضافه کنید.',
          ctaLabel: all.length ? undefined : 'افزودن مشتری',
          onCta: all.length ? undefined : () => openCustomerFormModal(),
        }),
      );
      return;
    }
    for (const c of list) listEl.appendChild(renderCustomerRow(c));
  }

  searchInput.addEventListener('input', render);
  const unsub = customers.subscribe(render);
  return () => unsub();
}

// ---------- Segmentation tab ----------

function renderSegmentsTab(container: HTMLElement): () => void {
  const summaryEl = el('div', { class: 'kpi-grid' });
  const listEl = el('div', { class: 'expense-list' });
  let activeSegment: CustomerSegment | 'all' = 'all';

  container.append(summaryEl, listEl);

  function renderRow(c: Customer): HTMLElement {
    const checkbox = el('input', {
      type: 'checkbox',
      checked: smsSelection.has(c.id),
      onchange: (e: Event) => {
        if ((e.target as HTMLInputElement).checked) smsSelection.add(c.id);
        else smsSelection.delete(c.id);
      },
    });
    return el('label', { class: 'expense-row' }, [
      checkbox,
      el('div', { class: 'expense-row__main' }, [
        el('span', { class: 'expense-row__name' }, [c.name]),
        el('div', { class: 'expense-row__meta' }, [`${c.phone} · ${formatMoney(c.totalSpent)}`]),
      ]),
    ]);
  }

  function render(): void {
    const list = customers.get();
    const bySegment = new Map<CustomerSegment, Customer[]>(SEGMENTS.map((s) => [s, []]));
    for (const c of list) bySegment.get(customerSegment(c))!.push(c);

    summaryEl.innerHTML = '';
    summaryEl.appendChild(
      kpiCard('👥', 'همه مشتریان', toPersian(list.length), undefined, () => {
        activeSegment = 'all';
        renderList();
      }),
    );
    for (const seg of SEGMENTS) {
      summaryEl.appendChild(
        kpiCard(SEGMENT_ICONS[seg], SEGMENT_LABELS[seg], toPersian(bySegment.get(seg)!.length), undefined, () => {
          activeSegment = seg;
          renderList();
        }),
      );
    }

    function renderList(): void {
      listEl.innerHTML = '';
      const shown = activeSegment === 'all' ? list : bySegment.get(activeSegment)!;
      if (!shown.length) {
        listEl.appendChild(emptyState({ icon: '🔍', title: 'مشتری‌ای در این بخش نیست' }));
        return;
      }
      for (const c of shown) listEl.appendChild(renderRow(c));
    }

    renderList();
  }

  const unsub = customers.subscribe(render);
  return () => unsub();
}

// ---------- Bulk SMS tab ----------

type RecipientMode = 'selected' | 'all' | 'manual';

function renderSmsLogRow(log: SmsLog): HTMLElement {
  const preview = log.message.length > 40 ? `${log.message.slice(0, 40)}…` : log.message;
  return el('div', { class: 'expense-row' }, [
    el('div', { class: 'expense-row__main' }, [
      el('div', { class: 'expense-row__title-row' }, [
        el('span', { class: 'expense-row__name' }, [preview]),
        el('span', { class: `badge${log.status === 'failed' ? ' badge--danger' : ''}` }, [
          log.status === 'sent' ? '✓ ارسال شد' : '✗ ناموفق',
        ]),
      ]),
      el('div', { class: 'expense-row__meta' }, [`${toPersian(log.recipients.length)} گیرنده · ${formatDateTime(log.sentAt)}`]),
    ]),
  ]);
}

function renderSmsTab(container: HTMLElement): () => void {
  const s = settings.get();

  const apiKeyInput = el('input', { type: 'text', class: 'input', value: s?.kavenegarApiKey ?? '', placeholder: 'کلید API کاوه‌نگار' });
  const senderInput = el('input', {
    type: 'text', class: 'input', value: s?.kavenegarSenderLine ?? '', placeholder: 'شماره خط ارسال (اختیاری)',
  });
  const saveConfigBtn = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-secondary btn-sm',
      onclick: async () => {
        await db.updateSettings({
          kavenegarApiKey: apiKeyInput.value.trim() || undefined,
          kavenegarSenderLine: senderInput.value.trim() || undefined,
        });
        await refreshSettings();
        showToast('تنظیمات پیامک ذخیره شد', 'success');
      },
    },
    ['ذخیره تنظیمات'],
  );

  const configBody = el('div', { class: 'form' }, [
    field('کلید API کاوه‌نگار', apiKeyInput),
    field('شماره خط ارسال', senderInput),
    el('div', { class: 'modal-actions' }, [saveConfigBtn]),
  ]);

  const modeSelect = selectEl(
    [
      { value: 'selected', label: `مشتریان انتخاب‌شده در بخش‌بندی (${toPersian(smsSelection.size)})` },
      { value: 'all', label: 'همه مشتریان' },
      { value: 'manual', label: 'وارد کردن دستی شماره‌ها' },
    ],
    'selected',
  );
  const manualInput = el('textarea', { class: 'input', rows: 3, placeholder: '۰۹xxxxxxxxx، ۰۹xxxxxxxxx', hidden: true });
  modeSelect.addEventListener('change', () => {
    manualInput.hidden = (modeSelect as HTMLSelectElement).value !== 'manual';
  });

  const messageInput = el('textarea', { class: 'input', rows: 4, placeholder: 'متن پیامک...' });
  const sendBtn = el('button', { type: 'button', class: 'btn btn-primary', onclick: () => void handleSend() }, ['ارسال پیامک گروهی']);

  const composeBody = el('div', { class: 'form' }, [
    field('گیرندگان', modeSelect),
    manualInput,
    field('متن پیامک', messageInput),
    el('div', { class: 'modal-actions' }, [sendBtn]),
  ]);

  const historyEl = el('div', { class: 'expense-list' });

  container.append(
    settingsCard('تنظیمات کاوه‌نگار', configBody),
    settingsCard('ارسال پیامک گروهی', composeBody),
    el('h3', { class: 'settings-card__title' }, ['تاریخچهٔ ارسال']),
    historyEl,
  );

  async function handleSend(): Promise<void> {
    const message = messageInput.value.trim();
    if (!message) {
      showToast('متن پیامک را وارد کنید', 'error');
      return;
    }

    let receptors: string[];
    const mode = (modeSelect as HTMLSelectElement).value as RecipientMode;
    if (mode === 'all') receptors = customers.get().map((c) => c.phone);
    else if (mode === 'selected') receptors = customers.get().filter((c) => smsSelection.has(c.id)).map((c) => c.phone);
    else receptors = (manualInput as HTMLTextAreaElement).value.split(/[,\n]/).map((p) => p.trim()).filter(Boolean);
    receptors = Array.from(new Set(receptors));

    if (!receptors.length) {
      showToast('گیرنده‌ای انتخاب نشده است', 'error');
      return;
    }

    const confirmed = await confirmModal({
      title: 'ارسال پیامک گروهی',
      message: `پیامک برای ${toPersian(receptors.length)} گیرنده ارسال می‌شود. ادامه می‌دهید؟`,
      confirmLabel: 'ارسال',
    });
    if (!confirmed) return;

    sendBtn.setAttribute('disabled', 'true');
    const result = await sendBulkSms(
      { apiKey: apiKeyInput.value.trim(), senderLine: senderInput.value.trim() || undefined },
      receptors,
      message,
    );
    sendBtn.removeAttribute('disabled');

    await db.recordSmsLog({
      recipients: receptors,
      message,
      status: result.ok ? 'sent' : 'failed',
      error: result.error,
      sentAt: new Date().toISOString(),
    });
    await refreshSmsLogs();

    if (result.ok) showToast('پیامک با موفقیت ارسال شد', 'success');
    else showToast(result.error ?? 'ارسال پیامک ناموفق بود', 'error');
  }

  function renderHistory(): void {
    historyEl.innerHTML = '';
    const list = [...smsLogs.get()].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    if (!list.length) {
      historyEl.appendChild(emptyState({ icon: '📨', title: 'هنوز پیامکی ارسال نشده است' }));
      return;
    }
    for (const log of list) historyEl.appendChild(renderSmsLogRow(log));
  }

  const unsub = smsLogs.subscribe(renderHistory);
  return () => unsub();
}

// ---------- Loyalty tab ----------

function openAdjustPointsModal(customer: Customer): void {
  const deltaInput = numberInput(0);
  const body = el('form', { class: 'form' }, [
    field('تعداد امتیاز (مثبت برای افزایش، منفی برای کاهش)', deltaInput),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['ثبت']),
    ]),
  ]);
  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const delta = Math.trunc(parseNumberInput(deltaInput));
    if (delta) {
      await db.adjustLoyaltyPoints(customer.id, delta);
      await refreshCustomers();
      showToast('امتیاز وفاداری به‌روزرسانی شد', 'success');
    }
    modal.close();
  });
  const modal = openModal({ title: `ویرایش امتیاز — ${customer.name}`, body });
}

function renderLoyaltyRow(c: Customer, rank: number): HTMLElement {
  return el('div', { class: 'expense-row' }, [
    el('div', { class: 'expense-row__main' }, [
      el('div', { class: 'expense-row__title-row' }, [
        el('span', { class: 'badge' }, [`#${toPersian(rank)}`]),
        el('span', { class: 'expense-row__name' }, [c.name]),
      ]),
      el('div', { class: 'expense-row__meta' }, [`${toPersian(c.loyaltyPoints)} امتیاز · ${c.phone}`]),
    ]),
    el('div', { class: 'expense-row__actions' }, [
      el('button', { class: 'icon-btn', type: 'button', title: 'ویرایش امتیاز', onclick: () => openAdjustPointsModal(c) }, ['🏆']),
    ]),
  ]);
}

function renderLoyaltyTab(container: HTMLElement): () => void {
  const listEl = el('div', { class: 'expense-list' });
  container.append(
    el('div', { class: 'tab-toolbar' }, [
      el('p', { class: 'form-hint' }, ['به ازای هر ۱۰٬۰۰۰ تومان خرید، ۱ امتیاز وفاداری ثبت می‌شود.']),
    ]),
    listEl,
  );

  function render(): void {
    listEl.innerHTML = '';
    const list = [...customers.get()].filter((c) => c.loyaltyPoints > 0).sort((a, b) => b.loyaltyPoints - a.loyaltyPoints);
    if (!list.length) {
      listEl.appendChild(
        emptyState({
          icon: '🏆',
          title: 'هنوز امتیاز وفاداری ثبت نشده است',
          message: 'با ثبت بازدید مشتریان از تب «مشتریان»، امتیاز وفاداری انباشته می‌شود.',
        }),
      );
      return;
    }
    list.forEach((c, idx) => listEl.appendChild(renderLoyaltyRow(c, idx + 1)));
  }

  const unsub = customers.subscribe(render);
  return () => unsub();
}

// ---------- Report tab ----------

const SEGMENT_CHART_COLORS: Record<CustomerSegment, string> = {
  vip: palette.amber, regular: palette.primary, new: palette.mint, inactive: palette.red,
};

function renderReportTab(container: HTMLElement): () => void {
  const statsEl = el('div', { class: 'kpi-grid' });
  const canvas = el('canvas');
  const chartCard = el('div', { class: 'chart-card' }, [
    el('h3', { class: 'chart-card__title' }, ['توزیع بخش‌بندی مشتریان']),
    el('div', { class: 'chart-card__canvas-wrap' }, [canvas]),
  ]);
  const topListEl = el('div', { class: 'expense-list' });

  container.append(statsEl, chartCard, el('h3', { class: 'settings-card__title' }, ['مشتریان برتر']), topListEl);

  function render(): void {
    const list = customers.get();
    const totalSpent = list.reduce((sum, c) => sum + c.totalSpent, 0);
    const avgSpend = list.length ? totalSpent / list.length : 0;

    statsEl.innerHTML = '';
    statsEl.appendChild(kpiCard('👥', 'تعداد مشتریان', toPersian(list.length)));
    statsEl.appendChild(kpiCard('💰', 'مجموع خرید مشتریان', formatMoney(totalSpent)));
    statsEl.appendChild(kpiCard('📊', 'میانگین خرید هر مشتری', formatMoney(avgSpend)));
    statsEl.appendChild(kpiCard('📨', 'تعداد پیامک‌های ارسالی', toPersian(smsLogs.get().length)));

    const bySegment = new Map<CustomerSegment, number>();
    for (const c of list) {
      const seg = customerSegment(c);
      bySegment.set(seg, (bySegment.get(seg) ?? 0) + 1);
    }
    const segs = SEGMENTS.filter((s) => (bySegment.get(s) ?? 0) > 0);

    if (!segs.length) {
      destroyChart(canvas);
      chartCard.style.display = 'none';
    } else {
      chartCard.style.display = '';
      renderChart(canvas, {
        type: 'doughnut',
        data: {
          labels: segs.map((s) => SEGMENT_LABELS[s]),
          datasets: [{ data: segs.map((s) => bySegment.get(s) ?? 0), backgroundColor: segs.map((s) => SEGMENT_CHART_COLORS[s]) }],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }

    topListEl.innerHTML = '';
    const top = [...list].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);
    if (!top.length) {
      topListEl.appendChild(emptyState({ icon: '🏅', title: 'هنوز داده‌ای برای نمایش وجود ندارد' }));
      return;
    }
    top.forEach((c, idx) => {
      topListEl.appendChild(
        el('div', { class: 'expense-row' }, [
          el('div', { class: 'expense-row__main' }, [
            el('div', { class: 'expense-row__title-row' }, [
              el('span', { class: 'badge' }, [`#${toPersian(idx + 1)}`]),
              el('span', { class: 'expense-row__name' }, [c.name]),
            ]),
            el('div', { class: 'expense-row__meta' }, [`${formatMoney(c.totalSpent)} · ${toPersian(c.visitCount)} بازدید`]),
          ]),
        ]),
      );
    });
  }

  const unsubC = customers.subscribe(render);
  const unsubS = smsLogs.subscribe(render);
  return () => {
    unsubC();
    unsubS();
    destroyChart(canvas);
  };
}

// ---------- View shell with tabs ----------

export async function renderCrm(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-crm' });
  container.appendChild(root);

  const tabsEl = el('div', { class: 'tabs' });
  const contentEl = el('div', { class: 'tab-content' });

  root.append(
    el('div', { class: 'view-header' }, [el('h1', { class: 'view-header__title' }, ['مدیریت ارتباط با مشتری (CRM)'])]),
    tabsEl,
    contentEl,
  );

  const tabs: { id: Tab; label: string; render: (c: HTMLElement) => () => void }[] = [
    { id: 'customers', label: 'مشتریان', render: renderCustomersTab },
    { id: 'segments', label: 'بخش‌بندی', render: renderSegmentsTab },
    { id: 'sms', label: 'پیامک گروهی', render: renderSmsTab },
    { id: 'loyalty', label: 'باشگاه وفاداری', render: renderLoyaltyTab },
    { id: 'report', label: 'گزارش CRM', render: renderReportTab },
  ];

  let activeTab: Tab = 'customers';
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

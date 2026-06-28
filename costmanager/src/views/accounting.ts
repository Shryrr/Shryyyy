import { destroyChart, palette, renderChart } from '../components/chart';
import { confirmModal, openModal } from '../components/modal';
import { showToast } from '../components/toast';
import { el, emptyState, field, kpiCard, numberInput, parseNumberInput, selectEl } from '../utils/dom';
import { formatDateShort, formatIngredientCategory, formatMoney, formatMoneyShort, formatPct, formatUnit, toPersian } from '../utils/format';
import { downloadCSV, downloadJSON } from '../utils/export';
import type { RouteCleanup } from '../router';
import {
  employees, expenses, ingredients, ingredientsById, refreshSettings, refreshSupplierPayments, refreshSuppliers, sales, settings, suppliers,
  supplierPayments,
} from '../store';
import {
  avgGrossMarginRatio,
  dailyBreakEven,
  dailySeries,
  monthlyFixedCost,
  periodProfitLoss,
  salesInPeriod,
  type PeriodPL,
} from '../utils/calc';
import * as db from '../db';
import { renderExpensesTab, renderPayrollTab, renderSummaryTab } from './expenses';
import { renderImportTab, renderSalesLogTab } from './sales';
import type { Sale, SaleSource, Supplier, SupplierPayment } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

type AccountingTab = 'dashboard' | 'expenses' | 'sales-log' | 'import' | 'suppliers-vat' | 'reports';

const PERIOD_OPTIONS = [
  { value: '7', label: '۷ روز گذشته' },
  { value: '30', label: '۳۰ روز گذشته' },
  { value: '90', label: '۹۰ روز گذشته' },
  { value: '365', label: 'یک سال گذشته' },
];

function plRow(label: string, value: string, opts?: { strong?: boolean; tone?: 'positive' | 'negative' }): HTMLElement {
  return el(
    'div',
    { class: `pl-row${opts?.strong ? ' pl-row--strong' : ''}${opts?.tone ? ` pl-row--${opts.tone}` : ''}` },
    [el('span', { class: 'pl-row__label' }, [label]), el('span', { class: 'pl-row__value' }, [value])],
  );
}

function plStatement(pl: PeriodPL, periodLabel: string): HTMLElement {
  return el('div', { class: 'pl-statement' }, [
    el('h3', { class: 'pl-statement__title' }, [`صورت سود و زیان — ${periodLabel}`]),
    plRow('درآمد فروش', formatMoney(pl.revenue)),
    plRow('هزینه‌های متغیر (بهای تمام‌شده مواد اولیه)', `(${formatMoney(pl.cogs)})`),
    el('hr'),
    plRow('سود ناخالص', formatMoney(pl.grossProfit), { strong: true }),
    plRow('حاشیه سود ناخالص', formatPct(pl.grossMarginPct)),
    plRow('هزینه‌های ثابت (نسبت به دوره)', `(${formatMoney(pl.fixedProrated)})`),
    el('hr'),
    plRow('سود خالص', formatMoney(pl.netProfit), { strong: true, tone: pl.netProfit >= 0 ? 'positive' : 'negative' }),
    plRow('حاشیه سود خالص', formatPct(pl.netMarginPct)),
  ]);
}

const SOURCE_LABELS: Record<SaleSource, string> = {
  manual: 'ثبت دستی',
  cashier: 'صندوق فروش',
  snappfood: 'اسنپ‌فود',
  bulk: 'فروش کلی (تخمینی)',
};

const SOURCE_COLORS: Record<SaleSource, string> = {
  manual: palette.primary,
  cashier: palette.mint,
  snappfood: palette.coral,
  bulk: palette.amber,
};

function effectiveSource(s: Sale): SaleSource {
  return s.source ?? (s.type === 'bulk' ? 'bulk' : 'manual');
}

interface SourceBreakdownEntry {
  source: SaleSource;
  count: number;
  revenue: number;
  cogs: number;
}

function bySourceBreakdown(periodSales: Sale[]): SourceBreakdownEntry[] {
  const map = new Map<SaleSource, SourceBreakdownEntry>();
  for (const s of periodSales) {
    const source = effectiveSource(s);
    const entry = map.get(source) ?? { source, count: 0, revenue: 0, cogs: 0 };
    entry.count += 1;
    entry.revenue += s.unitSalePrice * s.quantity;
    entry.cogs += s.unitCost * s.quantity;
    map.set(source, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

function sourceBreakdownRow(label: string, count: string, revenue: string, cogs: string, profit: string, opts?: { strong?: boolean }): HTMLElement {
  return el('div', { class: `source-breakdown-row${opts?.strong ? ' source-breakdown-row--strong' : ''}` }, [
    el('span', { class: 'source-breakdown-row__name' }, [label]),
    el('span', {}, [count]),
    el('span', {}, [revenue]),
    el('span', {}, [cogs]),
    el('span', {}, [profit]),
  ]);
}

function sourceBreakdownPanel(rows: SourceBreakdownEntry[], canvas: HTMLCanvasElement): HTMLElement {
  if (!rows.length) {
    return el('div', { class: 'chart-card' }, [
      el('h3', { class: 'chart-card__title' }, ['گزارش تفکیک فروش بر اساس منبع']),
      emptyState({ icon: '📊', title: 'فروشی در این دوره ثبت نشده است' }),
    ]);
  }

  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalCogs = rows.reduce((s, r) => s + r.cogs, 0);

  const table = el('div', { class: 'source-breakdown-table' }, [
    sourceBreakdownRow('منبع', 'تعداد', 'فروش', 'بهای تمام‌شده', 'سود'),
    ...rows.map((r) =>
      sourceBreakdownRow(SOURCE_LABELS[r.source], toPersian(r.count), formatMoney(r.revenue), formatMoney(r.cogs), formatMoney(r.revenue - r.cogs)),
    ),
    sourceBreakdownRow(
      'مجموع',
      toPersian(totalCount),
      formatMoney(totalRevenue),
      formatMoney(totalCogs),
      formatMoney(totalRevenue - totalCogs),
      { strong: true },
    ),
  ]);

  renderChart(canvas, {
    type: 'doughnut',
    data: {
      labels: rows.map((r) => SOURCE_LABELS[r.source]),
      datasets: [{ data: rows.map((r) => r.revenue), backgroundColor: rows.map((r) => SOURCE_COLORS[r.source]) }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });

  return el('div', { class: 'accounting-grid' }, [
    el('div', { class: 'chart-card' }, [el('h3', { class: 'chart-card__title' }, ['گزارش تفکیک فروش بر اساس منبع']), table]),
    el('div', { class: 'chart-card' }, [
      el('h3', { class: 'chart-card__title' }, ['سهم هر منبع از فروش']),
      el('div', { class: 'chart-card__canvas-wrap' }, [canvas]),
    ]),
  ]);
}

function breakEvenPanel(monthlyFixed: number, marginRatio: number): HTMLElement {
  const dailyFixed = monthlyFixed / 30;
  const breakEven = dailyBreakEven(monthlyFixed, marginRatio);
  const text =
    marginRatio > 0
      ? `با حاشیه سود ناخالص فعلی (${formatPct(marginRatio * 100)})، برای پوشش هزینهٔ ثابت روزانه (${formatMoney(dailyFixed)}) باید حداقل ${formatMoney(breakEven)} فروش روزانه داشته باشید.`
      : 'داده فروش کافی برای محاسبهٔ نقطهٔ سربه‌سر وجود ندارد.';
  return el('div', { class: 'breakeven-panel' }, [
    el('h3', { class: 'breakeven-panel__title' }, ['نقطهٔ سربه‌سر']),
    el('p', { class: 'breakeven-panel__text' }, [text]),
  ]);
}

// ---------- Tab 1: داشبورد مالی ----------

function renderFinancialDashboardTab(container: HTMLElement, onNavigateTab: (tab: AccountingTab) => void): () => void {
  const kpiContainer = el('div');
  const periodSelect = selectEl(PERIOD_OPTIONS, '30');
  const exportCsvBtn = el('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, ['خروجی CSV']);
  const exportJsonBtn = el('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, ['خروجی JSON']);
  const contentEl = el('div');

  container.append(kpiContainer, el('div', { class: 'toolbar' }, [periodSelect, exportCsvBtn, exportJsonBtn]), contentEl);

  let activeCanvas: HTMLCanvasElement | null = null;
  let sourceCanvas: HTMLCanvasElement | null = null;
  let currentPL: PeriodPL | null = null;
  let currentLabel = '';

  function render(): void {
    const now = new Date();
    const periodDays = Number(periodSelect.value);
    currentLabel = PERIOD_OPTIONS.find((o) => o.value === periodSelect.value)?.label ?? '';

    const periodStart = new Date(now.getTime() - periodDays * DAY_MS);
    const periodSales = salesInPeriod(sales.get(), periodStart, now);
    const monthlyFixed = monthlyFixedCost(expenses.get(), employees.get());
    const pl = periodProfitLoss(periodSales, monthlyFixed, periodDays);
    currentPL = pl;
    const marginRatio = avgGrossMarginRatio(sales.get(), now);

    kpiContainer.innerHTML = '';
    kpiContainer.appendChild(
      el('div', { class: 'kpi-grid' }, [
        kpiCard('💰', 'درآمد فروش دوره', formatMoneyShort(pl.revenue), undefined, () => onNavigateTab('sales-log')),
        kpiCard('📉', 'هزینه‌های متغیر دوره', formatMoneyShort(pl.cogs), undefined, () => onNavigateTab('sales-log')),
        kpiCard('🏢', 'هزینه‌های ثابت (نسبت به دوره)', formatMoneyShort(pl.fixedProrated), undefined, () => onNavigateTab('expenses')),
        kpiCard('📈', 'سود خالص دوره', formatMoneyShort(pl.netProfit), pl.netProfit >= 0 ? 'positive' : 'negative', () => onNavigateTab('reports')),
      ]),
    );

    if (activeCanvas) destroyChart(activeCanvas);
    if (sourceCanvas) destroyChart(sourceCanvas);
    contentEl.innerHTML = '';

    const canvas = el('canvas');
    activeCanvas = canvas;
    const sourceChartCanvas = el('canvas');
    sourceCanvas = sourceChartCanvas;

    contentEl.append(
      el('div', { class: 'accounting-grid' }, [
        plStatement(pl, currentLabel),
        el('div', { class: 'chart-card' }, [
          el('h3', { class: 'chart-card__title' }, ['روند درآمد، بهای تمام‌شده و سود ناخالص']),
          el('div', { class: 'chart-card__canvas-wrap' }, [canvas]),
        ]),
      ]),
      breakEvenPanel(monthlyFixed, marginRatio),
      sourceBreakdownPanel(bySourceBreakdown(periodSales), sourceChartCanvas),
    );

    const series = dailySeries(sales.get(), Math.min(periodDays, 30), now);
    renderChart(canvas, {
      type: 'line',
      data: {
        labels: series.map((d) => formatDateShort(d.date)),
        datasets: [
          { label: 'درآمد', data: series.map((d) => d.revenue), borderColor: palette.primary, backgroundColor: palette.primary, tension: 0.3 },
          { label: 'هزینهٔ متغیر', data: series.map((d) => d.cogs), borderColor: palette.coral, backgroundColor: palette.coral, tension: 0.3 },
          {
            label: 'سود ناخالص',
            data: series.map((d) => d.revenue - d.cogs),
            borderColor: palette.mint,
            backgroundColor: palette.mint,
            tension: 0.3,
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
    });
  }

  let scheduled = false;
  function scheduleRender(): void {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      render();
    });
  }

  exportCsvBtn.addEventListener('click', () => {
    if (!currentPL) return;
    downloadCSV(`profit-loss-${periodSelect.value}d.csv`, ['شرح', 'مقدار'], [
      ['دوره', currentLabel],
      ['درآمد فروش (تومان)', Math.round(currentPL.revenue)],
      ['هزینه‌های متغیر (تومان)', Math.round(currentPL.cogs)],
      ['سود ناخالص (تومان)', Math.round(currentPL.grossProfit)],
      ['حاشیه سود ناخالص (٪)', Number(currentPL.grossMarginPct.toFixed(1))],
      ['هزینه‌های ثابت نسبت به دوره (تومان)', Math.round(currentPL.fixedProrated)],
      ['سود خالص (تومان)', Math.round(currentPL.netProfit)],
      ['حاشیه سود خالص (٪)', Number(currentPL.netMarginPct.toFixed(1))],
    ]);
  });

  exportJsonBtn.addEventListener('click', () => {
    if (!currentPL) return;
    downloadJSON(`profit-loss-${periodSelect.value}d.json`, {
      period: currentLabel,
      periodDays: Number(periodSelect.value),
      ...currentPL,
    });
  });

  periodSelect.addEventListener('change', scheduleRender);
  const unsubSales = sales.subscribe(scheduleRender);
  const unsubExpenses = expenses.subscribe(scheduleRender);
  const unsubEmployees = employees.subscribe(scheduleRender);

  return () => {
    unsubSales();
    unsubExpenses();
    unsubEmployees();
    if (activeCanvas) destroyChart(activeCanvas);
    if (sourceCanvas) destroyChart(sourceCanvas);
  };
}

// ---------- Tab 2: هزینه‌های ثابت و متغیر (سه بخش: هزینه‌ها / حقوق / خلاصه) ----------

type ExpenseSubTab = 'expenses' | 'payroll' | 'summary';

function renderFixedVariableTab(container: HTMLElement): () => void {
  const subTabsEl = el('div', { class: 'tabs tabs--sub' });
  const subContentEl = el('div', { class: 'tab-content' });
  container.append(subTabsEl, subContentEl);

  const subTabs: { id: ExpenseSubTab; label: string; render: (c: HTMLElement) => () => void }[] = [
    { id: 'expenses', label: 'هزینه‌های ثابت', render: renderExpensesTab },
    { id: 'payroll', label: 'حقوق و دستمزد', render: renderPayrollTab },
    { id: 'summary', label: 'خلاصه ماهانه', render: renderSummaryTab },
  ];

  let activeSub: ExpenseSubTab = 'expenses';
  let cleanup: () => void = () => {};

  function renderSubTabs(): void {
    subTabsEl.innerHTML = '';
    for (const t of subTabs) {
      subTabsEl.appendChild(
        el(
          'button',
          { type: 'button', class: `tab-btn${t.id === activeSub ? ' tab-btn--active' : ''}`, onclick: () => switchSub(t.id) },
          [t.label],
        ),
      );
    }
  }

  function switchSub(id: ExpenseSubTab): void {
    activeSub = id;
    cleanup();
    subContentEl.innerHTML = '';
    renderSubTabs();
    cleanup = subTabs.find((t) => t.id === id)!.render(subContentEl);
  }

  switchSub(activeSub);
  return () => cleanup();
}

// ---------- Tab: تامین‌کنندگان و مالیات بر ارزش افزوده ----------

type SupplierVatSubTab = 'suppliers' | 'vat';

function openSupplierFormModal(existing?: Supplier): void {
  const nameInput = el('input', { type: 'text', class: 'input', value: existing?.name ?? '' });
  const phoneInput = el('input', { type: 'tel', class: 'input', value: existing?.phone ?? '' });
  const ingredientSelect = el('select', { class: 'input', multiple: true }) as HTMLSelectElement;
  for (const ing of ingredients.get()) {
    const opt = el('option', { value: ing.id }, [ing.name]) as HTMLOptionElement;
    if (existing?.ingredientIds.includes(ing.id)) opt.selected = true;
    ingredientSelect.appendChild(opt);
  }
  const notesInput = el('input', { type: 'text', class: 'input', value: existing?.notes ?? '' });

  const body = el('form', { class: 'form' }, [
    field('نام تامین‌کننده', nameInput),
    field('شماره تماس (اختیاری)', phoneInput),
    field('مواد اولیهٔ مرتبط', ingredientSelect, 'برای انتخاب چند مورد، کلید Ctrl را نگه دارید.'),
    field('یادداشت (اختیاری)', notesInput),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, [existing ? 'ذخیره تغییرات' : 'افزودن تامین‌کننده']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      showToast('نام تامین‌کننده الزامی است', 'error');
      return;
    }
    const ingredientIds = Array.from(ingredientSelect.selectedOptions).map((o) => o.value);
    const payload = { name, phone: phoneInput.value.trim() || undefined, ingredientIds, notes: notesInput.value.trim() || undefined };
    if (existing) await db.updateSupplier(existing.id, payload);
    else await db.createSupplier(payload);
    await refreshSuppliers();
    showToast(existing ? 'تغییرات ذخیره شد' : 'تامین‌کننده افزوده شد', 'success');
    modal.close();
  });

  const modal = openModal({ title: existing ? 'ویرایش تامین‌کننده' : 'افزودن تامین‌کننده', body });
}

async function handleDeleteSupplier(supplier: Supplier): Promise<void> {
  const confirmed = await confirmModal({
    title: 'حذف تامین‌کننده',
    message: `تامین‌کنندهٔ «${supplier.name}» برای همیشه حذف می‌شود.`,
    confirmLabel: 'حذف',
    danger: true,
  });
  if (!confirmed) return;
  await db.deleteSupplier(supplier.id);
  await refreshSuppliers();
  showToast('تامین‌کننده حذف شد', 'success');
}

function renderSupplierRow(supplier: Supplier, ingredientNames: string): HTMLElement {
  return el('div', { class: 'recipe-row' }, [
    el('div', { class: 'recipe-row__main' }, [
      el('div', { class: 'recipe-row__title-row' }, [
        el('span', { class: 'recipe-row__name' }, [supplier.name]),
        supplier.phone ? el('span', { class: 'badge' }, [supplier.phone]) : null,
      ]),
      el('div', { class: 'recipe-row__meta' }, [
        ingredientNames || 'بدون مادهٔ اولیهٔ مرتبط',
        supplier.notes ? ` · ${supplier.notes}` : '',
      ]),
    ]),
    el('div', { class: 'expense-row__actions' }, [
      el('button', { class: 'icon-btn', type: 'button', title: 'ویرایش', onclick: () => openSupplierFormModal(supplier) }, ['✏️']),
      el('button', { class: 'icon-btn', type: 'button', title: 'حذف', onclick: () => handleDeleteSupplier(supplier) }, ['🗑️']),
    ]),
  ]);
}

function openSupplierPaymentFormModal(existing?: SupplierPayment): void {
  const supplierList = suppliers.get();
  const supplierSelect = selectEl(
    supplierList.map((s) => ({ value: s.id, label: s.name })),
    existing?.supplierId ?? supplierList[0]?.id,
  );
  const amountInput = numberInput(existing?.amount ?? 0);
  const dateInput = el('input', { type: 'date', class: 'input', value: (existing?.date ?? new Date().toISOString()).slice(0, 10) });
  const dueDateInput = el('input', { type: 'date', class: 'input', value: existing?.dueDate?.slice(0, 10) ?? '' });
  const isPaidCheckbox = el('input', { type: 'checkbox', checked: existing?.isPaid ?? false });
  const noteInput = el('input', { type: 'text', class: 'input', value: existing?.note ?? '' });

  const body = el('form', { class: 'form' }, [
    field('تامین‌کننده', supplierSelect),
    field('مبلغ (تومان)', amountInput),
    field('تاریخ', dateInput),
    field('سررسید (اختیاری)', dueDateInput),
    el('label', { class: 'toolbar__checkbox' }, [isPaidCheckbox, ' پرداخت‌شده']),
    field('یادداشت (اختیاری)', noteInput),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, [existing ? 'ذخیره تغییرات' : 'ثبت پرداخت']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supplierSelect.value) {
      showToast('ابتدا یک تامین‌کننده اضافه کنید', 'error');
      return;
    }
    const amount = parseNumberInput(amountInput);
    if (amount <= 0) {
      showToast('مبلغ باید بیشتر از صفر باشد', 'error');
      return;
    }
    const payload = {
      supplierId: supplierSelect.value,
      amount,
      date: dateInput.value ? new Date(dateInput.value).toISOString() : new Date().toISOString(),
      isPaid: isPaidCheckbox.checked,
      dueDate: dueDateInput.value ? new Date(dueDateInput.value).toISOString() : undefined,
      note: noteInput.value.trim() || undefined,
    };
    if (existing) await db.updateSupplierPayment(existing.id, payload);
    else await db.createSupplierPayment(payload);
    await refreshSupplierPayments();
    showToast(existing ? 'تغییرات ذخیره شد' : 'پرداخت ثبت شد', 'success');
    modal.close();
  });

  const modal = openModal({ title: existing ? 'ویرایش پرداخت' : 'ثبت پرداخت', body });
}

async function handleDeleteSupplierPayment(payment: SupplierPayment): Promise<void> {
  const confirmed = await confirmModal({
    title: 'حذف پرداخت',
    message: 'این رکورد پرداخت برای همیشه حذف می‌شود.',
    confirmLabel: 'حذف',
    danger: true,
  });
  if (!confirmed) return;
  await db.deleteSupplierPayment(payment.id);
  await refreshSupplierPayments();
  showToast('پرداخت حذف شد', 'success');
}

async function toggleSupplierPaymentPaid(payment: SupplierPayment): Promise<void> {
  await db.updateSupplierPayment(payment.id, { isPaid: !payment.isPaid });
  await refreshSupplierPayments();
}

function renderSupplierPaymentRow(payment: SupplierPayment, supplierName: string): HTMLElement {
  const overdue = !payment.isPaid && !!payment.dueDate && new Date(payment.dueDate) < new Date();
  const statusClass = payment.isPaid ? 'badge--success' : overdue ? 'badge--danger' : 'badge--warning';
  const statusLabel = payment.isPaid ? 'پرداخت‌شده' : overdue ? 'سررسید گذشته' : 'پرداخت‌نشده';
  return el('div', { class: `expense-row${payment.isPaid ? '' : ' expense-row--inactive'}` }, [
    el('div', { class: 'expense-row__main' }, [
      el('div', { class: 'expense-row__title-row' }, [
        el('span', { class: 'expense-row__name' }, [supplierName]),
        el('span', { class: `badge ${statusClass}` }, [statusLabel]),
      ]),
      el('div', { class: 'expense-row__meta' }, [
        `${formatMoney(payment.amount)} · ${formatDateShort(payment.date)}`,
        payment.dueDate ? ` · سررسید: ${formatDateShort(payment.dueDate)}` : '',
        payment.note ? ` · ${payment.note}` : '',
      ]),
    ]),
    el('div', { class: 'expense-row__actions' }, [
      el(
        'button',
        {
          class: 'icon-btn',
          type: 'button',
          title: payment.isPaid ? 'علامت‌گذاری به‌عنوان پرداخت‌نشده' : 'علامت‌گذاری به‌عنوان پرداخت‌شده',
          onclick: () => toggleSupplierPaymentPaid(payment),
        },
        [payment.isPaid ? '↩️' : '✅'],
      ),
      el('button', { class: 'icon-btn', type: 'button', title: 'ویرایش', onclick: () => openSupplierPaymentFormModal(payment) }, ['✏️']),
      el('button', { class: 'icon-btn', type: 'button', title: 'حذف', onclick: () => handleDeleteSupplierPayment(payment) }, ['🗑️']),
    ]),
  ]);
}

function renderSuppliersSubTab(container: HTMLElement): () => void {
  const kpiContainer = el('div');
  const supplierListEl = el('div', { class: 'recipe-list' });
  const paymentListEl = el('div', { class: 'expense-list' });

  const addSupplierBtn = el(
    'button',
    { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => openSupplierFormModal() },
    ['+ افزودن تامین‌کننده'],
  );
  const addPaymentBtn = el(
    'button',
    {
      class: 'btn btn-secondary btn-sm',
      type: 'button',
      onclick: () => {
        if (!suppliers.get().length) {
          showToast('ابتدا یک تامین‌کننده اضافه کنید', 'error');
          return;
        }
        openSupplierPaymentFormModal();
      },
    },
    ['+ ثبت پرداخت'],
  );

  container.append(
    kpiContainer,
    el('div', { class: 'chart-card' }, [
      el('h3', { class: 'chart-card__title' }, ['تامین‌کنندگان']),
      el('div', { class: 'tab-toolbar' }, [addSupplierBtn]),
      supplierListEl,
    ]),
    el('div', { class: 'chart-card' }, [
      el('h3', { class: 'chart-card__title' }, ['پرداخت‌ها']),
      el('div', { class: 'tab-toolbar' }, [addPaymentBtn]),
      paymentListEl,
    ]),
  );

  function render(): void {
    const supplierList = suppliers.get();
    const paymentList = supplierPayments.get();
    const byIngredient = ingredientsById();
    const now = new Date();

    const outstanding = paymentList.filter((p) => !p.isPaid);
    const totalOutstanding = outstanding.reduce((sum, p) => sum + p.amount, 0);
    const overdueCount = outstanding.filter((p) => p.dueDate && new Date(p.dueDate) < now).length;

    kpiContainer.innerHTML = '';
    kpiContainer.appendChild(
      el('div', { class: 'kpi-grid' }, [
        kpiCard('🚚', 'تامین‌کنندگان', toPersian(supplierList.length)),
        kpiCard('💳', 'مانده پرداخت‌نشده', formatMoneyShort(totalOutstanding), outstanding.length ? 'warning' : undefined),
        kpiCard('⏰', 'سررسید گذشته', toPersian(overdueCount), overdueCount ? 'negative' : undefined),
      ]),
    );

    supplierListEl.innerHTML = '';
    if (!supplierList.length) {
      supplierListEl.appendChild(
        emptyState({
          icon: '🚚',
          title: 'هنوز تامین‌کننده‌ای ثبت نشده است',
          message: 'برای پیگیری حساب‌های پرداختی، تامین‌کنندگان را اضافه کنید.',
          ctaLabel: 'افزودن تامین‌کننده',
          onCta: () => openSupplierFormModal(),
        }),
      );
    } else {
      for (const supplier of [...supplierList].sort((a, b) => a.name.localeCompare(b.name, 'fa'))) {
        const names = supplier.ingredientIds
          .map((id) => byIngredient.get(id)?.name)
          .filter((n): n is string => !!n)
          .join('، ');
        supplierListEl.appendChild(renderSupplierRow(supplier, names));
      }
    }

    paymentListEl.innerHTML = '';
    if (!paymentList.length) {
      paymentListEl.appendChild(emptyState({ icon: '💳', title: 'هنوز پرداختی ثبت نشده است' }));
    } else {
      const sorted = [...paymentList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      for (const payment of sorted) {
        const supplierName = supplierList.find((s) => s.id === payment.supplierId)?.name ?? 'نامشخص';
        paymentListEl.appendChild(renderSupplierPaymentRow(payment, supplierName));
      }
    }
  }

  const unsubSuppliers = suppliers.subscribe(render);
  const unsubPayments = supplierPayments.subscribe(render);
  const unsubIngredients = ingredients.subscribe(render);

  return () => {
    unsubSuppliers();
    unsubPayments();
    unsubIngredients();
  };
}

function renderVatSubTab(container: HTMLElement): () => void {
  const s = settings.get();
  const vatEnabledCheckbox = el('input', { type: 'checkbox', checked: s?.vatEnabled ?? false });
  const vatRateInput = numberInput(s?.vatRate ?? 9);
  const vatIncludedCheckbox = el('input', { type: 'checkbox', checked: s?.vatIncludedInPrice ?? true });
  const saveBtn = el('button', { type: 'button', class: 'btn btn-primary btn-sm' }, ['ذخیره تنظیمات مالیات']);

  const configBody = el('div', { class: 'form' }, [
    el('label', { class: 'toolbar__checkbox' }, [vatEnabledCheckbox, ' محاسبهٔ خودکار مالیات بر ارزش افزوده فعال باشد']),
    field('نرخ مالیات بر ارزش افزوده (٪)', vatRateInput),
    el('label', { class: 'toolbar__checkbox' }, [vatIncludedCheckbox, ' قیمت فروش شامل مالیات است']),
    el('div', { class: 'modal-actions' }, [saveBtn]),
  ]);

  const noticeEl = el('div');
  const kpiContainer = el('div');
  const periodSelect = selectEl(PERIOD_OPTIONS, '30');
  const exportBtn = el('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, ['خروجی گزارش مالیات (CSV)']);

  container.append(
    el('div', { class: 'chart-card' }, [el('h3', { class: 'chart-card__title' }, ['تنظیمات مالیات بر ارزش افزوده']), configBody]),
    noticeEl,
    kpiContainer,
    el('div', { class: 'toolbar' }, [periodSelect, exportBtn]),
  );

  saveBtn.addEventListener('click', async () => {
    await db.updateSettings({
      vatEnabled: vatEnabledCheckbox.checked,
      vatRate: parseNumberInput(vatRateInput),
      vatIncludedInPrice: vatIncludedCheckbox.checked,
    });
    await refreshSettings();
    showToast('تنظیمات مالیات ذخیره شد', 'success');
  });

  function vatSales(): Sale[] {
    const now = new Date();
    const periodDays = Number(periodSelect.value);
    const periodStart = new Date(now.getTime() - periodDays * DAY_MS);
    return salesInPeriod(sales.get(), periodStart, now).filter((sale) => (sale.vatAmount ?? 0) > 0);
  }

  function render(): void {
    noticeEl.innerHTML = '';
    if (!settings.get()?.vatEnabled) {
      noticeEl.appendChild(
        el('p', { class: 'field__hint' }, [
          'محاسبهٔ مالیات غیرفعال است. آن را در بالا فعال کنید تا فروش‌های بعدی شامل مالیات ثبت شوند.',
        ]),
      );
    }

    const list = vatSales();
    const totalVat = list.reduce((sum, sale) => sum + (sale.vatAmount ?? 0), 0);
    const totalTaxable = list.reduce((sum, sale) => sum + sale.unitSalePrice * sale.quantity, 0);

    kpiContainer.innerHTML = '';
    kpiContainer.appendChild(
      el('div', { class: 'kpi-grid' }, [
        kpiCard('🧾', 'مالیات جمع‌آوری‌شده', formatMoneyShort(totalVat)),
        kpiCard('💰', 'فروش مشمول مالیات', formatMoneyShort(totalTaxable)),
        kpiCard('📄', 'تعداد فروش مشمول', toPersian(list.length)),
      ]),
    );
  }

  exportBtn.addEventListener('click', () => {
    const list = vatSales();
    downloadCSV(
      `vat-report-${periodSelect.value}d.csv`,
      ['تاریخ', 'آیتم', 'فروش کل', 'نرخ مالیات (٪)', 'مبلغ مالیات'],
      list.map((sale) => [
        formatDateShort(sale.date),
        sale.menuItemName,
        Math.round(sale.unitSalePrice * sale.quantity),
        sale.vatRate ?? 0,
        Math.round(sale.vatAmount ?? 0),
      ]),
    );
  });

  periodSelect.addEventListener('change', render);
  const unsubSales = sales.subscribe(render);
  const unsubSettings = settings.subscribe(render);

  return () => {
    unsubSales();
    unsubSettings();
  };
}

function renderSuppliersVatTab(container: HTMLElement): () => void {
  const subTabsEl = el('div', { class: 'tabs tabs--sub' });
  const subContentEl = el('div', { class: 'tab-content' });
  container.append(subTabsEl, subContentEl);

  const subTabs: { id: SupplierVatSubTab; label: string; render: (c: HTMLElement) => () => void }[] = [
    { id: 'suppliers', label: 'تامین‌کنندگان', render: renderSuppliersSubTab },
    { id: 'vat', label: 'مالیات بر ارزش افزوده', render: renderVatSubTab },
  ];

  let activeSub: SupplierVatSubTab = 'suppliers';
  let cleanup: () => void = () => {};

  function renderSubTabs(): void {
    subTabsEl.innerHTML = '';
    for (const t of subTabs) {
      subTabsEl.appendChild(
        el(
          'button',
          { type: 'button', class: `tab-btn${t.id === activeSub ? ' tab-btn--active' : ''}`, onclick: () => switchSub(t.id) },
          [t.label],
        ),
      );
    }
  }

  function switchSub(id: SupplierVatSubTab): void {
    activeSub = id;
    cleanup();
    subContentEl.innerHTML = '';
    renderSubTabs();
    cleanup = subTabs.find((t) => t.id === id)!.render(subContentEl);
  }

  switchSub(activeSub);
  return () => cleanup();
}

// ---------- Tab 5: گزارش‌های خروجی ----------

function renderReportsTab(container: HTMLElement): () => void {
  const periodSelect = selectEl(PERIOD_OPTIONS, '30');
  const salesReportBtn = el('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, ['خروجی گزارش فروش دوره (CSV)']);
  const plCsvBtn = el('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, ['خروجی صورت سود و زیان (CSV)']);
  const plJsonBtn = el('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, ['خروجی صورت سود و زیان (JSON)']);
  const inventoryBtn = el('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, ['خروجی وضعیت انبار (CSV)']);
  const backupBtn = el('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, ['خروجی نسخهٔ پشتیبان کامل (JSON)']);

  container.append(
    el('div', { class: 'chart-card' }, [
      el('h3', { class: 'chart-card__title' }, ['گزارش‌های دوره‌ای']),
      el('div', { class: 'toolbar' }, [periodSelect]),
      el('div', { class: 'modal-actions' }, [salesReportBtn, plCsvBtn, plJsonBtn]),
    ]),
    el('div', { class: 'chart-card' }, [
      el('h3', { class: 'chart-card__title' }, ['گزارش‌های کلی']),
      el('div', { class: 'modal-actions' }, [inventoryBtn, backupBtn]),
    ]),
  );

  function periodSales(): Sale[] {
    const now = new Date();
    const periodDays = Number(periodSelect.value);
    const periodStart = new Date(now.getTime() - periodDays * DAY_MS);
    return salesInPeriod(sales.get(), periodStart, now);
  }

  function currentPL(): { pl: PeriodPL; label: string; periodDays: number } {
    const periodDays = Number(periodSelect.value);
    const label = PERIOD_OPTIONS.find((o) => o.value === periodSelect.value)?.label ?? '';
    const monthlyFixed = monthlyFixedCost(expenses.get(), employees.get());
    const pl = periodProfitLoss(periodSales(), monthlyFixed, periodDays);
    return { pl, label, periodDays };
  }

  salesReportBtn.addEventListener('click', () => {
    const list = periodSales();
    downloadCSV(
      `sales-report-${periodSelect.value}d.csv`,
      ['تاریخ', 'آیتم', 'تعداد', 'قیمت واحد', 'بهای واحد', 'فروش کل', 'بهای تمام‌شده کل', 'منبع'],
      list.map((s) => [
        formatDateShort(s.date),
        s.menuItemName,
        s.quantity,
        Math.round(s.unitSalePrice),
        Math.round(s.unitCost),
        Math.round(s.unitSalePrice * s.quantity),
        Math.round(s.unitCost * s.quantity),
        SOURCE_LABELS[effectiveSource(s)],
      ]),
    );
  });

  plCsvBtn.addEventListener('click', () => {
    const { pl, label, periodDays } = currentPL();
    downloadCSV(`profit-loss-${periodDays}d.csv`, ['شرح', 'مقدار'], [
      ['دوره', label],
      ['درآمد فروش (تومان)', Math.round(pl.revenue)],
      ['هزینه‌های متغیر (تومان)', Math.round(pl.cogs)],
      ['سود ناخالص (تومان)', Math.round(pl.grossProfit)],
      ['حاشیه سود ناخالص (٪)', Number(pl.grossMarginPct.toFixed(1))],
      ['هزینه‌های ثابت نسبت به دوره (تومان)', Math.round(pl.fixedProrated)],
      ['سود خالص (تومان)', Math.round(pl.netProfit)],
      ['حاشیه سود خالص (٪)', Number(pl.netMarginPct.toFixed(1))],
    ]);
  });

  plJsonBtn.addEventListener('click', () => {
    const { pl, label, periodDays } = currentPL();
    downloadJSON(`profit-loss-${periodDays}d.json`, { period: label, periodDays, ...pl });
  });

  inventoryBtn.addEventListener('click', () => {
    const list = ingredients.get();
    downloadCSV(
      'inventory-status.csv',
      ['نام', 'دسته‌بندی', 'واحد', 'موجودی فعلی', 'حداقل موجودی', 'حداکثر موجودی', 'قیمت واحد', 'ارزش انبار'],
      list.map((i) => [
        i.name,
        formatIngredientCategory(i.category),
        formatUnit(i.unit),
        i.currentStock,
        i.minStock,
        i.maxStock,
        Math.round(i.pricePerUnit),
        Math.round(i.currentStock * i.pricePerUnit),
      ]),
    );
  });

  backupBtn.addEventListener('click', async () => {
    const backup = await db.exportAllData();
    downloadJSON(`accounting-backup-${new Date().toISOString().slice(0, 10)}.json`, backup);
  });

  return () => {};
}

// ---------- View shell with 5 tabs ----------

export async function renderAccounting(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-accounting' });
  container.appendChild(root);

  const tabsEl = el('div', { class: 'tabs' });
  const contentEl = el('div', { class: 'tab-content' });

  root.append(el('div', { class: 'view-header' }, [el('h1', { class: 'view-header__title' }, ['حسابداری'])]), tabsEl, contentEl);

  const tabs: { id: AccountingTab; label: string; render: (c: HTMLElement) => () => void }[] = [
    { id: 'dashboard', label: 'داشبورد مالی', render: (c) => renderFinancialDashboardTab(c, switchTab) },
    { id: 'expenses', label: 'هزینه‌های ثابت و متغیر', render: renderFixedVariableTab },
    { id: 'sales-log', label: 'دفتر فروش', render: renderSalesLogTab },
    { id: 'import', label: 'ورودی فایل فروش', render: renderImportTab },
    { id: 'suppliers-vat', label: 'تامین‌کنندگان و مالیات', render: renderSuppliersVatTab },
    { id: 'reports', label: 'گزارش‌های خروجی', render: renderReportsTab },
  ];

  let activeTab: AccountingTab = 'dashboard';
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

  function switchTab(tab: AccountingTab): void {
    activeTab = tab;
    activeCleanup();
    contentEl.innerHTML = '';
    renderTabs();
    activeCleanup = tabs.find((t) => t.id === tab)!.render(contentEl);
  }

  switchTab(activeTab);

  return () => activeCleanup();
}

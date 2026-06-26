import * as db from '../db';
import { confirmModal, openModal } from '../components/modal';
import { destroyChart, palette, renderChart } from '../components/chart';
import { showToast } from '../components/toast';
import { el, emptyState, field, kpiCard, numberInput, parseNumberInput, selectEl } from '../utils/dom';
import { formatExpenseCategory, formatExpenseFrequency, formatMoney, formatPayType, formatPct } from '../utils/format';
import type { RouteCleanup } from '../router';
import { employees, expenses, refreshEmployees, refreshExpenses } from '../store';
import { expenseMonthlyEquivalent, monthlyEquivalent, monthlyFixedCost } from '../utils/calc';
import type { Employee, Expense, ExpenseCategory, ExpenseFrequency, PayType } from '../types';

const EXPENSE_CATEGORY_OPTIONS: ExpenseCategory[] = [
  'rent', 'utilities', 'insurance', 'marketing', 'maintenance', 'packaging', 'transport', 'tax', 'other',
];
const FREQUENCY_OPTIONS: ExpenseFrequency[] = ['monthly', 'yearly', 'one_time'];
const PAY_TYPE_OPTIONS: PayType[] = ['monthly', 'daily', 'hourly'];
const CHART_COLORS = [palette.primary, palette.coral, palette.mint, palette.amber, palette.blue, palette.red, palette.primaryD];

type Tab = 'expenses' | 'payroll' | 'summary';

// ---------- Expenses tab ----------

function openExpenseFormModal(existing?: Expense): void {
  const nameInput = el('input', { type: 'text', class: 'input', value: existing?.name ?? '' });
  const categorySelect = selectEl(
    EXPENSE_CATEGORY_OPTIONS.map((c) => ({ value: c, label: formatExpenseCategory(c) })),
    existing?.category ?? 'other',
  );
  const amountInput = numberInput(existing?.amount ?? 0);
  const frequencySelect = selectEl(
    FREQUENCY_OPTIONS.map((f) => ({ value: f, label: formatExpenseFrequency(f) })),
    existing?.frequency ?? 'monthly',
  );
  const noteInput = el('input', { type: 'text', class: 'input', value: existing?.note ?? '' });
  const activeCheckbox = el('input', { type: 'checkbox', checked: existing?.isActive ?? true });

  const body = el('form', { class: 'form' }, [
    field('عنوان هزینه', nameInput),
    field('دسته‌بندی', categorySelect),
    field('مبلغ (تومان)', amountInput),
    field('دوره تکرار', frequencySelect),
    field('یادداشت (اختیاری)', noteInput),
    el('label', { class: 'toolbar__checkbox' }, [activeCheckbox, ' فعال']),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, [existing ? 'ذخیره تغییرات' : 'افزودن هزینه']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      showToast('عنوان هزینه الزامی است', 'error');
      return;
    }
    const amount = parseNumberInput(amountInput);
    if (amount <= 0) {
      showToast('مبلغ باید بیشتر از صفر باشد', 'error');
      return;
    }
    const payload = {
      name,
      category: categorySelect.value as ExpenseCategory,
      amount,
      frequency: frequencySelect.value as ExpenseFrequency,
      isActive: activeCheckbox.checked,
      note: noteInput.value.trim() || undefined,
    };
    if (existing) await db.updateExpense(existing.id, payload);
    else await db.createExpense(payload);
    await refreshExpenses();
    showToast(existing ? 'تغییرات ذخیره شد' : 'هزینه افزوده شد', 'success');
    modal.close();
  });

  const modal = openModal({ title: existing ? 'ویرایش هزینه' : 'افزودن هزینه', body });
}

async function handleDeleteExpense(expense: Expense): Promise<void> {
  const confirmed = await confirmModal({
    title: 'حذف هزینه',
    message: `هزینهٔ «${expense.name}» برای همیشه حذف می‌شود.`,
    confirmLabel: 'حذف',
    danger: true,
  });
  if (!confirmed) return;
  await db.deleteExpense(expense.id);
  await refreshExpenses();
  showToast('هزینه حذف شد', 'success');
}

async function toggleExpenseActive(expense: Expense): Promise<void> {
  await db.updateExpense(expense.id, { isActive: !expense.isActive });
  await refreshExpenses();
}

function renderExpenseRow(expense: Expense): HTMLElement {
  return el('div', { class: `expense-row${expense.isActive ? '' : ' expense-row--inactive'}` }, [
    el('div', { class: 'expense-row__main' }, [
      el('div', { class: 'expense-row__title-row' }, [
        el('span', { class: 'expense-row__name' }, [expense.name]),
        el('span', { class: 'badge' }, [formatExpenseCategory(expense.category)]),
        !expense.isActive ? el('span', { class: 'badge badge--muted' }, ['غیرفعال']) : null,
      ]),
      el('div', { class: 'expense-row__meta' }, [
        `${formatMoney(expense.amount)} · ${formatExpenseFrequency(expense.frequency)} · معادل ماهانه: ${formatMoney(expenseMonthlyEquivalent(expense))}`,
      ]),
    ]),
    el('div', { class: 'expense-row__actions' }, [
      el('button', { class: 'icon-btn', type: 'button', title: 'ویرایش', onclick: () => openExpenseFormModal(expense) }, ['✏️']),
      el(
        'button',
        {
          class: 'icon-btn',
          type: 'button',
          title: expense.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی',
          onclick: () => toggleExpenseActive(expense),
        },
        [expense.isActive ? '👁️' : '🚫'],
      ),
      el('button', { class: 'icon-btn', type: 'button', title: 'حذف', onclick: () => handleDeleteExpense(expense) }, ['🗑️']),
    ]),
  ]);
}

function renderExpensesTab(container: HTMLElement): () => void {
  const listEl = el('div', { class: 'expense-list' });
  container.append(
    el('div', { class: 'tab-toolbar' }, [
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => openExpenseFormModal() }, ['+ افزودن هزینه']),
    ]),
    listEl,
  );

  function render(): void {
    listEl.innerHTML = '';
    const list = [...expenses.get()].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    if (!list.length) {
      listEl.appendChild(
        emptyState({
          icon: '🧾',
          title: 'هنوز هزینه‌ای ثبت نشده است',
          message: 'اولین هزینهٔ ثابت یا متغیر را اضافه کنید.',
          ctaLabel: 'افزودن هزینه',
          onCta: () => openExpenseFormModal(),
        }),
      );
      return;
    }
    for (const expense of list) listEl.appendChild(renderExpenseRow(expense));
  }

  const unsub = expenses.subscribe(render);
  return () => unsub();
}

// ---------- Payroll tab ----------

function openEmployeeFormModal(existing?: Employee): void {
  const nameInput = el('input', { type: 'text', class: 'input', value: existing?.name ?? '' });
  const roleInput = el('input', { type: 'text', class: 'input', value: existing?.role ?? '' });
  const payTypeSelect = selectEl(
    PAY_TYPE_OPTIONS.map((p) => ({ value: p, label: formatPayType(p) })),
    existing?.payType ?? 'monthly',
  );
  const amountInput = numberInput(existing?.amount ?? 0);
  const startDateInput = el('input', { type: 'date', class: 'input', value: existing?.startDate?.slice(0, 10) ?? '' });
  const activeCheckbox = el('input', { type: 'checkbox', checked: existing?.isActive ?? true });

  const body = el('form', { class: 'form' }, [
    field('نام پرسنل', nameInput),
    field('نقش / سمت', roleInput),
    field('نوع پرداخت', payTypeSelect),
    field('مبلغ (تومان)', amountInput),
    field('تاریخ شروع (اختیاری)', startDateInput),
    el('label', { class: 'toolbar__checkbox' }, [activeCheckbox, ' فعال']),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, [existing ? 'ذخیره تغییرات' : 'افزودن پرسنل']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const role = roleInput.value.trim();
    if (!name || !role) {
      showToast('نام و نقش پرسنل الزامی است', 'error');
      return;
    }
    const amount = parseNumberInput(amountInput);
    if (amount <= 0) {
      showToast('مبلغ باید بیشتر از صفر باشد', 'error');
      return;
    }
    const payload = {
      name,
      role,
      payType: payTypeSelect.value as PayType,
      amount,
      isActive: activeCheckbox.checked,
      startDate: startDateInput.value ? new Date(startDateInput.value).toISOString() : undefined,
    };
    if (existing) await db.updateEmployee(existing.id, payload);
    else await db.createEmployee(payload);
    await refreshEmployees();
    showToast(existing ? 'تغییرات ذخیره شد' : 'پرسنل افزوده شد', 'success');
    modal.close();
  });

  const modal = openModal({ title: existing ? 'ویرایش پرسنل' : 'افزودن پرسنل', body });
}

async function handleDeleteEmployee(employee: Employee): Promise<void> {
  const confirmed = await confirmModal({
    title: 'حذف پرسنل',
    message: `پرسنل «${employee.name}» برای همیشه حذف می‌شود.`,
    confirmLabel: 'حذف',
    danger: true,
  });
  if (!confirmed) return;
  await db.deleteEmployee(employee.id);
  await refreshEmployees();
  showToast('پرسنل حذف شد', 'success');
}

async function toggleEmployeeActive(employee: Employee): Promise<void> {
  await db.updateEmployee(employee.id, { isActive: !employee.isActive });
  await refreshEmployees();
}

function renderEmployeeRow(employee: Employee): HTMLElement {
  const periodSuffix = employee.payType === 'monthly' ? '/ماه' : employee.payType === 'daily' ? '/روز' : '/ساعت';
  return el('div', { class: `expense-row${employee.isActive ? '' : ' expense-row--inactive'}` }, [
    el('div', { class: 'expense-row__main' }, [
      el('div', { class: 'expense-row__title-row' }, [
        el('span', { class: 'expense-row__name' }, [employee.name]),
        el('span', { class: 'badge' }, [employee.role]),
        !employee.isActive ? el('span', { class: 'badge badge--muted' }, ['غیرفعال']) : null,
      ]),
      el('div', { class: 'expense-row__meta' }, [
        `${formatMoney(employee.amount)} ${periodSuffix} · ${formatPayType(employee.payType)} · معادل ماهانه: ${formatMoney(monthlyEquivalent(employee))}`,
      ]),
    ]),
    el('div', { class: 'expense-row__actions' }, [
      el('button', { class: 'icon-btn', type: 'button', title: 'ویرایش', onclick: () => openEmployeeFormModal(employee) }, ['✏️']),
      el(
        'button',
        {
          class: 'icon-btn',
          type: 'button',
          title: employee.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی',
          onclick: () => toggleEmployeeActive(employee),
        },
        [employee.isActive ? '👁️' : '🚫'],
      ),
      el('button', { class: 'icon-btn', type: 'button', title: 'حذف', onclick: () => handleDeleteEmployee(employee) }, ['🗑️']),
    ]),
  ]);
}

function renderPayrollTab(container: HTMLElement): () => void {
  const listEl = el('div', { class: 'expense-list' });
  container.append(
    el('div', { class: 'tab-toolbar' }, [
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => openEmployeeFormModal() }, ['+ افزودن پرسنل']),
    ]),
    listEl,
  );

  function render(): void {
    listEl.innerHTML = '';
    const list = [...employees.get()].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    if (!list.length) {
      listEl.appendChild(
        emptyState({
          icon: '👥',
          title: 'هنوز پرسنلی ثبت نشده است',
          message: 'اولین عضو تیم را اضافه کنید.',
          ctaLabel: 'افزودن پرسنل',
          onCta: () => openEmployeeFormModal(),
        }),
      );
      return;
    }
    for (const employee of list) listEl.appendChild(renderEmployeeRow(employee));
  }

  const unsub = employees.subscribe(render);
  return () => unsub();
}

// ---------- Summary tab ----------

function renderSummaryTab(container: HTMLElement): () => void {
  const statsEl = el('div', { class: 'kpi-grid' });
  const canvas = el('canvas');
  const chartCard = el('div', { class: 'chart-card' }, [
    el('h3', { class: 'chart-card__title' }, ['ترکیب هزینهٔ ثابت ماهانه']),
    el('div', { class: 'chart-card__canvas-wrap' }, [canvas]),
  ]);
  const breakdownEl = el('div', { class: 'expense-breakdown' });

  container.append(statsEl, chartCard, breakdownEl);

  function render(): void {
    const exp = expenses.get();
    const emp = employees.get();
    const total = monthlyFixedCost(exp, emp);

    statsEl.innerHTML = '';
    statsEl.appendChild(kpiCard('🏢', 'هزینهٔ ثابت ماهانه (هزینه‌ها + حقوق)', formatMoney(total)));

    const byLabel = new Map<string, number>();
    for (const e of exp.filter((e) => e.isActive)) {
      const value = expenseMonthlyEquivalent(e);
      if (value <= 0) continue;
      const label = formatExpenseCategory(e.category);
      byLabel.set(label, (byLabel.get(label) ?? 0) + value);
    }
    const payrollTotal = emp.filter((e) => e.isActive).reduce((sum, e) => sum + monthlyEquivalent(e), 0);
    if (payrollTotal > 0) byLabel.set('حقوق و دستمزد', payrollTotal);

    const labels = Array.from(byLabel.keys());
    const values = Array.from(byLabel.values());

    if (!values.length) {
      destroyChart(canvas);
      chartCard.style.display = 'none';
    } else {
      chartCard.style.display = '';
      renderChart(canvas, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: CHART_COLORS }] },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }

    breakdownEl.innerHTML = '';
    if (!labels.length) {
      breakdownEl.appendChild(emptyState({ icon: '📊', title: 'هنوز هزینهٔ ثابتی برای نمایش وجود ندارد' }));
      return;
    }
    for (let i = 0; i < labels.length; i++) {
      const pct = total > 0 ? (values[i] / total) * 100 : 0;
      breakdownEl.appendChild(
        el('div', { class: 'expense-breakdown__row' }, [
          el('span', { class: 'expense-breakdown__dot', style: `background:${CHART_COLORS[i % CHART_COLORS.length]}` }),
          el('span', { class: 'expense-breakdown__label' }, [labels[i]]),
          el('span', { class: 'expense-breakdown__value' }, [formatMoney(values[i])]),
          el('span', { class: 'expense-breakdown__pct' }, [formatPct(pct)]),
        ]),
      );
    }
  }

  const unsubExpenses = expenses.subscribe(render);
  const unsubEmployees = employees.subscribe(render);

  return () => {
    unsubExpenses();
    unsubEmployees();
    destroyChart(canvas);
  };
}

// ---------- View shell with tabs ----------

export async function renderExpenses(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-expenses' });
  container.appendChild(root);

  const tabsEl = el('div', { class: 'tabs' });
  const contentEl = el('div', { class: 'tab-content' });

  root.append(el('div', { class: 'view-header' }, [el('h1', { class: 'view-header__title' }, ['هزینه‌ها و حقوق'])]), tabsEl, contentEl);

  const tabs: { id: Tab; label: string; render: (c: HTMLElement) => () => void }[] = [
    { id: 'expenses', label: 'هزینه‌های ثابت و متغیر', render: renderExpensesTab },
    { id: 'payroll', label: 'حقوق و دستمزد', render: renderPayrollTab },
    { id: 'summary', label: 'خلاصه ماهانه', render: renderSummaryTab },
  ];

  let activeTab: Tab = 'expenses';
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

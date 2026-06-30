import * as db from '../db';
import { currentUser } from '../auth';
import { confirmModal, openModal } from '../components/modal';
import { showToast } from '../components/toast';
import { el, emptyState, field, iconBtn, numberInput, parseNumberInput, selectEl } from '../utils/dom';
import { formatDate, formatMoney, formatPayType } from '../utils/format';
import { employees, refreshEmployees } from '../store';
import type { RouteCleanup } from '../router';
import type {
  AttendanceRecord, AttendanceStatus, Employee, PayrollAdjustment, PayrollRecord, PayrollStatus, SalaryAdvance, SalaryAdvanceStatus,
} from '../types';

type Tab = 'attendance' | 'payroll' | 'advances' | 'leave';

const ATTENDANCE_STATUS_OPTIONS: AttendanceStatus[] = ['present', 'absent', 'leave', 'half_day'];
const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'حاضر',
  absent: 'غایب',
  leave: 'مرخصی',
  half_day: 'نیم‌روز',
};
const ATTENDANCE_STATUS_TONE: Record<AttendanceStatus, string> = {
  present: 'badge--success',
  absent: 'badge--danger',
  leave: 'badge--warning',
  half_day: 'badge--muted',
};

const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = {
  draft: 'پیش‌نویس',
  finalized: 'نهایی‌شده',
  paid: 'پرداخت‌شده',
};
const PAYROLL_STATUS_TONE: Record<PayrollStatus, string> = {
  draft: 'badge--muted',
  finalized: 'badge--warning',
  paid: 'badge--success',
};

const ADVANCE_STATUS_LABELS: Record<SalaryAdvanceStatus, string> = {
  pending: 'در انتظار',
  approved: 'تایید‌شده',
  rejected: 'رد‌شده',
  deducted: 'کسر‌شده (در فیش حقوقی)',
};
const ADVANCE_STATUS_TONE: Record<SalaryAdvanceStatus, string> = {
  pending: 'badge--warning',
  approved: 'badge--success',
  rejected: 'badge--danger',
  deducted: 'badge--muted',
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentPeriodMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function activeEmployees(): Employee[] {
  return [...employees.get()].filter((e) => e.isActive).sort((a, b) => a.name.localeCompare(b.name, 'fa'));
}

function employeeSelect(selected?: string): HTMLSelectElement {
  return selectEl(activeEmployees().map((e) => ({ value: e.id, label: `${e.name} (${e.role})` })), selected);
}

function badge(label: string, tone: string): HTMLElement {
  return el('span', { class: `badge ${tone}` }, [label]);
}

// ---------- Attendance tab ----------

function openMarkAttendanceModal(): void {
  if (!activeEmployees().length) {
    showToast('ابتدا یک پرسنل فعال از بخش «حقوق و دستمزد» اضافه کنید', 'error');
    return;
  }
  const empSelect = employeeSelect();
  const dateInput = el('input', { type: 'date', class: 'input', value: todayISO() }) as HTMLInputElement;
  const statusSelect = selectEl(ATTENDANCE_STATUS_OPTIONS.map((s) => ({ value: s, label: ATTENDANCE_STATUS_LABELS[s] })), 'present');
  const overtimeInput = numberInput(0);
  const noteInput = el('input', { type: 'text', class: 'input' });

  const body = el('form', { class: 'form' }, [
    field('پرسنل', empSelect),
    field('تاریخ', dateInput),
    field('وضعیت', statusSelect),
    field('اضافه‌کاری (ساعت، اختیاری)', overtimeInput),
    field('یادداشت (اختیاری)', noteInput),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['ثبت حضور']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!dateInput.value) {
      showToast('تاریخ الزامی است', 'error');
      return;
    }
    await db.markAttendance({
      employeeId: empSelect.value,
      date: dateInput.value,
      status: statusSelect.value as AttendanceStatus,
      overtimeHours: parseNumberInput(overtimeInput) || undefined,
      note: noteInput.value.trim() || undefined,
    });
    showToast('حضور ثبت شد', 'success');
    modal.close();
    renderAttendanceList();
  });

  const modal = openModal({ title: 'ثبت حضور و غیاب', body });
}

async function handleDeleteAttendance(record: AttendanceRecord): Promise<void> {
  const confirmed = await confirmModal({
    title: 'حذف رکورد حضور',
    message: `رکورد حضور تاریخ ${formatDate(record.date)} حذف شود؟`,
    confirmLabel: 'حذف',
    danger: true,
  });
  if (!confirmed) return;
  await db.deleteAttendance(record.id);
  showToast('رکورد حذف شد', 'success');
  renderAttendanceList();
}

let attendanceListEl: HTMLElement;

async function renderAttendanceList(): Promise<void> {
  attendanceListEl.innerHTML = '';
  const [records, emps] = await Promise.all([db.listAttendance(), Promise.resolve(employees.get())]);
  const empById = new Map(emps.map((e) => [e.id, e]));
  const sorted = records.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200);

  if (!sorted.length) {
    attendanceListEl.appendChild(
      emptyState({ icon: 'clock', title: 'هنوز حضوری ثبت نشده است', message: 'حضور پرسنل را روزانه ثبت کنید.' }),
    );
    return;
  }
  for (const record of sorted) {
    const emp = empById.get(record.employeeId);
    attendanceListEl.appendChild(
      el('div', { class: 'expense-row' }, [
        el('div', { class: 'expense-row__main' }, [
          el('div', { class: 'expense-row__title-row' }, [
            el('span', { class: 'expense-row__name' }, [emp?.name ?? 'پرسنل حذف‌شده']),
            badge(ATTENDANCE_STATUS_LABELS[record.status], ATTENDANCE_STATUS_TONE[record.status]),
          ]),
          el('div', { class: 'expense-row__meta' }, [
            `${formatDate(record.date)}${record.overtimeHours ? ` · ${record.overtimeHours} ساعت اضافه‌کاری` : ''}${record.note ? ` · ${record.note}` : ''}`,
          ]),
        ]),
        el('div', { class: 'expense-row__actions' }, [iconBtn('trash', 'حذف', () => void handleDeleteAttendance(record))]),
      ]),
    );
  }
}

export function renderAttendanceTab(container: HTMLElement): () => void {
  attendanceListEl = el('div', { class: 'expense-list' });
  container.append(
    el('div', { class: 'tab-toolbar' }, [
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => openMarkAttendanceModal() }, ['+ ثبت حضور']),
    ]),
    attendanceListEl,
  );
  void renderAttendanceList();
  const unsub = employees.subscribe(() => void renderAttendanceList());
  return () => unsub();
}

// ---------- Payroll tab ----------

function openRunPayrollModal(onDone: () => void): void {
  if (!activeEmployees().length) {
    showToast('ابتدا یک پرسنل فعال از بخش «حقوق و دستمزد» اضافه کنید', 'error');
    return;
  }
  const empSelect = employeeSelect();
  const monthInput = el('input', { type: 'month', class: 'input', value: currentPeriodMonth() }) as HTMLInputElement;
  const adjustLabelInput = el('input', { type: 'text', class: 'input', placeholder: 'مثلاً پاداش عملکرد' });
  const adjustAmountInput = numberInput(0);

  const body = el('form', { class: 'form' }, [
    field('پرسنل', empSelect),
    field('دورهٔ پرداخت', monthInput),
    el('p', { class: 'form-hint' }, ['کسر پیش‌پرداخت‌های تایید‌شده و بیمهٔ ۷٪ به‌صورت خودکار محاسبه می‌شود.']),
    field('عنوان مزایا/کسری (اختیاری)', adjustLabelInput),
    field('مبلغ مزایا/کسری (تومان، منفی برای کسری)', adjustAmountInput),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['محاسبه فیش حقوقی']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!monthInput.value) {
      showToast('دورهٔ پرداخت الزامی است', 'error');
      return;
    }
    const adjustments: PayrollAdjustment[] = [];
    const adjustLabel = adjustLabelInput.value.trim();
    const adjustAmount = parseNumberInput(adjustAmountInput);
    if (adjustLabel && adjustAmount !== 0) adjustments.push({ label: adjustLabel, amount: adjustAmount });
    try {
      await db.runPayroll({ employeeId: empSelect.value, periodMonth: monthInput.value, adjustments });
      showToast('فیش حقوقی محاسبه شد', 'success');
      modal.close();
      onDone();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطا در محاسبهٔ فیش حقوقی', 'error');
    }
  });

  const modal = openModal({ title: 'محاسبهٔ فیش حقوقی جدید', body });
}

function payrollDetailBody(record: PayrollRecord): HTMLElement {
  const rows: [string, string][] = [
    ['حقوق پایه', formatMoney(record.baseAmount)],
    ['روزهای حاضر', String(record.presentDays)],
    ['روزهای غایب', String(record.absentDays)],
    ['روزهای مرخصی', String(record.leaveDays)],
    ['ساعت اضافه‌کاری', String(record.overtimeHours)],
    ['مبلغ اضافه‌کاری', formatMoney(record.overtimeAmount)],
  ];
  for (const adj of record.adjustments) rows.push([adj.label, formatMoney(adj.amount)]);
  rows.push(
    ['ناخالص', formatMoney(record.grossPay)],
    ['سهم بیمهٔ کارمند (۷٪)', `(${formatMoney(record.insuranceEmployeeShare)})`],
    ['سهم بیمهٔ کارفرما (۲۳٪، اطلاعاتی)', formatMoney(record.insuranceEmployerShare)],
    ['کسر پیش‌پرداخت', `(${formatMoney(record.advanceDeduction)})`],
    ['خالص پرداختی', formatMoney(record.netPay)],
  );
  return el(
    'div',
    { class: 'pl-statement' },
    rows.map(([label, value]) => el('div', { class: 'pl-row' }, [el('span', { class: 'pl-row__label' }, [label]), el('span', { class: 'pl-row__value' }, [value])])),
  );
}

async function handleFinalizePayroll(record: PayrollRecord, onDone: () => void): Promise<void> {
  const confirmed = await confirmModal({
    title: 'نهایی‌سازی فیش حقوقی',
    message: `فیش حقوقی «${record.employeeName}» برای دورهٔ ${record.periodMonth} نهایی شود؟ پس از نهایی‌سازی قابل ویرایش نیست.`,
    confirmLabel: 'نهایی‌سازی',
  });
  if (!confirmed) return;
  await db.finalizePayroll(record.id);
  showToast('فیش حقوقی نهایی شد', 'success');
  onDone();
}

async function handleMarkPayrollPaid(record: PayrollRecord, onDone: () => void): Promise<void> {
  const confirmed = await confirmModal({
    title: 'ثبت پرداخت',
    message: `پرداخت خالص ${formatMoney(record.netPay)} تومان به «${record.employeeName}» انجام شد؟`,
    confirmLabel: 'تایید پرداخت',
  });
  if (!confirmed) return;
  await db.markPayrollPaid(record.id);
  showToast('پرداخت ثبت شد', 'success');
  onDone();
}

async function handleDeletePayroll(record: PayrollRecord, onDone: () => void): Promise<void> {
  const confirmed = await confirmModal({
    title: 'حذف فیش حقوقی',
    message: `فیش حقوقی «${record.employeeName}» برای دورهٔ ${record.periodMonth} برای همیشه حذف می‌شود.`,
    confirmLabel: 'حذف',
    danger: true,
  });
  if (!confirmed) return;
  await db.deletePayrollRecord(record.id);
  showToast('فیش حقوقی حذف شد', 'success');
  onDone();
}

function openPayrollDetailModal(record: PayrollRecord, onDone: () => void): void {
  const actions = el('div', { class: 'modal-actions' }, [
    el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['بستن']),
    record.status === 'draft'
      ? el('button', { type: 'button', class: 'btn btn-primary', onclick: () => { void handleFinalizePayroll(record, () => { modal.close(); onDone(); }); } }, ['نهایی‌سازی'])
      : null,
    record.status === 'finalized'
      ? el('button', { type: 'button', class: 'btn btn-primary', onclick: () => { void handleMarkPayrollPaid(record, () => { modal.close(); onDone(); }); } }, ['ثبت پرداخت'])
      : null,
  ]);
  const body = el('div', { class: 'form' }, [payrollDetailBody(record), actions]);
  const modal = openModal({ title: `فیش حقوقی — ${record.employeeName} (${record.periodMonth})`, body });
}

let payrollListEl: HTMLElement;

async function renderPayrollList(): Promise<void> {
  payrollListEl.innerHTML = '';
  const records = (await db.listPayrollRecords()).sort((a, b) => b.periodMonth.localeCompare(a.periodMonth) || a.employeeName.localeCompare(b.employeeName, 'fa'));

  if (!records.length) {
    payrollListEl.appendChild(
      emptyState({ icon: 'wallet', title: 'هنوز فیش حقوقی محاسبه نشده است', message: 'برای شروع، فیش حقوقی یک پرسنل را محاسبه کنید.' }),
    );
    return;
  }
  for (const record of records) {
    payrollListEl.appendChild(
      el('div', { class: 'expense-row', onclick: () => openPayrollDetailModal(record, () => void renderPayrollList()) }, [
        el('div', { class: 'expense-row__main' }, [
          el('div', { class: 'expense-row__title-row' }, [
            el('span', { class: 'expense-row__name' }, [record.employeeName]),
            badge(PAYROLL_STATUS_LABELS[record.status], PAYROLL_STATUS_TONE[record.status]),
          ]),
          el('div', { class: 'expense-row__meta' }, [`دورهٔ ${record.periodMonth} · خالص پرداختی: ${formatMoney(record.netPay)}`]),
        ]),
        el('div', { class: 'expense-row__actions' }, [
          record.status === 'draft' ? iconBtn('trash', 'حذف', (e?: Event) => { e?.stopPropagation(); void handleDeletePayroll(record, () => void renderPayrollList()); }) : null,
        ]),
      ]),
    );
  }
}

export function renderPayrollRunsTab(container: HTMLElement): () => void {
  payrollListEl = el('div', { class: 'expense-list' });
  container.append(
    el('div', { class: 'tab-toolbar' }, [
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => openRunPayrollModal(() => void renderPayrollList()) }, ['+ محاسبهٔ فیش حقوقی']),
    ]),
    payrollListEl,
  );
  void renderPayrollList();
  const unsub = employees.subscribe(() => void renderPayrollList());
  return () => unsub();
}

// ---------- Salary advances tab ----------

function openRequestAdvanceModal(onDone: () => void): void {
  if (!activeEmployees().length) {
    showToast('ابتدا یک پرسنل فعال از بخش «حقوق و دستمزد» اضافه کنید', 'error');
    return;
  }
  const empSelect = employeeSelect();
  const amountInput = numberInput(0);
  const noteInput = el('input', { type: 'text', class: 'input' });

  const body = el('form', { class: 'form' }, [
    field('پرسنل', empSelect),
    field('مبلغ (تومان)', amountInput),
    field('یادداشت (اختیاری)', noteInput),
    el('div', { class: 'modal-actions' }, [
      el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => modal.close() }, ['انصراف']),
      el('button', { type: 'submit', class: 'btn btn-primary' }, ['ثبت درخواست']),
    ]),
  ]);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseNumberInput(amountInput);
    if (amount <= 0) {
      showToast('مبلغ باید بیشتر از صفر باشد', 'error');
      return;
    }
    await db.requestSalaryAdvance({ employeeId: empSelect.value, amount, note: noteInput.value.trim() || undefined });
    showToast('درخواست پیش‌پرداخت ثبت شد', 'success');
    modal.close();
    onDone();
  });

  const modal = openModal({ title: 'درخواست پیش‌پرداخت حقوق', body });
}

async function handleReviewAdvance(advance: SalaryAdvance, status: 'approved' | 'rejected', onDone: () => void): Promise<void> {
  const confirmed = await confirmModal({
    title: status === 'approved' ? 'تایید پیش‌پرداخت' : 'رد پیش‌پرداخت',
    message: status === 'approved'
      ? `پیش‌پرداخت ${formatMoney(advance.amount)} تومانی تایید شود؟ این مبلغ از فیش حقوقی بعدی کسر خواهد شد.`
      : 'این درخواست رد شود؟',
    confirmLabel: status === 'approved' ? 'تایید' : 'رد کردن',
    danger: status === 'rejected',
  });
  if (!confirmed) return;
  await db.reviewSalaryAdvance(advance.id, status, currentUser.get()?.name ?? 'نامشخص');
  showToast(status === 'approved' ? 'پیش‌پرداخت تایید شد' : 'پیش‌پرداخت رد شد', 'success');
  onDone();
}

let advancesListEl: HTMLElement;

async function renderAdvancesList(): Promise<void> {
  advancesListEl.innerHTML = '';
  const [advances, emps] = await Promise.all([db.listSalaryAdvances(), Promise.resolve(employees.get())]);
  const empById = new Map(emps.map((e) => [e.id, e]));
  const sorted = advances.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  if (!sorted.length) {
    advancesListEl.appendChild(emptyState({ icon: 'wallet', title: 'درخواست پیش‌پرداختی ثبت نشده است' }));
    return;
  }
  for (const advance of sorted) {
    const emp = empById.get(advance.employeeId);
    advancesListEl.appendChild(
      el('div', { class: 'expense-row' }, [
        el('div', { class: 'expense-row__main' }, [
          el('div', { class: 'expense-row__title-row' }, [
            el('span', { class: 'expense-row__name' }, [emp?.name ?? 'پرسنل حذف‌شده']),
            badge(ADVANCE_STATUS_LABELS[advance.status], ADVANCE_STATUS_TONE[advance.status]),
          ]),
          el('div', { class: 'expense-row__meta' }, [
            `${formatMoney(advance.amount)} تومان · ${formatDate(advance.requestedAt)}${advance.note ? ` · ${advance.note}` : ''}`,
          ]),
        ]),
        advance.status === 'pending'
          ? el('div', { class: 'expense-row__actions' }, [
              iconBtn('check', 'تایید', () => void handleReviewAdvance(advance, 'approved', () => void renderAdvancesList())),
              iconBtn('x', 'رد', () => void handleReviewAdvance(advance, 'rejected', () => void renderAdvancesList())),
            ])
          : null,
      ]),
    );
  }
}

export function renderAdvancesTab(container: HTMLElement): () => void {
  advancesListEl = el('div', { class: 'expense-list' });
  container.append(
    el('div', { class: 'tab-toolbar' }, [
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => openRequestAdvanceModal(() => void renderAdvancesList()) }, ['+ درخواست پیش‌پرداخت']),
    ]),
    advancesListEl,
  );
  void renderAdvancesList();
  const unsub = employees.subscribe(() => void renderAdvancesList());
  return () => unsub();
}

// ---------- Leave balance tab ----------

let leaveListEl: HTMLElement;

async function renderLeaveList(): Promise<void> {
  leaveListEl.innerHTML = '';
  const emps = activeEmployees();
  if (!emps.length) {
    leaveListEl.appendChild(emptyState({ icon: 'users', title: 'پرسنل فعالی ثبت نشده است' }));
    return;
  }
  const year = new Date().getFullYear();
  for (const emp of emps) {
    const balance = await db.getLeaveBalance(emp.id, year);
    leaveListEl.appendChild(
      el('div', { class: 'expense-row' }, [
        el('div', { class: 'expense-row__main' }, [
          el('div', { class: 'expense-row__title-row' }, [el('span', { class: 'expense-row__name' }, [emp.name]), el('span', { class: 'badge' }, [emp.role])]),
          el('div', { class: 'expense-row__meta' }, [
            `سهمیهٔ سالانه: ${balance.total} روز · استفاده‌شده: ${balance.used} روز · باقی‌مانده: ${balance.remaining} روز`,
          ]),
        ]),
      ]),
    );
  }
}

export function renderLeaveBalanceTab(container: HTMLElement): () => void {
  leaveListEl = el('div', { class: 'expense-list' });
  container.append(
    el('p', { class: 'form-hint' }, ['سهمیهٔ مرخصی سالانه از پروفایل هر پرسنل (بخش «حقوق و دستمزد») تنظیم می‌شود.']),
    leaveListEl,
  );
  void renderLeaveList();
  const unsub = employees.subscribe(() => void renderLeaveList());
  return () => unsub();
}

// ---------- View shell with tabs ----------

export async function renderHr(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-hr' });
  container.appendChild(root);

  const tabsEl = el('div', { class: 'tabs' });
  const contentEl = el('div', { class: 'tab-content' });

  root.append(el('div', { class: 'view-header' }, [el('h1', { class: 'view-header__title' }, ['منابع انسانی و حقوق و دستمزد'])]), tabsEl, contentEl);

  const tabs: { id: Tab; label: string; render: (c: HTMLElement) => () => void }[] = [
    { id: 'attendance', label: 'حضور و غیاب', render: renderAttendanceTab },
    { id: 'payroll', label: 'فیش‌های حقوقی', render: renderPayrollRunsTab },
    { id: 'advances', label: 'پیش‌پرداخت‌ها', render: renderAdvancesTab },
    { id: 'leave', label: 'مانده مرخصی', render: renderLeaveBalanceTab },
  ];

  let activeTab: Tab = 'attendance';
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

  await refreshEmployees();
  switchTab(activeTab);

  return () => activeCleanup();
}

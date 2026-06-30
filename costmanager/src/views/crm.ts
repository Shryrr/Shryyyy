import * as db from '../db';
import { confirmModal, openModal } from '../components/modal';
import { destroyChart, palette, renderChart } from '../components/chart';
import { showToast } from '../components/toast';
import {
  automationTriggers, customers, refreshAutomationTriggers, refreshCustomers, refreshSettings, refreshSmsLogs, settings, smsLogs,
} from '../store';
import { el, emptyState, field, iconBtn, kpiCard, numberInput, parseNumberInput, selectEl } from '../utils/dom';
import { svgIcon } from '../utils/icons';
import {
  RFM_SEGMENT_ORDER, formatDateTime, formatMoney, formatPct, formatRfmSegment, rfmSegmentIcon, toPersian,
} from '../utils/format';
import { sendBulkSms } from '../utils/sms';
import {
  CUSTOMER_FIELD_LABELS, buildCustomerRows, detectCustomerColumns, parseSpreadsheetFile,
} from '../utils/excel-import';
import type { CustomerField, CustomerImportRow, ParsedSheet } from '../utils/excel-import';
import type { RouteCleanup } from '../router';
import type { AutomationTrigger, AutomationTriggerType, Customer, RFMSegment, SmsLog } from '../types';

type Tab = 'customers' | 'segments' | 'automation' | 'sms' | 'loyalty' | 'report';

/** 'custom' triggers have no built-in eligibility rule and no manual-fire UI exists, so they're excluded from this catalog. */
const AUTOMATION_TYPES: AutomationTriggerType[] = ['welcome', 'birthday', 'lapsed_14', 'lapsed_30', 'post_survey', 'milestone_5'];

const AUTOMATION_LABELS: Record<AutomationTriggerType, string> = {
  welcome: 'پیام خوش‌آمدگویی',
  birthday: 'تبریک تولد',
  lapsed_14: 'یادآوری غیبت (۱۴ روز)',
  lapsed_30: 'بازگرداندن مشتری (۳۰ روز)',
  post_survey: 'نظرسنجی پس از بازدید',
  milestone_5: 'پاداش هر ۵ بازدید',
  custom: 'سفارشی',
};

const AUTOMATION_DESCRIPTIONS: Record<AutomationTriggerType, string> = {
  welcome: 'بعد از اولین بازدید مشتری، یک پیامک خوش‌آمدگویی ارسال می‌شود.',
  birthday: 'در روز تولد مشتری، پیامک تبریک ارسال می‌شود.',
  lapsed_14: 'وقتی ۱۴ تا ۳۰ روز از آخرین بازدید مشتری گذشته باشد، پیامک یادآوری ارسال می‌شود.',
  lapsed_30: 'وقتی بیش از ۳۰ روز از آخرین بازدید مشتری گذشته باشد، پیامک بازگرداندن ارسال می‌شود.',
  post_survey: 'همان روز بازدید، پیامک درخواست نظرسنجی ارسال می‌شود.',
  milestone_5: 'به ازای هر ۵ بازدید، پیامک تشکر و پاداش ارسال می‌شود.',
  custom: '',
};

const AUTOMATION_DEFAULT_TEMPLATES: Record<AutomationTriggerType, string> = {
  welcome: 'سلام {name} عزیز، به خانواده {businessName} خوش آمدید! 🌟',
  birthday: '{name} عزیز، تولدتون مبارک! 🎉 از طرف {businessName} یک هدیه ویژه منتظرتونه.',
  lapsed_14: '{name} عزیز، دلمون براتون تنگ شده! منتظر دیدارتون در {businessName} هستیم.',
  lapsed_30: '{name} عزیز، مدتی است شما را نمی‌بینیم. با {points} امتیاز وفاداری، منتظر بازگشت شما در {businessName} هستیم.',
  post_survey: '{name} عزیز، از خریدتون متشکریم! نظر شما درباره {businessName} برای ما ارزشمند است.',
  milestone_5: '{name} عزیز، با {visitCount}مین بازدید از {businessName}، شما عضو ویژه ما شدید! 🏆',
  custom: '',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Customers selected in the segmentation tab, carried over as the default recipient set in the bulk-SMS tab. */
const smsSelection = new Set<string>();

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

function rfmSegmentBadge(segment: RFMSegment): HTMLElement {
  const badge = el('span', { class: 'badge' }, [` ${formatRfmSegment(segment)}`]);
  badge.prepend(svgIcon(rfmSegmentIcon(segment), 14));
  return badge;
}

function renderCustomerRow(customer: Customer): HTMLElement {
  return el('div', { class: 'expense-row' }, [
    el('div', { class: 'expense-row__main' }, [
      el('div', { class: 'expense-row__title-row' }, [
        el('span', { class: 'expense-row__name' }, [customer.name]),
        rfmSegmentBadge(customer.segment),
      ]),
      el('div', { class: 'expense-row__meta' }, [
        `${customer.phone} · ${toPersian(customer.visitCount)} بازدید · ${formatMoney(customer.totalSpent)} · ${toPersian(customer.loyaltyPoints)} امتیاز`,
      ]),
    ]),
    el('div', { class: 'expense-row__actions' }, [
      iconBtn('receipt', 'ثبت بازدید', () => openRecordVisitModal(customer)),
      iconBtn('edit', 'ویرایش', () => openCustomerFormModal(customer)),
      iconBtn('trash', 'حذف', () => handleDeleteCustomer(customer)),
    ]),
  ]);
}

// ---------- Customer Excel import ----------

const CUSTOMER_IMPORT_FIELDS: CustomerField[] = ['name', 'phone', 'email', 'address', 'birthdate', 'notes'];

function customerMappingRow(headers: string[], mapping: Record<CustomerField, number>, onChange: () => void): HTMLElement {
  const row = el('div', { class: 'import-mapping' });
  for (const fieldKey of CUSTOMER_IMPORT_FIELDS) {
    const select = el('select', { class: 'input input--sm' });
    select.appendChild(el('option', { value: '-1' }, ['— تشخیص نشد —']));
    headers.forEach((h, idx) => {
      const opt = el('option', { value: String(idx) }, [h || `ستون ${toPersian(idx + 1)}`]);
      if (idx === mapping[fieldKey]) opt.selected = true;
      select.appendChild(opt);
    });
    if (mapping[fieldKey] === -1) (select as HTMLSelectElement).value = '-1';
    select.addEventListener('change', () => {
      mapping[fieldKey] = Number((select as HTMLSelectElement).value);
      onChange();
    });
    row.appendChild(field(CUSTOMER_FIELD_LABELS[fieldKey], select));
  }
  return row;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Folds detected email/address/birthdate columns into the free-text notes field (Customer has no dedicated columns for these). */
function buildExtraNotes(row: CustomerImportRow): string | undefined {
  const parts: string[] = [];
  if (row.email) parts.push(`ایمیل: ${row.email}`);
  if (row.address) parts.push(`آدرس: ${row.address}`);
  if (row.birthdate) parts.push(`تاریخ تولد: ${row.birthdate}`);
  if (row.notes) parts.push(row.notes);
  return parts.length ? parts.join(' | ') : undefined;
}

function renderCustomerImportPreview(rows: CustomerImportRow[]): HTMLElement {
  const table = el('div', { class: 'import-table' });
  table.appendChild(
    el('div', { class: 'import-table__row import-table__row--head' }, [
      el('span', {}, ['#']),
      el('span', {}, ['نام']),
      el('span', {}, ['موبایل']),
      el('span', {}, ['ایمیل']),
      el('span', {}, ['آدرس']),
    ]),
  );
  rows.slice(0, 5).forEach((row, i) => {
    table.appendChild(
      el('div', { class: 'import-table__row' }, [
        el('span', {}, [toPersian(i + 1)]),
        el('span', {}, [row.name || '—']),
        el('span', {}, [row.phone || '—']),
        el('span', {}, [row.email || '—']),
        el('span', {}, [row.address || '—']),
      ]),
    );
  });
  return table;
}

type DuplicateAction = 'skip' | 'update';

function renderDuplicateSection(
  duplicates: { row: CustomerImportRow; existing: Customer }[],
  actions: Map<number, DuplicateAction>,
): HTMLElement {
  if (!duplicates.length) return el('div');
  const rows = duplicates.map(({ row, existing }) => {
    const select = el('select', { class: 'input input--sm' }, [
      el('option', { value: 'skip' }, ['رد کردن']),
      el('option', { value: 'update' }, ['بروزرسانی اطلاعات موجود']),
    ]);
    (select as HTMLSelectElement).value = actions.get(row.rowIndex) ?? 'skip';
    select.addEventListener('change', () => {
      actions.set(row.rowIndex, (select as HTMLSelectElement).value as DuplicateAction);
    });
    return el('div', { class: 'import-table__row' }, [
      el('span', {}, [`${row.name || '—'} (${row.phone}) ⟷ ${existing.name}`]),
      select,
    ]);
  });
  return el('div', { class: 'import-table' }, [
    el('div', { class: 'import-table__row import-table__row--head' }, [el('span', {}, ['مشتریان تکراری شناسایی‌شده'])]),
    ...rows,
  ]);
}

function openCustomerImportModal(): void {
  let currentSheet: ParsedSheet | null = null;
  let currentMapping: Record<CustomerField, number> = { name: -1, phone: -1, email: -1, address: -1, birthdate: -1, notes: -1 };
  let currentRows: CustomerImportRow[] = [];
  const duplicateActions = new Map<number, DuplicateAction>();

  const fileInput = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', class: 'input' });
  const statusEl = el('p', { class: 'form-hint' }, ['یک فایل اکسل یا CSV حاوی لیست مشتریان انتخاب کنید.']);
  const mappingContainer = el('div');
  const countEl = el('p', { class: 'form-hint' });
  const previewContainer = el('div');
  const duplicateContainer = el('div');
  const summaryContainer = el('div');
  const confirmBtn = el('button', { type: 'button', class: 'btn btn-primary', disabled: true }, ['تأیید و وارد کردن']);

  function rebuildRows(): void {
    if (!currentSheet) return;
    currentRows = buildCustomerRows(currentSheet, currentMapping);
    duplicateActions.clear();

    const existing = customers.get();
    const duplicates: { row: CustomerImportRow; existing: Customer }[] = [];
    for (const row of currentRows) {
      if (!row.phone) continue;
      const match = existing.find((c) => normalizePhone(c.phone) === normalizePhone(row.phone));
      if (match) {
        duplicates.push({ row, existing: match });
        duplicateActions.set(row.rowIndex, 'skip');
      }
    }

    countEl.textContent = `${toPersian(currentRows.length)} مشتری شناسایی شد`;
    previewContainer.innerHTML = '';
    previewContainer.appendChild(renderCustomerImportPreview(currentRows));
    duplicateContainer.innerHTML = '';
    duplicateContainer.appendChild(renderDuplicateSection(duplicates, duplicateActions));
    confirmBtn.disabled = currentRows.length === 0;
  }

  function rerenderMapping(): void {
    if (!currentSheet) return;
    mappingContainer.innerHTML = '';
    mappingContainer.appendChild(customerMappingRow(currentSheet.headers, currentMapping, rebuildRows));
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      currentSheet = await parseSpreadsheetFile(file);
      currentMapping = detectCustomerColumns(currentSheet.headers);
      statusEl.textContent = `${toPersian(currentSheet.rows.length)} ردیف در فایل یافت شد — ستون‌ها را تأیید کنید`;
      rerenderMapping();
      rebuildRows();
      summaryContainer.innerHTML = '';
    } catch {
      showToast('خطا در خواندن فایل', 'error');
    }
  });

  confirmBtn.addEventListener('click', async () => {
    if (!currentRows.length) return;
    confirmBtn.disabled = true;

    let imported = 0;
    let updated = 0;
    let skippedDuplicates = 0;
    let errors = 0;

    for (const row of currentRows) {
      if (!row.name.trim() || !row.phone.trim()) {
        errors++;
        continue;
      }
      const existing = customers.get().find((c) => normalizePhone(c.phone) === normalizePhone(row.phone));
      if (existing) {
        const action = duplicateActions.get(row.rowIndex) ?? 'skip';
        if (action === 'update') {
          await db.updateCustomer(existing.id, {
            name: row.name.trim(),
            phone: row.phone.trim(),
            notes: buildExtraNotes(row) ?? existing.notes,
          });
          updated++;
        } else {
          skippedDuplicates++;
        }
        continue;
      }
      await db.createCustomer({ name: row.name.trim(), phone: row.phone.trim(), notes: buildExtraNotes(row) });
      imported++;
    }

    await refreshCustomers();

    summaryContainer.innerHTML = '';
    const lines = [`✓ ${toPersian(imported)} مشتری وارد شد`];
    if (updated) lines.push(`🔄 ${toPersian(updated)} مشتری بروزرسانی شد`);
    lines.push(`⚠ ${toPersian(skippedDuplicates)} مورد تکراری رد شد`);
    lines.push(`✗ ${toPersian(errors)} ردیف خطا داشت`);
    summaryContainer.appendChild(
      el(
        'div',
        { class: 'import-summary-card' },
        lines.map((line, i) => el('p', { class: `import-summary-card__line${i === 0 ? ' import-summary-card__line--strong' : ''}` }, [line])),
      ),
    );

    showToast('وارد کردن مشتریان انجام شد', 'success');
    previewContainer.innerHTML = '';
    duplicateContainer.innerHTML = '';
    mappingContainer.innerHTML = '';
    countEl.textContent = '';
    statusEl.textContent = 'یک فایل اکسل یا CSV حاوی لیست مشتریان انتخاب کنید.';
    fileInput.value = '';
    currentSheet = null;
    currentRows = [];
    confirmBtn.disabled = true;
  });

  const body = el('div', { class: 'form' }, [
    field('فایل اکسل/CSV', fileInput),
    statusEl,
    mappingContainer,
    countEl,
    previewContainer,
    duplicateContainer,
    el('div', { class: 'modal-actions' }, [confirmBtn]),
    summaryContainer,
  ]);

  openModal({ title: 'وارد کردن مشتریان از فایل Excel', body, maxWidth: '640px' });
}

function importCustomersBtn(): HTMLElement {
  const btn = el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: openCustomerImportModal }, []);
  btn.append(svgIcon('upload', 14), ' وارد کردن مشتریان از فایل Excel');
  return btn;
}

function renderCustomersTab(container: HTMLElement): () => void {
  const searchInput = el('input', { type: 'search', class: 'input', placeholder: 'جستجو بر اساس نام یا شماره موبایل' });
  const listEl = el('div', { class: 'expense-list' });
  container.append(
    el('div', { class: 'tab-toolbar' }, [
      searchInput,
      importCustomersBtn(),
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
          icon: 'user',
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

// ---------- RFM Segmentation tab ----------

function renderSegmentsTab(container: HTMLElement): () => void {
  const summaryEl = el('div', { class: 'kpi-grid' });
  const listEl = el('div', { class: 'expense-list' });
  let activeSegment: RFMSegment | 'all' = 'all';

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
        el('div', { class: 'expense-row__meta' }, [`${c.phone} · ${formatMoney(c.totalSpent)} · ${toPersian(c.rfmScore.recencyDays)} روز از آخرین بازدید`]),
      ]),
    ]);
  }

  function render(): void {
    const list = customers.get();
    const bySegment = new Map<RFMSegment, Customer[]>(RFM_SEGMENT_ORDER.map((s) => [s, []]));
    for (const c of list) bySegment.get(c.segment)!.push(c);

    summaryEl.innerHTML = '';
    summaryEl.appendChild(
      kpiCard('users', 'همه مشتریان', toPersian(list.length), undefined, () => {
        activeSegment = 'all';
        renderList();
      }),
    );
    for (const seg of RFM_SEGMENT_ORDER) {
      summaryEl.appendChild(
        kpiCard(rfmSegmentIcon(seg), formatRfmSegment(seg), toPersian(bySegment.get(seg)!.length), undefined, () => {
          activeSegment = seg;
          renderList();
        }),
      );
    }

    function renderList(): void {
      listEl.innerHTML = '';
      const shown = activeSegment === 'all' ? list : bySegment.get(activeSegment)!;
      if (!shown.length) {
        listEl.appendChild(emptyState({ icon: 'search', title: 'مشتری‌ای در این بخش نیست' }));
        return;
      }
      for (const c of shown) listEl.appendChild(renderRow(c));
    }

    renderList();
  }

  const unsub = customers.subscribe(render);
  return () => unsub();
}

// ---------- Automation tab ----------

function findTrigger(type: AutomationTriggerType): AutomationTrigger | undefined {
  return automationTriggers.get().find((t) => t.type === type);
}

function renderAutomationCard(type: AutomationTriggerType): HTMLElement {
  const existing = findTrigger(type);
  const templateInput = el('textarea', {
    class: 'input',
    rows: 2,
    value: existing?.action.messageTemplate ?? AUTOMATION_DEFAULT_TEMPLATES[type],
  }) as HTMLTextAreaElement;

  const toggle = el('input', {
    type: 'checkbox',
    checked: existing?.isActive ?? false,
    onchange: async (e: Event) => {
      const isActive = (e.target as HTMLInputElement).checked;
      const current = findTrigger(type);
      if (current) {
        await db.updateAutomationTrigger(current.id, { isActive });
      } else {
        await db.createAutomationTrigger({
          name: AUTOMATION_LABELS[type],
          type,
          conditions: {},
          action: { channel: 'sms', messageTemplate: templateInput.value.trim() || AUTOMATION_DEFAULT_TEMPLATES[type] },
          isActive,
        });
      }
      await refreshAutomationTriggers();
      showToast(isActive ? 'اتوماسیون فعال شد' : 'اتوماسیون غیرفعال شد', 'success');
    },
  });

  const saveBtn = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-secondary btn-sm',
      onclick: async () => {
        const messageTemplate = templateInput.value.trim();
        if (!messageTemplate) {
          showToast('متن پیامک نمی‌تواند خالی باشد', 'error');
          return;
        }
        const current = findTrigger(type);
        if (current) {
          await db.updateAutomationTrigger(current.id, { action: { channel: 'sms', messageTemplate } });
        } else {
          await db.createAutomationTrigger({
            name: AUTOMATION_LABELS[type],
            type,
            conditions: {},
            action: { channel: 'sms', messageTemplate },
            isActive: false,
          });
        }
        await refreshAutomationTriggers();
        showToast('متن پیامک ذخیره شد', 'success');
      },
    },
    ['ذخیره متن'],
  );

  const statsLine = existing
    ? `${toPersian(existing.timesRun)} بار اجرا · ${toPersian(existing.successCount)} ارسال موفق${existing.lastRun ? ` · آخرین اجرا: ${formatDateTime(existing.lastRun)}` : ''}`
    : 'هنوز اجرا نشده است';

  return el('div', { class: 'automation-card' }, [
    el('div', { class: 'automation-card__head' }, [
      el('div', { class: 'automation-card__title-wrap' }, [
        el('span', { class: 'automation-card__title' }, [AUTOMATION_LABELS[type]]),
        el('p', { class: 'automation-card__desc' }, [AUTOMATION_DESCRIPTIONS[type]]),
      ]),
      el('label', { class: 'automation-card__switch' }, [toggle]),
    ]),
    field('متن پیامک', templateInput),
    el('div', { class: 'modal-actions' }, [saveBtn]),
    el('p', { class: 'form-hint' }, [statsLine]),
  ]);
}

function renderAutomationTab(container: HTMLElement): () => void {
  const cardsEl = el('div', { class: 'automation-grid' });
  container.append(
    el('p', { class: 'form-hint' }, ['اتوماسیون‌های فعال، بدون نیاز به دخالت دستی، پیامک مناسب را در زمان درست برای هر مشتری ارسال می‌کنند.']),
    cardsEl,
  );

  function render(): void {
    cardsEl.innerHTML = '';
    for (const type of AUTOMATION_TYPES) cardsEl.appendChild(renderAutomationCard(type));
  }

  const unsub = automationTriggers.subscribe(render);
  return () => unsub();
}

// ---------- Bulk SMS tab ----------

type RecipientMode = 'selected' | 'all' | 'manual' | 'segment';

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
      { value: 'segment', label: 'بر اساس بخش RFM' },
      { value: 'all', label: 'همه مشتریان' },
      { value: 'manual', label: 'وارد کردن دستی شماره‌ها' },
    ],
    'selected',
  );
  const manualInput = el('textarea', { class: 'input', rows: 3, placeholder: '۰۹xxxxxxxxx، ۰۹xxxxxxxxx', hidden: true });
  const segmentSelect = selectEl(RFM_SEGMENT_ORDER.map((seg) => ({ value: seg, label: formatRfmSegment(seg) })));
  segmentSelect.hidden = true;
  modeSelect.addEventListener('change', () => {
    const mode = (modeSelect as HTMLSelectElement).value as RecipientMode;
    manualInput.hidden = mode !== 'manual';
    segmentSelect.hidden = mode !== 'segment';
  });

  const messageInput = el('textarea', { class: 'input', rows: 4, placeholder: 'متن پیامک...' });
  const sendBtn = el('button', { type: 'button', class: 'btn btn-primary', onclick: () => void handleSend() }, ['ارسال پیامک گروهی']);

  const composeBody = el('div', { class: 'form' }, [
    field('گیرندگان', modeSelect),
    segmentSelect,
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
    else if (mode === 'segment') {
      const seg = (segmentSelect as HTMLSelectElement).value as RFMSegment;
      receptors = customers.get().filter((c) => c.segment === seg).map((c) => c.phone);
    } else receptors = (manualInput as HTMLTextAreaElement).value.split(/[,\n]/).map((p) => p.trim()).filter(Boolean);
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
      historyEl.appendChild(emptyState({ icon: 'mail', title: 'هنوز پیامکی ارسال نشده است' }));
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
      iconBtn('award', 'ویرایش امتیاز', () => openAdjustPointsModal(c)),
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
          icon: 'award',
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

const SEGMENT_CHART_COLORS: Record<RFMSegment, string> = {
  champions: palette.mint,
  loyal: palette.primary,
  potential: palette.blue,
  regular: palette.primaryD,
  new: palette.amber,
  at_risk: palette.coral,
  hibernating: '#9BA0B0',
  lost: palette.red,
};

function renderReportTab(container: HTMLElement): () => void {
  const statsEl = el('div', { class: 'kpi-grid' });
  const canvas = el('canvas');
  const chartCard = el('div', { class: 'chart-card' }, [
    el('h3', { class: 'chart-card__title' }, ['توزیع بخش‌بندی RFM مشتریان']),
    el('div', { class: 'chart-card__canvas-wrap' }, [canvas]),
  ]);
  const topListEl = el('div', { class: 'expense-list' });

  container.append(statsEl, chartCard, el('h3', { class: 'settings-card__title' }, ['مشتریان برتر']), topListEl);

  function render(): void {
    const list = customers.get();
    const totalSpent = list.reduce((sum, c) => sum + c.totalSpent, 0);
    const avgSpend = list.length ? totalSpent / list.length : 0;

    const allCampaigns = list.flatMap((c) => c.campaignHistory);
    const automatedCampaigns = allCampaigns.filter((c) => c.type === 'automation');
    const successRate = automatedCampaigns.length
      ? (automatedCampaigns.filter((c) => c.status === 'sent').length / automatedCampaigns.length) * 100
      : 0;

    statsEl.innerHTML = '';
    statsEl.appendChild(kpiCard('users', 'تعداد مشتریان', toPersian(list.length)));
    statsEl.appendChild(kpiCard('wallet', 'مجموع خرید مشتریان', formatMoney(totalSpent)));
    statsEl.appendChild(kpiCard('bar-chart', 'میانگین خرید هر مشتری', formatMoney(avgSpend)));
    statsEl.appendChild(kpiCard('cpu', 'پیامک‌های اتوماسیون', toPersian(automatedCampaigns.length)));
    statsEl.appendChild(kpiCard('check', 'نرخ موفقیت اتوماسیون', formatPct(successRate)));
    statsEl.appendChild(kpiCard('mail', 'تعداد پیامک‌های گروهی', toPersian(smsLogs.get().length)));

    const bySegment = new Map<RFMSegment, number>();
    for (const c of list) bySegment.set(c.segment, (bySegment.get(c.segment) ?? 0) + 1);
    const segs = RFM_SEGMENT_ORDER.filter((s) => (bySegment.get(s) ?? 0) > 0);

    if (!segs.length) {
      destroyChart(canvas);
      chartCard.style.display = 'none';
    } else {
      chartCard.style.display = '';
      renderChart(canvas, {
        type: 'doughnut',
        data: {
          labels: segs.map((s) => formatRfmSegment(s)),
          datasets: [{ data: segs.map((s) => bySegment.get(s) ?? 0), backgroundColor: segs.map((s) => SEGMENT_CHART_COLORS[s]) }],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    }

    topListEl.innerHTML = '';
    const top = [...list].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);
    if (!top.length) {
      topListEl.appendChild(emptyState({ icon: 'award', title: 'هنوز داده‌ای برای نمایش وجود ندارد' }));
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
  const unsubA = automationTriggers.subscribe(render);
  return () => {
    unsubC();
    unsubS();
    unsubA();
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
    { id: 'segments', label: 'بخش‌بندی RFM', render: renderSegmentsTab },
    { id: 'automation', label: 'اتوماسیون', render: renderAutomationTab },
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

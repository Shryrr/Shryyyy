import * as db from '../db';
import { confirmModal } from '../components/modal';
import { destroyChart, palette, renderChart } from '../components/chart';
import { showToast } from '../components/toast';
import { el, emptyState, field, kpiCard, numberInput, parseNumberInput, selectEl } from '../utils/dom';
import { formatDateShort, formatMoney, formatPct, formatUnit, toPersian, todayISO } from '../utils/format';
import type { RouteCleanup } from '../router';
import { ingredientsById, menuItems, refreshIngredients, refreshSales, refreshShoppingList, sales, settings } from '../store';
import { dailySeries, recipeCost, salesInPeriod } from '../utils/calc';
import { scheduleRecalculation } from '../utils/inventory-engine';
import { scheduleRfmRecalculation } from '../utils/rfm';
import { scheduleAutomationRun } from '../utils/automation';
import {
  buildCashierRows,
  buildSnappfoodRows,
  CASHIER_FIELD_LABELS,
  detectCashierColumns,
  detectSnappfoodColumns,
  parseSpreadsheetFile,
  SNAPPFOOD_FIELD_LABELS,
  type CashierField,
  type CashierImportRow,
  type MatchType,
  type ParsedSheet,
  type SnappfoodField,
  type SnappfoodImportRow,
} from '../utils/excel-import';
import type { MenuItem, Sale } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

const PERIOD_OPTIONS = [
  { value: '1', label: 'امروز' },
  { value: '7', label: '۷ روز گذشته' },
  { value: '30', label: '۳۰ روز گذشته' },
  { value: '90', label: '۹۰ روز گذشته' },
  { value: '36500', label: 'همه' },
];

function panel(title: string, body: HTMLElement): HTMLElement {
  return el('div', { class: 'chart-card' }, [el('h3', { class: 'chart-card__title' }, [title]), body]);
}

function renderQuickSaleForm(container: HTMLElement): () => void {
  const menuItemSelect = el('select', { class: 'input' });
  const qtyInput = numberInput(1);
  const dateInput = el('input', { type: 'date', class: 'input', value: todayISO().slice(0, 10) });
  const noteInput = el('input', { type: 'text', class: 'input' });

  function renderOptions(): void {
    const active = menuItems.get().filter((m) => m.isActive);
    const selected = menuItemSelect.value;
    menuItemSelect.innerHTML = '';
    for (const m of active) {
      const opt = el('option', { value: m.id }, [`${m.name} — ${formatMoney(m.salePrice)}`]);
      if (m.id === selected) opt.selected = true;
      menuItemSelect.appendChild(opt);
    }
  }

  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    const menuItemId = menuItemSelect.value;
    const quantity = parseNumberInput(qtyInput);
    if (!menuItemId) {
      showToast('یک آیتم منو انتخاب کنید', 'error');
      return;
    }
    if (quantity <= 0) {
      showToast('تعداد باید بیشتر از صفر باشد', 'error');
      return;
    }
    const menuItem = menuItems.get().find((m) => m.id === menuItemId);
    const s = settings.get();
    let vatAmount: number | undefined;
    let vatRate: number | undefined;
    if (menuItem && s?.vatEnabled) {
      const total = menuItem.salePrice * quantity;
      vatRate = s.vatRate;
      vatAmount = s.vatIncludedInPrice ? total - total / (1 + vatRate / 100) : total * (vatRate / 100);
    }
    await db.recordSale({
      menuItemId,
      quantity,
      date: dateInput.value ? new Date(dateInput.value).toISOString() : todayISO(),
      note: noteInput.value.trim() || undefined,
      vatAmount,
      vatRate,
    });
    await Promise.all([refreshSales(), refreshIngredients(), refreshShoppingList()]);
    scheduleRecalculation();
    scheduleRfmRecalculation();
    scheduleAutomationRun();
    showToast('فروش ثبت شد', 'success');
    qtyInput.value = toPersian(1);
    noteInput.value = '';
  }

  const form = el('form', { class: 'form', onsubmit: handleSubmit }, [
    field('آیتم منو', menuItemSelect),
    field('تعداد', qtyInput),
    field('تاریخ', dateInput),
    field('یادداشت (اختیاری)', noteInput),
    el('div', { class: 'modal-actions' }, [el('button', { type: 'submit', class: 'btn btn-primary' }, ['ثبت فروش'])]),
  ]);

  container.appendChild(el('div', { class: 'quick-sale-card' }, [el('h3', { class: 'chart-card__title' }, ['ثبت فروش سریع']), form]));

  const unsub = menuItems.subscribe(renderOptions);
  return () => unsub();
}

function renderBulkBreakdown(container: HTMLElement, sale: Sale): void {
  container.innerHTML = '';
  if (!sale.estimatedBreakdown?.length) return;
  const rows = sale.estimatedBreakdown.map((b) =>
    el('div', { class: 'top-items-row' }, [
      el('span', { class: 'top-items-row__name' }, [b.menuItemName]),
      el('span', { class: 'top-items-row__qty' }, [`~${toPersian(b.estimatedQuantity.toFixed(1))} عدد`]),
      el('span', { class: 'top-items-row__revenue' }, [formatMoney(b.estimatedRevenue)]),
    ]),
  );
  container.appendChild(panel('برآورد تفکیک فروش کلی', el('div', { class: 'top-items-list' }, rows)));
}

function renderBulkSaleForm(container: HTMLElement): () => void {
  const dateInput = el('input', { type: 'date', class: 'input', value: todayISO().slice(0, 10) });
  const revenueInput = numberInput(0);
  const breakdownContainer = el('div');

  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    const totalRevenue = parseNumberInput(revenueInput);
    if (totalRevenue <= 0) {
      showToast('مبلغ فروش باید بیشتر از صفر باشد', 'error');
      return;
    }
    try {
      const sale = await db.recordBulkSale({
        date: dateInput.value ? new Date(dateInput.value).toISOString() : todayISO(),
        totalRevenue,
      });
      await Promise.all([refreshSales(), refreshIngredients(), refreshShoppingList()]);
      scheduleRecalculation();
      scheduleRfmRecalculation();
      scheduleAutomationRun();
      showToast('فروش کلی پایان روز ثبت شد', 'success');
      revenueInput.value = toPersian(0);
      renderBulkBreakdown(breakdownContainer, sale);
    } catch {
      showToast('برای برآورد فروش کلی، حداقل یک آیتم منو فعال لازم است', 'error');
    }
  }

  const form = el('form', { class: 'form', onsubmit: handleSubmit }, [
    field('تاریخ', dateInput),
    field('مجموع فروش روز (تومان)', revenueInput),
    el('p', { class: 'form-hint' }, ['تفکیک بین آیتم‌های منو بر اساس سهم فروش ۳۰ روز گذشته برآورد می‌شود.']),
    el('div', { class: 'modal-actions' }, [el('button', { type: 'submit', class: 'btn btn-primary' }, ['ثبت فروش کلی'])]),
  ]);

  container.appendChild(
    el(
      'div',
      { class: 'quick-sale-card' },
      [el('h3', { class: 'chart-card__title' }, ['ثبت فروش پایان روز (کلی)']), form, breakdownContainer],
    ),
  );

  return () => {};
}

function renderSaleRow(s: Sale, onDelete: (s: Sale) => void): HTMLElement {
  const sourceBadge =
    s.source === 'cashier' ? ' صندوق' : s.source === 'snappfood' ? ' اسنپ‌فود' : s.type === 'bulk' ? ' کلی' : null;
  return el('div', { class: 'sales-log-row' }, [
    el('span', { class: 'sales-log-row__date' }, [formatDateShort(s.date)]),
    el('span', { class: 'sales-log-row__name' }, [s.menuItemName, sourceBadge ? el('span', { class: 'badge' }, [sourceBadge]) : null]),
    el('span', { class: 'sales-log-row__qty' }, [s.type === 'bulk' ? '—' : `${toPersian(s.quantity)} عدد`]),
    el('span', { class: 'sales-log-row__total' }, [formatMoney(s.unitSalePrice * s.quantity)]),
    el('button', { type: 'button', class: 'icon-btn', title: 'حذف', onclick: () => onDelete(s) }, ['🗑️']),
  ]);
}

export function renderSalesLogTab(container: HTMLElement): () => void {
  const root = el('div', { class: 'tab-content' });
  container.appendChild(root);

  const formContainer = el('div');
  const bulkFormContainer = el('div');
  const periodSelect = selectEl(PERIOD_OPTIONS, '30');
  const statsContainer = el('div');
  const chartContainer = el('div');
  const topItemsContainer = el('div');
  const logContainer = el('div');

  root.append(
    formContainer,
    bulkFormContainer,
    el('div', { class: 'toolbar' }, [periodSelect]),
    statsContainer,
    chartContainer,
    topItemsContainer,
    logContainer,
  );

  const formCleanup = renderQuickSaleForm(formContainer);
  const bulkFormCleanup = renderBulkSaleForm(bulkFormContainer);

  let activeCanvas: HTMLCanvasElement | null = null;

  async function handleDeleteSale(s: Sale): Promise<void> {
    const confirmed = await confirmModal({
      title: 'حذف فروش',
      message: `این فروش (${s.menuItemName}) حذف می‌شود و موجودی مواد اولیه به حالت قبل برمی‌گردد.`,
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!confirmed) return;
    await db.deleteSale(s.id);
    await Promise.all([refreshSales(), refreshIngredients(), refreshShoppingList()]);
    scheduleRecalculation();
    scheduleRfmRecalculation();
    scheduleAutomationRun();
    showToast('فروش حذف شد', 'success');
  }

  function renderContent(): void {
    const now = new Date();
    const periodDays = Number(periodSelect.value);
    const periodStart = new Date(now.getTime() - periodDays * DAY_MS);
    const periodSales = salesInPeriod(sales.get(), periodStart, now);

    const revenue = periodSales.reduce((sum, s) => sum + s.unitSalePrice * s.quantity, 0);
    const cogs = periodSales.reduce((sum, s) => sum + s.unitCost * s.quantity, 0);
    const quantity = periodSales.reduce((sum, s) => sum + s.quantity, 0);
    const profit = revenue - cogs;
    const pct = revenue > 0 ? (cogs / revenue) * 100 : 0;

    statsContainer.innerHTML = '';
    statsContainer.appendChild(
      el('div', { class: 'kpi-grid' }, [
        kpiCard('💰', 'فروش دوره', formatMoney(revenue)),
        kpiCard('🧾', 'تعداد فروش', toPersian(quantity)),
        kpiCard('📈', 'سود ناخالص دوره', formatMoney(profit), profit >= 0 ? 'positive' : 'negative'),
        kpiCard('🍽️', 'فودکاست دوره', formatPct(pct)),
      ]),
    );

    if (activeCanvas) destroyChart(activeCanvas);
    chartContainer.innerHTML = '';
    const canvas = el('canvas');
    activeCanvas = canvas;
    const wrap = el('div', { class: 'chart-card__canvas-wrap' }, [canvas]);
    chartContainer.appendChild(panel('روند فروش و بهای تمام‌شده', wrap));
    const series = dailySeries(sales.get(), Math.min(periodDays, 30), now);
    renderChart(canvas, {
      type: 'bar',
      data: {
        labels: series.map((d) => formatDateShort(d.date)),
        datasets: [
          { label: 'فروش', data: series.map((d) => d.revenue), backgroundColor: palette.primary, borderRadius: 4 },
          { label: 'بهای تمام‌شده', data: series.map((d) => d.cogs), backgroundColor: palette.coral, borderRadius: 4 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
    });

    const byItem = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const s of periodSales) {
      const entry = byItem.get(s.menuItemId) ?? { name: s.menuItemName, quantity: 0, revenue: 0 };
      entry.quantity += s.quantity;
      entry.revenue += s.unitSalePrice * s.quantity;
      byItem.set(s.menuItemId, entry);
    }
    const topItems = Array.from(byItem.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    topItemsContainer.innerHTML = '';
    const topItemsBody = topItems.length
      ? el(
          'div',
          { class: 'top-items-list' },
          topItems.map((t, i) =>
            el('div', { class: 'top-items-row' }, [
              el('span', { class: 'top-items-row__rank' }, [toPersian(i + 1)]),
              el('span', { class: 'top-items-row__name' }, [t.name]),
              el('span', { class: 'top-items-row__qty' }, [`${toPersian(t.quantity)} عدد`]),
              el('span', { class: 'top-items-row__revenue' }, [formatMoney(t.revenue)]),
            ]),
          ),
        )
      : emptyState({ icon: '📊', title: 'فروشی در این دوره ثبت نشده است' });
    topItemsContainer.appendChild(panel('پرفروش‌ترین آیتم‌ها', topItemsBody));

    logContainer.innerHTML = '';
    const sortedLog = [...periodSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const logBody = sortedLog.length
      ? el(
          'div',
          { class: 'sales-log' },
          sortedLog.map((s) => renderSaleRow(s, handleDeleteSale)),
        )
      : emptyState({ icon: '🧾', title: 'فروشی در این دوره ثبت نشده است' });
    logContainer.appendChild(panel('سوابق فروش', logBody));
  }

  periodSelect.addEventListener('change', renderContent);
  const unsub = sales.subscribe(renderContent);

  return () => {
    unsub();
    formCleanup();
    bulkFormCleanup();
    if (activeCanvas) destroyChart(activeCanvas);
  };
}

// ---------- Excel import tab ----------

function matchBadge(matchType: MatchType): HTMLElement {
  const variant = matchType === 'exact' ? ['✓', 'match-badge--exact'] : matchType === 'fuzzy' ? ['⚠', 'match-badge--fuzzy'] : ['●', 'match-badge--none'];
  return el('span', { class: `match-badge ${variant[1]}` }, [variant[0]]);
}

function buildItemResolutionSelect(menuItemsList: MenuItem[], selected: string | null): HTMLSelectElement {
  const select = el('select', { class: 'input input--sm' });
  select.appendChild(el('option', { value: '__skip__' }, ['نادیده گرفتن']));
  for (const m of menuItemsList) {
    const opt = el('option', { value: m.id }, [m.name]);
    if (m.id === selected) opt.selected = true;
    select.appendChild(opt);
  }
  if (selected === null) select.value = '__skip__';
  return select as HTMLSelectElement;
}

function buildMappingRow<F extends string>(
  headers: string[],
  mapping: Record<F, number>,
  labels: Record<F, string>,
  fields: F[],
  onChange: () => void,
): HTMLElement {
  const row = el('div', { class: 'import-mapping' });
  for (const fieldKey of fields) {
    const select = el('select', { class: 'input input--sm' });
    select.appendChild(el('option', { value: '-1' }, ['— تشخیص نشد —']));
    headers.forEach((h, idx) => {
      const opt = el('option', { value: String(idx) }, [h || `ستون ${toPersian(idx + 1)}`]);
      if (idx === mapping[fieldKey]) opt.selected = true;
      select.appendChild(opt);
    });
    if (mapping[fieldKey] === -1) select.value = '-1';
    select.addEventListener('change', () => {
      mapping[fieldKey] = Number(select.value);
      onChange();
    });
    row.appendChild(field(labels[fieldKey], select));
  }
  return row;
}

function inventoryChangesLine(deltas: Map<string, number>): HTMLElement | null {
  const idMap = ingredientsById();
  const parts = Array.from(deltas.entries()).map(([ingredientId, qty]) => {
    const ing = idMap.get(ingredientId);
    const name = ing?.name ?? ingredientId;
    const unit = ing ? formatUnit(ing.unit) : '';
    return `${name}: −${toPersian(Number(qty.toFixed(2)))} ${unit}`;
  });
  return parts.length ? el('p', { class: 'import-summary-card__inventory' }, [parts.join(' | ')]) : null;
}

function renderCashierPreviewTable(rows: CashierImportRow[], menuItemsList: MenuItem[], resolutions: (string | null)[]): HTMLElement {
  const table = el('div', { class: 'import-table' });
  table.appendChild(
    el('div', { class: 'import-table__row import-table__row--head' }, [
      el('span', {}, ['#']),
      el('span', {}, ['نام آیتم (فایل)']),
      el('span', {}, ['تطبیق با منو']),
      el('span', {}, ['تعداد']),
      el('span', {}, ['قیمت واحد']),
      el('span', {}, ['مجموع']),
    ]),
  );
  rows.forEach((row, i) => {
    const select = buildItemResolutionSelect(menuItemsList, resolutions[i]);
    select.addEventListener('change', () => {
      resolutions[i] = select.value === '__skip__' ? null : select.value;
    });
    table.appendChild(
      el('div', { class: 'import-table__row' }, [
        el('span', {}, [toPersian(i + 1)]),
        el('span', {}, [row.itemName || '—']),
        el('span', { class: 'import-table__match' }, [matchBadge(row.match.matchType), select]),
        el('span', {}, [toPersian(row.quantity)]),
        el('span', {}, [formatMoney(row.unitPrice)]),
        el('span', {}, [formatMoney(row.total)]),
      ]),
    );
  });
  return table;
}

function renderCashierImport(container: HTMLElement): () => void {
  let currentSheet: ParsedSheet | null = null;
  let currentMapping: Record<CashierField, number> = { itemName: -1, quantity: -1, unitPrice: -1, total: -1 };
  let currentRows: CashierImportRow[] = [];
  let resolutions: (string | null)[] = [];

  const fileInput = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', class: 'input' });
  const statusEl = el('p', { class: 'form-hint' }, ['یک فایل اکسل یا CSV از صندوق فروش انتخاب کنید.']);
  const mappingContainer = el('div');
  const previewContainer = el('div');
  const summaryContainer = el('div');
  const confirmBtn = el('button', { type: 'button', class: 'btn btn-primary', disabled: true }, ['تأیید و وارد کردن']);

  function rebuildRows(): void {
    if (!currentSheet) return;
    currentRows = buildCashierRows(currentSheet, currentMapping, menuItems.get());
    resolutions = currentRows.map((r) => r.match.menuItem?.id ?? null);
    previewContainer.innerHTML = '';
    previewContainer.appendChild(renderCashierPreviewTable(currentRows, menuItems.get(), resolutions));
    confirmBtn.disabled = currentRows.length === 0;
  }

  function rerenderMapping(): void {
    if (!currentSheet) return;
    mappingContainer.innerHTML = '';
    mappingContainer.appendChild(
      buildMappingRow(currentSheet.headers, currentMapping, CASHIER_FIELD_LABELS, ['itemName', 'quantity', 'unitPrice', 'total'], rebuildRows),
    );
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      currentSheet = await parseSpreadsheetFile(file);
      currentMapping = detectCashierColumns(currentSheet.headers);
      statusEl.textContent = `${toPersian(currentSheet.rows.length)} ردیف شناسایی شد — ستون‌ها را تأیید کنید`;
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
    const deltas = new Map<string, number>();
    let revenue = 0;
    let cost = 0;
    let importedCount = 0;
    const items = menuItems.get();

    for (let i = 0; i < currentRows.length; i++) {
      const menuItemId = resolutions[i];
      const row = currentRows[i];
      if (!menuItemId || row.quantity <= 0) continue;
      const menuItem = items.find((m) => m.id === menuItemId);
      if (!menuItem) continue;
      const sale = await db.recordImportedSale({
        menuItemId,
        quantity: row.quantity,
        unitSalePrice: row.unitPrice,
        date: todayISO(),
        source: 'cashier',
      });
      revenue += sale.unitSalePrice * sale.quantity;
      cost += sale.unitCost * sale.quantity;
      importedCount++;
      for (const ri of menuItem.recipe) {
        deltas.set(ri.ingredientId, (deltas.get(ri.ingredientId) ?? 0) + ri.quantity * row.quantity);
      }
    }

    await Promise.all([refreshSales(), refreshIngredients(), refreshShoppingList()]);
    scheduleRecalculation();
    scheduleRfmRecalculation();
    scheduleAutomationRun();

    if (importedCount === 0) {
      showToast('هیچ ردیفی برای ورود انتخاب نشده است', 'error');
      confirmBtn.disabled = false;
      return;
    }

    summaryContainer.innerHTML = '';
    summaryContainer.appendChild(
      el('div', { class: 'import-summary-card' }, [
        el('p', { class: 'import-summary-card__line import-summary-card__line--strong' }, [`✓ وارد شد: ${toPersian(importedCount)} ردیف`]),
        el('p', { class: 'import-summary-card__line' }, [`فروش کل: ${formatMoney(revenue)}`]),
        el('p', { class: 'import-summary-card__line' }, [`بهای تمام‌شده: ${formatMoney(cost)}`]),
        el('p', { class: 'import-summary-card__line' }, [`سود ناخالص: ${formatMoney(revenue - cost)}`]),
        el('p', { class: 'import-summary-card__line' }, [`کسری انبار اعمال‌شده: ${toPersian(deltas.size)} قلم`]),
        inventoryChangesLine(deltas),
      ]),
    );

    showToast('فایل فروش با موفقیت وارد شد', 'success');
    previewContainer.innerHTML = '';
    mappingContainer.innerHTML = '';
    statusEl.textContent = 'یک فایل اکسل یا CSV از صندوق فروش انتخاب کنید.';
    fileInput.value = '';
    currentSheet = null;
    currentRows = [];
    confirmBtn.disabled = true;
  });

  container.append(
    el('div', { class: 'quick-sale-card' }, [
      el('h3', { class: 'chart-card__title' }, ['ورودی فایل صندوق فروش حضوری']),
      field('فایل اکسل/CSV', fileInput),
      statusEl,
      mappingContainer,
      previewContainer,
      el('div', { class: 'modal-actions' }, [confirmBtn]),
      summaryContainer,
    ]),
  );

  return () => {};
}

function renderSnappfoodPreviewTable(
  rows: SnappfoodImportRow[],
  menuItemsList: MenuItem[],
  resolutions: (string | null)[],
  onResolutionChange: () => void,
): HTMLElement {
  const table = el('div', { class: 'import-table' });
  table.appendChild(
    el('div', { class: 'import-table__row import-table__row--head' }, [
      el('span', {}, ['#']),
      el('span', {}, ['نام آیتم (فایل)']),
      el('span', {}, ['تطبیق با منو']),
      el('span', {}, ['تعداد']),
      el('span', {}, ['قیمت']),
      el('span', {}, ['تخفیف']),
      el('span', {}, ['کمیسیون']),
      el('span', {}, ['مبلغ دریافتی']),
    ]),
  );
  rows.forEach((row, i) => {
    const select = buildItemResolutionSelect(menuItemsList, resolutions[i]);
    select.addEventListener('change', () => {
      resolutions[i] = select.value === '__skip__' ? null : select.value;
      onResolutionChange();
    });
    table.appendChild(
      el('div', { class: 'import-table__row' }, [
        el('span', {}, [toPersian(i + 1)]),
        el('span', {}, [row.itemName || '—']),
        el('span', { class: 'import-table__match' }, [matchBadge(row.match.matchType), select]),
        el('span', {}, [toPersian(row.quantity)]),
        el('span', {}, [formatMoney(row.price)]),
        el('span', {}, [formatMoney(row.discount)]),
        el('span', {}, [formatMoney(row.commission)]),
        el('span', {}, [formatMoney(row.netAmount)]),
      ]),
    );
  });
  return table;
}

function renderSnappfoodImport(container: HTMLElement): () => void {
  let currentSheet: ParsedSheet | null = null;
  let currentMapping: Record<SnappfoodField, number> = {
    itemName: -1,
    quantity: -1,
    price: -1,
    discount: -1,
    commission: -1,
    netAmount: -1,
  };
  let currentRows: SnappfoodImportRow[] = [];
  let resolutions: (string | null)[] = [];

  const fileInput = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', class: 'input' });
  const statusEl = el('p', { class: 'form-hint' }, ['فایل گزارش فروشندگان اسنپ‌فود را انتخاب کنید.']);
  const mappingContainer = el('div');
  const summaryContainer = el('div');
  const previewContainer = el('div');
  const inventoryContainer = el('div');
  const confirmBtn = el('button', { type: 'button', class: 'btn btn-primary', disabled: true }, ['تأیید و وارد کردن']);

  function renderSummary(): void {
    let grossSales = 0;
    let discount = 0;
    let commission = 0;
    let netReceived = 0;
    let cogs = 0;
    const idMap = ingredientsById();
    const items = menuItems.get();
    currentRows.forEach((row, i) => {
      grossSales += row.price * row.quantity;
      discount += row.discount;
      commission += row.commission;
      netReceived += row.netAmount;
      const menuItemId = resolutions[i];
      const menuItem = menuItemId ? items.find((m) => m.id === menuItemId) : undefined;
      if (menuItem) cogs += recipeCost(menuItem.recipe, idMap) * row.quantity;
    });
    const profit = netReceived - cogs;

    summaryContainer.innerHTML = '';
    summaryContainer.appendChild(
      el('div', { class: 'kpi-grid' }, [
        kpiCard('💰', 'فروش ناخالص', formatMoney(grossSales)),
        kpiCard('🏷️', 'تخفیف اسنپ', formatMoney(discount)),
        kpiCard('📉', 'کمیسیون اسنپ', formatMoney(commission)),
        kpiCard('💳', 'مبلغ دریافتی', formatMoney(netReceived)),
        kpiCard('🧮', 'بهای تمام‌شده', formatMoney(cogs)),
        kpiCard('📈', 'سود تخمینی', formatMoney(profit), profit >= 0 ? 'positive' : 'negative'),
      ]),
    );
  }

  function rebuildRows(): void {
    if (!currentSheet) return;
    currentRows = buildSnappfoodRows(currentSheet, currentMapping, menuItems.get());
    resolutions = currentRows.map((r) => r.match.menuItem?.id ?? null);
    previewContainer.innerHTML = '';
    previewContainer.appendChild(renderSnappfoodPreviewTable(currentRows, menuItems.get(), resolutions, renderSummary));
    confirmBtn.disabled = currentRows.length === 0;
    renderSummary();
  }

  function rerenderMapping(): void {
    if (!currentSheet) return;
    mappingContainer.innerHTML = '';
    mappingContainer.appendChild(
      buildMappingRow(
        currentSheet.headers,
        currentMapping,
        SNAPPFOOD_FIELD_LABELS,
        ['itemName', 'quantity', 'price', 'discount', 'commission', 'netAmount'],
        rebuildRows,
      ),
    );
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      currentSheet = await parseSpreadsheetFile(file);
      currentMapping = detectSnappfoodColumns(currentSheet.headers);
      statusEl.textContent = `${toPersian(currentSheet.rows.length)} ردیف شناسایی شد — ستون‌ها را تأیید کنید`;
      rerenderMapping();
      rebuildRows();
      inventoryContainer.innerHTML = '';
    } catch {
      showToast('خطا در خواندن فایل', 'error');
    }
  });

  confirmBtn.addEventListener('click', async () => {
    if (!currentRows.length) return;
    confirmBtn.disabled = true;
    const deltas = new Map<string, number>();
    let importedCount = 0;
    const items = menuItems.get();

    for (let i = 0; i < currentRows.length; i++) {
      const menuItemId = resolutions[i];
      const row = currentRows[i];
      if (!menuItemId || row.quantity <= 0) continue;
      const menuItem = items.find((m) => m.id === menuItemId);
      if (!menuItem) continue;
      await db.recordImportedSale({
        menuItemId,
        quantity: row.quantity,
        unitSalePrice: row.price,
        date: todayISO(),
        source: 'snappfood',
        snappfood: {
          grossSales: row.price * row.quantity,
          discount: row.discount,
          commission: row.commission,
          netReceived: row.netAmount,
        },
      });
      importedCount++;
      for (const ri of menuItem.recipe) {
        deltas.set(ri.ingredientId, (deltas.get(ri.ingredientId) ?? 0) + ri.quantity * row.quantity);
      }
    }

    await Promise.all([refreshSales(), refreshIngredients(), refreshShoppingList()]);
    scheduleRecalculation();
    scheduleRfmRecalculation();
    scheduleAutomationRun();

    if (importedCount === 0) {
      showToast('هیچ ردیفی برای ورود انتخاب نشده است', 'error');
      confirmBtn.disabled = false;
      return;
    }

    inventoryContainer.innerHTML = '';
    inventoryContainer.appendChild(
      el('div', { class: 'import-summary-card' }, [
        el('p', { class: 'import-summary-card__line import-summary-card__line--strong' }, [`✓ وارد شد: ${toPersian(importedCount)} ردیف`]),
        inventoryChangesLine(deltas),
      ]),
    );

    showToast('فایل اسنپ‌فود با موفقیت وارد شد', 'success');
    previewContainer.innerHTML = '';
    mappingContainer.innerHTML = '';
    summaryContainer.innerHTML = '';
    statusEl.textContent = 'فایل گزارش فروشندگان اسنپ‌فود را انتخاب کنید.';
    fileInput.value = '';
    currentSheet = null;
    currentRows = [];
    confirmBtn.disabled = true;
  });

  container.append(
    el('div', { class: 'quick-sale-card' }, [
      el('h3', { class: 'chart-card__title' }, ['ورودی فایل اسنپ‌فود']),
      field('فایل اکسل/CSV', fileInput),
      statusEl,
      mappingContainer,
      summaryContainer,
      previewContainer,
      el('div', { class: 'modal-actions' }, [confirmBtn]),
      inventoryContainer,
    ]),
  );

  return () => {};
}

type ImportSubTab = 'cashier' | 'snappfood';

export function renderImportTab(container: HTMLElement): () => void {
  const subTabsEl = el('div', { class: 'tabs tabs--sub' });
  const subContentEl = el('div', { class: 'tab-content' });
  container.append(subTabsEl, subContentEl);

  const subTabs: { id: ImportSubTab; label: string; render: (c: HTMLElement) => () => void }[] = [
    { id: 'cashier', label: 'صندوق فروش حضوری', render: renderCashierImport },
    { id: 'snappfood', label: 'اسنپ‌فود', render: renderSnappfoodImport },
  ];

  let activeSub: ImportSubTab = 'cashier';
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

  function switchSub(id: ImportSubTab): void {
    activeSub = id;
    cleanup();
    subContentEl.innerHTML = '';
    renderSubTabs();
    cleanup = subTabs.find((t) => t.id === id)!.render(subContentEl);
  }

  switchSub(activeSub);
  return () => cleanup();
}

// ---------- View shell with tabs ----------

type SalesTab = 'log' | 'import';

export async function renderSales(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-sales' });
  container.appendChild(root);

  const tabsEl = el('div', { class: 'tabs' });
  const contentEl = el('div');

  root.append(el('div', { class: 'view-header' }, [el('h1', { class: 'view-header__title' }, ['فروش'])]), tabsEl, contentEl);

  const tabs: { id: SalesTab; label: string; render: (c: HTMLElement) => () => void }[] = [
    { id: 'log', label: 'ثبت و سوابق فروش', render: renderSalesLogTab },
    { id: 'import', label: 'ورودی فایل فروش', render: renderImportTab },
  ];

  let activeTab: SalesTab = 'log';
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

  function switchTab(tab: SalesTab): void {
    activeTab = tab;
    activeCleanup();
    contentEl.innerHTML = '';
    renderTabs();
    activeCleanup = tabs.find((t) => t.id === tab)!.render(contentEl);
  }

  switchTab(activeTab);

  return () => activeCleanup();
}

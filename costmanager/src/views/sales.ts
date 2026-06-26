import * as db from '../db';
import { confirmModal } from '../components/modal';
import { destroyChart, palette, renderChart } from '../components/chart';
import { showToast } from '../components/toast';
import { el, emptyState, field, kpiCard, numberInput, parseNumberInput, selectEl } from '../utils/dom';
import { formatDateShort, formatMoney, formatPct, toPersian, todayISO } from '../utils/format';
import type { RouteCleanup } from '../router';
import { menuItems, refreshIngredients, refreshSales, refreshShoppingList, sales } from '../store';
import { dailySeries, salesInPeriod } from '../utils/calc';
import type { Sale } from '../types';

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
    await db.recordSale({
      menuItemId,
      quantity,
      date: dateInput.value ? new Date(dateInput.value).toISOString() : todayISO(),
      note: noteInput.value.trim() || undefined,
    });
    await Promise.all([refreshSales(), refreshIngredients(), refreshShoppingList()]);
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

function renderSaleRow(s: Sale, onDelete: (s: Sale) => void): HTMLElement {
  return el('div', { class: 'sales-log-row' }, [
    el('span', { class: 'sales-log-row__date' }, [formatDateShort(s.date)]),
    el('span', { class: 'sales-log-row__name' }, [s.menuItemName]),
    el('span', { class: 'sales-log-row__qty' }, [`${toPersian(s.quantity)} عدد`]),
    el('span', { class: 'sales-log-row__total' }, [formatMoney(s.unitSalePrice * s.quantity)]),
    el('button', { type: 'button', class: 'icon-btn', title: 'حذف', onclick: () => onDelete(s) }, ['🗑️']),
  ]);
}

export async function renderSales(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-sales' });
  container.appendChild(root);

  const formContainer = el('div');
  const periodSelect = selectEl(PERIOD_OPTIONS, '30');
  const statsContainer = el('div');
  const chartContainer = el('div');
  const topItemsContainer = el('div');
  const logContainer = el('div');

  root.append(
    el('div', { class: 'view-header' }, [el('h1', { class: 'view-header__title' }, ['فروش'])]),
    formContainer,
    el('div', { class: 'toolbar' }, [periodSelect]),
    statsContainer,
    chartContainer,
    topItemsContainer,
    logContainer,
  );

  const formCleanup = renderQuickSaleForm(formContainer);

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
    if (activeCanvas) destroyChart(activeCanvas);
  };
}

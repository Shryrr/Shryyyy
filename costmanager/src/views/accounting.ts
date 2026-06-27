import { destroyChart, palette, renderChart } from '../components/chart';
import { el, emptyState, selectEl } from '../utils/dom';
import { formatDateShort, formatMoney, formatPct, toPersian } from '../utils/format';
import { downloadCSV, downloadJSON } from '../utils/export';
import type { RouteCleanup } from '../router';
import { employees, expenses, sales } from '../store';
import {
  avgGrossMarginRatio,
  dailyBreakEven,
  dailySeries,
  monthlyFixedCost,
  periodProfitLoss,
  salesInPeriod,
  type PeriodPL,
} from '../utils/calc';
import type { Sale, SaleSource } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

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
    plRow('بهای تمام‌شده فروش (COGS)', `(${formatMoney(pl.cogs)})`),
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

export async function renderAccounting(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-accounting' });
  container.appendChild(root);

  const periodSelect = selectEl(PERIOD_OPTIONS, '30');
  const exportCsvBtn = el('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, ['خروجی CSV']);
  const exportJsonBtn = el('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, ['خروجی JSON']);
  const contentEl = el('div');

  root.append(
    el('div', { class: 'view-header' }, [el('h1', { class: 'view-header__title' }, ['حسابداری و سود و زیان'])]),
    el('div', { class: 'toolbar' }, [periodSelect, exportCsvBtn, exportJsonBtn]),
    contentEl,
  );

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
          { label: 'بهای تمام‌شده', data: series.map((d) => d.cogs), borderColor: palette.coral, backgroundColor: palette.coral, tension: 0.3 },
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
      ['بهای تمام‌شده فروش (تومان)', Math.round(currentPL.cogs)],
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

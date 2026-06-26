import { destroyChart, palette, renderChart } from '../components/chart';
import { el, selectEl } from '../utils/dom';
import { formatDateShort, formatMoney, formatPct } from '../utils/format';
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
    contentEl.innerHTML = '';

    const canvas = el('canvas');
    activeCanvas = canvas;

    contentEl.append(
      el('div', { class: 'accounting-grid' }, [
        plStatement(pl, currentLabel),
        el('div', { class: 'chart-card' }, [
          el('h3', { class: 'chart-card__title' }, ['روند درآمد، بهای تمام‌شده و سود ناخالص']),
          el('div', { class: 'chart-card__canvas-wrap' }, [canvas]),
        ]),
      ]),
      breakEvenPanel(monthlyFixed, marginRatio),
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
  };
}

import { createAlertBanner } from '../components/alert-banner';
import { palette, renderChart, destroyChart } from '../components/chart';
import { el, kpiCard } from '../utils/dom';
import { navigate } from '../router';
import type { RouteCleanup } from '../router';
import { employees, expenses, ingredients, ingredientsById, menuItems, navigationIntent, sales } from '../store';
import {
  avgFoodCostPct,
  avgGrossMarginRatio,
  dailyBreakEven,
  dailySeries,
  foodCostPct,
  foodCostStatus,
  inventoryValue,
  lowStockIngredients,
  monthlyFixedCost,
  periodProfitLoss,
  recipeCost,
  salesInPeriod,
} from '../utils/calc';
import { formatDate, formatDateShort, formatMoney, formatMoneyShort, formatPct, toPersian } from '../utils/format';

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_COLOR = { green: palette.mint, amber: palette.amber, red: palette.red } as const;

function chartCard(title: string): { card: HTMLElement; canvas: HTMLCanvasElement } {
  const canvas = el('canvas');
  const card = el('div', { class: 'chart-card' }, [
    el('h3', { class: 'chart-card__title' }, [title]),
    el('div', { class: 'chart-card__canvas-wrap' }, [canvas]),
  ]);
  return { card, canvas };
}

function quickActions(): HTMLElement {
  return el('div', { class: 'quick-actions' }, [
    el('button', { class: 'quick-actions__btn', type: 'button', onclick: () => navigate('/sales') }, [
      el('span', { class: 'quick-actions__icon' }, ['🧾']),
      'ثبت فروش',
    ]),
    el('button', { class: 'quick-actions__btn', type: 'button', onclick: () => navigate('/ingredients') }, [
      el('span', { class: 'quick-actions__icon' }, ['📥']),
      'ثبت خرید مواد',
    ]),
    el('button', { class: 'quick-actions__btn', type: 'button', onclick: () => navigate('/shopping') }, [
      el('span', { class: 'quick-actions__icon' }, ['🛒']),
      'مشاهده لیست خرید',
    ]),
  ]);
}

function breakEvenPanel(monthlyFixed: number, marginRatio: number): HTMLElement {
  const dailyFixed = monthlyFixed / 30;
  const breakEven = dailyBreakEven(monthlyFixed, marginRatio);

  const text =
    marginRatio > 0
      ? `برای پوشش هزینهٔ ثابت روزانه (${formatMoney(dailyFixed)})، باید حداقل ${formatMoney(breakEven)} فروش روزانه داشته باشید.`
      : 'داده فروش کافی برای محاسبهٔ نقطهٔ سربه‌سر وجود ندارد.';

  return el('div', { class: 'breakeven-panel' }, [
    el('h3', { class: 'breakeven-panel__title' }, ['نقطهٔ سربه‌سر']),
    el('p', { class: 'breakeven-panel__text' }, [text]),
  ]);
}

export async function renderDashboard(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-dashboard' });
  container.appendChild(root);

  let activeCanvases: HTMLCanvasElement[] = [];

  function renderContent(): void {
    for (const canvas of activeCanvases) destroyChart(canvas);
    activeCanvases = [];
    root.innerHTML = '';

    const now = new Date();
    const ing = ingredients.get();
    const items = menuItems.get();
    const exp = expenses.get();
    const emp = employees.get();
    const saleList = sales.get();
    const ingById = ingredientsById();

    const monthlyFixed = monthlyFixedCost(exp, emp);
    const marginRatio = avgGrossMarginRatio(saleList, now);

    const periodStart = new Date(now.getTime() - 30 * DAY_MS);
    const recentSales = salesInPeriod(saleList, periodStart, now);
    const pl = periodProfitLoss(recentSales, monthlyFixed, 30);
    const foodCostPctValue = pl.revenue > 0 ? (pl.cogs / pl.revenue) * 100 : avgFoodCostPct(items, ingById);
    const lowStock = lowStockIngredients(ing);

    root.append(
      el('div', { class: 'view-header' }, [
        el('h1', { class: 'view-header__title' }, ['داشبورد']),
        el('span', { class: 'view-header__date' }, [formatDate(now.toISOString())]),
      ]),
    );

    root.append(
      el('div', { class: 'kpi-grid' }, [
        kpiCard('📦', 'تعداد مواد اولیه', toPersian(ing.length), undefined, () => navigate('/ingredients')),
        kpiCard('💰', 'ارزش انبار', formatMoneyShort(inventoryValue(ing)), undefined, () => {
          navigationIntent.set({ sortByValue: true });
          navigate('/ingredients');
        }),
        kpiCard('🍽️', 'فودکاست (۳۰ روز)', formatPct(foodCostPctValue), foodCostStatus(foodCostPctValue) === 'red' ? 'negative' : undefined, () => {
          navigationIntent.set({ sortBy: 'pct_desc' });
          navigate('/recipes');
        }),
        kpiCard('🏢', 'هزینهٔ ثابت ماهانه', formatMoneyShort(monthlyFixed), undefined, () => navigate('/expenses')),
        kpiCard('📈', 'سود خالص (۳۰ روز)', formatMoneyShort(pl.netProfit), pl.netProfit >= 0 ? 'positive' : 'negative', () => navigate('/accounting')),
        kpiCard('⚠️', 'کسری موجودی', toPersian(lowStock.length), lowStock.length > 0 ? 'warning' : undefined, () => navigate('/shopping')),
      ]),
    );

    if (lowStock.length > 0) {
      const banner = createAlertBanner({
        id: 'dashboard-low-stock',
        message: `${toPersian(lowStock.length)} ماده اولیه نیاز به خرید دارند.`,
        actionLabel: 'مشاهده لیست خرید',
        onAction: () => navigate('/shopping'),
        tone: 'warning',
      });
      if (banner) root.appendChild(banner);
    }

    root.append(quickActions());

    const chartsGrid = el('div', { class: 'dashboard-charts' });
    root.append(chartsGrid);

    const series = dailySeries(saleList, 14, now);
    const salesChart = chartCard('روند فروش و بهای تمام‌شده (۱۴ روز اخیر)');
    chartsGrid.append(salesChart.card);
    activeCanvases.push(salesChart.canvas);
    renderChart(salesChart.canvas, {
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

    const activeItems = items.filter((m) => m.isActive);
    const costByCategory = new Map<string, number>();
    for (const item of activeItems) {
      const cost = recipeCost(item.recipe, ingById);
      costByCategory.set(item.category, (costByCategory.get(item.category) ?? 0) + cost);
    }
    const categoryChart = chartCard('سهم هر دسته از بهای تمام‌شدهٔ منو');
    chartsGrid.append(categoryChart.card);
    activeCanvases.push(categoryChart.canvas);
    const categoryColors = [palette.primary, palette.coral, palette.mint, palette.amber, palette.blue, palette.red, palette.primaryD];
    renderChart(categoryChart.canvas, {
      type: 'doughnut',
      data: {
        labels: Array.from(costByCategory.keys()),
        datasets: [{ data: Array.from(costByCategory.values()), backgroundColor: categoryColors }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });

    const topItems = activeItems
      .map((item) => ({ item, pct: foodCostPct(recipeCost(item.recipe, ingById), item.salePrice) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
    const topItemsChart = chartCard('بالاترین درصد فودکاست (۵ آیتم)');
    chartsGrid.append(topItemsChart.card);
    activeCanvases.push(topItemsChart.canvas);
    renderChart(topItemsChart.canvas, {
      type: 'bar',
      data: {
        labels: topItems.map((t) => t.item.name),
        datasets: [
          {
            label: 'فودکاست٪',
            data: topItems.map((t) => t.pct),
            backgroundColor: topItems.map((t) => STATUS_COLOR[foodCostStatus(t.pct)]),
            borderRadius: 4,
          },
        ],
      },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { beginAtZero: true } } },
    });

    root.append(breakEvenPanel(monthlyFixed, marginRatio));
  }

  let scheduled = false;
  function scheduleRender(): void {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      renderContent();
    });
  }

  const unsubscribers = [
    ingredients.subscribe(scheduleRender),
    menuItems.subscribe(scheduleRender),
    expenses.subscribe(scheduleRender),
    employees.subscribe(scheduleRender),
    sales.subscribe(scheduleRender),
  ];

  return () => {
    for (const unsub of unsubscribers) unsub();
    for (const canvas of activeCanvases) destroyChart(canvas);
  };
}

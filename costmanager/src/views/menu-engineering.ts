import * as db from '../db';
import { destroyChart, palette, renderChart } from '../components/chart';
import { showToast } from '../components/toast';
import { askClaude } from '../utils/ai';
import { salesInPeriod } from '../utils/calc';
import { el, emptyState, field, kpiCard } from '../utils/dom';
import type { KpiTone } from '../utils/dom';
import { svgIcon } from '../utils/icons';
import type { IconName } from '../utils/icons';
import { formatMoney, formatPct, toPersian } from '../utils/format';
import {
  QUADRANT_DESCRIPTIONS, QUADRANT_LABELS, QUADRANT_ORDER, classifyMenuItems,
} from '../utils/menu-engineering';
import type { MenuEngineeringItem, MenuEngineeringResult, MenuQuadrant } from '../utils/menu-engineering';
import type { RouteCleanup } from '../router';
import { ingredients, ingredientsById, menuItems, refreshSettings, sales, settings } from '../store';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS = 90;

const QUADRANT_BADGE_CLASS: Record<MenuQuadrant, string> = {
  star: 'badge--success',
  plowhorse: 'badge--warning',
  puzzle: 'badge--muted',
  dog: 'badge--danger',
};

const QUADRANT_COLORS: Record<MenuQuadrant, string> = {
  star: palette.mint,
  plowhorse: palette.amber,
  puzzle: palette.blue,
  dog: palette.coral,
};

const QUADRANT_KPI_ICON: Record<MenuQuadrant, IconName> = {
  star: 'sparkles',
  plowhorse: 'truck',
  puzzle: 'megaphone',
  dog: 'x-circle',
};

const QUADRANT_KPI_TONE: Record<MenuQuadrant, KpiTone | undefined> = {
  star: 'positive',
  plowhorse: 'warning',
  puzzle: undefined,
  dog: 'negative',
};

function quadrantSwatch(q: MenuQuadrant): HTMLElement {
  return el('span', { class: 'quadrant-swatch', style: `background:${QUADRANT_COLORS[q]}` }, []);
}

function settingsCard(title: string, body: HTMLElement): HTMLElement {
  return el('div', { class: 'settings-card' }, [el('h3', { class: 'settings-card__title' }, [title]), body]);
}

function quadrantCard(q: MenuQuadrant, count: number): HTMLElement {
  return el('div', { class: 'quadrant-card' }, [
    el('div', { class: 'quadrant-card__title' }, [quadrantSwatch(q), ` ${QUADRANT_LABELS[q]} (${toPersian(count)})`]),
    el('div', { class: 'quadrant-card__desc' }, [QUADRANT_DESCRIPTIONS[q]]),
  ]);
}

function renderItemRow(r: MenuEngineeringItem): HTMLElement {
  const badgeClass = `badge ${QUADRANT_BADGE_CLASS[r.quadrant]}`.trim();
  return el('div', { class: 'recipe-row' }, [
    el('div', { class: 'recipe-row__main' }, [
      el('div', { class: 'recipe-row__title-row' }, [
        el('span', { class: 'recipe-row__name' }, [r.item.name]),
        el('span', { class: badgeClass }, [quadrantSwatch(r.quadrant), ` ${QUADRANT_LABELS[r.quadrant]}`]),
      ]),
      el('div', { class: 'recipe-row__meta' }, [
        `فروش: ${toPersian(r.quantitySold)} عدد · سود هر واحد: ${formatMoney(r.marginPerUnit)} · فودکاست: ${formatPct(r.foodCostPct)}`,
      ]),
    ]),
  ]);
}

function buildAiPrompt(result: MenuEngineeringResult): string {
  const lines = result.items
    .map((r) => `- ${r.item.name}: ${QUADRANT_LABELS[r.quadrant]} | فروش ${toPersian(r.quantitySold)} عدد | سود هر واحد ${formatMoney(r.marginPerUnit)} | فودکاست ${formatPct(r.foodCostPct)}`)
    .join('\n');
  const categories = QUADRANT_ORDER.map((q) => QUADRANT_LABELS[q]).join('، ');
  return `بر اساس ماتریس مهندسی منو (Kasavana-Smith) زیر، برای هر دسته (${categories}) حداکثر دو پیشنهاد عملی و کوتاه به زبان فارسی برای بهبود سودآوری منو بده. پاسخ را خلاصه و کاربردی بنویس.\n\n${lines}`;
}

function renderAiCard(result: MenuEngineeringResult): HTMLElement {
  const apiKeyInput = el('input', {
    type: 'text', class: 'input', value: settings.get()?.anthropicApiKey ?? '', placeholder: 'کلید API آنتروپیک (Claude)',
  });
  const saveBtn = el('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, ['ذخیره کلید']);
  const generateBtn = el('button', { type: 'button', class: 'btn btn-primary' }, []);
  const generateBtnLabel = 'تولید پیشنهاد هوش مصنوعی';
  generateBtn.append(svgIcon('cpu', 14), ` ${generateBtnLabel}`);
  const resultBox = el('div', { class: 'ai-insight-card__text' });

  saveBtn.addEventListener('click', async () => {
    await db.updateSettings({ anthropicApiKey: apiKeyInput.value.trim() || undefined });
    await refreshSettings();
    showToast('کلید API ذخیره شد', 'success');
  });

  generateBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showToast('ابتدا کلید API هوش مصنوعی را وارد کنید', 'error');
      return;
    }
    generateBtn.setAttribute('disabled', 'true');
    generateBtn.textContent = 'در حال تولید...';
    resultBox.textContent = '';
    const res = await askClaude(apiKey, buildAiPrompt(result));
    generateBtn.removeAttribute('disabled');
    generateBtn.innerHTML = '';
    generateBtn.append(svgIcon('cpu', 14), ` ${generateBtnLabel}`);
    if (!res.ok) {
      showToast(res.error ?? 'خطا در دریافت پاسخ هوش مصنوعی', 'error');
      return;
    }
    resultBox.textContent = res.text ?? '';
  });

  const configBody = el('div', { class: 'form' }, [
    field('کلید API آنتروپیک (Claude)', apiKeyInput, 'این کلید فقط در مرورگر شما ذخیره می‌شود و هرگز به جای دیگری ارسال نمی‌شود.'),
    el('div', { class: 'modal-actions' }, [saveBtn, generateBtn]),
    resultBox,
  ]);

  return settingsCard('پیشنهاد هوش مصنوعی برای منو', configBody);
}

export async function renderMenuEngineering(container: HTMLElement): Promise<RouteCleanup> {
  const root = el('div', { class: 'view view-menu-engineering' });
  container.appendChild(root);

  let activeCanvas: HTMLCanvasElement | null = null;
  let quadrantFilter: MenuQuadrant | null = null;
  let searchTerm = '';
  let lastResult: MenuEngineeringResult | null = null;

  const searchInput = el('input', { type: 'text', class: 'input', placeholder: 'جستجوی آیتم منو...' });
  const listEl = el('div', { class: 'recipe-list' });

  function renderList(): void {
    listEl.innerHTML = '';
    if (!lastResult) return;
    let items = lastResult.items;
    if (quadrantFilter) items = items.filter((r) => r.quadrant === quadrantFilter);
    if (searchTerm) items = items.filter((r) => r.item.name.includes(searchTerm));
    items = [...items].sort((a, b) => b.revenue - a.revenue);

    if (!items.length) {
      listEl.appendChild(
        emptyState({ icon: 'search', title: 'موردی یافت نشد', message: 'فیلتر یا عبارت جست‌وجو را تغییر دهید.' }),
      );
      return;
    }
    for (const r of items) listEl.appendChild(renderItemRow(r));
  }

  searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value.trim();
    renderList();
  });

  function renderContent(): void {
    if (activeCanvas) destroyChart(activeCanvas);
    activeCanvas = null;
    root.innerHTML = '';

    const now = new Date();
    const periodStart = new Date(now.getTime() - PERIOD_DAYS * DAY_MS);
    const recentSales = salesInPeriod(sales.get(), periodStart, now);
    const result = classifyMenuItems(menuItems.get(), recentSales, ingredientsById());
    lastResult = result;

    root.append(
      el('div', { class: 'view-header' }, [
        el('h1', { class: 'view-header__title' }, ['مهندسی منو']),
        el('span', { class: 'view-header__date' }, [`بر اساس فروش ${toPersian(PERIOD_DAYS)} روز اخیر`]),
      ]),
    );

    if (!result.items.length) {
      root.appendChild(
        emptyState({
          icon: 'utensils',
          title: 'هنوز آیتم فعالی در منو ثبت نشده است',
          message: 'برای مشاهدهٔ ماتریس مهندسی منو، ابتدا چند آیتم منو اضافه کنید.',
        }),
      );
      return;
    }

    const counts: Record<MenuQuadrant, number> = { star: 0, plowhorse: 0, puzzle: 0, dog: 0 };
    for (const r of result.items) counts[r.quadrant]++;

    root.append(
      el('div', { class: 'kpi-grid' }, [
        kpiCard('utensils', 'آیتم‌های فعال', toPersian(result.items.length)),
        ...QUADRANT_ORDER.map((q) =>
          kpiCard(QUADRANT_KPI_ICON[q], QUADRANT_LABELS[q], toPersian(counts[q]), QUADRANT_KPI_TONE[q], () => {
            quadrantFilter = quadrantFilter === q ? null : q;
            renderList();
          }),
        ),
      ]),
    );

    const canvas = el('canvas');
    activeCanvas = canvas;
    root.append(
      el('div', { class: 'chart-card' }, [
        el('h3', { class: 'chart-card__title' }, ['محبوبیت در برابر سودآوری هر آیتم']),
        el('div', { class: 'chart-card__canvas-wrap' }, [canvas]),
      ]),
    );
    renderChart(canvas, {
      type: 'scatter',
      data: {
        datasets: QUADRANT_ORDER.map((q) => ({
          label: QUADRANT_LABELS[q],
          data: result.items
            .filter((r) => r.quadrant === q)
            .map((r) => ({ x: r.popularityIndex, y: r.marginPerUnit, name: r.item.name })),
          backgroundColor: QUADRANT_COLORS[q],
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'شاخص محبوبیت (٪)' }, beginAtZero: true },
          y: { title: { display: true, text: 'سود هر واحد (تومان)' } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const raw = ctx.raw as { name?: string; y?: number };
                return `${raw.name ?? ''}: ${formatMoney(ctx.parsed.y ?? 0)}`;
              },
            },
          },
        },
      },
    });

    root.append(
      el(
        'div',
        { class: 'quadrant-grid' },
        QUADRANT_ORDER.map((q) => quadrantCard(q, counts[q])),
      ),
    );

    root.append(el('div', { class: 'toolbar' }, [searchInput]), listEl);
    renderList();

    root.append(renderAiCard(result));
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
    menuItems.subscribe(scheduleRender),
    sales.subscribe(scheduleRender),
    ingredients.subscribe(scheduleRender),
    settings.subscribe(scheduleRender),
  ];

  return () => {
    for (const unsub of unsubscribers) unsub();
    if (activeCanvas) destroyChart(activeCanvas);
  };
}

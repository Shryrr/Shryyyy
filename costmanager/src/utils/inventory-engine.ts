import * as db from '../db';
import { checkStockAlertsAndNotify } from './stock-alerts';
import type { ConsumptionRecord, Ingredient, Sale, WasteEntry } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Trailing window the daily usage rate is averaged over — short enough to react to recent trends. */
const USAGE_WINDOW_DAYS = 14;
/** How much daily history is retained on the ingredient for charting / future analysis. */
const CONSUMPTION_HISTORY_DAYS = 30;
/** Finite cap instead of Infinity: JSON.stringify (used by the backup export) silently turns Infinity into null. */
const MAX_DAYS_OF_STOCK = 999;
const RECALC_DEBOUNCE_MS = 10_000;

interface ConsumptionContext {
  recipeQtyByMenuItem: Map<string, Map<string, number>>;
  sales: Sale[];
  waste: WasteEntry[];
}

async function buildContext(): Promise<{ ingredients: Ingredient[]; ctx: ConsumptionContext }> {
  const [ingredients, menuItems, sales, waste] = await Promise.all([
    db.listIngredients(),
    db.listMenuItems(),
    db.listSales(),
    db.listWaste(),
  ]);
  const recipeQtyByMenuItem = new Map<string, Map<string, number>>();
  for (const item of menuItems) {
    recipeQtyByMenuItem.set(item.id, new Map(item.recipe.map((ri) => [ri.ingredientId, ri.quantity])));
  }
  return { ingredients, ctx: { recipeQtyByMenuItem, sales, waste } };
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Per-day consumption for one ingredient, derived fresh from raw sales + waste records every call (no incremental state to drift). */
function computeDailyConsumption(ingredientId: string, ctx: ConsumptionContext, sinceMs: number): Map<string, { fromSales: number; fromWaste: number }> {
  const byDate = new Map<string, { fromSales: number; fromWaste: number }>();
  const bump = (date: string, key: 'fromSales' | 'fromWaste', amount: number) => {
    if (amount <= 0) return;
    const entry = byDate.get(dateKey(date)) ?? { fromSales: 0, fromWaste: 0 };
    entry[key] += amount;
    byDate.set(dateKey(date), entry);
  };

  for (const sale of ctx.sales) {
    if (new Date(sale.date).getTime() < sinceMs) continue;
    if (sale.type === 'bulk') {
      const delta = sale.ingredientDeltas?.find((d) => d.ingredientId === ingredientId);
      if (delta) bump(sale.date, 'fromSales', delta.quantity);
    } else {
      const qtyPerUnit = ctx.recipeQtyByMenuItem.get(sale.menuItemId)?.get(ingredientId);
      if (qtyPerUnit) bump(sale.date, 'fromSales', qtyPerUnit * sale.quantity);
    }
  }
  for (const w of ctx.waste) {
    if (w.ingredientId !== ingredientId || new Date(w.date).getTime() < sinceMs) continue;
    bump(w.date, 'fromWaste', w.quantity);
  }
  return byDate;
}

function sumDeltasSince(ingredient: Ingredient, ctx: ConsumptionContext, sinceMs: number): { purchased: number; consumed: number; wasted: number } {
  let purchased = 0;
  for (const p of ingredient.purchaseHistory) {
    if (new Date(p.date).getTime() > sinceMs) purchased += p.quantity;
  }
  let consumed = 0;
  for (const sale of ctx.sales) {
    if (new Date(sale.date).getTime() <= sinceMs) continue;
    if (sale.type === 'bulk') {
      const delta = sale.ingredientDeltas?.find((d) => d.ingredientId === ingredient.id);
      if (delta) consumed += delta.quantity;
    } else {
      const qtyPerUnit = ctx.recipeQtyByMenuItem.get(sale.menuItemId)?.get(ingredient.id);
      if (qtyPerUnit) consumed += qtyPerUnit * sale.quantity;
    }
  }
  let wasted = 0;
  for (const w of ctx.waste) {
    if (w.ingredientId === ingredient.id && new Date(w.date).getTime() > sinceMs) wasted += w.quantity;
  }
  return { purchased, consumed, wasted };
}

export interface IngredientEstimation {
  theoreticalStock: number;
  dailyUsageRate: number;
  daysOfStockRemaining: number;
  predictedStockoutDate: string | null;
  consumptionHistory: ConsumptionRecord[];
}

function computeEstimation(ingredient: Ingredient, ctx: ConsumptionContext, now: Date): IngredientEstimation {
  const nowMs = now.getTime();

  // No physical count yet: currentStock already accurately tracks every logged delta (purchase/sale/waste),
  // so there is nothing to reconcile against — use it directly rather than replaying history from createdAt.
  const theoreticalStock = ingredient.lastPhysicalCount
    ? (() => {
        const { purchased, consumed, wasted } = sumDeltasSince(ingredient, ctx, new Date(ingredient.lastPhysicalCount!.date).getTime());
        return Math.max(0, ingredient.lastPhysicalCount!.quantity + purchased - consumed - wasted);
      })()
    : ingredient.currentStock;

  const byDate = computeDailyConsumption(ingredient.id, ctx, nowMs - CONSUMPTION_HISTORY_DAYS * DAY_MS);
  const consumptionHistory: ConsumptionRecord[] = Array.from(byDate.entries())
    .map(([date, { fromSales, fromWaste }]) => ({ date, consumed: fromSales + fromWaste, fromSales, fromWaste }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const usageSinceMs = nowMs - USAGE_WINDOW_DAYS * DAY_MS;
  const usageTotal = consumptionHistory.reduce((sum, e) => (new Date(e.date).getTime() >= usageSinceMs ? sum + e.consumed : sum), 0);
  const dailyUsageRate = usageTotal / USAGE_WINDOW_DAYS;

  const daysOfStockRemaining = dailyUsageRate > 0 ? Math.min(MAX_DAYS_OF_STOCK, theoreticalStock / dailyUsageRate) : MAX_DAYS_OF_STOCK;
  const predictedStockoutDate = dailyUsageRate > 0 ? new Date(nowMs + daysOfStockRemaining * DAY_MS).toISOString() : null;

  return { theoreticalStock, dailyUsageRate, daysOfStockRemaining, predictedStockoutDate, consumptionHistory };
}

export async function recalculateTheoreticalStock(ingredientId: string): Promise<void> {
  const { ingredients, ctx } = await buildContext();
  const ingredient = ingredients.find((i) => i.id === ingredientId);
  if (!ingredient) return;
  const now = new Date();
  const estimation = computeEstimation(ingredient, ctx, now);
  await db.updateIngredientEstimation(ingredientId, { ...estimation, lastEstimationUpdatedAt: now.toISOString() });
}

export async function recalculateAllTheoreticalStock(): Promise<void> {
  const { ingredients, ctx } = await buildContext();
  const now = new Date();
  const updated: Ingredient[] = [];
  for (const ingredient of ingredients) {
    const estimation = computeEstimation(ingredient, ctx, now);
    await db.updateIngredientEstimation(ingredient.id, { ...estimation, lastEstimationUpdatedAt: now.toISOString() });
    updated.push({ ...ingredient, ...estimation });
  }
  await checkStockAlertsAndNotify(updated);
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Call after any stock-affecting write (sale, purchase, waste, stocktake). Debounced so a burst of
 * writes (e.g. an Excel import of hundreds of sale rows) triggers exactly one recomputation pass.
 */
export function scheduleRecalculation(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    recalculateAllTheoreticalStock().catch((err) => console.error('[inventory-engine] recalculation failed:', err));
  }, RECALC_DEBOUNCE_MS);
}

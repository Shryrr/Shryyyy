import type { Employee, Expense, Ingredient, MenuItem, RecipeIngredient, Sale } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type FoodCostStatus = 'green' | 'amber' | 'red';

/** newAvgPrice = (oldStock*oldPrice + qty*price) / (oldStock + qty) */
export function weightedAvgPrice(oldStock: number, oldPrice: number, purchasedQty: number, purchasePrice: number): number {
  const totalQty = oldStock + purchasedQty;
  if (totalQty <= 0) return purchasePrice;
  return (oldStock * oldPrice + purchasedQty * purchasePrice) / totalQty;
}

export function recipeCost(recipe: RecipeIngredient[], ingredientsById: Map<string, Ingredient>): number {
  return recipe.reduce((sum, ri) => {
    const ingredient = ingredientsById.get(ri.ingredientId);
    if (!ingredient) return sum;
    return sum + ingredient.pricePerUnit * ri.quantity;
  }, 0);
}

export function foodCostPct(cost: number, salePrice: number): number {
  if (!salePrice) return 0;
  return (cost / salePrice) * 100;
}

export function foodCostStatus(pct: number): FoodCostStatus {
  if (pct <= 30) return 'green';
  if (pct <= 40) return 'amber';
  return 'red';
}

export function grossProfit(salePrice: number, cost: number): number {
  return salePrice - cost;
}

export function suggestedPriceForTarget(cost: number, targetPercent: number): number {
  if (!targetPercent) return 0;
  return cost / (targetPercent / 100);
}

export function monthlyFixedCost(expenses: Expense[], employees: Employee[]): number {
  const expenseTotal = expenses.filter((e) => e.isActive).reduce((sum, e) => sum + expenseMonthlyEquivalent(e), 0);
  const payrollTotal = employees.filter((e) => e.isActive).reduce((sum, e) => sum + monthlyEquivalent(e), 0);
  return expenseTotal + payrollTotal;
}

/** one_time expenses are not part of recurring monthly overhead */
export function expenseMonthlyEquivalent(expense: Expense): number {
  if (expense.frequency === 'monthly') return expense.amount;
  if (expense.frequency === 'yearly') return expense.amount / 12;
  return 0;
}

/** hourly assumes an 8h shift, 30 working days */
export function monthlyEquivalent(employee: Employee): number {
  if (employee.payType === 'monthly') return employee.amount;
  if (employee.payType === 'daily') return employee.amount * 30;
  return employee.amount * 8 * 30;
}

function withinLastDays(iso: string, days: number, now: Date): boolean {
  const t = new Date(iso).getTime();
  return t > now.getTime() - days * DAY_MS && t <= now.getTime();
}

export interface ItemRecipeCostFn {
  (menuItemId: string): number;
}

/**
 * avgGrossMarginRatio = Σ(grossProfit_i * qty_i) / Σ(salePrice_i * qty_i) over last 30 days,
 * computed from sale snapshots (unitSalePrice/unitCost), not live recipe cost.
 */
export function avgGrossMarginRatio(sales: Sale[], now = new Date()): number {
  const recent = sales.filter((s) => withinLastDays(s.date, 30, now));
  let numerator = 0;
  let denominator = 0;
  for (const s of recent) {
    numerator += (s.unitSalePrice - s.unitCost) * s.quantity;
    denominator += s.unitSalePrice * s.quantity;
  }
  if (!denominator) return 0;
  return numerator / denominator;
}

export function dailyBreakEven(monthlyFixed: number, marginRatio: number): number {
  if (!marginRatio) return 0;
  return (monthlyFixed / 30) / marginRatio;
}

export interface PeriodPL {
  revenue: number;
  cogs: number;
  grossProfit: number;
  fixedProrated: number;
  netProfit: number;
  grossMarginPct: number;
  netMarginPct: number;
}

export function periodProfitLoss(sales: Sale[], monthlyFixed: number, periodDays: number): PeriodPL {
  let revenue = 0;
  let cogs = 0;
  for (const s of sales) {
    revenue += s.unitSalePrice * s.quantity;
    cogs += s.unitCost * s.quantity;
  }
  const gp = revenue - cogs;
  const fixedProrated = (monthlyFixed / 30) * periodDays;
  const netProfit = gp - fixedProrated;
  return {
    revenue,
    cogs,
    grossProfit: gp,
    fixedProrated,
    netProfit,
    grossMarginPct: revenue ? (gp / revenue) * 100 : 0,
    netMarginPct: revenue ? (netProfit / revenue) * 100 : 0,
  };
}

export function salesInPeriod(sales: Sale[], start: Date, end: Date): Sale[] {
  const startT = start.getTime();
  const endT = end.getTime();
  return sales.filter((s) => {
    const t = new Date(s.date).getTime();
    return t >= startT && t <= endT;
  });
}

export interface DailyAggregate {
  date: string;
  revenue: number;
  cogs: number;
  quantity: number;
}

/** Buckets sales into the trailing `days` calendar days (local time), filling zero-sales days. */
export function dailySeries(sales: Sale[], days: number, now = new Date()): DailyAggregate[] {
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);

  const buckets = new Map<string, DailyAggregate>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: d.toISOString(), revenue: 0, cogs: 0, quantity: 0 });
  }

  for (const s of sales) {
    const key = s.date.slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.revenue += s.unitSalePrice * s.quantity;
    bucket.cogs += s.unitCost * s.quantity;
    bucket.quantity += s.quantity;
  }

  return Array.from(buckets.values());
}

export interface ShoppingSuggestion {
  ingredientId: string;
  suggestedQty: number;
  estimatedCost: number;
}

/** for each ingredient where currentStock < minStock: suggestedQty = maxStock - currentStock */
export function generateShoppingSuggestions(ingredients: Ingredient[]): ShoppingSuggestion[] {
  return ingredients
    .filter((ing) => ing.currentStock < ing.minStock)
    .map((ing) => {
      const suggestedQty = Math.max(0, ing.maxStock - ing.currentStock);
      return {
        ingredientId: ing.id,
        suggestedQty,
        estimatedCost: suggestedQty * ing.pricePerUnit,
      };
    });
}

export function inventoryValue(ingredients: Ingredient[]): number {
  return ingredients.reduce((sum, i) => sum + i.currentStock * i.pricePerUnit, 0);
}

export function lowStockIngredients(ingredients: Ingredient[]): Ingredient[] {
  return ingredients.filter((i) => i.currentStock <= i.minStock);
}

export function avgFoodCostPct(menuItems: MenuItem[], ingredientsById: Map<string, Ingredient>): number {
  const active = menuItems.filter((m) => m.isActive);
  if (!active.length) return 0;
  const total = active.reduce((sum, m) => sum + foodCostPct(recipeCost(m.recipe, ingredientsById), m.salePrice), 0);
  return total / active.length;
}

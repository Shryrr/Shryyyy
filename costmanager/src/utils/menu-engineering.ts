import { foodCostPct, foodCostStatus, recipeCost } from './calc';
import type { FoodCostStatus } from './calc';
import type { Ingredient, MenuItem, Sale } from '../types';

export type MenuQuadrant = 'star' | 'plowhorse' | 'puzzle' | 'dog';

export interface MenuEngineeringItem {
  item: MenuItem;
  quantitySold: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPerUnit: number;
  popularityIndex: number;
  foodCostPct: number;
  foodCostStatus: FoodCostStatus;
  quadrant: MenuQuadrant;
}

export interface MenuEngineeringResult {
  items: MenuEngineeringItem[];
  avgMarginPerUnit: number;
  totalQuantitySold: number;
}

/**
 * Kasavana–Smith menu-engineering matrix: an item is "popular" if its sold quantity is at
 * least 70% of its fair share (total qty ÷ active item count), and "profitable" if its
 * per-unit contribution margin is at or above the average across all sold items.
 */
export function classifyMenuItems(items: MenuItem[], sales: Sale[], ingredientsById: Map<string, Ingredient>): MenuEngineeringResult {
  const active = items.filter((m) => m.isActive);

  const byItem = new Map<string, { quantitySold: number; revenue: number; cost: number }>();
  for (const s of sales) {
    const agg = byItem.get(s.menuItemId) ?? { quantitySold: 0, revenue: 0, cost: 0 };
    agg.quantitySold += s.quantity;
    agg.revenue += s.unitSalePrice * s.quantity;
    agg.cost += s.unitCost * s.quantity;
    byItem.set(s.menuItemId, agg);
  }

  const totalQuantitySold = Array.from(byItem.values()).reduce((sum, a) => sum + a.quantitySold, 0);
  const totalMargin = Array.from(byItem.values()).reduce((sum, a) => sum + (a.revenue - a.cost), 0);
  const avgMarginPerUnit = totalQuantitySold > 0 ? totalMargin / totalQuantitySold : 0;
  const fairShare = active.length > 0 ? totalQuantitySold / active.length : 0;
  const popularityThreshold = fairShare * 0.7;

  const result: MenuEngineeringItem[] = active.map((item) => {
    const agg = byItem.get(item.id) ?? { quantitySold: 0, revenue: 0, cost: 0 };
    const fallbackUnitCost = recipeCost(item.recipe, ingredientsById);
    const margin = agg.revenue - agg.cost;
    const marginPerUnit = agg.quantitySold > 0 ? margin / agg.quantitySold : item.salePrice - fallbackUnitCost;
    const isPopular = popularityThreshold > 0 && agg.quantitySold >= popularityThreshold;
    const isProfitable = marginPerUnit >= avgMarginPerUnit;
    const quadrant: MenuQuadrant = isPopular
      ? (isProfitable ? 'star' : 'plowhorse')
      : (isProfitable ? 'puzzle' : 'dog');
    const unitCost = agg.quantitySold > 0 ? agg.cost / agg.quantitySold : fallbackUnitCost;
    const pct = foodCostPct(unitCost, item.salePrice);
    return {
      item,
      quantitySold: agg.quantitySold,
      revenue: agg.revenue,
      cost: agg.cost,
      margin,
      marginPerUnit,
      popularityIndex: totalQuantitySold > 0 ? (agg.quantitySold / totalQuantitySold) * 100 : 0,
      foodCostPct: pct,
      foodCostStatus: foodCostStatus(pct),
      quadrant,
    };
  });

  return { items: result, avgMarginPerUnit, totalQuantitySold };
}

export const QUADRANT_LABELS: Record<MenuQuadrant, string> = {
  star: 'پرفروش و سودآور',
  plowhorse: 'پرفروش، کم‌سود',
  puzzle: 'کم‌فروش، سودآور',
  dog: 'کم‌فروش و کم‌سود',
};

export const QUADRANT_DESCRIPTIONS: Record<MenuQuadrant, string> = {
  star: 'محبوب و سودآور — کیفیت را حفظ کنید و در منو برجسته‌اش کنید.',
  plowhorse: 'محبوب اما سود کم — قیمت یا بهای تمام‌شدهٔ آن را بازبینی کنید.',
  puzzle: 'سودآور اما کم‌فروش — با تبلیغ و چیدمان بهتر در منو فروش را افزایش دهید.',
  dog: 'نه محبوب نه سودآور — کاندید حذف یا بازطراحی کامل از منو.',
};

export const QUADRANT_ORDER: MenuQuadrant[] = ['star', 'plowhorse', 'puzzle', 'dog'];

import * as db from '../db';
import { refreshNotifications } from '../store';
import type { Ingredient, UserRole } from '../types';
import { formatDate, formatUnit, toPersian } from './format';

/** Roles responsible for acting on a stock alert: buyer purchases, warehouse manages physical counts. */
const ALERT_ROLES: UserRole[] = ['buyer', 'warehouse'];

/** Days-of-stock-remaining threshold below which a predictive stockout alert fires. */
export const STOCKOUT_WARNING_DAYS = 3;

/** Ingredient ids already notified for the current continuous low-stock/stockout period; cleared once recovered, mirroring utils/notifications.ts. */
const notifiedLowStock = new Set<string>();
const notifiedStockout = new Set<string>();

function lowStockMessage(ingredient: Ingredient): string {
  return `${ingredient.name} به ${toPersian(ingredient.currentStock)} ${formatUnit(ingredient.unit)} رسیده است (حد آستانه: ${toPersian(ingredient.minStock)} ${formatUnit(ingredient.unit)})`;
}

function stockoutMessage(ingredient: Ingredient): string {
  const days = Math.max(0, Math.round(ingredient.daysOfStockRemaining));
  const etaPart = ingredient.predictedStockoutDate ? ` (حدود ${formatDate(ingredient.predictedStockoutDate)})` : '';
  return `بر اساس روند مصرف، «${ingredient.name}» تا ${toPersian(days)} روز دیگر تمام می‌شود${etaPart}`;
}

async function notifyRoles(type: 'low_stock' | 'stockout_predicted', title: string, message: string): Promise<void> {
  for (const role of ALERT_ROLES) {
    await db.createNotification({ type, title, message, targetRole: role, createdBy: 'system' });
  }
}

/** Called after every theoretical-stock recomputation; persists in-app notifications for newly-crossed thresholds. */
export async function checkStockAlertsAndNotify(ingredients: Ingredient[]): Promise<void> {
  const lowIds = new Set<string>();
  const stockoutIds = new Set<string>();
  let created = false;

  for (const ingredient of ingredients) {
    if (ingredient.currentStock <= ingredient.minStock) {
      lowIds.add(ingredient.id);
      if (!notifiedLowStock.has(ingredient.id)) {
        notifiedLowStock.add(ingredient.id);
        await notifyRoles('low_stock', `⚠️ کسری موجودی: ${ingredient.name}`, lowStockMessage(ingredient));
        created = true;
      }
    }

    if (ingredient.dailyUsageRate > 0 && ingredient.daysOfStockRemaining <= STOCKOUT_WARNING_DAYS) {
      stockoutIds.add(ingredient.id);
      if (!notifiedStockout.has(ingredient.id)) {
        notifiedStockout.add(ingredient.id);
        await notifyRoles('stockout_predicted', `📉 پیش‌بینی اتمام موجودی: ${ingredient.name}`, stockoutMessage(ingredient));
        created = true;
      }
    }
  }

  for (const id of notifiedLowStock) if (!lowIds.has(id)) notifiedLowStock.delete(id);
  for (const id of notifiedStockout) if (!stockoutIds.has(id)) notifiedStockout.delete(id);

  if (created) await refreshNotifications();
}

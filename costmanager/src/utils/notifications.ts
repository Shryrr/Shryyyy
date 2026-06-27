import { createAlertBanner } from '../components/alert-banner';
import { ingredients } from '../store';
import { formatUnit, toPersian } from './format';
import type { Ingredient } from '../types';

/** Ingredient ids already notified for the current continuous low-stock period; cleared once stock recovers. */
const notifiedIds = new Set<string>();
let bannerHost: HTMLElement | null = null;

export function setNotificationBannerHost(host: HTMLElement): void {
  bannerHost = host;
}

export async function requestNotificationPermission(): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  await Notification.requestPermission();
}

function lowStockMessage(ingredient: Ingredient): string {
  return `${ingredient.name} به ${toPersian(ingredient.currentStock)} ${formatUnit(ingredient.unit)} رسیده است (حد آستانه: ${toPersian(ingredient.minStock)} ${formatUnit(ingredient.unit)})`;
}

function notifyBrowser(ingredient: Ingredient): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(`⚠️ کسری موجودی: ${ingredient.name}`, {
    body: lowStockMessage(ingredient),
    tag: `low-stock-${ingredient.id}`,
  });
}

function notifyInApp(ingredient: Ingredient): void {
  if (!bannerHost) return;
  const banner = createAlertBanner({
    id: `low-stock-${ingredient.id}`,
    message: lowStockMessage(ingredient),
    tone: 'warning',
  });
  if (banner) bannerHost.appendChild(banner);
}

export function checkLowStockAndNotify(): void {
  const lowIds = new Set<string>();

  for (const ingredient of ingredients.get()) {
    if (ingredient.currentStock > ingredient.minStock) continue;
    lowIds.add(ingredient.id);
    if (notifiedIds.has(ingredient.id)) continue;
    notifiedIds.add(ingredient.id);
    notifyInApp(ingredient);
    notifyBrowser(ingredient);
  }

  for (const id of notifiedIds) {
    if (!lowIds.has(id)) notifiedIds.delete(id);
  }
}

/** Subscribing fires immediately with the current value, so this also covers the initial app-load check. */
export function initLowStockWatcher(): void {
  ingredients.subscribe(() => checkLowStockAndNotify());
}

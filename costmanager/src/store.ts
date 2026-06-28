import * as db from './db';
import type {
  AppNotification, Customer, Employee, Expense, Ingredient, MenuItem, Sale, Settings, ShoppingListItem, SmsLog, UserRole,
} from './types';

type Listener<T> = (value: T) => void;

/** Minimal signal: holds a value, notifies subscribers on change. No diffing, no batching. */
export class Signal<T> {
  private listeners = new Set<Listener<T>>();

  constructor(private value: T) {}

  get(): T {
    return this.value;
  }

  set(value: T): void {
    this.value = value;
    for (const listener of this.listeners) listener(value);
  }

  update(fn: (current: T) => T): void {
    this.set(fn(this.value));
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    listener(this.value);
    return () => this.listeners.delete(listener);
  }
}

export function signal<T>(initial: T): Signal<T> {
  return new Signal(initial);
}

export const ingredients = signal<Ingredient[]>([]);
export const menuItems = signal<MenuItem[]>([]);
export const expenses = signal<Expense[]>([]);
export const employees = signal<Employee[]>([]);
export const sales = signal<Sale[]>([]);
export const shoppingList = signal<ShoppingListItem[]>([]);
export const customers = signal<Customer[]>([]);
export const smsLogs = signal<SmsLog[]>([]);
export const notifications = signal<AppNotification[]>([]);
export const settings = signal<Settings | null>(null);
export const resolvedTheme = signal<'light' | 'dark'>('light');
export const isOnline = signal<boolean>(navigator.onLine);
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';
export const syncStatus = signal<SyncStatus>('idle');

/** Transient cross-view filter intent set by a KPI card before navigate(); the target view reads + clears it on mount. */
export const navigationIntent = signal<Record<string, unknown> | null>(null);
export function takeNavigationIntent(): Record<string, unknown> {
  const intent = navigationIntent.get() ?? {};
  navigationIntent.set(null);
  return intent;
}

export async function refreshIngredients(): Promise<void> {
  ingredients.set(await db.listIngredients());
}
export async function refreshMenuItems(): Promise<void> {
  menuItems.set(await db.listMenuItems());
}
export async function refreshExpenses(): Promise<void> {
  expenses.set(await db.listExpenses());
}
export async function refreshEmployees(): Promise<void> {
  employees.set(await db.listEmployees());
}
export async function refreshSales(): Promise<void> {
  sales.set(await db.listSales());
}
export async function refreshShoppingList(): Promise<void> {
  shoppingList.set(await db.listShoppingList());
}
export async function refreshCustomers(): Promise<void> {
  customers.set(await db.listCustomers());
}
export async function refreshSmsLogs(): Promise<void> {
  smsLogs.set(await db.listSmsLogs());
}
export async function refreshNotifications(): Promise<void> {
  notifications.set(await db.listNotifications());
}
export async function refreshSettings(): Promise<void> {
  settings.set(await db.getSettings());
}

export async function refreshAll(): Promise<void> {
  await Promise.all([
    refreshIngredients(),
    refreshMenuItems(),
    refreshExpenses(),
    refreshEmployees(),
    refreshSales(),
    refreshShoppingList(),
    refreshCustomers(),
    refreshSmsLogs(),
    refreshNotifications(),
    refreshSettings(),
  ]);
}

export function ingredientsById(): Map<string, Ingredient> {
  return new Map(ingredients.get().map((i) => [i.id, i]));
}

export function lowStockCount(): number {
  return ingredients.get().filter((i) => i.currentStock <= i.minStock).length;
}

export function unreadNotificationCount(role: UserRole): number {
  return notifications.get().filter((n) => n.targetRole === role && !n.isRead).length;
}

function applyTheme(theme: Settings['theme']): void {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const resolved = theme === 'auto' ? (prefersDark ? 'dark' : 'light') : theme;
  resolvedTheme.set(resolved);
  document.documentElement.setAttribute('data-theme', resolved);
}

export function initThemeWatcher(): void {
  settings.subscribe((s) => {
    if (s) applyTheme(s.theme);
  });
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const s = settings.get();
    if (s?.theme === 'auto') applyTheme('auto');
  });
}

export function initOnlineWatcher(): void {
  window.addEventListener('online', () => isOnline.set(true));
  window.addEventListener('offline', () => isOnline.set(false));
}

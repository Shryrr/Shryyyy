import * as db from './db';
import type { Employee, Expense, Ingredient, MenuItem, Sale, Settings, ShoppingListItem } from './types';

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
export const settings = signal<Settings | null>(null);
export const resolvedTheme = signal<'light' | 'dark'>('light');
export const isOnline = signal<boolean>(navigator.onLine);

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
    refreshSettings(),
  ]);
}

export function ingredientsById(): Map<string, Ingredient> {
  return new Map(ingredients.get().map((i) => [i.id, i]));
}

export function lowStockCount(): number {
  return ingredients.get().filter((i) => i.currentStock <= i.minStock).length;
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

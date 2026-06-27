import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  AppUser, AuthConfig, BulkSaleBreakdownEntry, Employee, Expense, FullBackup, Ingredient, MenuItem, PaidSubscriptionPlan,
  PurchaseRecord, Sale, SaleSource, Settings, ShoppingListItem, SubscriptionPlan, UserRole,
} from './types';
import { generateShoppingSuggestions, recipeCost, weightedAvgPrice } from './utils/calc';

interface Schema extends DBSchema {
  ingredients: { key: string; value: Ingredient; indexes: { byCategory: string } };
  menu_items: { key: string; value: MenuItem; indexes: { byCategory: string } };
  expenses: { key: string; value: Expense; indexes: { byCategory: string } };
  employees: { key: string; value: Employee };
  sales: { key: string; value: Sale; indexes: { byDate: string; byMenuItem: string } };
  shopping_list: { key: string; value: ShoppingListItem };
  settings: { key: string; value: Settings };
  auth: { key: string; value: AuthConfig };
}

/**
 * keyof Schema widens to `string` because DBSchema carries an index signature — spell out the literal union instead.
 * 'auth' is deliberately excluded from this list: it backs exportAllData/importAllData/resetAllData, and PINs
 * must never leak into a shared JSON backup, nor get wiped by a "reset all data" action that would lock out admins.
 */
type StoreName = 'ingredients' | 'menu_items' | 'expenses' | 'employees' | 'sales' | 'shopping_list' | 'settings';

const DB_NAME = 'costmanager_db';
const DB_VERSION = 3;
const MAX_PURCHASE_HISTORY = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
const UNLIMITED_EXPIRY = '2099-12-31T00:00:00.000Z';

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function getDB(): Promise<IDBPDatabase<Schema>> {
  if (!dbPromise) {
    dbPromise = openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          const ingredients = db.createObjectStore('ingredients', { keyPath: 'id' });
          ingredients.createIndex('byCategory', 'category');

          const menuItems = db.createObjectStore('menu_items', { keyPath: 'id' });
          menuItems.createIndex('byCategory', 'category');

          const expenses = db.createObjectStore('expenses', { keyPath: 'id' });
          expenses.createIndex('byCategory', 'category');

          db.createObjectStore('employees', { keyPath: 'id' });

          const sales = db.createObjectStore('sales', { keyPath: 'id' });
          sales.createIndex('byDate', 'date');
          sales.createIndex('byMenuItem', 'menuItemId');

          db.createObjectStore('shopping_list', { keyPath: 'id' });
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('auth', { keyPath: 'id' });
        }
        if (oldVersion > 0 && oldVersion < 3) {
          // Migrate the old 3-role system (admin/buyer/viewer) to the new 4-role system
          // (superadmin/manager/warehouse/buyer): the first 'admin' becomes the sole superadmin,
          // any further 'admin' or 'viewer' users fall back to 'manager' (closest full-access role).
          const authStore = transaction.objectStore('auth');
          type LegacyUser = Omit<AppUser, 'role'> & { role: string };
          authStore.get('auth').then((config) => {
            if (!config) return;
            let superadminAssigned = false;
            const users: AppUser[] = (config.users as LegacyUser[]).map((u): AppUser => {
              const createdAt = u.createdAt ?? nowISO();
              if (u.role === 'admin') {
                if (!superadminAssigned) {
                  superadminAssigned = true;
                  return { ...u, role: 'superadmin', subscriptionPlan: 'unlimited', subscriptionExpiry: UNLIMITED_EXPIRY, createdAt };
                }
                return { ...u, role: 'manager', createdAt };
              }
              if (u.role === 'viewer') return { ...u, role: 'manager', createdAt };
              return { ...u, role: u.role as UserRole, createdAt };
            });
            authStore.put({ id: 'auth', isSetup: config.isSetup, users });
          });
        }
      },
    });
  }
  return dbPromise;
}

// crypto.randomUUID() only exists in secure contexts (HTTPS or localhost); this app is
// meant to run from a plain HTTP IP too, so generate the UUID from getRandomValues
// instead, which carries no such restriction.
export function uuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

export class IngredientInUseError extends Error {
  constructor(public readonly recipes: MenuItem[]) {
    super('ingredient is used in one or more recipes');
  }
}

// ---------- Ingredients ----------

export async function listIngredients(): Promise<Ingredient[]> {
  return (await getDB()).getAll('ingredients');
}

export async function getIngredient(id: string): Promise<Ingredient | undefined> {
  return (await getDB()).get('ingredients', id);
}

export interface NewIngredientInput {
  name: string;
  category: Ingredient['category'];
  unit: Ingredient['unit'];
  currentStock: number;
  pricePerUnit: number;
  minStock: number;
  maxStock: number;
}

export async function createIngredient(input: NewIngredientInput): Promise<Ingredient> {
  const ts = nowISO();
  const purchaseHistory: PurchaseRecord[] = [];
  if (input.currentStock > 0 && input.pricePerUnit > 0) {
    purchaseHistory.push({
      id: uuid(),
      date: ts,
      quantity: input.currentStock,
      pricePerUnit: input.pricePerUnit,
      note: 'موجودی اولیه',
    });
  }
  const ingredient: Ingredient = {
    id: uuid(),
    name: input.name,
    category: input.category,
    unit: input.unit,
    currentStock: input.currentStock,
    pricePerUnit: input.pricePerUnit,
    minStock: input.minStock,
    maxStock: input.maxStock,
    purchaseHistory,
    createdAt: ts,
    updatedAt: ts,
  };
  await (await getDB()).put('ingredients', ingredient);
  await regenerateShoppingList();
  return ingredient;
}

export async function updateIngredient(id: string, patch: Partial<NewIngredientInput>): Promise<Ingredient> {
  const db = await getDB();
  const existing = await db.get('ingredients', id);
  if (!existing) throw new Error('ingredient not found');
  const updated: Ingredient = { ...existing, ...patch, updatedAt: nowISO() };
  await db.put('ingredients', updated);
  await regenerateShoppingList();
  return updated;
}

export async function getRecipesUsingIngredient(ingredientId: string): Promise<MenuItem[]> {
  const menuItems = await listMenuItems();
  return menuItems.filter((m) => m.recipe.some((ri) => ri.ingredientId === ingredientId));
}

export async function deleteIngredient(id: string, force = false): Promise<void> {
  const affected = await getRecipesUsingIngredient(id);
  if (affected.length && !force) {
    throw new IngredientInUseError(affected);
  }
  const db = await getDB();
  if (affected.length) {
    const tx = db.transaction('menu_items', 'readwrite');
    for (const item of affected) {
      const cleaned = { ...item, recipe: item.recipe.filter((ri) => ri.ingredientId !== id), updatedAt: nowISO() };
      await tx.store.put(cleaned);
    }
    await tx.done;
  }
  await db.delete('ingredients', id);
  const list = await listShoppingList();
  const stale = list.find((i) => i.ingredientId === id);
  if (stale) await db.delete('shopping_list', stale.id);
}

export interface RecordPurchaseInput {
  quantity: number;
  pricePerUnit: number;
  date: string;
  supplier?: string;
  note?: string;
}

export async function recordPurchase(ingredientId: string, input: RecordPurchaseInput): Promise<Ingredient> {
  const db = await getDB();
  const ingredient = await db.get('ingredients', ingredientId);
  if (!ingredient) throw new Error('ingredient not found');

  const record: PurchaseRecord = {
    id: uuid(),
    date: input.date,
    quantity: input.quantity,
    pricePerUnit: input.pricePerUnit,
    supplier: input.supplier,
    note: input.note,
  };

  const newAvgPrice = weightedAvgPrice(ingredient.currentStock, ingredient.pricePerUnit, input.quantity, input.pricePerUnit);
  const history = [...ingredient.purchaseHistory, record]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-MAX_PURCHASE_HISTORY);

  const updated: Ingredient = {
    ...ingredient,
    currentStock: ingredient.currentStock + input.quantity,
    pricePerUnit: newAvgPrice,
    purchaseHistory: history,
    updatedAt: nowISO(),
  };
  await db.put('ingredients', updated);
  await regenerateShoppingList();
  return updated;
}

function recalcWeightedAvgFromHistory(history: PurchaseRecord[]): number {
  let qtySum = 0;
  let costSum = 0;
  for (const r of history) {
    qtySum += r.quantity;
    costSum += r.quantity * r.pricePerUnit;
  }
  if (!qtySum) return 0;
  return costSum / qtySum;
}

export async function updatePurchaseHistoryEntry(
  ingredientId: string,
  recordId: string,
  patch: Partial<Pick<PurchaseRecord, 'quantity' | 'pricePerUnit' | 'date' | 'supplier' | 'note'>>,
): Promise<Ingredient> {
  const db = await getDB();
  const ingredient = await db.get('ingredients', ingredientId);
  if (!ingredient) throw new Error('ingredient not found');

  const idx = ingredient.purchaseHistory.findIndex((r) => r.id === recordId);
  if (idx === -1) throw new Error('purchase record not found');

  const oldRecord = ingredient.purchaseHistory[idx];
  const deltaQty = (patch.quantity ?? oldRecord.quantity) - oldRecord.quantity;
  const newHistory = [...ingredient.purchaseHistory];
  newHistory[idx] = { ...oldRecord, ...patch };

  const updated: Ingredient = {
    ...ingredient,
    currentStock: ingredient.currentStock + deltaQty,
    pricePerUnit: recalcWeightedAvgFromHistory(newHistory),
    purchaseHistory: newHistory,
    updatedAt: nowISO(),
  };
  await db.put('ingredients', updated);
  await regenerateShoppingList();
  return updated;
}

// ---------- Menu items / recipes ----------

export async function listMenuItems(): Promise<MenuItem[]> {
  return (await getDB()).getAll('menu_items');
}

export async function getMenuItem(id: string): Promise<MenuItem | undefined> {
  return (await getDB()).get('menu_items', id);
}

export interface NewMenuItemInput {
  name: string;
  category: string;
  salePrice: number;
}

export async function createMenuItem(input: NewMenuItemInput): Promise<MenuItem> {
  const ts = nowISO();
  const item: MenuItem = {
    id: uuid(),
    name: input.name,
    category: input.category,
    salePrice: input.salePrice,
    isActive: true,
    recipe: [],
    createdAt: ts,
    updatedAt: ts,
  };
  await (await getDB()).put('menu_items', item);
  return item;
}

export async function updateMenuItem(id: string, patch: Partial<Omit<MenuItem, 'id' | 'createdAt'>>): Promise<MenuItem> {
  const db = await getDB();
  const existing = await db.get('menu_items', id);
  if (!existing) throw new Error('menu item not found');
  const updated: MenuItem = { ...existing, ...patch, updatedAt: nowISO() };
  await db.put('menu_items', updated);
  return updated;
}

export async function deleteMenuItem(id: string): Promise<void> {
  await (await getDB()).delete('menu_items', id);
}

export async function setRecipeIngredientQty(menuItemId: string, ingredientId: string, quantity: number): Promise<MenuItem> {
  const db = await getDB();
  const item = await db.get('menu_items', menuItemId);
  if (!item) throw new Error('menu item not found');
  const recipe = [...item.recipe];
  const idx = recipe.findIndex((r) => r.ingredientId === ingredientId);
  if (quantity <= 0) {
    if (idx > -1) recipe.splice(idx, 1);
  } else if (idx > -1) {
    recipe[idx] = { ingredientId, quantity };
  } else {
    recipe.push({ ingredientId, quantity });
  }
  const updated: MenuItem = { ...item, recipe, updatedAt: nowISO() };
  await db.put('menu_items', updated);
  return updated;
}

export async function removeRecipeIngredient(menuItemId: string, ingredientId: string): Promise<MenuItem> {
  return setRecipeIngredientQty(menuItemId, ingredientId, 0);
}

// ---------- Expenses ----------

export async function listExpenses(): Promise<Expense[]> {
  return (await getDB()).getAll('expenses');
}

export type NewExpenseInput = Omit<Expense, 'id' | 'createdAt'>;

export async function createExpense(input: NewExpenseInput): Promise<Expense> {
  const expense: Expense = { ...input, id: uuid(), createdAt: nowISO() };
  await (await getDB()).put('expenses', expense);
  return expense;
}

export async function updateExpense(id: string, patch: Partial<NewExpenseInput>): Promise<Expense> {
  const db = await getDB();
  const existing = await db.get('expenses', id);
  if (!existing) throw new Error('expense not found');
  const updated: Expense = { ...existing, ...patch };
  await db.put('expenses', updated);
  return updated;
}

export async function deleteExpense(id: string): Promise<void> {
  await (await getDB()).delete('expenses', id);
}

// ---------- Employees ----------

export async function listEmployees(): Promise<Employee[]> {
  return (await getDB()).getAll('employees');
}

export type NewEmployeeInput = Omit<Employee, 'id'>;

export async function createEmployee(input: NewEmployeeInput): Promise<Employee> {
  const employee: Employee = { ...input, id: uuid() };
  await (await getDB()).put('employees', employee);
  return employee;
}

export async function updateEmployee(id: string, patch: Partial<NewEmployeeInput>): Promise<Employee> {
  const db = await getDB();
  const existing = await db.get('employees', id);
  if (!existing) throw new Error('employee not found');
  const updated: Employee = { ...existing, ...patch };
  await db.put('employees', updated);
  return updated;
}

export async function deleteEmployee(id: string): Promise<void> {
  await (await getDB()).delete('employees', id);
}

// ---------- Sales ----------

export async function listSales(): Promise<Sale[]> {
  return (await getDB()).getAll('sales');
}

export interface RecordSaleInput {
  menuItemId: string;
  quantity: number;
  date: string;
  note?: string;
  source?: SaleSource;
}

export async function recordSale(input: RecordSaleInput): Promise<Sale> {
  const db = await getDB();
  const menuItem = await db.get('menu_items', input.menuItemId);
  if (!menuItem) throw new Error('menu item not found');
  const ingredients = await db.getAll('ingredients');
  const ingredientsById = new Map(ingredients.map((i) => [i.id, i]));
  const unitCost = recipeCost(menuItem.recipe, ingredientsById);

  const sale: Sale = {
    id: uuid(),
    date: input.date,
    menuItemId: menuItem.id,
    menuItemName: menuItem.name,
    quantity: input.quantity,
    unitSalePrice: menuItem.salePrice,
    unitCost,
    note: input.note,
    source: input.source ?? 'manual',
  };

  const tx = db.transaction(['sales', 'ingredients'], 'readwrite');
  await tx.objectStore('sales').put(sale);
  for (const ri of menuItem.recipe) {
    const ingredient = ingredientsById.get(ri.ingredientId);
    if (!ingredient) continue;
    await tx.objectStore('ingredients').put({
      ...ingredient,
      currentStock: ingredient.currentStock - ri.quantity * input.quantity,
      updatedAt: nowISO(),
    });
  }
  await tx.done;
  await regenerateShoppingList();
  return sale;
}

export interface RecordImportedSaleInput {
  menuItemId: string;
  quantity: number;
  unitSalePrice: number;
  date: string;
  source: 'cashier' | 'snappfood';
  note?: string;
  snappfood?: { grossSales: number; discount: number; commission: number; netReceived: number };
}

/**
 * Like recordSale, but for Excel-imported rows (POS cashier / Snappfood): the sale's unit price
 * comes from the imported row (which may differ from the menu item's current catalog price), and
 * the shopping list is NOT regenerated per-row — the caller regenerates once after the whole batch.
 */
export async function recordImportedSale(input: RecordImportedSaleInput): Promise<Sale> {
  const db = await getDB();
  const menuItem = await db.get('menu_items', input.menuItemId);
  if (!menuItem) throw new Error('menu item not found');
  const ingredients = await db.getAll('ingredients');
  const ingredientsById = new Map(ingredients.map((i) => [i.id, i]));
  const unitCost = recipeCost(menuItem.recipe, ingredientsById);

  const sale: Sale = {
    id: uuid(),
    date: input.date,
    menuItemId: menuItem.id,
    menuItemName: menuItem.name,
    quantity: input.quantity,
    unitSalePrice: input.unitSalePrice,
    unitCost,
    note: input.note,
    source: input.source,
    snappfood: input.snappfood,
  };

  const tx = db.transaction(['sales', 'ingredients'], 'readwrite');
  await tx.objectStore('sales').put(sale);
  for (const ri of menuItem.recipe) {
    const ingredient = ingredientsById.get(ri.ingredientId);
    if (!ingredient) continue;
    await tx.objectStore('ingredients').put({
      ...ingredient,
      currentStock: ingredient.currentStock - ri.quantity * input.quantity,
      updatedAt: nowISO(),
    });
  }
  await tx.done;
  return sale;
}

export interface RecordBulkSaleInput {
  date: string;
  totalRevenue: number;
}

/**
 * Estimates a per-item breakdown of an end-of-day total by revenue-share: each active menu item's
 * share of the last 30 days of itemized sales (or an equal split if there's no history), then
 * deducts ingredients proportionally to the estimated quantities. The exact deducted amounts are
 * saved on the sale itself (not recomputed from the live recipe later) so deleteSale can reverse
 * them precisely even if recipes change afterward.
 */
export async function recordBulkSale(input: RecordBulkSaleInput): Promise<Sale> {
  const db = await getDB();
  const [menuItems, ingredientsList, allSales] = await Promise.all([
    db.getAll('menu_items'),
    db.getAll('ingredients'),
    db.getAll('sales'),
  ]);
  const activeItems = menuItems.filter((m) => m.isActive);
  if (!activeItems.length) throw new Error('no active menu items to estimate from');

  const ingredientsById = new Map(ingredientsList.map((i) => [i.id, i]));
  const saleTime = new Date(input.date).getTime();
  const cutoff = saleTime - 30 * DAY_MS;

  const historicalByItem = new Map<string, number>();
  let historicalTotal = 0;
  for (const s of allSales) {
    if (s.type === 'bulk') continue;
    const t = new Date(s.date).getTime();
    if (t < cutoff || t > saleTime) continue;
    const revenue = s.unitSalePrice * s.quantity;
    historicalByItem.set(s.menuItemId, (historicalByItem.get(s.menuItemId) ?? 0) + revenue);
    historicalTotal += revenue;
  }

  const activeHistoricalTotal = activeItems.reduce((sum, item) => sum + (historicalByItem.get(item.id) ?? 0), 0);
  const shareByItem = new Map<string, number>();
  if (activeHistoricalTotal > 0) {
    for (const item of activeItems) shareByItem.set(item.id, (historicalByItem.get(item.id) ?? 0) / activeHistoricalTotal);
  } else {
    for (const item of activeItems) shareByItem.set(item.id, 1 / activeItems.length);
  }

  const breakdown: BulkSaleBreakdownEntry[] = [];
  const ingredientDeltas = new Map<string, number>();
  let totalEstimatedCost = 0;

  for (const item of activeItems) {
    const share = shareByItem.get(item.id) ?? 0;
    if (share <= 0) continue;
    const itemRevenue = input.totalRevenue * share;
    const estimatedQuantity = item.salePrice > 0 ? itemRevenue / item.salePrice : 0;
    if (estimatedQuantity <= 0) continue;
    const unitCost = recipeCost(item.recipe, ingredientsById);
    const itemCost = unitCost * estimatedQuantity;
    totalEstimatedCost += itemCost;
    breakdown.push({
      menuItemId: item.id,
      menuItemName: item.name,
      estimatedQuantity,
      estimatedRevenue: itemRevenue,
      estimatedCost: itemCost,
    });
    for (const ri of item.recipe) {
      ingredientDeltas.set(ri.ingredientId, (ingredientDeltas.get(ri.ingredientId) ?? 0) + ri.quantity * estimatedQuantity);
    }
  }

  const sale: Sale = {
    id: uuid(),
    date: input.date,
    menuItemId: '',
    menuItemName: 'فروش کلی پایان روز',
    quantity: 1,
    unitSalePrice: input.totalRevenue,
    unitCost: totalEstimatedCost,
    type: 'bulk',
    source: 'bulk',
    estimatedBreakdown: breakdown,
    ingredientDeltas: Array.from(ingredientDeltas.entries()).map(([ingredientId, quantity]) => ({ ingredientId, quantity })),
  };

  const tx = db.transaction(['sales', 'ingredients'], 'readwrite');
  await tx.objectStore('sales').put(sale);
  for (const [ingredientId, qty] of ingredientDeltas) {
    const ingredient = ingredientsById.get(ingredientId);
    if (!ingredient) continue;
    await tx.objectStore('ingredients').put({ ...ingredient, currentStock: ingredient.currentStock - qty, updatedAt: nowISO() });
  }
  await tx.done;
  await regenerateShoppingList();
  return sale;
}

export async function deleteSale(id: string): Promise<void> {
  const db = await getDB();
  const sale = await db.get('sales', id);
  if (!sale) return;
  const menuItem = sale.type === 'bulk' ? undefined : await db.get('menu_items', sale.menuItemId);

  const tx = db.transaction(['sales', 'ingredients'], 'readwrite');
  if (sale.type === 'bulk') {
    for (const delta of sale.ingredientDeltas ?? []) {
      const ingredient = await tx.objectStore('ingredients').get(delta.ingredientId);
      if (!ingredient) continue;
      await tx.objectStore('ingredients').put({
        ...ingredient,
        currentStock: ingredient.currentStock + delta.quantity,
        updatedAt: nowISO(),
      });
    }
  } else if (menuItem) {
    for (const ri of menuItem.recipe) {
      const ingredient = await tx.objectStore('ingredients').get(ri.ingredientId);
      if (!ingredient) continue;
      await tx.objectStore('ingredients').put({
        ...ingredient,
        currentStock: ingredient.currentStock + ri.quantity * sale.quantity,
        updatedAt: nowISO(),
      });
    }
  }
  await tx.objectStore('sales').delete(id);
  await tx.done;
  await regenerateShoppingList();
}

// ---------- Shopping list ----------

export async function listShoppingList(): Promise<ShoppingListItem[]> {
  return (await getDB()).getAll('shopping_list');
}

export async function regenerateShoppingList(): Promise<ShoppingListItem[]> {
  const db = await getDB();
  const ingredients = await db.getAll('ingredients');
  const existing = await db.getAll('shopping_list');
  const existingByIngredient = new Map(existing.map((i) => [i.ingredientId, i]));
  const suggestions = generateShoppingSuggestions(ingredients);
  const ingredientsById = new Map(ingredients.map((i) => [i.id, i]));
  const ts = nowISO();

  const nextList: ShoppingListItem[] = suggestions.map((s) => {
    const ingredient = ingredientsById.get(s.ingredientId)!;
    const prior = existingByIngredient.get(s.ingredientId);
    return {
      id: prior?.id ?? uuid(),
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      currentStock: ingredient.currentStock,
      minStock: ingredient.minStock,
      maxStock: ingredient.maxStock,
      unit: ingredient.unit,
      suggestedQty: prior?.suggestedQty ?? s.suggestedQty,
      estimatedCost: (prior?.suggestedQty ?? s.suggestedQty) * ingredient.pricePerUnit,
      checked: prior?.checked ?? false,
      note: prior?.note,
      generatedAt: prior?.generatedAt ?? ts,
    };
  });

  const tx = db.transaction('shopping_list', 'readwrite');
  await tx.store.clear();
  for (const item of nextList) await tx.store.put(item);
  await tx.done;
  return nextList;
}

export async function toggleShoppingItemChecked(id: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('shopping_list', id);
  if (!item) return;
  await db.put('shopping_list', { ...item, checked: !item.checked });
}

export async function updateShoppingItem(id: string, patch: Partial<Pick<ShoppingListItem, 'suggestedQty' | 'note'>>): Promise<void> {
  const db = await getDB();
  const item = await db.get('shopping_list', id);
  if (!item) return;
  const ingredient = await db.get('ingredients', item.ingredientId);
  const suggestedQty = patch.suggestedQty ?? item.suggestedQty;
  await db.put('shopping_list', {
    ...item,
    ...patch,
    suggestedQty,
    estimatedCost: suggestedQty * (ingredient?.pricePerUnit ?? 0),
  });
}

// ---------- Settings ----------

const DEFAULT_SETTINGS: Settings = {
  id: 'global',
  businessName: 'کافه من',
  businessType: 'cafe',
  currency: 'toman',
  targetFoodCostPercent: 30,
  theme: 'auto',
  subscriptionPrices: { '1m': 0, '3m': 0, '6m': 0, '12m': 0 },
};

export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const settings = await db.get('settings', 'global');
  if (!settings) {
    await db.put('settings', DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  if (!settings.subscriptionPrices) {
    const patched: Settings = { ...settings, subscriptionPrices: DEFAULT_SETTINGS.subscriptionPrices };
    await db.put('settings', patched);
    return patched;
  }
  return settings;
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const db = await getDB();
  const existing = await getSettings();
  const updated: Settings = { ...existing, ...patch };
  await db.put('settings', updated);
  return updated;
}

// ---------- Auth ----------

const PLAN_MONTHS: Record<PaidSubscriptionPlan, number> = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 };

function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function planExpiryISO(plan: SubscriptionPlan, fromISO: string = nowISO()): string {
  if (plan === 'unlimited') return UNLIMITED_EXPIRY;
  return addMonthsISO(fromISO, PLAN_MONTHS[plan]);
}

export async function getAuthConfig(): Promise<AuthConfig> {
  const db = await getDB();
  const config = await db.get('auth', 'auth');
  if (config) return config;
  const fresh: AuthConfig = { id: 'auth', isSetup: false, users: [] };
  await db.put('auth', fresh);
  return fresh;
}

export async function hasSuperadmin(): Promise<boolean> {
  const config = await getAuthConfig();
  return config.users.some((u) => u.role === 'superadmin');
}

/** First-launch setup wizard: creates the single superadmin user with an unlimited plan. */
export async function createSuperadmin(name: string, pin: string): Promise<AppUser> {
  const db = await getDB();
  const config = await getAuthConfig();
  if (config.users.some((u) => u.role === 'superadmin')) {
    throw new Error('مدیر اصلی سیستم از قبل تعریف شده است');
  }
  const user: AppUser = {
    id: uuid(),
    name,
    pin,
    role: 'superadmin',
    isActive: true,
    subscriptionPlan: 'unlimited',
    subscriptionExpiry: UNLIMITED_EXPIRY,
    createdAt: nowISO(),
  };
  const updated: AuthConfig = { ...config, isSetup: true, users: [...config.users, user] };
  await db.put('auth', updated);
  return user;
}

export async function findUserByPin(pin: string): Promise<AppUser | undefined> {
  const config = await getAuthConfig();
  return config.users.find((u) => u.pin === pin && u.isActive);
}

export async function getUser(id: string): Promise<AppUser | undefined> {
  const config = await getAuthConfig();
  return config.users.find((u) => u.id === id);
}

export async function listUsers(): Promise<AppUser[]> {
  const config = await getAuthConfig();
  return config.users;
}

export async function recordLogin(id: string): Promise<void> {
  const db = await getDB();
  const config = await getAuthConfig();
  const idx = config.users.findIndex((u) => u.id === id);
  if (idx === -1) return;
  const users = [...config.users];
  users[idx] = { ...users[idx], lastLogin: nowISO() };
  await db.put('auth', { ...config, users });
}

export interface NewUserInput {
  name: string;
  pin: string;
  role: UserRole;
  subscriptionPlan: SubscriptionPlan;
  subscriptionPricesPaid?: number;
}

export async function createUser(input: NewUserInput): Promise<AppUser> {
  if (input.role === 'superadmin') throw new Error('امکان ایجاد مدیر اصلی دوم وجود ندارد');
  const db = await getDB();
  const config = await getAuthConfig();
  const user: AppUser = {
    id: uuid(),
    name: input.name,
    pin: input.pin,
    role: input.role,
    isActive: true,
    subscriptionPlan: input.subscriptionPlan,
    subscriptionExpiry: planExpiryISO(input.subscriptionPlan),
    subscriptionPricesPaid: input.subscriptionPricesPaid,
    createdAt: nowISO(),
  };
  await db.put('auth', { ...config, users: [...config.users, user] });
  return user;
}

export async function updateUser(id: string, patch: Partial<Omit<AppUser, 'id'>>): Promise<AppUser> {
  const db = await getDB();
  const config = await getAuthConfig();
  const idx = config.users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error('user not found');
  const existing = config.users[idx];
  if (existing.role === 'superadmin') {
    if (patch.role && patch.role !== 'superadmin') throw new Error('نقش مدیر اصلی قابل تغییر نیست');
    if (patch.isActive === false) throw new Error('مدیر اصلی قابل غیرفعال‌سازی نیست');
  } else if (patch.role === 'superadmin') {
    throw new Error('امکان تغییر نقش به مدیر اصلی وجود ندارد');
  }
  const updated: AppUser = { ...existing, ...patch };
  const users = [...config.users];
  users[idx] = updated;
  await db.put('auth', { ...config, users });
  return updated;
}

export async function deleteUser(id: string): Promise<void> {
  const db = await getDB();
  const config = await getAuthConfig();
  const target = config.users.find((u) => u.id === id);
  if (target?.role === 'superadmin') throw new Error('مدیر اصلی قابل حذف نیست');
  await db.put('auth', { ...config, users: config.users.filter((u) => u.id !== id) });
}

/** Overwrites the entire user list, used by cloud sync to mirror cross-device user management. */
export async function replaceAuthUsers(users: AppUser[]): Promise<void> {
  const db = await getDB();
  const config = await getAuthConfig();
  await db.put('auth', { ...config, isSetup: true, users });
}

export async function changeSuperadminPin(currentPin: string, newPin: string): Promise<AppUser> {
  const db = await getDB();
  const config = await getAuthConfig();
  const idx = config.users.findIndex((u) => u.role === 'superadmin');
  if (idx === -1) throw new Error('مدیر اصلی یافت نشد');
  if (config.users[idx].pin !== currentPin) throw new Error('پین فعلی نادرست است');
  const updated: AppUser = { ...config.users[idx], pin: newPin };
  const users = [...config.users];
  users[idx] = updated;
  await db.put('auth', { ...config, users });
  return updated;
}

/** Extends from the current expiry if still active, otherwise from today (so a lapsed user doesn't keep their old date). */
export async function extendSubscription(id: string, months: number, plan?: SubscriptionPlan): Promise<AppUser> {
  const db = await getDB();
  const config = await getAuthConfig();
  const idx = config.users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error('user not found');
  const user = config.users[idx];
  if (plan === 'unlimited') {
    const updated: AppUser = { ...user, subscriptionPlan: 'unlimited', subscriptionExpiry: UNLIMITED_EXPIRY };
    const users = [...config.users];
    users[idx] = updated;
    await db.put('auth', { ...config, users });
    return updated;
  }
  const stillActive = user.subscriptionPlan !== 'unlimited' && new Date(user.subscriptionExpiry).getTime() > Date.now();
  const base = stillActive ? user.subscriptionExpiry : nowISO();
  const updated: AppUser = {
    ...user,
    subscriptionExpiry: addMonthsISO(base, months),
    subscriptionPlan: plan ?? (user.subscriptionPlan === 'unlimited' ? '12m' : user.subscriptionPlan),
  };
  const users = [...config.users];
  users[idx] = updated;
  await db.put('auth', { ...config, users });
  return updated;
}

// ---------- Backup / restore ----------

export async function exportAllData(): Promise<FullBackup> {
  const db = await getDB();
  const [ingredients, menu_items, expenses, employees, sales, shopping_list, settings] = await Promise.all([
    db.getAll('ingredients'),
    db.getAll('menu_items'),
    db.getAll('expenses'),
    db.getAll('employees'),
    db.getAll('sales'),
    db.getAll('shopping_list'),
    db.getAll('settings'),
  ]);
  return {
    exportedAt: nowISO(),
    version: 1,
    data: { ingredients, menu_items, expenses, employees, sales, shopping_list, settings },
  };
}

export async function importAllData(backup: FullBackup, mode: 'merge' | 'replace'): Promise<void> {
  const db = await getDB();
  const storeNames: StoreName[] = ['ingredients', 'menu_items', 'expenses', 'employees', 'sales', 'shopping_list', 'settings'];
  const tx = db.transaction(storeNames, 'readwrite');
  for (const name of storeNames) {
    if (mode === 'replace') await tx.objectStore(name).clear();
    const rows = (backup.data as Record<string, { id: string }[]>)[name] ?? [];
    for (const row of rows) await tx.objectStore(name).put(row as never);
  }
  await tx.done;
  await updateSettings({ lastBackup: nowISO() });
}

export async function resetAllData(): Promise<void> {
  const db = await getDB();
  const storeNames: StoreName[] = ['ingredients', 'menu_items', 'expenses', 'employees', 'sales', 'shopping_list', 'settings'];
  const tx = db.transaction(storeNames, 'readwrite');
  for (const name of storeNames) await tx.objectStore(name).clear();
  await tx.done;
}

export async function isDatabaseEmpty(): Promise<boolean> {
  const db = await getDB();
  const count = await db.count('ingredients');
  return count === 0;
}

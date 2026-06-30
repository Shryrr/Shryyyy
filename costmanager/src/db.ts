import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  AppNotification, AppUser, AttendanceRecord, AttendanceStatus, AuthConfig, AutomationTrigger, BulkSaleBreakdownEntry,
  BusinessSubscriptionStatus, BusinessType,
  CampaignRecord, Customer, DeliveryInfo, Employee, Expense, FullBackup, Ingredient, MenuItem, OrderType, PaidSubscriptionPlan,
  PayrollAdjustment, PayrollRecord, PettyCashRequestStatus, PettyCashTransaction, PettyCashTxType, PurchaseRecord, RFMScore, RFMSegment,
  SalaryAdvance, Sale, SaleSource, Settings, ShoppingListItem, SmsLog, SubscriptionPaymentRecord, Supplier,
  SupplierPayment, SupplierTransaction, SupplierTransactionType, SubscriptionPlan, SurveyResponse, UserRole, WasteEntry, WasteReason,
} from './types';
import { generateShoppingSuggestions, recipeCost, weightedAvgPrice } from './utils/calc';
import { generateSalt, hashPassword, verifyPassword } from './utils/password';
import type { ApiBusiness, ApiUser } from './utils/api';

interface Schema extends DBSchema {
  ingredients: { key: string; value: Ingredient; indexes: { byCategory: string } };
  menu_items: { key: string; value: MenuItem; indexes: { byCategory: string } };
  expenses: { key: string; value: Expense; indexes: { byCategory: string } };
  employees: { key: string; value: Employee };
  sales: { key: string; value: Sale; indexes: { byDate: string; byMenuItem: string } };
  shopping_list: { key: string; value: ShoppingListItem };
  settings: { key: string; value: Settings };
  auth: { key: string; value: AuthConfig };
  customers: { key: string; value: Customer; indexes: { byPhone: string } };
  sms_logs: { key: string; value: SmsLog };
  notifications: { key: string; value: AppNotification; indexes: { byTargetRole: string } };
  waste: { key: string; value: WasteEntry; indexes: { byIngredient: string; byDate: string } };
  suppliers: { key: string; value: Supplier };
  supplier_payments: { key: string; value: SupplierPayment; indexes: { bySupplier: string } };
  automation_triggers: { key: string; value: AutomationTrigger };
  supplier_transactions: { key: string; value: SupplierTransaction; indexes: { bySupplier: string } };
  attendance: { key: string; value: AttendanceRecord; indexes: { byEmployee: string; byDate: string } };
  payroll_records: { key: string; value: PayrollRecord; indexes: { byEmployee: string; byPeriod: string } };
  salary_advances: { key: string; value: SalaryAdvance; indexes: { byEmployee: string } };
  petty_cash: { key: string; value: PettyCashTransaction };
  subscription_payments_cache: { key: string; value: SubscriptionPaymentRecord };
}

/**
 * keyof Schema widens to `string` because DBSchema carries an index signature — spell out the literal union instead.
 * 'auth' is deliberately excluded from this list: it backs exportAllData/importAllData/resetAllData, and PINs
 * must never leak into a shared JSON backup, nor get wiped by a "reset all data" action that would lock out admins.
 */
export type StoreName =
  | 'ingredients' | 'menu_items' | 'expenses' | 'employees' | 'sales' | 'shopping_list' | 'settings'
  | 'customers' | 'sms_logs' | 'notifications' | 'waste' | 'suppliers' | 'supplier_payments' | 'automation_triggers'
  | 'supplier_transactions' | 'attendance' | 'payroll_records' | 'salary_advances' | 'petty_cash' | 'subscription_payments_cache';

const DB_NAME = 'costmanager_db';
const DB_VERSION = 7;
const MAX_PURCHASE_HISTORY = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
const UNLIMITED_EXPIRY = '2099-12-31T00:00:00.000Z';
const DEFAULT_POINTS_PER_TOMAN = 10_000;
const DEFAULT_POINTS_TO_TOMAN_RATIO = 1_000;
/** Finite cap instead of Infinity: JSON.stringify (used by the backup export) silently turns Infinity into null. */
const MAX_DAYS_OF_STOCK = 999;

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
                  return { ...u, role: 'superadmin', createdAt };
                }
                return { ...u, role: 'manager', createdAt };
              }
              if (u.role === 'viewer') return { ...u, role: 'manager', createdAt };
              return { ...u, role: u.role as UserRole, createdAt };
            });
            authStore.put({ id: 'auth', isSetup: config.isSetup, users });
          });
        }
        if (oldVersion < 4) {
          const customers = db.createObjectStore('customers', { keyPath: 'id' });
          customers.createIndex('byPhone', 'phone');
          db.createObjectStore('sms_logs', { keyPath: 'id' });
        }
        if (oldVersion < 5) {
          const notifications = db.createObjectStore('notifications', { keyPath: 'id' });
          notifications.createIndex('byTargetRole', 'targetRole');
        }
        if (oldVersion < 6) {
          const waste = db.createObjectStore('waste', { keyPath: 'id' });
          waste.createIndex('byIngredient', 'ingredientId');
          waste.createIndex('byDate', 'date');

          db.createObjectStore('suppliers', { keyPath: 'id' });

          const supplierPayments = db.createObjectStore('supplier_payments', { keyPath: 'id' });
          supplierPayments.createIndex('bySupplier', 'supplierId');

          db.createObjectStore('automation_triggers', { keyPath: 'id' });

          // Backfill the new predictive-inventory fields onto existing ingredients so the
          // inventory engine has a consistent base point to compute from on its very next read.
          const ingredientsStore = transaction.objectStore('ingredients');
          ingredientsStore.getAll().then((ingredients) => {
            for (const ing of ingredients as (Ingredient & { theoreticalStock?: number })[]) {
              if (ing.theoreticalStock !== undefined) continue;
              ingredientsStore.put({
                ...ing,
                theoreticalStock: ing.currentStock,
                lastPhysicalCount: null,
                dailyUsageRate: 0,
                daysOfStockRemaining: MAX_DAYS_OF_STOCK,
                predictedStockoutDate: null,
                consumptionHistory: [],
                lastEstimationUpdatedAt: nowISO(),
              });
            }
          });

          const menuItemsStore = transaction.objectStore('menu_items');
          menuItemsStore.getAll().then((items) => {
            for (const item of items as (MenuItem & { isVatExempt?: boolean })[]) {
              if (item.isVatExempt !== undefined) continue;
              menuItemsStore.put({ ...item, isVatExempt: false });
            }
          });

          // Migrate legacy Customer rows (totalSpent/visitCount/loyaltyPoints/createdAt only) to the
          // full CRM/RFM shape, defaulting every new field so older installs don't crash on first read.
          const customersStore = transaction.objectStore('customers');
          customersStore.getAll().then((customers) => {
            for (const c of customers as (Customer & { lastVisitAt?: string })[]) {
              if (c.segment !== undefined) continue;
              const ts = c.createdAt ?? nowISO();
              customersStore.put({
                ...c,
                firstVisit: c.firstVisit ?? ts,
                lastVisit: c.lastVisit ?? c.lastVisitAt,
                avgOrderValue: c.visitCount > 0 ? c.totalSpent / c.visitCount : 0,
                favoriteItems: c.favoriteItems ?? [],
                tags: c.tags ?? [],
                walletBalance: c.walletBalance ?? 0,
                segment: 'new',
                rfmScore: { recency: 0, frequency: 0, monetary: 0, recencyDays: 0, calculatedAt: ts },
                isActive: true,
                source: c.source ?? 'manual',
                surveyResponses: c.surveyResponses ?? [],
                campaignHistory: c.campaignHistory ?? [],
              });
            }
          });
        }
        if (oldVersion < 7) {
          const supplierTransactions = db.createObjectStore('supplier_transactions', { keyPath: 'id' });
          supplierTransactions.createIndex('bySupplier', 'supplierId');

          const attendance = db.createObjectStore('attendance', { keyPath: 'id' });
          attendance.createIndex('byEmployee', 'employeeId');
          attendance.createIndex('byDate', 'date');

          const payrollRecords = db.createObjectStore('payroll_records', { keyPath: 'id' });
          payrollRecords.createIndex('byEmployee', 'employeeId');
          payrollRecords.createIndex('byPeriod', 'periodMonth');

          const salaryAdvances = db.createObjectStore('salary_advances', { keyPath: 'id' });
          salaryAdvances.createIndex('byEmployee', 'employeeId');

          db.createObjectStore('petty_cash', { keyPath: 'id' });
          db.createObjectStore('subscription_payments_cache', { keyPath: 'id' });
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

// ---------- Sync support ----------
// Record-level push/pull against the costmanager-api backend (see utils/sync.ts) needs to know
// which IDs were deleted locally so it can ship tombstones — IndexedDB itself has no delete log.
// Kept in localStorage (not a new object store) since it's transient wire state, cleared once pushed.

const TOMBSTONE_KEY = 'pendingSyncTombstones';

export interface SyncTombstone {
  store: StoreName;
  id: string;
  deletedAt: string;
}

function recordTombstone(store: StoreName, id: string): void {
  let list: SyncTombstone[] = [];
  try {
    list = JSON.parse(localStorage.getItem(TOMBSTONE_KEY) || '[]');
  } catch {
    list = [];
  }
  list.push({ store, id, deletedAt: nowISO() });
  localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(list));
}

/** Reads and clears the pending tombstone queue — call once per push attempt and re-queue on failure. */
export function consumeTombstones(): SyncTombstone[] {
  let list: SyncTombstone[] = [];
  try {
    list = JSON.parse(localStorage.getItem(TOMBSTONE_KEY) || '[]');
  } catch {
    list = [];
  }
  localStorage.removeItem(TOMBSTONE_KEY);
  return list;
}

/** Re-queues tombstones after a failed push so the next attempt still ships them. */
export function requeueTombstones(tombstones: SyncTombstone[]): void {
  if (!tombstones.length) return;
  let list: SyncTombstone[] = [];
  try {
    list = JSON.parse(localStorage.getItem(TOMBSTONE_KEY) || '[]');
  } catch {
    list = [];
  }
  localStorage.setItem(TOMBSTONE_KEY, JSON.stringify([...tombstones, ...list]));
}

/** All records currently in a syncable store, for a full-snapshot push. */
export async function getAllForSync(store: StoreName): Promise<unknown[]> {
  return (await getDB()).getAll(store as never);
}

/** Applies a pulled record (upsert) or tombstone (delete) into the local store, bypassing app-level validation — sync is the source of truth here. */
export async function applySyncedRecord(store: StoreName, id: string, data: unknown | null): Promise<void> {
  const db = await getDB();
  if (data === null) {
    await db.delete(store as never, id);
  } else {
    await db.put(store as never, data as never);
  }
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
    theoreticalStock: input.currentStock,
    lastPhysicalCount: null,
    dailyUsageRate: 0,
    daysOfStockRemaining: MAX_DAYS_OF_STOCK,
    predictedStockoutDate: null,
    consumptionHistory: [],
    lastEstimationUpdatedAt: ts,
  };
  await (await getDB()).put('ingredients', ingredient);
  await regenerateShoppingList();
  return ingredient;
}

export async function updateIngredient(id: string, patch: Partial<NewIngredientInput>): Promise<Ingredient> {
  const db = await getDB();
  const existing = await db.get('ingredients', id);
  if (!existing) throw new Error('ingredient not found');
  const ts = nowISO();
  // A manual stock edit here (as opposed to a purchase/sale/waste delta) is treated like a fresh
  // count: re-anchor theoreticalStock to it so the two don't immediately diverge.
  const reanchor = patch.currentStock !== undefined ? { theoreticalStock: patch.currentStock, lastEstimationUpdatedAt: ts } : {};
  const updated: Ingredient = { ...existing, ...patch, ...reanchor, updatedAt: ts };
  await db.put('ingredients', updated);
  await regenerateShoppingList();
  return updated;
}

/** Narrow setter used only by the inventory-prediction engine: plain-writes estimation fields without regenerateShoppingList. */
export async function updateIngredientEstimation(
  id: string,
  patch: Partial<Pick<Ingredient, 'theoreticalStock' | 'dailyUsageRate' | 'daysOfStockRemaining' | 'predictedStockoutDate' | 'consumptionHistory' | 'lastEstimationUpdatedAt'>>,
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('ingredients', id);
  if (!existing) return;
  await db.put('ingredients', { ...existing, ...patch });
}

/** Physical stocktake: becomes the new anchor point the inventory engine computes deltas from. */
export async function recordPhysicalCount(id: string, quantity: number, countedBy: string): Promise<Ingredient> {
  const db = await getDB();
  const existing = await db.get('ingredients', id);
  if (!existing) throw new Error('ingredient not found');
  const ts = nowISO();
  const updated: Ingredient = {
    ...existing,
    currentStock: quantity,
    theoreticalStock: quantity,
    lastPhysicalCount: { date: ts, quantity, countedBy },
    lastEstimationUpdatedAt: ts,
    updatedAt: ts,
  };
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
  recordTombstone('ingredients', id);
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
    isVatExempt: false,
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
  recordTombstone('menu_items', id);
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
  recordTombstone('expenses', id);
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
  recordTombstone('employees', id);
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
  customerId?: string;
  vatAmount?: number;
  vatRate?: number;
  orderType?: OrderType;
  deliveryInfo?: DeliveryInfo;
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
    customerId: input.customerId,
    vatAmount: input.vatAmount,
    vatRate: input.vatRate,
    orderType: input.orderType,
    deliveryInfo: input.deliveryInfo,
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
  if (input.customerId) await recordCustomerVisit(input.customerId, sale.unitSalePrice * sale.quantity);
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
  customerId?: string;
  orderType?: OrderType;
  deliveryInfo?: DeliveryInfo;
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
    customerId: input.customerId,
    orderType: input.orderType,
    deliveryInfo: input.deliveryInfo,
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
  if (input.customerId) await recordCustomerVisit(input.customerId, sale.unitSalePrice * sale.quantity);
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
  recordTombstone('sales', id);
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
  if (sale.customerId) await reverseCustomerVisit(sale.customerId, sale.unitSalePrice * sale.quantity);
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

// ---------- Customers (CRM) ----------

export async function listCustomers(): Promise<Customer[]> {
  return (await getDB()).getAll('customers');
}

export async function getCustomer(id: string): Promise<Customer | undefined> {
  return (await getDB()).get('customers', id);
}

export type NewCustomerInput = Pick<Customer, 'name' | 'phone'> &
  Partial<Pick<Customer, 'notes' | 'birthday' | 'email' | 'address' | 'allergies' | 'preferences' | 'source'>>;

export async function createCustomer(input: NewCustomerInput): Promise<Customer> {
  const ts = nowISO();
  const customer: Customer = {
    id: uuid(),
    name: input.name,
    phone: input.phone,
    birthday: input.birthday,
    email: input.email,
    address: input.address,
    firstVisit: ts,
    visitCount: 0,
    totalSpent: 0,
    avgOrderValue: 0,
    favoriteItems: [],
    tags: ['new'],
    notes: input.notes,
    walletBalance: 0,
    loyaltyPoints: 0,
    segment: 'new',
    rfmScore: { recency: 0, frequency: 0, monetary: 0, recencyDays: 0, calculatedAt: ts },
    isActive: true,
    source: input.source ?? 'manual',
    allergies: input.allergies,
    preferences: input.preferences,
    surveyResponses: [],
    campaignHistory: [],
    createdAt: ts,
  };
  await (await getDB()).put('customers', customer);
  return customer;
}

export async function updateCustomer(id: string, patch: Partial<Omit<Customer, 'id' | 'createdAt'>>): Promise<Customer> {
  const db = await getDB();
  const existing = await db.get('customers', id);
  if (!existing) throw new Error('customer not found');
  const updated: Customer = { ...existing, ...patch };
  await db.put('customers', updated);
  return updated;
}

export async function deleteCustomer(id: string): Promise<void> {
  recordTombstone('customers', id);
  await (await getDB()).delete('customers', id);
}

async function effectivePointsPerToman(): Promise<number> {
  const settings = await getSettings();
  return settings.pointsPerToman > 0 ? settings.pointsPerToman : DEFAULT_POINTS_PER_TOMAN;
}

/** Records a purchase against a customer: bumps visit/spend totals and accrues loyalty points. */
export async function recordCustomerVisit(id: string, amountSpent: number): Promise<Customer> {
  const db = await getDB();
  const existing = await db.get('customers', id);
  if (!existing) throw new Error('customer not found');
  const pointsPerToman = await effectivePointsPerToman();
  const ts = nowISO();
  const visitCount = existing.visitCount + 1;
  const totalSpent = existing.totalSpent + amountSpent;
  const updated: Customer = {
    ...existing,
    totalSpent,
    visitCount,
    avgOrderValue: totalSpent / visitCount,
    loyaltyPoints: existing.loyaltyPoints + Math.floor(amountSpent / pointsPerToman),
    lastVisit: ts,
    firstVisit: existing.firstVisit ?? ts,
  };
  await db.put('customers', updated);
  return updated;
}

/** Reverses recordCustomerVisit's effect, used when an itemized sale tied to a customer is deleted. */
export async function reverseCustomerVisit(id: string, amountSpent: number): Promise<Customer | undefined> {
  const db = await getDB();
  const existing = await db.get('customers', id);
  if (!existing) return undefined;
  const pointsPerToman = await effectivePointsPerToman();
  const visitCount = Math.max(0, existing.visitCount - 1);
  const totalSpent = Math.max(0, existing.totalSpent - amountSpent);
  const updated: Customer = {
    ...existing,
    totalSpent,
    visitCount,
    avgOrderValue: visitCount > 0 ? totalSpent / visitCount : 0,
    loyaltyPoints: Math.max(0, existing.loyaltyPoints - Math.floor(amountSpent / pointsPerToman)),
  };
  await db.put('customers', updated);
  return updated;
}

export async function adjustLoyaltyPoints(id: string, delta: number): Promise<Customer> {
  const db = await getDB();
  const existing = await db.get('customers', id);
  if (!existing) throw new Error('customer not found');
  const updated: Customer = { ...existing, loyaltyPoints: Math.max(0, existing.loyaltyPoints + delta) };
  await db.put('customers', updated);
  return updated;
}

export async function adjustWalletBalance(id: string, delta: number): Promise<Customer> {
  const db = await getDB();
  const existing = await db.get('customers', id);
  if (!existing) throw new Error('customer not found');
  const updated: Customer = { ...existing, walletBalance: Math.max(0, existing.walletBalance + delta) };
  await db.put('customers', updated);
  return updated;
}

/** Narrow setter used only by the RFM engine: plain-writes segment + score without disturbing other fields. */
export async function updateCustomerSegment(id: string, segment: RFMSegment, rfmScore: RFMScore): Promise<void> {
  const db = await getDB();
  const existing = await db.get('customers', id);
  if (!existing) return;
  await db.put('customers', { ...existing, segment, rfmScore });
}

export async function addSurveyResponse(customerId: string, input: Omit<SurveyResponse, 'id' | 'createdAt'>): Promise<Customer> {
  const db = await getDB();
  const existing = await db.get('customers', customerId);
  if (!existing) throw new Error('customer not found');
  const response: SurveyResponse = { ...input, id: uuid(), createdAt: nowISO() };
  const updated: Customer = { ...existing, surveyResponses: [...existing.surveyResponses, response] };
  await db.put('customers', updated);
  return updated;
}

/** Appends a sent-campaign record, used by the automation engine and manual CRM campaigns alike. */
export async function recordCampaign(customerId: string, input: Omit<CampaignRecord, 'id' | 'sentAt'>): Promise<Customer> {
  const db = await getDB();
  const existing = await db.get('customers', customerId);
  if (!existing) throw new Error('customer not found');
  const record: CampaignRecord = { ...input, id: uuid(), sentAt: nowISO() };
  const updated: Customer = { ...existing, campaignHistory: [...existing.campaignHistory, record] };
  await db.put('customers', updated);
  return updated;
}

// ---------- Waste ----------

export async function listWaste(): Promise<WasteEntry[]> {
  return (await getDB()).getAll('waste');
}

export interface RecordWasteInput {
  ingredientId: string;
  quantity: number;
  reason: WasteReason;
  date: string;
}

export async function recordWaste(input: RecordWasteInput): Promise<WasteEntry> {
  const db = await getDB();
  const ingredient = await db.get('ingredients', input.ingredientId);
  if (!ingredient) throw new Error('ingredient not found');
  const entry: WasteEntry = {
    id: uuid(),
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    quantity: input.quantity,
    unit: ingredient.unit,
    reason: input.reason,
    date: input.date,
    estimatedCost: input.quantity * ingredient.pricePerUnit,
  };
  const tx = db.transaction(['waste', 'ingredients'], 'readwrite');
  await tx.objectStore('waste').put(entry);
  await tx.objectStore('ingredients').put({
    ...ingredient,
    currentStock: Math.max(0, ingredient.currentStock - input.quantity),
    updatedAt: nowISO(),
  });
  await tx.done;
  await regenerateShoppingList();
  return entry;
}

export async function deleteWaste(id: string): Promise<void> {
  const db = await getDB();
  const entry = await db.get('waste', id);
  if (!entry) return;
  recordTombstone('waste', id);
  const ingredient = await db.get('ingredients', entry.ingredientId);
  const tx = db.transaction(['waste', 'ingredients'], 'readwrite');
  if (ingredient) {
    await tx.objectStore('ingredients').put({ ...ingredient, currentStock: ingredient.currentStock + entry.quantity, updatedAt: nowISO() });
  }
  await tx.objectStore('waste').delete(id);
  await tx.done;
  await regenerateShoppingList();
}

// ---------- Suppliers ----------

export async function listSuppliers(): Promise<Supplier[]> {
  return (await getDB()).getAll('suppliers');
}

export type NewSupplierInput = Omit<Supplier, 'id' | 'createdAt'>;

export async function createSupplier(input: NewSupplierInput): Promise<Supplier> {
  const supplier: Supplier = { ...input, id: uuid(), createdAt: nowISO() };
  await (await getDB()).put('suppliers', supplier);
  return supplier;
}

export async function updateSupplier(id: string, patch: Partial<NewSupplierInput>): Promise<Supplier> {
  const db = await getDB();
  const existing = await db.get('suppliers', id);
  if (!existing) throw new Error('supplier not found');
  const updated: Supplier = { ...existing, ...patch };
  await db.put('suppliers', updated);
  return updated;
}

export async function deleteSupplier(id: string): Promise<void> {
  recordTombstone('suppliers', id);
  await (await getDB()).delete('suppliers', id);
}

// ---------- Supplier payments ----------

export async function listSupplierPayments(): Promise<SupplierPayment[]> {
  return (await getDB()).getAll('supplier_payments');
}

export type NewSupplierPaymentInput = Omit<SupplierPayment, 'id'>;

export async function createSupplierPayment(input: NewSupplierPaymentInput): Promise<SupplierPayment> {
  const payment: SupplierPayment = { ...input, id: uuid() };
  await (await getDB()).put('supplier_payments', payment);
  return payment;
}

export async function updateSupplierPayment(id: string, patch: Partial<NewSupplierPaymentInput>): Promise<SupplierPayment> {
  const db = await getDB();
  const existing = await db.get('supplier_payments', id);
  if (!existing) throw new Error('supplier payment not found');
  const updated: SupplierPayment = { ...existing, ...patch };
  await db.put('supplier_payments', updated);
  return updated;
}

export async function deleteSupplierPayment(id: string): Promise<void> {
  recordTombstone('supplier_payments', id);
  await (await getDB()).delete('supplier_payments', id);
}

// ---------- Supplier transactions (accounts payable) ----------

export async function listSupplierTransactions(): Promise<SupplierTransaction[]> {
  return (await getDB()).getAll('supplier_transactions');
}

export interface RecordSupplierTransactionInput {
  supplierId: string;
  type: SupplierTransactionType;
  amount: number;
  date: string;
  ingredientId?: string;
  description?: string;
}

export async function recordSupplierTransaction(input: RecordSupplierTransactionInput): Promise<SupplierTransaction> {
  const tx: SupplierTransaction = { ...input, id: uuid(), createdAt: nowISO() };
  await (await getDB()).put('supplier_transactions', tx);
  return tx;
}

export async function deleteSupplierTransaction(id: string): Promise<void> {
  recordTombstone('supplier_transactions', id);
  await (await getDB()).delete('supplier_transactions', id);
}

/** Outstanding payable = sum of unsettled credit purchases minus payments made toward the supplier. cash_purchase never affects it. */
export async function getSupplierBalance(supplierId: string): Promise<number> {
  const db = await getDB();
  const [transactions, payments] = await Promise.all([
    db.getAllFromIndex('supplier_transactions', 'bySupplier', supplierId),
    db.getAllFromIndex('supplier_payments', 'bySupplier', supplierId),
  ]);
  const owed = transactions.filter((t) => t.type === 'credit_purchase').reduce((sum, t) => sum + t.amount, 0);
  const paid = payments.filter((p) => p.isPaid).reduce((sum, p) => sum + p.amount, 0);
  return Math.max(0, owed - paid);
}

export async function getAllSupplierBalances(): Promise<Map<string, number>> {
  const db = await getDB();
  const [suppliers, transactions, payments] = await Promise.all([
    db.getAll('suppliers'),
    db.getAll('supplier_transactions'),
    db.getAll('supplier_payments'),
  ]);
  const owedBySupplier = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'credit_purchase') continue;
    owedBySupplier.set(t.supplierId, (owedBySupplier.get(t.supplierId) ?? 0) + t.amount);
  }
  const paidBySupplier = new Map<string, number>();
  for (const p of payments) {
    if (!p.isPaid) continue;
    paidBySupplier.set(p.supplierId, (paidBySupplier.get(p.supplierId) ?? 0) + p.amount);
  }
  const result = new Map<string, number>();
  for (const s of suppliers) {
    result.set(s.id, Math.max(0, (owedBySupplier.get(s.id) ?? 0) - (paidBySupplier.get(s.id) ?? 0)));
  }
  return result;
}

// ---------- Petty cash ----------

export async function listPettyCash(): Promise<PettyCashTransaction[]> {
  return (await getDB()).getAll('petty_cash');
}

/** deposit/withdrawal post immediately (cashier-recorded); expense requests need approval before they affect the balance. */
export interface NewPettyCashInput {
  type: PettyCashTxType;
  amount: number;
  reason: string;
  requestedBy: string;
  requestedByName: string;
  date: string;
}

export async function requestPettyCash(input: NewPettyCashInput): Promise<PettyCashTransaction> {
  const tx: PettyCashTransaction = {
    ...input,
    id: uuid(),
    status: input.type === 'expense' ? 'pending' : 'approved',
    createdAt: nowISO(),
  };
  await (await getDB()).put('petty_cash', tx);
  return tx;
}

export async function reviewPettyCashRequest(id: string, status: PettyCashRequestStatus, approvedBy: string): Promise<PettyCashTransaction> {
  const db = await getDB();
  const existing = await db.get('petty_cash', id);
  if (!existing) throw new Error('petty cash request not found');
  const updated: PettyCashTransaction = { ...existing, status, approvedBy, approvedAt: nowISO() };
  await db.put('petty_cash', updated);
  return updated;
}

export async function deletePettyCash(id: string): Promise<void> {
  recordTombstone('petty_cash', id);
  await (await getDB()).delete('petty_cash', id);
}

/** deposit and withdrawal increase/decrease the float directly; an expense only counts once approved. */
export async function getPettyCashBalance(): Promise<number> {
  const transactions = await listPettyCash();
  let balance = 0;
  for (const t of transactions) {
    if (t.type === 'deposit' && t.status === 'approved') balance += t.amount;
    else if (t.type === 'withdrawal' && t.status === 'approved') balance -= t.amount;
    else if (t.type === 'expense' && t.status === 'approved') balance -= t.amount;
  }
  return balance;
}

// ---------- HR & payroll ----------

export async function listAttendance(): Promise<AttendanceRecord[]> {
  return (await getDB()).getAll('attendance');
}

export async function listAttendanceForEmployee(employeeId: string): Promise<AttendanceRecord[]> {
  return (await getDB()).getAllFromIndex('attendance', 'byEmployee', employeeId);
}

export interface MarkAttendanceInput {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  overtimeHours?: number;
  note?: string;
}

/** One record per (employee, date): re-marking the same day overwrites the prior entry instead of duplicating it. */
export async function markAttendance(input: MarkAttendanceInput): Promise<AttendanceRecord> {
  const db = await getDB();
  const existing = await db.getAllFromIndex('attendance', 'byEmployee', input.employeeId);
  const prior = existing.find((a) => a.date === input.date);
  const record: AttendanceRecord = {
    id: prior?.id ?? uuid(),
    employeeId: input.employeeId,
    date: input.date,
    status: input.status,
    overtimeHours: input.overtimeHours,
    note: input.note,
    createdAt: prior?.createdAt ?? nowISO(),
  };
  await db.put('attendance', record);
  return record;
}

export async function deleteAttendance(id: string): Promise<void> {
  recordTombstone('attendance', id);
  await (await getDB()).delete('attendance', id);
}

export async function listPayrollRecords(): Promise<PayrollRecord[]> {
  return (await getDB()).getAll('payroll_records');
}

export async function listSalaryAdvances(): Promise<SalaryAdvance[]> {
  return (await getDB()).getAll('salary_advances');
}

export interface RequestSalaryAdvanceInput {
  employeeId: string;
  amount: number;
  note?: string;
}

export async function requestSalaryAdvance(input: RequestSalaryAdvanceInput): Promise<SalaryAdvance> {
  const advance: SalaryAdvance = { ...input, id: uuid(), requestedAt: nowISO(), status: 'pending' };
  await (await getDB()).put('salary_advances', advance);
  return advance;
}

export async function reviewSalaryAdvance(id: string, status: 'approved' | 'rejected', approvedBy: string): Promise<SalaryAdvance> {
  const db = await getDB();
  const existing = await db.get('salary_advances', id);
  if (!existing) throw new Error('salary advance not found');
  const updated: SalaryAdvance = { ...existing, status, approvedBy, approvedAt: nowISO() };
  await db.put('salary_advances', updated);
  return updated;
}

const INSURANCE_EMPLOYEE_RATE = 0.07;
const INSURANCE_EMPLOYER_RATE = 0.23;
const WORK_HOURS_PER_DAY = 8;
const OVERTIME_MULTIPLIER = 1.4;

export interface RunPayrollInput {
  employeeId: string;
  periodMonth: string;
  adjustments?: PayrollAdjustment[];
}

/**
 * Computes a draft payroll for one employee/month from their attendance records and pay type, applies
 * the 7%/23% employee/employer insurance split, and auto-deducts any of their approved-but-undeducted
 * salary advances. Daily-rate employees are paid per present/half day; monthly-rate employees get the
 * full base regardless of present-day count (absences are informational only, matching typical payroll
 * practice for salaried staff).
 */
export async function runPayroll(input: RunPayrollInput): Promise<PayrollRecord> {
  const db = await getDB();
  const employee = await db.get('employees', input.employeeId);
  if (!employee) throw new Error('employee not found');

  const allAttendance = await db.getAllFromIndex('attendance', 'byEmployee', input.employeeId);
  const periodAttendance = allAttendance.filter((a) => a.date.startsWith(input.periodMonth));
  const presentDays = periodAttendance.filter((a) => a.status === 'present').length + 0.5 * periodAttendance.filter((a) => a.status === 'half_day').length;
  const absentDays = periodAttendance.filter((a) => a.status === 'absent').length;
  const leaveDays = periodAttendance.filter((a) => a.status === 'leave').length;
  const overtimeHours = periodAttendance.reduce((sum, a) => sum + (a.overtimeHours ?? 0), 0);

  let baseAmount: number;
  if (employee.payType === 'monthly') {
    baseAmount = employee.amount;
  } else if (employee.payType === 'daily') {
    baseAmount = employee.amount * presentDays;
  } else {
    baseAmount = employee.amount * presentDays * WORK_HOURS_PER_DAY;
  }

  const hourlyRate = employee.payType === 'hourly' ? employee.amount : baseAmount / (presentDays * WORK_HOURS_PER_DAY || WORK_HOURS_PER_DAY);
  const overtimeAmount = overtimeHours * hourlyRate * OVERTIME_MULTIPLIER;

  const adjustments = input.adjustments ?? [];
  const adjustmentsTotal = adjustments.reduce((sum, a) => sum + a.amount, 0);

  const allAdvances = await db.getAllFromIndex('salary_advances', 'byEmployee', input.employeeId);
  const dueAdvances = allAdvances.filter((a) => a.status === 'approved');
  const advanceDeduction = dueAdvances.reduce((sum, a) => sum + a.amount, 0);

  const grossPay = baseAmount + overtimeAmount + adjustmentsTotal;
  const insuranceEmployeeShare = grossPay * INSURANCE_EMPLOYEE_RATE;
  const insuranceEmployerShare = grossPay * INSURANCE_EMPLOYER_RATE;
  const netPay = grossPay - insuranceEmployeeShare - advanceDeduction;

  const record: PayrollRecord = {
    id: uuid(),
    employeeId: employee.id,
    employeeName: employee.name,
    periodMonth: input.periodMonth,
    baseAmount,
    presentDays,
    absentDays,
    leaveDays,
    overtimeHours,
    overtimeAmount,
    adjustments,
    advanceDeduction,
    grossPay,
    insuranceEmployeeShare,
    insuranceEmployerShare,
    netPay,
    status: 'draft',
    createdAt: nowISO(),
  };

  const tx = db.transaction(['payroll_records', 'salary_advances'], 'readwrite');
  await tx.objectStore('payroll_records').put(record);
  for (const advance of dueAdvances) {
    await tx.objectStore('salary_advances').put({ ...advance, status: 'deducted', deductedInPayrollId: record.id });
  }
  await tx.done;
  return record;
}

export async function finalizePayroll(id: string): Promise<PayrollRecord> {
  const db = await getDB();
  const existing = await db.get('payroll_records', id);
  if (!existing) throw new Error('payroll record not found');
  const updated: PayrollRecord = { ...existing, status: 'finalized' };
  await db.put('payroll_records', updated);
  return updated;
}

export async function markPayrollPaid(id: string): Promise<PayrollRecord> {
  const db = await getDB();
  const existing = await db.get('payroll_records', id);
  if (!existing) throw new Error('payroll record not found');
  const updated: PayrollRecord = { ...existing, status: 'paid', paidAt: nowISO() };
  await db.put('payroll_records', updated);
  return updated;
}

export async function deletePayrollRecord(id: string): Promise<void> {
  recordTombstone('payroll_records', id);
  await (await getDB()).delete('payroll_records', id);
}

/** annualLeaveDays (set on the employee) minus days marked 'leave' in attendance this calendar year. */
export async function getLeaveBalance(employeeId: string, year: number): Promise<{ total: number; used: number; remaining: number }> {
  const db = await getDB();
  const employee = await db.get('employees', employeeId);
  const total = employee?.annualLeaveDays ?? 0;
  const allAttendance = await db.getAllFromIndex('attendance', 'byEmployee', employeeId);
  const used = allAttendance.filter((a) => a.status === 'leave' && a.date.startsWith(String(year))).length;
  return { total, used, remaining: Math.max(0, total - used) };
}

// ---------- SMS logs (CRM) ----------

export async function listSmsLogs(): Promise<SmsLog[]> {
  return (await getDB()).getAll('sms_logs');
}

export async function recordSmsLog(input: Omit<SmsLog, 'id'>): Promise<SmsLog> {
  const log: SmsLog = { ...input, id: uuid() };
  await (await getDB()).put('sms_logs', log);
  return log;
}

export async function deleteSmsLog(id: string): Promise<void> {
  recordTombstone('sms_logs', id);
  await (await getDB()).delete('sms_logs', id);
}

// ---------- Notifications ----------

export async function listNotifications(): Promise<AppNotification[]> {
  return (await getDB()).getAll('notifications');
}

export async function createNotification(input: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>): Promise<AppNotification> {
  const notification: AppNotification = { ...input, id: uuid(), createdAt: nowISO(), isRead: false };
  await (await getDB()).put('notifications', notification);
  return notification;
}

export async function markNotificationRead(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get('notifications', id);
  if (!existing) return;
  await db.put('notifications', { ...existing, isRead: true });
}

// ---------- Automation triggers (CRM) ----------

export async function listAutomationTriggers(): Promise<AutomationTrigger[]> {
  return (await getDB()).getAll('automation_triggers');
}

export type NewAutomationTriggerInput =
  Pick<AutomationTrigger, 'name' | 'type' | 'conditions' | 'action'> & Partial<Pick<AutomationTrigger, 'isActive'>>;

export async function createAutomationTrigger(input: NewAutomationTriggerInput): Promise<AutomationTrigger> {
  const trigger: AutomationTrigger = {
    id: uuid(),
    name: input.name,
    type: input.type,
    isActive: input.isActive ?? true,
    conditions: input.conditions,
    action: input.action,
    timesRun: 0,
    successCount: 0,
  };
  await (await getDB()).put('automation_triggers', trigger);
  return trigger;
}

export async function updateAutomationTrigger(id: string, patch: Partial<Omit<AutomationTrigger, 'id'>>): Promise<AutomationTrigger> {
  const db = await getDB();
  const existing = await db.get('automation_triggers', id);
  if (!existing) throw new Error('automation trigger not found');
  const updated: AutomationTrigger = { ...existing, ...patch };
  await db.put('automation_triggers', updated);
  return updated;
}

export async function deleteAutomationTrigger(id: string): Promise<void> {
  recordTombstone('automation_triggers', id);
  await (await getDB()).delete('automation_triggers', id);
}

export async function recordAutomationRun(id: string, success: boolean): Promise<void> {
  const db = await getDB();
  const existing = await db.get('automation_triggers', id);
  if (!existing) return;
  await db.put('automation_triggers', {
    ...existing,
    lastRun: nowISO(),
    timesRun: existing.timesRun + 1,
    successCount: existing.successCount + (success ? 1 : 0),
  });
}

// ---------- Settings ----------

/** Legacy field, no longer read by any fetch (sync.ts now goes through utils/api.ts's own origin-relative baseUrl()) — kept only so existing Settings rows still satisfy the required string field. */
export const DEFAULT_SYNC_SERVER_URL = `${window.location.origin}/sync`;
export const TRIAL_DAYS = 7;

const DEFAULT_SETTINGS: Settings = {
  id: 'global',
  businessName: 'کافه من',
  businessType: 'cafe',
  currency: 'toman',
  targetFoodCostPercent: 30,
  theme: 'auto',
  subscriptionStatus: 'trial',
  subscriptionPlan: '1m',
  subscriptionExpiry: UNLIMITED_EXPIRY,
  businessId: '',
  syncServerUrl: DEFAULT_SYNC_SERVER_URL,
  vatEnabled: false,
  vatRate: 9,
  vatIncludedInPrice: true,
  pointsPerToman: DEFAULT_POINTS_PER_TOMAN,
  pointsToTomanRatio: DEFAULT_POINTS_TO_TOMAN_RATIO,
};

export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const settings = await db.get('settings', 'global');
  if (!settings) {
    const trialStartedAt = nowISO();
    const fresh: Settings = {
      ...DEFAULT_SETTINGS,
      businessId: uuid(),
      trialStartedAt,
      subscriptionExpiry: new Date(Date.now() + TRIAL_DAYS * DAY_MS).toISOString(),
    };
    await db.put('settings', fresh);
    return fresh;
  }
  let patched = settings;
  let dirty = false;
  if (!patched.businessId) {
    patched = { ...patched, businessId: uuid() };
    dirty = true;
  }
  if (!patched.syncServerUrl) {
    patched = { ...patched, syncServerUrl: DEFAULT_SYNC_SERVER_URL };
    dirty = true;
  }
  if (!patched.subscriptionStatus) {
    // Pre-existing install from before per-business subscriptions existed: grandfather it in, never retroactively block it.
    patched = { ...patched, subscriptionStatus: 'active', subscriptionPlan: 'unlimited', subscriptionExpiry: UNLIMITED_EXPIRY };
    dirty = true;
  }
  if (patched.vatEnabled === undefined) {
    patched = { ...patched, vatEnabled: false, vatRate: patched.vatRate ?? 9, vatIncludedInPrice: patched.vatIncludedInPrice ?? true };
    dirty = true;
  }
  if (!patched.pointsPerToman) {
    patched = { ...patched, pointsPerToman: DEFAULT_POINTS_PER_TOMAN, pointsToTomanRatio: DEFAULT_POINTS_TO_TOMAN_RATIO };
    dirty = true;
  }
  if (dirty) {
    await db.put('settings', patched);
  }
  return patched;
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const db = await getDB();
  const existing = await getSettings();
  const updated: Settings = { ...existing, ...patch };
  await db.put('settings', updated);
  return updated;
}

/** Mirrors server-owned business/subscription fields into local Settings; device-local fields (theme, apiBaseUrl, etc.) are untouched. */
export async function syncBusinessIdentity(business: ApiBusiness): Promise<Settings> {
  return updateSettings({
    businessId: business.id,
    businessName: business.name,
    businessType: business.type as BusinessType,
    subscriptionPlan: business.subscriptionPlan as SubscriptionPlan,
    subscriptionStatus: business.subscriptionStatus as BusinessSubscriptionStatus,
    subscriptionExpiry: business.subscriptionExpires,
  });
}

// ---------- Auth ----------

function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
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

export interface RegisterBusinessInput {
  businessName: string;
  businessType: BusinessType;
  managerName: string;
  managerUsername: string;
  managerEmail: string;
  managerPassword: string;
  managerPhone?: string;
  plan: SubscriptionPlan;
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const config = await getAuthConfig();
  return config.users.some((u) => u.username.toLowerCase() === username.toLowerCase());
}

/**
 * Registration wizard: creates the business's Settings row + its sole superadmin (the registering manager).
 * Every business starts with a 14-day trial regardless of the plan picked in the wizard — that plan only takes
 * effect once extendBusinessSubscription is used to actually pay for/renew it.
 */
export async function registerBusiness(input: RegisterBusinessInput): Promise<AppUser> {
  const db = await getDB();
  const config = await getAuthConfig();
  if (config.users.some((u) => u.role === 'superadmin')) {
    throw new Error('کسب‌وکار از قبل ثبت شده است');
  }
  const passwordSalt = generateSalt();
  const passwordHash = await hashPassword(input.managerPassword, passwordSalt);
  const user: AppUser = {
    id: uuid(),
    name: input.managerName,
    username: input.managerUsername,
    passwordHash,
    passwordSalt,
    role: 'superadmin',
    isActive: true,
    email: input.managerEmail,
    phone: input.managerPhone,
    createdAt: nowISO(),
  };
  await db.put('auth', { id: 'auth', isSetup: true, users: [user] });

  const existing = await getSettings();
  const trialStartedAt = nowISO();
  await db.put('settings', {
    ...existing,
    businessName: input.businessName,
    businessType: input.businessType,
    subscriptionStatus: 'trial',
    subscriptionPlan: input.plan,
    subscriptionExpiry: new Date(Date.now() + TRIAL_DAYS * DAY_MS).toISOString(),
    trialStartedAt,
  });

  return user;
}

export async function findUserByUsername(username: string): Promise<AppUser | undefined> {
  const config = await getAuthConfig();
  return config.users.find((u) => u.username.toLowerCase() === username.toLowerCase() && u.isActive);
}

/**
 * Mirrors a server-authenticated user into the local auth store, hashing the plaintext password
 * (only available at this exact moment) so the next login can succeed entirely offline.
 * Drops any stale local entry sharing the username under a different (pre-sync) id to avoid collisions.
 */
export async function cacheApiUser(apiUser: ApiUser, plainPassword: string): Promise<AppUser> {
  const db = await getDB();
  const config = await getAuthConfig();
  const passwordSalt = generateSalt();
  const passwordHash = await hashPassword(plainPassword, passwordSalt);
  const existing = config.users.find((u) => u.id === apiUser.id);
  const user: AppUser = {
    id: apiUser.id,
    name: apiUser.fullName,
    username: apiUser.username,
    passwordHash,
    passwordSalt,
    role: apiUser.role,
    isActive: apiUser.isActive,
    email: apiUser.email ?? undefined,
    phone: apiUser.phone ?? undefined,
    createdAt: existing?.createdAt ?? nowISO(),
    lastLogin: apiUser.lastLogin ?? existing?.lastLogin,
  };
  const users = [
    ...config.users.filter((u) => u.id !== apiUser.id && u.username.toLowerCase() !== apiUser.username.toLowerCase()),
    user,
  ];
  await db.put('auth', { id: 'auth', isSetup: true, users });
  return user;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

/** Persisted lockout (survives page reload) — call on every failed password check in attemptLogin. */
export async function recordFailedLoginAttempt(id: string): Promise<AppUser | undefined> {
  const db = await getDB();
  const config = await getAuthConfig();
  const idx = config.users.findIndex((u) => u.id === id);
  if (idx === -1) return undefined;
  const existing = config.users[idx];
  const attempts = (existing.failedLoginAttempts ?? 0) + 1;
  const updated: AppUser = {
    ...existing,
    failedLoginAttempts: attempts,
    lockedUntil: attempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOGIN_LOCKOUT_MS).toISOString() : existing.lockedUntil,
  };
  const users = [...config.users];
  users[idx] = updated;
  await db.put('auth', { ...config, users });
  return updated;
}

export async function resetLoginAttempts(id: string): Promise<void> {
  const db = await getDB();
  const config = await getAuthConfig();
  const idx = config.users.findIndex((u) => u.id === id);
  if (idx === -1) return;
  const users = [...config.users];
  users[idx] = { ...users[idx], failedLoginAttempts: 0, lockedUntil: undefined };
  await db.put('auth', { ...config, users });
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
  username: string;
  password: string;
  role: UserRole;
  phone?: string;
}

/** Staff (manager/warehouse/buyer) are free to add and have no individual subscription — only the business itself expires. */
export async function createUser(input: NewUserInput): Promise<AppUser> {
  if (input.role === 'superadmin') throw new Error('امکان ایجاد مدیر اصلی دوم وجود ندارد');
  const db = await getDB();
  const config = await getAuthConfig();
  if (config.users.some((u) => u.username.toLowerCase() === input.username.toLowerCase())) {
    throw new Error('این نام کاربری قبلاً استفاده شده است');
  }
  const passwordSalt = generateSalt();
  const passwordHash = await hashPassword(input.password, passwordSalt);
  const user: AppUser = {
    id: uuid(),
    name: input.name,
    username: input.username,
    passwordHash,
    passwordSalt,
    role: input.role,
    isActive: true,
    phone: input.phone,
    createdAt: nowISO(),
  };
  await db.put('auth', { ...config, users: [...config.users, user] });
  return user;
}

export interface UpdateUserInput {
  name?: string;
  username?: string;
  /** Plaintext — hashed before storage; omit to leave the password unchanged. */
  password?: string;
  role?: UserRole;
  isActive?: boolean;
  phone?: string;
}

export async function updateUser(id: string, patch: UpdateUserInput): Promise<AppUser> {
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
  if (patch.username && config.users.some((u) => u.id !== id && u.username.toLowerCase() === patch.username!.toLowerCase())) {
    throw new Error('این نام کاربری قبلاً استفاده شده است');
  }
  let passwordFields: Pick<AppUser, 'passwordHash' | 'passwordSalt'> | undefined;
  if (patch.password) {
    const passwordSalt = generateSalt();
    passwordFields = { passwordHash: await hashPassword(patch.password, passwordSalt), passwordSalt };
  }
  const updated: AppUser = {
    ...existing,
    name: patch.name ?? existing.name,
    username: patch.username ?? existing.username,
    role: patch.role ?? existing.role,
    isActive: patch.isActive ?? existing.isActive,
    phone: patch.phone ?? existing.phone,
    ...passwordFields,
  };
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

export async function changeSuperadminPassword(currentPassword: string, newPassword: string): Promise<AppUser> {
  const db = await getDB();
  const config = await getAuthConfig();
  const idx = config.users.findIndex((u) => u.role === 'superadmin');
  if (idx === -1) throw new Error('مدیر اصلی یافت نشد');
  const existing = config.users[idx];
  if (!(await verifyPassword(currentPassword, existing.passwordSalt, existing.passwordHash))) {
    throw new Error('رمز عبور فعلی نادرست است');
  }
  const passwordSalt = generateSalt();
  const passwordHash = await hashPassword(newPassword, passwordSalt);
  const updated: AppUser = { ...existing, passwordHash, passwordSalt };
  const users = [...config.users];
  users[idx] = updated;
  await db.put('auth', { ...config, users });
  return updated;
}

/** Extends the business's own subscription, from its current expiry if still active, otherwise from today. */
export async function extendBusinessSubscription(months: number, plan?: PaidSubscriptionPlan): Promise<Settings> {
  const settings = await getSettings();
  const stillActive = settings.subscriptionPlan !== 'unlimited' && new Date(settings.subscriptionExpiry).getTime() > Date.now();
  const base = stillActive ? settings.subscriptionExpiry : nowISO();
  return updateSettings({
    subscriptionStatus: 'active',
    subscriptionPlan: plan ?? (settings.subscriptionPlan === 'unlimited' ? '12m' : settings.subscriptionPlan),
    subscriptionExpiry: addMonthsISO(base, months),
  });
}

// ---------- Subscription payments (local cache of server-side review state) ----------

export async function listSubscriptionPaymentsCache(): Promise<SubscriptionPaymentRecord[]> {
  return (await getDB()).getAll('subscription_payments_cache');
}

export async function upsertSubscriptionPaymentCache(record: SubscriptionPaymentRecord): Promise<void> {
  await (await getDB()).put('subscription_payments_cache', record);
}

export async function replaceSubscriptionPaymentsCache(records: SubscriptionPaymentRecord[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('subscription_payments_cache', 'readwrite');
  await tx.store.clear();
  for (const r of records) await tx.store.put(r);
  await tx.done;
}

// ---------- Backup / restore ----------

const BACKUP_STORE_NAMES: StoreName[] = [
  'ingredients', 'menu_items', 'expenses', 'employees', 'sales', 'shopping_list', 'settings', 'customers', 'sms_logs',
  'notifications', 'waste', 'suppliers', 'supplier_payments', 'automation_triggers', 'supplier_transactions', 'attendance',
  'payroll_records', 'salary_advances', 'petty_cash', 'subscription_payments_cache',
];

export async function exportAllData(): Promise<FullBackup> {
  const db = await getDB();
  const [
    ingredients, menu_items, expenses, employees, sales, shopping_list, settings, customers, sms_logs, notifications,
    waste, suppliers, supplier_payments, automation_triggers, supplier_transactions, attendance, payroll_records,
    salary_advances, petty_cash, subscription_payments_cache,
  ] = await Promise.all([
    db.getAll('ingredients'),
    db.getAll('menu_items'),
    db.getAll('expenses'),
    db.getAll('employees'),
    db.getAll('sales'),
    db.getAll('shopping_list'),
    db.getAll('settings'),
    db.getAll('customers'),
    db.getAll('sms_logs'),
    db.getAll('notifications'),
    db.getAll('waste'),
    db.getAll('suppliers'),
    db.getAll('supplier_payments'),
    db.getAll('automation_triggers'),
    db.getAll('supplier_transactions'),
    db.getAll('attendance'),
    db.getAll('payroll_records'),
    db.getAll('salary_advances'),
    db.getAll('petty_cash'),
    db.getAll('subscription_payments_cache'),
  ]);
  return {
    exportedAt: nowISO(),
    version: 1,
    data: {
      ingredients, menu_items, expenses, employees, sales, shopping_list, settings, customers, sms_logs, notifications,
      waste, suppliers, supplier_payments, automation_triggers, supplier_transactions, attendance, payroll_records,
      salary_advances, petty_cash, subscription_payments_cache,
    },
  };
}

export async function importAllData(backup: FullBackup, mode: 'merge' | 'replace'): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(BACKUP_STORE_NAMES, 'readwrite');
  for (const name of BACKUP_STORE_NAMES) {
    if (mode === 'replace') await tx.objectStore(name).clear();
    const rows = (backup.data as Record<string, { id: string }[]>)[name] ?? [];
    for (const row of rows) await tx.objectStore(name).put(row as never);
  }
  await tx.done;
  await updateSettings({ lastBackup: nowISO() });
}

export async function resetAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(BACKUP_STORE_NAMES, 'readwrite');
  for (const name of BACKUP_STORE_NAMES) await tx.objectStore(name).clear();
  await tx.done;
}

export async function isDatabaseEmpty(): Promise<boolean> {
  const db = await getDB();
  const count = await db.count('ingredients');
  return count === 0;
}

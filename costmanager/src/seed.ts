import * as db from './db';
import type { ExpenseCategory, IngredientCategory, PayType, Unit } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const SALES_HISTORY_DAYS = 60;

interface SeedIngredientDef {
  key: string;
  name: string;
  category: IngredientCategory;
  unit: Unit;
  pricePerUnit: number;
  minStock: number;
  maxStock: number;
  /** Stock left over after all seeded sales are deducted — tuned so milk/cups end up below minStock. */
  buffer: number;
}

interface SeedMenuItemDef {
  key: string;
  name: string;
  category: string;
  salePrice: number;
  weight: number;
  recipe: { ingredient: string; quantity: number }[];
}

const INGREDIENTS: SeedIngredientDef[] = [
  { key: 'coffee', name: 'دانه قهوه عربیکا', category: 'coffee_tea', unit: 'kg', pricePerUnit: 1_250_000, minStock: 3, maxStock: 18, buffer: 6 },
  { key: 'milk', name: 'شیر پر چرب', category: 'dairy', unit: 'l', pricePerUnit: 38_000, minStock: 10, maxStock: 60, buffer: 4 },
  { key: 'sugar', name: 'شکر سفید', category: 'dry_goods', unit: 'kg', pricePerUnit: 32_000, minStock: 8, maxStock: 40, buffer: 15 },
  { key: 'tea', name: 'چای سیاه شمال', category: 'coffee_tea', unit: 'kg', pricePerUnit: 480_000, minStock: 2, maxStock: 10, buffer: 4 },
  { key: 'caramel', name: 'شربت کارامل', category: 'beverages', unit: 'l', pricePerUnit: 320_000, minStock: 2, maxStock: 10, buffer: 4 },
  { key: 'cocoa', name: 'پودر کاکائو', category: 'dry_goods', unit: 'kg', pricePerUnit: 580_000, minStock: 1.5, maxStock: 8, buffer: 5 },
  { key: 'bread', name: 'نان باگت', category: 'bakery', unit: 'unit', pricePerUnit: 18_000, minStock: 10, maxStock: 50, buffer: 20 },
  { key: 'cheese', name: 'پنیر گودا', category: 'dairy', unit: 'kg', pricePerUnit: 720_000, minStock: 2, maxStock: 12, buffer: 5 },
  { key: 'ham', name: 'ژامبون مرغ', category: 'protein', unit: 'kg', pricePerUnit: 450_000, minStock: 2, maxStock: 10, buffer: 4 },
  { key: 'cups', name: 'لیوان یکبار مصرف کاغذی', category: 'packaging', unit: 'pack', pricePerUnit: 95_000, minStock: 4, maxStock: 20, buffer: 1.5 },
];

const MENU_ITEMS: SeedMenuItemDef[] = [
  {
    key: 'espresso', name: 'اسپرسو', category: 'نوشیدنی گرم', salePrice: 45_000, weight: 30,
    recipe: [{ ingredient: 'coffee', quantity: 0.018 }, { ingredient: 'cups', quantity: 0.02 }],
  },
  {
    key: 'cappuccino', name: 'کاپوچینو', category: 'نوشیدنی گرم', salePrice: 65_000, weight: 25,
    recipe: [{ ingredient: 'coffee', quantity: 0.018 }, { ingredient: 'milk', quantity: 0.15 }, { ingredient: 'cups', quantity: 0.02 }],
  },
  {
    key: 'latte', name: 'لاته کارامل', category: 'نوشیدنی گرم', salePrice: 75_000, weight: 20,
    recipe: [
      { ingredient: 'coffee', quantity: 0.018 },
      { ingredient: 'milk', quantity: 0.2 },
      { ingredient: 'caramel', quantity: 0.03 },
      { ingredient: 'cups', quantity: 0.02 },
    ],
  },
  {
    key: 'tea', name: 'چای سنتی', category: 'نوشیدنی گرم', salePrice: 35_000, weight: 15,
    recipe: [{ ingredient: 'tea', quantity: 0.01 }, { ingredient: 'sugar', quantity: 0.01 }, { ingredient: 'cups', quantity: 0.02 }],
  },
  {
    key: 'sandwich', name: 'ساندویچ ژامبون و پنیر', category: 'غذا', salePrice: 120_000, weight: 10,
    recipe: [{ ingredient: 'bread', quantity: 1 }, { ingredient: 'ham', quantity: 0.08 }, { ingredient: 'cheese', quantity: 0.05 }],
  },
];

interface PlannedSale {
  menuKey: string;
  quantity: number;
  date: string;
}

function weightedPick(items: SeedMenuItemDef[]): SeedMenuItemDef {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    if (r < item.weight) return item;
    r -= item.weight;
  }
  return items[items.length - 1];
}

function buildSalesPlan(): PlannedSale[] {
  const plan: PlannedSale[] = [];
  const now = Date.now();
  for (let dayOffset = SALES_HISTORY_DAYS - 1; dayOffset >= 0; dayOffset--) {
    const salesCount = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < salesCount; i++) {
      const item = weightedPick(MENU_ITEMS);
      const quantity = 1 + Math.floor(Math.random() * 3);
      const date = new Date(now - dayOffset * DAY_MS);
      date.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);
      plan.push({ menuKey: item.key, quantity, date: date.toISOString() });
    }
  }
  return plan;
}

function computeConsumption(plan: PlannedSale[]): Map<string, number> {
  const consumption = new Map<string, number>();
  for (const sale of plan) {
    const menuItem = MENU_ITEMS.find((m) => m.key === sale.menuKey)!;
    for (const ri of menuItem.recipe) {
      consumption.set(ri.ingredient, (consumption.get(ri.ingredient) ?? 0) + ri.quantity * sale.quantity);
    }
  }
  return consumption;
}

function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}

async function seedExpensesAndPayroll(): Promise<void> {
  const expenseDefs: { name: string; category: ExpenseCategory; amount: number; frequency: 'monthly' | 'yearly' }[] = [
    { name: 'اجاره مغازه', category: 'rent', amount: 35_000_000, frequency: 'monthly' },
    { name: 'قبوض آب، برق و گاز', category: 'utilities', amount: 6_500_000, frequency: 'monthly' },
    { name: 'بیمه مسئولیت', category: 'insurance', amount: 24_000_000, frequency: 'yearly' },
  ];
  for (const def of expenseDefs) {
    await db.createExpense({ ...def, isActive: true });
  }

  const employeeDefs: { name: string; role: string; payType: PayType; amount: number }[] = [
    { name: 'بهنام رضایی', role: 'باریستا', payType: 'monthly', amount: 14_000_000 },
    { name: 'سارا احمدی', role: 'صندوقدار', payType: 'daily', amount: 900_000 },
    { name: 'علی محمدی', role: 'نیروی کمکی', payType: 'hourly', amount: 75_000 },
  ];
  for (const def of employeeDefs) {
    await db.createEmployee({ ...def, isActive: true });
  }
}

export async function seedDatabase(): Promise<void> {
  const plan = buildSalesPlan();
  const consumption = computeConsumption(plan);

  const ingredientIds = new Map<string, string>();
  for (const def of INGREDIENTS) {
    const used = consumption.get(def.key) ?? 0;
    const ingredient = await db.createIngredient({
      name: def.name,
      category: def.category,
      unit: def.unit,
      currentStock: roundQty(used + def.buffer),
      pricePerUnit: def.pricePerUnit,
      minStock: def.minStock,
      maxStock: def.maxStock,
    });
    ingredientIds.set(def.key, ingredient.id);
  }

  const menuItemIds = new Map<string, string>();
  for (const def of MENU_ITEMS) {
    const menuItem = await db.createMenuItem({ name: def.name, category: def.category, salePrice: def.salePrice });
    menuItemIds.set(def.key, menuItem.id);
    for (const ri of def.recipe) {
      await db.setRecipeIngredientQty(menuItem.id, ingredientIds.get(ri.ingredient)!, ri.quantity);
    }
  }

  await seedExpensesAndPayroll();

  for (const sale of plan) {
    await db.recordSale({ menuItemId: menuItemIds.get(sale.menuKey)!, quantity: sale.quantity, date: sale.date });
  }
}

export type IngredientCategory =
  | 'coffee_tea' | 'dairy' | 'dry_goods' | 'protein'
  | 'produce' | 'bakery' | 'beverages' | 'packaging' | 'other';

export type Unit = 'kg' | 'g' | 'l' | 'ml' | 'unit' | 'pack' | 'box';

export interface PurchaseRecord {
  id: string;
  date: string;
  quantity: number;
  pricePerUnit: number;
  supplier?: string;
  note?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  unit: Unit;
  currentStock: number;
  pricePerUnit: number;
  minStock: number;
  maxStock: number;
  purchaseHistory: PurchaseRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  salePrice: number;
  isActive: boolean;
  recipe: RecipeIngredient[];
  createdAt: string;
  updatedAt: string;
}

export type ExpenseCategory =
  | 'rent' | 'utilities' | 'insurance' | 'marketing'
  | 'maintenance' | 'packaging' | 'transport' | 'tax' | 'other';

export type ExpenseFrequency = 'monthly' | 'yearly' | 'one_time';

export interface Expense {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: ExpenseFrequency;
  isActive: boolean;
  note?: string;
  createdAt: string;
}

export type PayType = 'monthly' | 'daily' | 'hourly';

export interface Employee {
  id: string;
  name: string;
  role: string;
  payType: PayType;
  amount: number;
  isActive: boolean;
  startDate?: string;
}

export interface Sale {
  id: string;
  date: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitSalePrice: number;
  unitCost: number;
  note?: string;
}

export interface ShoppingListItem {
  id: string;
  ingredientId: string;
  ingredientName: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: Unit;
  suggestedQty: number;
  estimatedCost: number;
  checked: boolean;
  note?: string;
  generatedAt: string;
}

export type BusinessType = 'cafe' | 'restaurant' | 'fast_food' | 'bakery' | 'other';
export type Theme = 'light' | 'dark' | 'auto';

export interface Settings {
  id: 'global';
  businessName: string;
  businessType: BusinessType;
  currency: 'toman';
  targetFoodCostPercent: number;
  theme: Theme;
  lastBackup?: string;
}

export interface FullBackup {
  exportedAt: string;
  version: 1;
  data: {
    ingredients: Ingredient[];
    menu_items: MenuItem[];
    expenses: Expense[];
    employees: Employee[];
    sales: Sale[];
    shopping_list: ShoppingListItem[];
    settings: Settings[];
  };
}

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

export type SaleType = 'itemized' | 'bulk';
export type SaleSource = 'manual' | 'cashier' | 'snappfood' | 'bulk';

export interface BulkSaleBreakdownEntry {
  menuItemId: string;
  menuItemName: string;
  estimatedQuantity: number;
  estimatedRevenue: number;
  estimatedCost: number;
}

export interface IngredientDelta {
  ingredientId: string;
  quantity: number;
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
  /** Absent on existing records means 'itemized' — no migration needed. */
  type?: SaleType;
  /** Only present on bulk sales: per-item revenue-share estimate, for display + reversal. */
  estimatedBreakdown?: BulkSaleBreakdownEntry[];
  /** Only present on bulk sales: exact ingredient amounts deducted, for accurate deleteSale reversal. */
  ingredientDeltas?: IngredientDelta[];
  /** Absent on legacy records means 'manual' (or 'bulk' when type === 'bulk') — used for accounting's by-source breakdown. */
  source?: SaleSource;
  /** Snappfood-specific revenue breakdown, only present when source === 'snappfood'. */
  snappfood?: {
    grossSales: number;
    discount: number;
    commission: number;
    netReceived: number;
  };
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

export type CustomerSegment = 'vip' | 'regular' | 'new' | 'inactive';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  totalSpent: number;
  visitCount: number;
  lastVisitAt?: string;
  loyaltyPoints: number;
  createdAt: string;
}

export type SmsStatus = 'sent' | 'failed';

export interface SmsLog {
  id: string;
  recipients: string[];
  message: string;
  status: SmsStatus;
  error?: string;
  sentAt: string;
}

export type BusinessType = 'cafe' | 'restaurant' | 'fast_food' | 'bakery' | 'other';
export type Theme = 'light' | 'dark' | 'auto';

export type UserRole = 'superadmin' | 'manager' | 'warehouse' | 'buyer';
export type SubscriptionPlan = '1m' | '3m' | '6m' | '12m' | 'unlimited';
export type PaidSubscriptionPlan = '1m' | '3m' | '6m' | '12m';

export interface AppUser {
  id: string;
  name: string;
  pin: string;
  role: UserRole;
  isActive: boolean;
  subscriptionPlan: SubscriptionPlan;
  subscriptionExpiry: string;
  subscriptionPricesPaid?: number;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthConfig {
  id: 'auth';
  isSetup: boolean;
  users: AppUser[];
}

export interface Settings {
  id: 'global';
  businessName: string;
  businessType: BusinessType;
  currency: 'toman';
  targetFoodCostPercent: number;
  theme: Theme;
  lastBackup?: string;
  subscriptionPrices: Record<PaidSubscriptionPlan, number>;
  notificationsEnabled?: boolean;
  businessId: string;
  syncServerUrl: string;
  lastSyncAt?: string;
  kavenegarApiKey?: string;
  kavenegarSenderLine?: string;
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
    customers: Customer[];
    sms_logs: SmsLog[];
  };
}

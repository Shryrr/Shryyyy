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

export interface PhysicalCount {
  date: string;
  quantity: number;
  countedBy: string;
}

export interface ConsumptionRecord {
  date: string;
  consumed: number;
  fromSales: number;
  fromWaste: number;
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
  /** Estimated true stock derived from the last physical count plus purchases/sales/waste deltas since then. */
  theoreticalStock: number;
  lastPhysicalCount: PhysicalCount | null;
  /** Average units consumed per day, derived from consumptionHistory. */
  dailyUsageRate: number;
  daysOfStockRemaining: number;
  predictedStockoutDate: string | null;
  consumptionHistory: ConsumptionRecord[];
  lastEstimationUpdatedAt: string;
}

export type WasteReason = 'expired' | 'spoiled' | 'damaged' | 'prep_error' | 'other';

export interface WasteEntry {
  id: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: Unit;
  reason: WasteReason;
  date: string;
  estimatedCost: number;
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
  isVatExempt: boolean;
  prepTimeMinutes?: number;
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
  /** Annual paid-leave entitlement in days, used by the HR leave-balance view. Absent on legacy records means 0. */
  annualLeaveDays?: number;
}

// ---------- HR & payroll ----------

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'half_day';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  /** YYYY-MM-DD */
  date: string;
  status: AttendanceStatus;
  overtimeHours?: number;
  note?: string;
  createdAt: string;
}

export interface PayrollAdjustment {
  label: string;
  /** Positive = bonus, negative = penalty. */
  amount: number;
}

export type PayrollStatus = 'draft' | 'finalized' | 'paid';

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  /** YYYY-MM */
  periodMonth: string;
  baseAmount: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  overtimeHours: number;
  overtimeAmount: number;
  adjustments: PayrollAdjustment[];
  advanceDeduction: number;
  /** Base + overtime + adjustments, before insurance and advance deduction. */
  grossPay: number;
  /** 7% employee share, deducted from grossPay. */
  insuranceEmployeeShare: number;
  /** 23% employer share, informational only — not deducted from net pay. */
  insuranceEmployerShare: number;
  /** grossPay - insuranceEmployeeShare - advanceDeduction. */
  netPay: number;
  status: PayrollStatus;
  createdAt: string;
  paidAt?: string;
}

export type SalaryAdvanceStatus = 'pending' | 'approved' | 'rejected' | 'deducted';

export interface SalaryAdvance {
  id: string;
  employeeId: string;
  amount: number;
  requestedAt: string;
  status: SalaryAdvanceStatus;
  approvedBy?: string;
  approvedAt?: string;
  deductedInPayrollId?: string;
  note?: string;
}

// ---------- Purchase requests ----------

export type PurchaseRequestStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';

export interface PurchaseRequestItem {
  ingredientId: string;
  ingredientName: string;
  suggestedQty: number;
  unit: Unit;
  estimatedCost: number;
}

export interface PurchaseRequest {
  id: string;
  createdBy: string;
  createdByName: string;
  status: PurchaseRequestStatus;
  items: PurchaseRequestItem[];
  neededByDatetime?: string | null;
  estimatedTotal?: number | null;
  note?: string | null;
  acceptedBy?: string | null;
  acceptedAt?: string | null;
  estimatedPurchaseDatetime?: string | null;
  completedBy?: string | null;
  completedAt?: string | null;
  actualTotal?: number | null;
  receiptUrl?: string | null;
  completionNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Petty cash ----------

export type PettyCashTxType = 'deposit' | 'withdrawal' | 'expense';
export type PettyCashRequestStatus = 'pending' | 'approved' | 'rejected';

export interface PettyCashPermission {
  userId: string;
  canView: boolean;
  canWithdraw: boolean;
  canRequest: boolean;
  updatedAt?: string;
}

// ---------- Audit log ----------

export interface AuditLogEntry {
  id: string;
  userId?: string | null;
  userName?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  detail?: string | null;
  createdAt: string;
}

export interface PettyCashTransaction {
  id: string;
  type: PettyCashTxType;
  amount: number;
  reason: string;
  requestedBy: string;
  requestedByName: string;
  status: PettyCashRequestStatus;
  approvedBy?: string;
  approvedAt?: string;
  date: string;
  createdAt: string;
}

export type SaleType = 'itemized' | 'bulk';
export type SaleSource = 'manual' | 'cashier' | 'snappfood' | 'bulk';
export type OrderType = 'dine_in' | 'takeout' | 'delivery';
export type DeliverySource = 'direct' | 'snappfood' | 'digikala';
export type DeliveryStatus = 'pending' | 'picked_up' | 'delivered' | 'failed';

export interface DeliveryInfo {
  courierName?: string;
  courierPhone?: string;
  address: string;
  zone?: string;
  deliveryFee: number;
  estimatedTime?: number;
  actualDeliveryTime?: string;
  deliveryStatus: DeliveryStatus;
  source: DeliverySource;
  platformCommission?: number;
  netRevenue?: number;
}

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
  /** Linked customer for CRM/RFM tracking — absent means a walk-in/anonymous sale. */
  customerId?: string;
  /** Absent on legacy records means 0 (no VAT applied at the time). */
  vatAmount?: number;
  vatRate?: number;
  /** Absent on legacy records means 'dine_in'. */
  orderType?: OrderType;
  deliveryInfo?: DeliveryInfo;
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

export type CustomerTag =
  | 'vip' | 'new' | 'birthday_this_month' | 'allergic' | 'vegetarian' | 'vegan' | 'gluten_free'
  | 'price_sensitive' | 'big_spender' | 'frequent' | 'referrer' | 'complainer' | 'corporate' | 'employee_family';

export type RFMSegment = 'champions' | 'loyal' | 'potential' | 'new' | 'at_risk' | 'lost' | 'hibernating' | 'regular';

export interface RFMScore {
  /** 1 (worst) – 5 (best) per-axis scores. */
  recency: number;
  frequency: number;
  monetary: number;
  recencyDays: number;
  calculatedAt: string;
}

export interface SurveyResponse {
  id: string;
  saleId?: string;
  npsScore: number;
  comment?: string;
  createdAt: string;
}

export interface CampaignRecord {
  id: string;
  type: 'automation' | 'manual_campaign';
  triggerId?: string;
  triggerName?: string;
  message: string;
  sentAt: string;
  status: SmsStatus;
}

export type CustomerSource = 'manual' | 'imported' | 'pos_import' | 'snappfood';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  birthday?: string;
  email?: string;
  address?: string;
  firstVisit: string;
  lastVisit?: string;
  visitCount: number;
  totalSpent: number;
  avgOrderValue: number;
  favoriteItems: string[];
  tags: CustomerTag[];
  notes?: string;
  walletBalance: number;
  loyaltyPoints: number;
  segment: RFMSegment;
  rfmScore: RFMScore;
  isActive: boolean;
  source: CustomerSource;
  deliveryAddresses?: string[];
  allergies?: string;
  preferences?: string;
  surveyResponses: SurveyResponse[];
  campaignHistory: CampaignRecord[];
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

export type AppNotificationType =
  | 'purchase_request' | 'low_stock' | 'stockout_predicted' | 'automation_triggered' | 'system' | 'campaign_result';

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  message: string;
  targetRole: UserRole;
  createdBy: string;
  createdAt: string;
  isRead: boolean;
  actionUrl?: string;
}

export type AutomationTriggerType = 'welcome' | 'birthday' | 'lapsed_14' | 'lapsed_30' | 'post_survey' | 'milestone_5' | 'custom';

export interface AutomationTrigger {
  id: string;
  name: string;
  type: AutomationTriggerType;
  isActive: boolean;
  conditions: Record<string, unknown>;
  action: { channel: 'sms'; messageTemplate: string };
  lastRun?: string;
  timesRun: number;
  successCount: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  ingredientIds: string[];
  notes?: string;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: number;
  date: string;
  isPaid: boolean;
  dueDate?: string;
  note?: string;
}

export type SupplierTransactionType = 'credit_purchase' | 'cash_purchase';

/** A goods-received event from a supplier. credit_purchase increases the outstanding payable balance; cash_purchase settles immediately and never affects it. */
export interface SupplierTransaction {
  id: string;
  supplierId: string;
  type: SupplierTransactionType;
  amount: number;
  date: string;
  ingredientId?: string;
  description?: string;
  createdAt: string;
}

export type SubscriptionPaymentStatus = 'pending' | 'approved' | 'rejected';

/** Local cache of a payment the business submitted for platform-owner review — server (subscription_payments table) is the source of truth. */
export interface SubscriptionPaymentRecord {
  id: string;
  plan: PaidSubscriptionPlan;
  amount: number;
  transferRef?: string;
  description?: string;
  status: SubscriptionPaymentStatus;
  submittedAt: string;
  reviewedAt?: string;
  note?: string;
}

export type BusinessType = 'cafe' | 'restaurant' | 'fast_food' | 'bakery' | 'other';
export type Theme = 'light' | 'dark' | 'auto';

export type UserRole = 'superadmin' | 'manager' | 'warehouse' | 'buyer' | 'accountant';
export type SubscriptionPlan = '1m' | '3m' | '6m' | '12m' | 'unlimited';
export type PaidSubscriptionPlan = '1m' | '3m' | '6m' | '12m';
export type BusinessSubscriptionStatus = 'trial' | 'pending_payment' | 'active' | 'expired';

export interface AppUser {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
  isActive: boolean;
  email?: string;
  phone?: string;
  createdAt: string;
  lastLogin?: string;
  /** Persisted (not in-memory) so a page reload can't reset a lockout window. */
  failedLoginAttempts?: number;
  lockedUntil?: string;
  /** Accountant role only: optional expiry date after which access is revoked. */
  accountantExpiresAt?: string;
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
  /** Subscription is per-business, not per-user: every user is blocked the same way once the business's plan expires. */
  subscriptionStatus: BusinessSubscriptionStatus;
  subscriptionPlan: SubscriptionPlan;
  subscriptionExpiry: string;
  trialStartedAt?: string;
  notificationsEnabled?: boolean;
  businessId: string;
  syncServerUrl: string;
  lastSyncAt?: string;
  /** Cursor for /api/sync/pull?since= — separate from lastSyncAt (push time) since pull and push can succeed independently. */
  lastSyncPulledAt?: string;
  /** Base URL (host only, no /api suffix) of the costmanager-api backend. Optional override — when unset, api.ts defaults to the page's own origin (nginx reverse-proxies /api/ on the same origin as the PWA), so it always matches the scheme the app was loaded with. A trailing /api on older saved values is stripped automatically. */
  apiBaseUrl?: string;
  kavenegarApiKey?: string;
  kavenegarSenderLine?: string;
  vatEnabled: boolean;
  vatRate: number;
  vatIncludedInPrice: boolean;
  pointsPerToman: number;
  pointsToTomanRatio: number;
  /** User-supplied Anthropic API key for opt-in AI menu recommendations — never bundled into the app, only used client-side at call time. */
  anthropicApiKey?: string;
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
    notifications: AppNotification[];
    waste: WasteEntry[];
    suppliers: Supplier[];
    supplier_payments: SupplierPayment[];
    automation_triggers: AutomationTrigger[];
    supplier_transactions: SupplierTransaction[];
    attendance: AttendanceRecord[];
    payroll_records: PayrollRecord[];
    salary_advances: SalaryAdvance[];
    petty_cash: PettyCashTransaction[];
    subscription_payments_cache: SubscriptionPaymentRecord[];
  };
}

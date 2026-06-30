# Graph Report - costmanager  (2026-06-30)

## Corpus Check
- 56 files · ~66,483 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 998 nodes · 3306 edges · 41 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c1cb945b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_UI Components & Refresh Handlers|UI Components & Refresh Handlers]]
- [[_COMMUNITY_Session & Auth Management|Session & Auth Management]]
- [[_COMMUNITY_Inventory & Notification Types|Inventory & Notification Types]]
- [[_COMMUNITY_Platform Owner Admin|Platform Owner Admin]]
- [[_COMMUNITY_Reactive Store & Shared Components|Reactive Store & Shared Components]]
- [[_COMMUNITY_Database CRUD Operations|Database CRUD Operations]]
- [[_COMMUNITY_Modal Component & State Collections|Modal Component & State Collections]]
- [[_COMMUNITY_Excel Import Parsing|Excel Import Parsing]]
- [[_COMMUNITY_Toast UI & AI Menu Engineering|Toast UI & AI Menu Engineering]]
- [[_COMMUNITY_Database CreateUpdate Ops|Database Create/Update Ops]]
- [[_COMMUNITY_Accounting & P&L Reporting|Accounting & P&L Reporting]]
- [[_COMMUNITY_Expense Management|Expense Management]]
- [[_COMMUNITY_Chart Theming & Cost Calculations|Chart Theming & Cost Calculations]]
- [[_COMMUNITY_Seed Data Generator|Seed Data Generator]]
- [[_COMMUNITY_Automation & SMS|Automation & SMS]]
- [[_COMMUNITY_CSVJSON Export & P&L Calc|CSV/JSON Export & P&L Calc]]
- [[_COMMUNITY_User Auth CRUD|User Auth CRUD]]
- [[_COMMUNITY_Recipe Cost Calculations|Recipe Cost Calculations]]
- [[_COMMUNITY_Business Subscription Logic|Business Subscription Logic]]
- [[_COMMUNITY_Ingredient Deletion Guard|Ingredient Deletion Guard]]
- [[_COMMUNITY_Sale Recording Types|Sale Recording Types]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 44|Community 44]]

## God Nodes (most connected - your core abstractions)
1. `el()` - 182 edges
2. `getDB()` - 111 edges
3. `showToast()` - 85 edges
4. `toPersian()` - 73 edges
5. `formatMoney()` - 61 edges
6. `field()` - 58 edges
7. `nowISO()` - 42 edges
8. `svgIcon()` - 41 edges
9. `openModal()` - 37 edges
10. `confirmModal()` - 36 edges

## Surprising Connections (you probably didn't know these)
- `renderRenewalSection()` --calls--> `render()`  [INFERRED]
  src/views/admin.ts → scripts/gen-icons.js
- `renderInstallSection()` --calls--> `render()`  [INFERRED]
  src/views/settings.ts → scripts/gen-icons.js
- `renderUsersTab()` --calls--> `render()`  [INFERRED]
  src/views/admin.ts → scripts/gen-icons.js
- `renderSetupWizard()` --calls--> `render()`  [INFERRED]
  src/views/setup.ts → scripts/gen-icons.js
- `renderFixedVariableTab()` --calls--> `el()`  [EXTRACTED]
  src/views/accounting.ts → src/utils/dom.ts

## Import Cycles
- 3-file cycle: `src/db.ts -> src/utils/api.ts -> src/store.ts -> src/db.ts`

## Communities (41 total, 0 thin omitted)

### Community 0 - "UI Components & Refresh Handlers"
Cohesion: 0.13
Nodes (17): daysUntilBusinessExpiry(), isBusinessExpired(), isBusinessExpiringSoon(), RouteCleanup, FullBackup, BUSINESS_TYPE_OPTIONS, EXTEND_OPTIONS, PLAN_OPTIONS (+9 more)

### Community 1 - "Session & Auth Management"
Cohesion: 0.05
Nodes (38): adjustLoyaltyPoints(), adjustWalletBalance(), finalizePayroll(), getAllForSync(), getAllSupplierBalances(), getCustomer(), getDB(), getIngredient() (+30 more)

### Community 2 - "Inventory & Notification Types"
Cohesion: 0.13
Nodes (15): cacheApiUser(), changeSuperadminPassword(), createUser(), deleteUser(), findUserByUsername(), getAuthConfig(), getUser(), hasSuperadmin() (+7 more)

### Community 3 - "Platform Owner Admin"
Cohesion: 0.05
Nodes (125): confirmModal(), ConfirmOptions, ModalHandle, ModalOptions, openModal(), showToast(), renderAccessDenied(), refreshAll() (+117 more)

### Community 4 - "Reactive Store & Shared Components"
Cohesion: 0.13
Nodes (28): openPlatformOwnerOverlay(), addPlatformInvoice(), DEFAULT_PLATFORM_PRICING, deletePlatformInvoice(), getPlatformPaymentCard(), listPlatformBroadcasts(), listPlatformInvoices(), PlatformBroadcastMessage (+20 more)

### Community 5 - "Database CRUD Operations"
Cohesion: 0.09
Nodes (32): buildCashierRows(), buildCustomerRows(), buildSnappfoodRows(), CASHIER_FIELD_LABELS, CASHIER_KEYWORDS, CashierField, CashierImportRow, CUSTOMER_FIELD_LABELS (+24 more)

### Community 6 - "Modal Component & State Collections"
Cohesion: 0.09
Nodes (39): addSurveyResponse(), createAutomationTrigger(), createCustomer(), createEmployee(), createExpense(), createIngredient(), createMenuItem(), createNotification() (+31 more)

### Community 7 - "Excel Import Parsing"
Cohesion: 0.06
Nodes (46): applyChartTheme(), cssVar(), destroyChart(), instances, palette, renderChart(), refreshAutomationTriggers(), refreshSmsLogs() (+38 more)

### Community 8 - "Toast UI & AI Menu Engineering"
Cohesion: 0.18
Nodes (21): hasFullAccess(), refreshMenuItems(), takeNavigationIntent(), RecipeIngredient, avgFoodCostPct(), DailyAggregate, foodCostPct(), foodCostStatus (+13 more)

### Community 9 - "Database Create/Update Ops"
Cohesion: 0.09
Nodes (22): dependencies, chart.js, idb, workbox-core, workbox-precaching, workbox-routing, workbox-strategies, xlsx (+14 more)

### Community 10 - "Accounting & P&L Reporting"
Cohesion: 0.17
Nodes (12): employees, expenses, navigationIntent, suppliers, RFM_SEGMENT_ORDER, chartCard(), OnboardingStep, quickActionBtn() (+4 more)

### Community 11 - "Expense Management"
Cohesion: 0.10
Nodes (24): IngredientInUseError, menuItems, sales, MenuItem, askClaude(), ClaudeApiResponse, ClaudeResult, ItemMatch (+16 more)

### Community 12 - "Chart Theming & Cost Calculations"
Cohesion: 0.06
Nodes (26): SessionUser, NewUserInput, UpdateUserInput, PlatformInvoice, PaidSubscriptionPlan, SubscriptionPaymentStatus, UserRole, ApiBroadcast (+18 more)

### Community 13 - "Seed Data Generator"
Cohesion: 0.25
Nodes (4): Listener, lowStockCount(), signal, unreadNotificationCount()

### Community 14 - "Automation & SMS"
Cohesion: 0.13
Nodes (20): ensureContainer(), ToastType, StoreName, automationTriggers, customers, ingredients, isOnline, notifications (+12 more)

### Community 15 - "CSV/JSON Export & P&L Calc"
Cohesion: 0.09
Nodes (30): Schema, AppNotification, AppNotificationType, AttendanceRecord, AuthConfig, AutomationTrigger, BulkSaleBreakdownEntry, BusinessSubscriptionStatus (+22 more)

### Community 16 - "User Auth CRUD"
Cohesion: 0.06
Nodes (44): refreshSupplierPayments(), refreshSuppliers(), PettyCashRequestStatus, SaleSource, avgGrossMarginRatio(), dailyBreakEven(), dailySeries(), monthlyFixedCost() (+36 more)

### Community 17 - "Recipe Cost Calculations"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+7 more)

### Community 18 - "Business Subscription Logic"
Cohesion: 0.13
Nodes (24): createAppNav(), NAV_ITEMS, createNotificationBell(), NOTIFICATION_ROUTE, createSidebar(), navButton(), ROLE_LABELS, Sidebar (+16 more)

### Community 19 - "Ingredient Deletion Guard"
Cohesion: 0.15
Nodes (12): background_color, description, dir, display, icons, lang, name, orientation (+4 more)

### Community 20 - "Sale Recording Types"
Cohesion: 0.12
Nodes (19): render(), attemptLogin(), LoginResult, RegisterBusinessInput, getPlatformPricing(), AppUser, BusinessType, SubscriptionPlan (+11 more)

### Community 21 - "Community 21"
Cohesion: 0.17
Nodes (23): iconBtn(), formatDateShort(), formatMoney(), toPersian(), renderPettyCashRow(), renderSupplierPaymentRow(), renderSupplierRow(), renderSupplierTransactionRow() (+15 more)

### Community 22 - "Community 22"
Cohesion: 0.22
Nodes (14): checkInactivityTimeout(), hasRole(), isSuperadmin(), login(), logout(), logoutWithReason(), readSession(), recordActivity() (+6 more)

### Community 23 - "Community 23"
Cohesion: 0.21
Nodes (12): NewIngredientInput, ConsumptionRecord, Ingredient, Sale, WasteEntry, buildContext(), computeDailyConsumption(), computeEstimation() (+4 more)

### Community 24 - "Community 24"
Cohesion: 0.33
Nodes (4): { chromium }, fs, OUT_DIR, path

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+4 more)

### Community 26 - "Community 26"
Cohesion: 0.15
Nodes (20): currentUser, ingredientsById(), PurchaseRecord, inventoryValue(), lowStockIngredients(), kpiCard(), formatIngredientCategory(), formatMoneyShort() (+12 more)

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (10): buildManifest(), crypto, entry(), esbuild, fs, hashFile(), main(), minify (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.12
Nodes (15): ExpenseFrequency, BUSINESS_TYPE_LABELS, dateFmt, dateShortFmt, dateTimeFmt, EXPENSE_CATEGORY_LABELS, EXPENSE_FREQUENCY_LABELS, INGREDIENT_CATEGORY_LABELS (+7 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (15): buildSalesPlan(), computeConsumption(), INGREDIENTS, MENU_ITEMS, PlannedSale, roundQty(), seedDatabase(), seedExpensesAndPayroll() (+7 more)

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (9): اسکریپت‌ها, ذخیره‌سازی و حریم خصوصی, ساختار پروژه, منوبان — MenuBan CostManager, نصب و اجرا, همگام‌سازی چند دستگاهی, ویژگی‌ها, پشته فنی (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.15
Nodes (24): takeSessionExpiredReason(), AlertBannerOptions, createAlertBanner(), dismissedThisSession, ALL_ROUTES, bootstrap(), maybeShowPlatformBroadcast(), SYNC_STATUS_ICON_NAME (+16 more)

### Community 32 - "Community 32"
Cohesion: 0.15
Nodes (12): NavItem, SidebarLink, Child, ElProps, EmptyStateOptions, KpiTone, IconName, PATHS (+4 more)

### Community 34 - "Community 34"
Cohesion: 0.12
Nodes (17): deleteAttendance(), deleteAutomationTrigger(), deleteCustomer(), deleteEmployee(), deleteExpense(), deleteIngredient(), deleteMenuItem(), deletePayrollRecord() (+9 more)

### Community 35 - "Community 35"
Cohesion: 0.37
Nodes (15): refreshIngredients(), refreshSales(), refreshShoppingList(), scheduleAutomationRun(), parseSpreadsheetFile(), todayISO(), scheduleRecalculation(), scheduleRfmRecalculation() (+7 more)

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (10): addMonthsISO(), deleteSale(), effectivePointsPerToman(), extendBusinessSubscription(), getSettings(), importAllData(), registerBusiness(), reverseCustomerVisit() (+2 more)

### Community 38 - "Community 38"
Cohesion: 0.32
Nodes (6): Customer, RFMScore, RFMSegment, assignSegment(), quintileScores(), recalculateAllRfm()

### Community 39 - "Community 39"
Cohesion: 0.33
Nodes (5): DEST_DIR, fs, path, SRC_DIR, WEIGHTS

### Community 40 - "Community 40"
Cohesion: 0.21
Nodes (15): refreshNotifications(), formatDate(), formatUnit(), ALERT_ROLES, checkStockAlertsAndNotify(), lowStockMessage(), notifiedLowStock, notifiedStockout (+7 more)

### Community 44 - "Community 44"
Cohesion: 0.06
Nodes (37): applySyncedRecord(), BACKUP_STORE_NAMES, DEFAULT_SETTINGS, getLeaveBalance(), getPettyCashBalance(), listAttendance(), listCustomers(), listPettyCash() (+29 more)

## Knowledge Gaps
- **228 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `scope` (+223 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `Platform Owner Admin` to `Community 32`, `UI Components & Refresh Handlers`, `Community 35`, `Reactive Store & Shared Components`, `Database CRUD Operations`, `Excel Import Parsing`, `Toast UI & AI Menu Engineering`, `Community 40`, `Accounting & P&L Reporting`, `Expense Management`, `User Auth CRUD`, `Business Subscription Logic`, `Sale Recording Types`, `Community 21`, `Community 26`, `Community 31`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Platform Owner Admin` to `UI Components & Refresh Handlers`, `Community 35`, `Reactive Store & Shared Components`, `Database CRUD Operations`, `Excel Import Parsing`, `Toast UI & AI Menu Engineering`, `Community 40`, `Expense Management`, `Automation & SMS`, `User Auth CRUD`, `Community 21`, `Community 26`, `Community 31`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `name`, `short_name`, `description` to the rest of the system?**
  _228 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI Components & Refresh Handlers` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Session & Auth Management` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `Inventory & Notification Types` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Platform Owner Admin` be split into smaller, more focused modules?**
  _Cohesion score 0.05244670542635659 - nodes in this community are weakly interconnected._
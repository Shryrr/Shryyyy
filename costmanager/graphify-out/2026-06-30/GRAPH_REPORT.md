# Graph Report - costmanager  (2026-06-30)

## Corpus Check
- 56 files · ~64,899 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 984 nodes · 3224 edges · 42 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1f59b8fe`
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
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]

## God Nodes (most connected - your core abstractions)
1. `el()` - 175 edges
2. `getDB()` - 111 edges
3. `showToast()` - 78 edges
4. `toPersian()` - 71 edges
5. `formatMoney()` - 57 edges
6. `field()` - 54 edges
7. `nowISO()` - 42 edges
8. `svgIcon()` - 41 edges
9. `openModal()` - 34 edges
10. `emptyState()` - 34 edges

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

## Communities (42 total, 0 thin omitted)

### Community 0 - "UI Components & Refresh Handlers"
Cohesion: 0.24
Nodes (27): openModal(), refreshCustomers(), field(), numberInput(), parseNumberInput(), selectEl(), openSupplierFormModal(), openSupplierPaymentFormModal() (+19 more)

### Community 1 - "Session & Auth Management"
Cohesion: 0.05
Nodes (38): adjustLoyaltyPoints(), adjustWalletBalance(), finalizePayroll(), getAllForSync(), getAllSupplierBalances(), getCustomer(), getDB(), getIngredient() (+30 more)

### Community 2 - "Inventory & Notification Types"
Cohesion: 0.08
Nodes (32): buildSalesPlan(), computeConsumption(), INGREDIENTS, MENU_ITEMS, PlannedSale, roundQty(), seedDatabase(), seedExpensesAndPayroll() (+24 more)

### Community 3 - "Platform Owner Admin"
Cohesion: 0.27
Nodes (17): refreshAll(), refreshSettings(), iconTextBtn(), formatBusinessType(), BeforeInstallPromptEvent, BUSINESS_TYPE_OPTIONS, formatBytes(), renderDataSection() (+9 more)

### Community 4 - "Reactive Store & Shared Components"
Cohesion: 0.14
Nodes (27): openPlatformOwnerOverlay(), addPlatformInvoice(), DEFAULT_PLATFORM_PRICING, deletePlatformInvoice(), getPlatformPaymentCard(), listPlatformBroadcasts(), listPlatformInvoices(), PlatformBroadcastMessage (+19 more)

### Community 5 - "Database CRUD Operations"
Cohesion: 0.08
Nodes (49): refreshIngredients(), refreshSales(), refreshShoppingList(), scheduleAutomationRun(), buildCashierRows(), buildCustomerRows(), buildSnappfoodRows(), CASHIER_FIELD_LABELS (+41 more)

### Community 6 - "Modal Component & State Collections"
Cohesion: 0.09
Nodes (39): addSurveyResponse(), createAutomationTrigger(), createCustomer(), createEmployee(), createExpense(), createIngredient(), createMenuItem(), createNotification() (+31 more)

### Community 7 - "Excel Import Parsing"
Cohesion: 0.09
Nodes (29): destroyChart(), refreshAutomationTriggers(), refreshSmsLogs(), formatDateTime(), formatRfmSegment(), rfmSegmentIcon(), AUTOMATION_DEFAULT_TEMPLATES, AUTOMATION_DESCRIPTIONS (+21 more)

### Community 8 - "Toast UI & AI Menu Engineering"
Cohesion: 0.14
Nodes (26): NewIngredientInput, refreshMenuItems(), Employee, Expense, Ingredient, RecipeIngredient, avgFoodCostPct(), DailyAggregate (+18 more)

### Community 9 - "Database Create/Update Ops"
Cohesion: 0.09
Nodes (22): dependencies, chart.js, idb, workbox-core, workbox-precaching, workbox-routing, workbox-strategies, xlsx (+14 more)

### Community 10 - "Accounting & P&L Reporting"
Cohesion: 0.09
Nodes (38): ConfirmOptions, ModalHandle, ModalOptions, renderAccessDenied(), refreshEmployees(), PayrollStatus, SalaryAdvanceStatus, el() (+30 more)

### Community 11 - "Expense Management"
Cohesion: 0.11
Nodes (23): IngredientInUseError, MenuItem, askClaude(), ClaudeApiResponse, ClaudeResult, ItemMatch, classifyMenuItems(), MenuEngineeringItem (+15 more)

### Community 12 - "Chart Theming & Cost Calculations"
Cohesion: 0.06
Nodes (26): SessionUser, NewUserInput, UpdateUserInput, PlatformInvoice, PaidSubscriptionPlan, SubscriptionPaymentStatus, UserRole, ApiBroadcast (+18 more)

### Community 13 - "Seed Data Generator"
Cohesion: 0.33
Nodes (3): initThemeWatcher(), Listener, signal

### Community 14 - "Automation & SMS"
Cohesion: 0.09
Nodes (32): StoreName, automationTriggers, customers, employees, expenses, ingredients, isOnline, lowStockCount() (+24 more)

### Community 15 - "CSV/JSON Export & P&L Calc"
Cohesion: 0.09
Nodes (29): Schema, AppNotification, AppNotificationType, AttendanceRecord, AuthConfig, AutomationTriggerType, BulkSaleBreakdownEntry, BusinessSubscriptionStatus (+21 more)

### Community 16 - "User Auth CRUD"
Cohesion: 0.09
Nodes (36): renderChart(), refreshSupplierPayments(), refreshSuppliers(), SaleSource, avgGrossMarginRatio(), dailySeries(), monthlyFixedCost(), periodProfitLoss() (+28 more)

### Community 17 - "Recipe Cost Calculations"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+7 more)

### Community 18 - "Business Subscription Logic"
Cohesion: 0.14
Nodes (19): createSidebar(), navButton(), ROLE_LABELS, Sidebar, SIDEBAR_LINKS, SidebarLink, createBreadcrumb(), isPlatformOwnerSession() (+11 more)

### Community 19 - "Ingredient Deletion Guard"
Cohesion: 0.15
Nodes (12): background_color, description, dir, display, icons, lang, name, orientation (+4 more)

### Community 20 - "Sale Recording Types"
Cohesion: 0.11
Nodes (27): render(), attemptLogin(), checkInactivityTimeout(), currentUser, login(), LoginResult, logout(), logoutWithReason() (+19 more)

### Community 22 - "Community 22"
Cohesion: 0.19
Nodes (17): confirmModal(), ensureContainer(), showToast(), ToastType, handleDeleteSupplierPayment(), handleDeleteUser(), handleDeleteCustomer(), handleDeleteEmployee() (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.26
Nodes (10): ConsumptionRecord, Sale, WasteEntry, buildContext(), computeDailyConsumption(), computeEstimation(), ConsumptionContext, IngredientEstimation (+2 more)

### Community 24 - "Community 24"
Cohesion: 0.21
Nodes (13): AutomationTrigger, Settings, applyTemplate(), isEligible(), recencyDaysFor(), runAutomationTriggers(), withinCooldown(), fetchWithTimeout() (+5 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+4 more)

### Community 26 - "Community 26"
Cohesion: 0.06
Nodes (67): hasFullAccess(), hasRole(), isSuperadmin(), SeedIngredientDef, ingredientsById(), refreshNotifications(), ExpenseFrequency, IngredientCategory (+59 more)

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (10): buildManifest(), crypto, entry(), esbuild, fs, hashFile(), main(), minify (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.13
Nodes (21): FullBackup, pullFromServer(), pushToServer(), syncNow(), BUSINESS_TYPE_OPTIONS, EXTEND_OPTIONS, PLAN_OPTIONS, PLAN_TOTAL_DAYS (+13 more)

### Community 29 - "Community 29"
Cohesion: 0.13
Nodes (15): cacheApiUser(), changeSuperadminPassword(), createUser(), deleteUser(), findUserByUsername(), getAuthConfig(), getUser(), hasSuperadmin() (+7 more)

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (9): اسکریپت‌ها, ذخیره‌سازی و حریم خصوصی, ساختار پروژه, منوبان — MenuBan CostManager, نصب و اجرا, همگام‌سازی چند دستگاهی, ویژگی‌ها, پشته فنی (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.16
Nodes (22): AlertBannerOptions, createAlertBanner(), dismissedThisSession, ALL_ROUTES, bootstrap(), maybeShowPlatformBroadcast(), SYNC_STATUS_ICON_NAME, SYNC_STATUS_LABEL (+14 more)

### Community 32 - "Community 32"
Cohesion: 0.12
Nodes (19): createAppNav(), NAV_ITEMS, NavItem, createNotificationBell(), NOTIFICATION_ROUTE, createAppHeader(), renderExpiredScreen(), showBootError() (+11 more)

### Community 34 - "Community 34"
Cohesion: 0.12
Nodes (17): deleteAttendance(), deleteAutomationTrigger(), deleteCustomer(), deleteEmployee(), deleteExpense(), deleteIngredient(), deleteMenuItem(), deletePayrollRecord() (+9 more)

### Community 35 - "Community 35"
Cohesion: 0.50
Nodes (4): RegisterBusinessInput, BusinessType, SubscriptionPlan, WizardState

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
Cohesion: 0.33
Nodes (4): { chromium }, fs, OUT_DIR, path

### Community 41 - "Community 41"
Cohesion: 0.50
Nodes (4): applyChartTheme(), cssVar(), instances, palette

### Community 43 - "Community 43"
Cohesion: 0.53
Nodes (6): daysUntilBusinessExpiry(), isBusinessExpired(), isBusinessExpiringSoon(), getPlatformPricing(), renderRenewalSection(), renderSubscriptionsTab()

### Community 44 - "Community 44"
Cohesion: 0.06
Nodes (37): applySyncedRecord(), BACKUP_STORE_NAMES, DEFAULT_SETTINGS, getLeaveBalance(), getPettyCashBalance(), listAttendance(), listCustomers(), listPettyCash() (+29 more)

## Knowledge Gaps
- **224 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `scope` (+219 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `Accounting & P&L Reporting` to `Community 32`, `UI Components & Refresh Handlers`, `Inventory & Notification Types`, `Platform Owner Admin`, `Reactive Store & Shared Components`, `Database CRUD Operations`, `Excel Import Parsing`, `Toast UI & AI Menu Engineering`, `Community 43`, `Expense Management`, `Automation & SMS`, `User Auth CRUD`, `Business Subscription Logic`, `Sale Recording Types`, `Community 22`, `Community 26`, `Community 28`, `Community 31`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 22` to `UI Components & Refresh Handlers`, `Inventory & Notification Types`, `Platform Owner Admin`, `Reactive Store & Shared Components`, `Database CRUD Operations`, `Excel Import Parsing`, `Toast UI & AI Menu Engineering`, `Accounting & P&L Reporting`, `Community 43`, `Expense Management`, `Automation & SMS`, `User Auth CRUD`, `Community 26`, `Community 28`, `Community 31`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `name`, `short_name`, `description` to the rest of the system?**
  _224 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Session & Auth Management` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `Inventory & Notification Types` be split into smaller, more focused modules?**
  _Cohesion score 0.08199643493761141 - nodes in this community are weakly interconnected._
- **Should `Reactive Store & Shared Components` be split into smaller, more focused modules?**
  _Cohesion score 0.13763440860215054 - nodes in this community are weakly interconnected._
- **Should `Database CRUD Operations` be split into smaller, more focused modules?**
  _Cohesion score 0.08220211161387632 - nodes in this community are weakly interconnected._
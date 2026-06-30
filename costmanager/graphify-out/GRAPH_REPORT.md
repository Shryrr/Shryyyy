# Graph Report - costmanager  (2026-06-30)

## Corpus Check
- 54 files · ~59,856 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 866 nodes · 2889 edges · 45 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e9cd521a`
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
- [[_COMMUNITY_Service Worker Entry|Service Worker Entry]]
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
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 44|Community 44]]

## God Nodes (most connected - your core abstractions)
1. `el()` - 159 edges
2. `getDB()` - 83 edges
3. `toPersian()` - 72 edges
4. `showToast()` - 68 edges
5. `field()` - 50 edges
6. `formatMoney()` - 50 edges
7. `svgIcon()` - 41 edges
8. `nowISO()` - 32 edges
9. `bootstrap()` - 31 edges
10. `selectEl()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `renderRenewalSection()` --calls--> `render()`  [INFERRED]
  src/views/admin.ts → scripts/gen-icons.js
- `renderUsersTab()` --calls--> `render()`  [INFERRED]
  src/views/admin.ts → scripts/gen-icons.js
- `renderInstallSection()` --calls--> `render()`  [INFERRED]
  src/views/settings.ts → scripts/gen-icons.js
- `renderSetupWizard()` --calls--> `render()`  [INFERRED]
  src/views/setup.ts → scripts/gen-icons.js
- `renderFixedVariableTab()` --calls--> `el()`  [EXTRACTED]
  src/views/accounting.ts → src/utils/dom.ts

## Import Cycles
- None detected.

## Communities (45 total, 0 thin omitted)

### Community 0 - "UI Components & Refresh Handlers"
Cohesion: 0.26
Nodes (25): openModal(), showToast(), refreshCustomers(), refreshSuppliers(), field(), numberInput(), parseNumberInput(), selectEl() (+17 more)

### Community 1 - "Session & Auth Management"
Cohesion: 0.06
Nodes (58): adjustLoyaltyPoints(), adjustWalletBalance(), BACKUP_STORE_NAMES, DEFAULT_SETTINGS, deleteAutomationTrigger(), deleteCustomer(), deleteEmployee(), deleteExpense() (+50 more)

### Community 2 - "Inventory & Notification Types"
Cohesion: 0.11
Nodes (24): refreshEmployees(), refreshExpenses(), expenseMonthlyEquivalent(), monthlyEquivalent(), formatExpenseCategory(), formatExpenseFrequency(), formatPayType(), CHART_COLORS (+16 more)

### Community 3 - "Platform Owner Admin"
Cohesion: 0.10
Nodes (40): confirmModal(), ConfirmOptions, ModalHandle, ModalOptions, ensureContainer(), ToastType, refreshSettings(), FullBackup (+32 more)

### Community 4 - "Reactive Store & Shared Components"
Cohesion: 0.09
Nodes (47): openPlatformOwnerOverlay(), addPlatformInvoice(), DEFAULT_PLATFORM_PRICING, deletePlatformInvoice(), fetchLatestBroadcast(), fetchPlatformBusinesses(), fetchWithTimeout(), getPlatformPaymentCard() (+39 more)

### Community 5 - "Database CRUD Operations"
Cohesion: 0.09
Nodes (33): IngredientInUseError, MenuItem, buildCashierRows(), buildSnappfoodRows(), CASHIER_FIELD_LABELS, CASHIER_KEYWORDS, CashierField, CashierImportRow (+25 more)

### Community 6 - "Modal Component & State Collections"
Cohesion: 0.11
Nodes (32): addSurveyResponse(), createAutomationTrigger(), createCustomer(), createEmployee(), createExpense(), createIngredient(), createMenuItem(), createNotification() (+24 more)

### Community 7 - "Excel Import Parsing"
Cohesion: 0.07
Nodes (33): refreshAutomationTriggers(), refreshSmsLogs(), buildCustomerRows(), CUSTOMER_FIELD_LABELS, CustomerField, CustomerImportRow, formatRfmSegment(), rfmSegmentIcon() (+25 more)

### Community 8 - "Toast UI & AI Menu Engineering"
Cohesion: 0.19
Nodes (13): RecipeIngredient, avgGrossMarginRatio(), DailyAggregate, dailyBreakEven(), dailySeries(), ItemRecipeCostFn, monthlyFixedCost(), PeriodPL (+5 more)

### Community 9 - "Database Create/Update Ops"
Cohesion: 0.09
Nodes (22): dependencies, chart.js, idb, workbox-core, workbox-precaching, workbox-routing, workbox-strategies, xlsx (+14 more)

### Community 10 - "Accounting & P&L Reporting"
Cohesion: 0.17
Nodes (23): renderAccessDenied(), el(), emptyState(), plRow(), plStatement(), sourceBreakdownPanel(), sourceBreakdownRow(), renderBackupSection() (+15 more)

### Community 11 - "Expense Management"
Cohesion: 0.15
Nodes (17): askClaude(), ClaudeApiResponse, ClaudeResult, classifyMenuItems(), MenuEngineeringItem, MenuEngineeringResult, MenuQuadrant, QUADRANT_DESCRIPTIONS (+9 more)

### Community 12 - "Chart Theming & Cost Calculations"
Cohesion: 0.11
Nodes (16): ExpenseFrequency, BUSINESS_TYPE_LABELS, dateFmt, dateShortFmt, dateTimeFmt, EXPENSE_CATEGORY_LABELS, EXPENSE_FREQUENCY_LABELS, INGREDIENT_CATEGORY_LABELS (+8 more)

### Community 13 - "Seed Data Generator"
Cohesion: 0.18
Nodes (15): buildSalesPlan(), computeConsumption(), INGREDIENTS, MENU_ITEMS, PlannedSale, roundQty(), seedDatabase(), seedExpensesAndPayroll() (+7 more)

### Community 14 - "Automation & SMS"
Cohesion: 0.11
Nodes (22): automationTriggers, customers, employees, expenses, isOnline, menuItems, navigationIntent, notifications (+14 more)

### Community 15 - "CSV/JSON Export & P&L Calc"
Cohesion: 0.09
Nodes (28): RegisterBusinessInput, Schema, AppNotification, AppNotificationType, AuthConfig, AutomationTriggerType, BulkSaleBreakdownEntry, BusinessSubscriptionStatus (+20 more)

### Community 16 - "User Auth CRUD"
Cohesion: 0.14
Nodes (17): refreshSupplierPayments(), SaleSource, AccountingTab, bySourceBreakdown(), effectiveSource(), ExpenseSubTab, handleDeleteSupplierPayment(), PERIOD_OPTIONS (+9 more)

### Community 17 - "Recipe Cost Calculations"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+7 more)

### Community 18 - "Business Subscription Logic"
Cohesion: 0.13
Nodes (15): createAppNav(), createNotificationBell(), NOTIFICATION_ROUTE, createAppHeader(), renderExpiredScreen(), showBootError(), Child, ElProps (+7 more)

### Community 19 - "Ingredient Deletion Guard"
Cohesion: 0.15
Nodes (12): background_color, description, dir, display, icons, lang, name, orientation (+4 more)

### Community 20 - "Sale Recording Types"
Cohesion: 0.15
Nodes (20): attemptLogin(), checkInactivityTimeout(), isSuperadmin(), login(), LoginResult, logout(), logoutWithReason(), readSession() (+12 more)

### Community 21 - "Service Worker Entry"
Cohesion: 0.21
Nodes (12): NAV_ITEMS, createBreadcrumb(), currentPath, getHashPath(), navigate(), renderCurrent(), Route, RouteRender (+4 more)

### Community 22 - "Community 22"
Cohesion: 0.28
Nodes (15): refreshMenuItems(), avgFoodCostPct(), foodCostPct(), foodCostStatus, grossProfit(), suggestedPriceForTarget(), iconBtn(), formatPct() (+7 more)

### Community 23 - "Community 23"
Cohesion: 0.26
Nodes (10): ConsumptionRecord, Sale, WasteEntry, buildContext(), computeDailyConsumption(), computeEstimation(), ConsumptionContext, IngredientEstimation (+2 more)

### Community 24 - "Community 24"
Cohesion: 0.23
Nodes (12): AutomationTrigger, applyTemplate(), isEligible(), recencyDaysFor(), runAutomationTriggers(), withinCooldown(), fetchWithTimeout(), KavenegarConfig (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+4 more)

### Community 26 - "Community 26"
Cohesion: 0.13
Nodes (30): currentUser, ingredientsById(), kpiCard(), formatDateShort(), formatIngredientCategory(), formatMoney(), formatUnit(), toPersian() (+22 more)

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (10): buildManifest(), crypto, entry(), esbuild, fs, hashFile(), main(), minify (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.14
Nodes (16): daysUntilBusinessExpiry(), isBusinessExpired(), isBusinessExpiringSoon(), RouteCleanup, BUSINESS_TYPE_OPTIONS, EXTEND_OPTIONS, PLAN_OPTIONS, PLAN_TOTAL_DAYS (+8 more)

### Community 29 - "Community 29"
Cohesion: 0.14
Nodes (14): changeSuperadminPassword(), createUser(), deleteUser(), findUserByUsername(), getAuthConfig(), getUser(), hasSuperadmin(), isUsernameTaken() (+6 more)

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (9): اسکریپت‌ها, ذخیره‌سازی و حریم خصوصی, ساختار پروژه, منوبان — MenuBan CostManager, نصب و اجرا, همگام‌سازی چند دستگاهی, ویژگی‌ها, پشته فنی (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.16
Nodes (22): AlertBannerOptions, createAlertBanner(), dismissedThisSession, ALL_ROUTES, bootstrap(), maybeShowPlatformBroadcast(), SYNC_STATUS_ICON_NAME, SYNC_STATUS_LABEL (+14 more)

### Community 32 - "Community 32"
Cohesion: 0.18
Nodes (14): SessionUser, NavItem, createSidebar(), navButton(), ROLE_LABELS, Sidebar, SIDEBAR_LINKS, SidebarLink (+6 more)

### Community 33 - "Community 33"
Cohesion: 0.25
Nodes (4): Listener, lowStockCount(), signal, unreadNotificationCount()

### Community 34 - "Community 34"
Cohesion: 0.24
Nodes (11): NewIngredientInput, refreshNotifications(), Ingredient, formatDate(), ALERT_ROLES, checkStockAlertsAndNotify(), lowStockMessage(), notifiedLowStock (+3 more)

### Community 35 - "Community 35"
Cohesion: 0.25
Nodes (13): hasFullAccess(), hasRole(), takeNavigationIntent(), inventoryValue(), lowStockIngredients(), formatMoneyShort(), trimmed(), CATEGORY_OPTIONS (+5 more)

### Community 36 - "Community 36"
Cohesion: 0.25
Nodes (9): addMonthsISO(), deleteSale(), effectivePointsPerToman(), extendBusinessSubscription(), getSettings(), importAllData(), registerBusiness(), reverseCustomerVisit() (+1 more)

### Community 37 - "Community 37"
Cohesion: 0.36
Nodes (6): downloadBlob(), downloadCSV(), downloadJSON(), readFileAsJSON(), shareOrCopyText(), toCSV()

### Community 38 - "Community 38"
Cohesion: 0.32
Nodes (6): Customer, RFMScore, RFMSegment, assignSegment(), quintileScores(), recalculateAllRfm()

### Community 39 - "Community 39"
Cohesion: 0.33
Nodes (5): DEST_DIR, fs, path, SRC_DIR, WEIGHTS

### Community 40 - "Community 40"
Cohesion: 0.25
Nodes (6): { chromium }, fs, OUT_DIR, path, render(), renderSetupWizard()

### Community 41 - "Community 41"
Cohesion: 0.33
Nodes (6): applyChartTheme(), cssVar(), destroyChart(), instances, palette, renderChart()

### Community 42 - "Community 42"
Cohesion: 0.38
Nodes (14): refreshAll(), refreshIngredients(), refreshSales(), refreshShoppingList(), scheduleAutomationRun(), todayISO(), scheduleRecalculation(), scheduleRfmRecalculation() (+6 more)

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (4): RecordImportedSaleInput, RecordSaleInput, DeliveryInfo, OrderType

## Knowledge Gaps
- **212 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `scope` (+207 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `Accounting & P&L Reporting` to `UI Components & Refresh Handlers`, `Inventory & Notification Types`, `Platform Owner Admin`, `Reactive Store & Shared Components`, `Database CRUD Operations`, `Excel Import Parsing`, `Toast UI & AI Menu Engineering`, `Expense Management`, `Automation & SMS`, `User Auth CRUD`, `Business Subscription Logic`, `Sale Recording Types`, `Service Worker Entry`, `Community 22`, `Community 26`, `Community 28`, `Community 31`, `Community 35`, `Community 42`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `toPersian()` connect `Community 26` to `UI Components & Refresh Handlers`, `Platform Owner Admin`, `Reactive Store & Shared Components`, `Database CRUD Operations`, `Excel Import Parsing`, `Accounting & P&L Reporting`, `Expense Management`, `Chart Theming & Cost Calculations`, `Automation & SMS`, `User Auth CRUD`, `Business Subscription Logic`, `Service Worker Entry`, `Community 22`, `Community 24`, `Community 28`, `Community 31`, `Community 34`, `Community 35`, `Community 42`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `showToast()` connect `UI Components & Refresh Handlers` to `Inventory & Notification Types`, `Platform Owner Admin`, `Community 35`, `Reactive Store & Shared Components`, `Database CRUD Operations`, `Excel Import Parsing`, `Accounting & P&L Reporting`, `Community 42`, `Expense Management`, `User Auth CRUD`, `Community 22`, `Community 26`, `Community 28`, `Community 31`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `name`, `short_name`, `description` to the rest of the system?**
  _212 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Session & Auth Management` be split into smaller, more focused modules?**
  _Cohesion score 0.06078316773816481 - nodes in this community are weakly interconnected._
- **Should `Inventory & Notification Types` be split into smaller, more focused modules?**
  _Cohesion score 0.11333333333333333 - nodes in this community are weakly interconnected._
- **Should `Platform Owner Admin` be split into smaller, more focused modules?**
  _Cohesion score 0.10042283298097252 - nodes in this community are weakly interconnected._
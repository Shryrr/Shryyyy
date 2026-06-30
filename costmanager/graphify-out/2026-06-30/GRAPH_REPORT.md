# Graph Report - costmanager  (2026-06-29)

## Corpus Check
- 52 files · ~57,603 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 842 nodes · 2727 edges · 46 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `31eec43f`
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
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]

## God Nodes (most connected - your core abstractions)
1. `el()` - 152 edges
2. `getDB()` - 81 edges
3. `toPersian()` - 75 edges
4. `showToast()` - 67 edges
5. `formatMoney()` - 50 edges
6. `field()` - 47 edges
7. `nowISO()` - 32 edges
8. `bootstrap()` - 30 edges
9. `selectEl()` - 30 edges
10. `numberInput()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `renderRenewalSection()` --calls--> `render()`  [INFERRED]
  src/views/admin.ts → scripts/gen-icons.js
- `renderUsersTab()` --calls--> `render()`  [INFERRED]
  src/views/admin.ts → scripts/gen-icons.js
- `renderInstallSection()` --calls--> `render()`  [INFERRED]
  src/views/settings.ts → scripts/gen-icons.js
- `renderSetupWizard()` --calls--> `render()`  [INFERRED]
  src/views/setup.ts → scripts/gen-icons.js
- `showBootError()` --calls--> `el()`  [EXTRACTED]
  src/main.ts → src/utils/dom.ts

## Import Cycles
- None detected.

## Communities (46 total, 0 thin omitted)

### Community 0 - "UI Components & Refresh Handlers"
Cohesion: 0.08
Nodes (82): confirmModal(), ConfirmOptions, ModalHandle, ModalOptions, openModal(), ensureContainer(), showToast(), ToastType (+74 more)

### Community 1 - "Session & Auth Management"
Cohesion: 0.06
Nodes (56): adjustLoyaltyPoints(), adjustWalletBalance(), BACKUP_STORE_NAMES, DEFAULT_SETTINGS, deleteAutomationTrigger(), deleteCustomer(), deleteEmployee(), deleteExpense() (+48 more)

### Community 2 - "Inventory & Notification Types"
Cohesion: 0.05
Nodes (51): buildSalesPlan(), computeConsumption(), INGREDIENTS, MENU_ITEMS, PlannedSale, roundQty(), seedDatabase(), seedExpensesAndPayroll() (+43 more)

### Community 3 - "Platform Owner Admin"
Cohesion: 0.08
Nodes (41): customers, employees, expenses, isOnline, menuItems, sales, smsLogs, SyncStatus (+33 more)

### Community 4 - "Reactive Store & Shared Components"
Cohesion: 0.11
Nodes (38): addPlatformInvoice(), DEFAULT_PLATFORM_PRICING, deletePlatformInvoice(), fetchLatestBroadcast(), fetchPlatformBusinesses(), fetchWithTimeout(), getPlatformPaymentCard(), getPlatformPin() (+30 more)

### Community 5 - "Database CRUD Operations"
Cohesion: 0.09
Nodes (30): buildCashierRows(), buildCustomerRows(), buildSnappfoodRows(), CASHIER_FIELD_LABELS, CASHIER_KEYWORDS, CashierField, CashierImportRow, CUSTOMER_FIELD_LABELS (+22 more)

### Community 6 - "Modal Component & State Collections"
Cohesion: 0.11
Nodes (32): addSurveyResponse(), createAutomationTrigger(), createCustomer(), createEmployee(), createExpense(), createIngredient(), createMenuItem(), createNotification() (+24 more)

### Community 7 - "Excel Import Parsing"
Cohesion: 0.10
Nodes (26): automationTriggers, refreshAutomationTriggers(), refreshSmsLogs(), kpiCard(), formatRfmSegment(), rfmSegmentIcon(), AUTOMATION_DEFAULT_TEMPLATES, AUTOMATION_DESCRIPTIONS (+18 more)

### Community 8 - "Toast UI & AI Menu Engineering"
Cohesion: 0.12
Nodes (23): navigationIntent, suppliers, RecipeIngredient, avgGrossMarginRatio(), DailyAggregate, dailySeries(), inventoryValue(), ItemRecipeCostFn (+15 more)

### Community 9 - "Database Create/Update Ops"
Cohesion: 0.09
Nodes (22): dependencies, chart.js, idb, workbox-core, workbox-precaching, workbox-routing, workbox-strategies, xlsx (+14 more)

### Community 10 - "Accounting & P&L Reporting"
Cohesion: 0.16
Nodes (23): renderChart(), renderAccessDenied(), el(), emptyState(), toPersian(), renderSuppliersSubTab(), sourceBreakdownPanel(), sourceBreakdownRow() (+15 more)

### Community 11 - "Expense Management"
Cohesion: 0.14
Nodes (19): NewIngredientInput, Ingredient, askClaude(), ClaudeApiResponse, ClaudeResult, classifyMenuItems(), MenuEngineeringItem, MenuEngineeringResult (+11 more)

### Community 12 - "Chart Theming & Cost Calculations"
Cohesion: 0.13
Nodes (18): AlertBannerOptions, createAlertBanner(), dismissedThisSession, createNotificationBell(), ALL_ROUTES, createAppHeader(), HEADER_LINKS, maybeShowPlatformBroadcast() (+10 more)

### Community 13 - "Seed Data Generator"
Cohesion: 0.16
Nodes (17): render(), login(), AppUser, BusinessType, authShell(), renderAuthGate(), renderPinEntry(), renderUserGrid() (+9 more)

### Community 14 - "Automation & SMS"
Cohesion: 0.19
Nodes (15): NOTIFICATION_ROUTE, Schema, notifications, resolvedTheme, unreadNotificationCount(), AppNotification, AutomationTrigger, Customer (+7 more)

### Community 15 - "CSV/JSON Export & P&L Calc"
Cohesion: 0.11
Nodes (17): AppNotificationType, AuthConfig, AutomationTriggerType, BulkSaleBreakdownEntry, BusinessSubscriptionStatus, CampaignRecord, CustomerSource, CustomerTag (+9 more)

### Community 16 - "User Auth CRUD"
Cohesion: 0.13
Nodes (16): supplierPayments, SaleSource, AccountingTab, bySourceBreakdown(), effectiveSource(), ExpenseSubTab, PERIOD_OPTIONS, renderFixedVariableTab() (+8 more)

### Community 17 - "Recipe Cost Calculations"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+7 more)

### Community 18 - "Business Subscription Logic"
Cohesion: 0.14
Nodes (10): Child, ElProps, EmptyStateOptions, KpiTone, parseCell(), parsePersianDigits(), featureCard(), FEATURES (+2 more)

### Community 19 - "Ingredient Deletion Guard"
Cohesion: 0.15
Nodes (12): background_color, description, dir, display, icons, lang, name, orientation (+4 more)

### Community 20 - "Sale Recording Types"
Cohesion: 0.26
Nodes (12): checkInactivityTimeout(), currentUser, isSuperadmin(), logout(), logoutWithReason(), readSession(), recordActivity(), refreshCurrentUser() (+4 more)

### Community 21 - "Service Worker Entry"
Cohesion: 0.21
Nodes (12): createBreadcrumb(), getHashPath(), navigate(), registerRoutes(), renderCurrent(), Route, RouteCleanup, RouteRender (+4 more)

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (12): ingredientsById(), avgFoodCostPct(), foodCostPct(), foodCostStatus, grossProfit(), recipeCost(), suggestedPriceForTarget(), openRecipeBuilderModal() (+4 more)

### Community 23 - "Community 23"
Cohesion: 0.26
Nodes (10): ConsumptionRecord, Sale, WasteEntry, buildContext(), computeDailyConsumption(), computeEstimation(), ConsumptionContext, IngredientEstimation (+2 more)

### Community 24 - "Community 24"
Cohesion: 0.26
Nodes (11): applyTemplate(), isEligible(), recencyDaysFor(), runAutomationTriggers(), withinCooldown(), fetchWithTimeout(), KavenegarConfig, KavenegarResponse (+3 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+4 more)

### Community 26 - "Community 26"
Cohesion: 0.24
Nodes (12): dailyBreakEven(), formatDateShort(), formatMoney(), formatPct(), breakEvenPanel(), plRow(), plStatement(), renderSupplierPaymentRow() (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (10): buildManifest(), crypto, entry(), esbuild, fs, hashFile(), main(), minify (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.29
Nodes (11): daysUntilBusinessExpiry(), isBusinessExpired(), isBusinessExpiringSoon(), bootstrap(), renderExpiredScreen(), initOnlineWatcher(), formatDate(), renderRenewalSection() (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (11): changeSuperadminPin(), createUser(), deleteUser(), findUserByPin(), getAuthConfig(), getUser(), hasSuperadmin(), listUsers() (+3 more)

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (9): اسکریپت‌ها, ذخیره‌سازی و حریم خصوصی, ساختار پروژه, منوبان — MenuBan CostManager, نصب و اجرا, همگام‌سازی چند دستگاهی, ویژگی‌ها, پشته فنی (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.29
Nodes (9): settings, checkLowStockAndNotify(), initLowStockWatcher(), lowStockMessage(), notifiedIds, notifyBrowser(), notifyInApp(), requestNotificationPermission() (+1 more)

### Community 32 - "Community 32"
Cohesion: 0.25
Nodes (8): SessionUser, createAppNav(), NAV_ITEMS, NavItem, NewUserInput, currentPath, ingredients, UserRole

### Community 33 - "Community 33"
Cohesion: 0.25
Nodes (4): initThemeWatcher(), Listener, lowStockCount(), signal

### Community 34 - "Community 34"
Cohesion: 0.33
Nodes (8): refreshNotifications(), ALERT_ROLES, checkStockAlertsAndNotify(), lowStockMessage(), notifiedLowStock, notifiedStockout, notifyRoles(), stockoutMessage()

### Community 35 - "Community 35"
Cohesion: 0.36
Nodes (8): hasFullAccess(), hasRole(), takeNavigationIntent(), formatIngredientCategory(), renderIngredientCard(), renderIngredients(), renderRecipes(), renderBudgetSection()

### Community 36 - "Community 36"
Cohesion: 0.29
Nodes (8): addMonthsISO(), effectivePointsPerToman(), extendBusinessSubscription(), getSettings(), importAllData(), registerBusiness(), reverseCustomerVisit(), updateSettings()

### Community 37 - "Community 37"
Cohesion: 0.36
Nodes (6): downloadBlob(), downloadCSV(), downloadJSON(), readFileAsJSON(), shareOrCopyText(), toCSV()

### Community 38 - "Community 38"
Cohesion: 0.38
Nodes (5): RFMScore, RFMSegment, assignSegment(), quintileScores(), recalculateAllRfm()

### Community 39 - "Community 39"
Cohesion: 0.33
Nodes (5): DEST_DIR, fs, path, SRC_DIR, WEIGHTS

### Community 40 - "Community 40"
Cohesion: 0.33
Nodes (4): { chromium }, fs, OUT_DIR, path

### Community 41 - "Community 41"
Cohesion: 0.40
Nodes (5): applyChartTheme(), cssVar(), destroyChart(), instances, palette

### Community 42 - "Community 42"
Cohesion: 0.50
Nodes (4): deleteIngredient(), getRecipesUsingIngredient(), listMenuItems(), listShoppingList()

### Community 43 - "Community 43"
Cohesion: 0.50
Nodes (3): IngredientInUseError, MenuItem, ItemMatch

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (4): RecordImportedSaleInput, RecordSaleInput, DeliveryInfo, OrderType

## Knowledge Gaps
- **211 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `scope` (+206 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `Accounting & P&L Reporting` to `UI Components & Refresh Handlers`, `Inventory & Notification Types`, `Platform Owner Admin`, `Community 35`, `Reactive Store & Shared Components`, `Database CRUD Operations`, `Excel Import Parsing`, `Toast UI & AI Menu Engineering`, `Expense Management`, `Chart Theming & Cost Calculations`, `Seed Data Generator`, `Automation & SMS`, `User Auth CRUD`, `Business Subscription Logic`, `Service Worker Entry`, `Community 22`, `Community 26`, `Community 28`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `toPersian()` connect `Accounting & P&L Reporting` to `UI Components & Refresh Handlers`, `Inventory & Notification Types`, `Platform Owner Admin`, `Reactive Store & Shared Components`, `Database CRUD Operations`, `Excel Import Parsing`, `Toast UI & AI Menu Engineering`, `Expense Management`, `Chart Theming & Cost Calculations`, `Seed Data Generator`, `Automation & SMS`, `User Auth CRUD`, `Business Subscription Logic`, `Community 22`, `Community 24`, `Community 26`, `Community 28`, `Community 31`, `Community 32`, `Community 34`, `Community 35`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `showToast()` connect `UI Components & Refresh Handlers` to `Inventory & Notification Types`, `Platform Owner Admin`, `Reactive Store & Shared Components`, `Database CRUD Operations`, `Excel Import Parsing`, `Accounting & P&L Reporting`, `Expense Management`, `Chart Theming & Cost Calculations`, `User Auth CRUD`, `Community 22`, `Community 28`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `name`, `short_name`, `description` to the rest of the system?**
  _211 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI Components & Refresh Handlers` be split into smaller, more focused modules?**
  _Cohesion score 0.07654127481713689 - nodes in this community are weakly interconnected._
- **Should `Session & Auth Management` be split into smaller, more focused modules?**
  _Cohesion score 0.06077694235588972 - nodes in this community are weakly interconnected._
- **Should `Inventory & Notification Types` be split into smaller, more focused modules?**
  _Cohesion score 0.05117845117845118 - nodes in this community are weakly interconnected._
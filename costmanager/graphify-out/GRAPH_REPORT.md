# Graph Report - costmanager  (2026-06-30)

## Corpus Check
- 55 files · ~62,669 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 951 nodes · 3078 edges · 47 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `53ad4aa2`
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
- [[_COMMUNITY_Community 46|Community 46]]

## God Nodes (most connected - your core abstractions)
1. `el()` - 159 edges
2. `getDB()` - 111 edges
3. `toPersian()` - 71 edges
4. `showToast()` - 69 edges
5. `formatMoney()` - 51 edges
6. `field()` - 50 edges
7. `nowISO()` - 42 edges
8. `svgIcon()` - 41 edges
9. `bootstrap()` - 31 edges
10. `selectEl()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `renderUsersTab()` --calls--> `render()`  [INFERRED]
  src/views/admin.ts → scripts/gen-icons.js
- `renderInstallSection()` --calls--> `render()`  [INFERRED]
  src/views/settings.ts → scripts/gen-icons.js
- `renderRenewalSection()` --calls--> `render()`  [INFERRED]
  src/views/admin.ts → scripts/gen-icons.js
- `renderSetupWizard()` --calls--> `render()`  [INFERRED]
  src/views/setup.ts → scripts/gen-icons.js
- `NewIngredientInput` --references--> `Ingredient`  [EXTRACTED]
  src/db.ts → src/types.ts

## Import Cycles
- 3-file cycle: `src/db.ts -> src/utils/api.ts -> src/store.ts -> src/db.ts`

## Communities (47 total, 0 thin omitted)

### Community 0 - "UI Components & Refresh Handlers"
Cohesion: 0.21
Nodes (18): openModal(), refreshCustomers(), takeNavigationIntent(), field(), selectEl(), openSupplierFormModal(), openSupplierPaymentFormModal(), openImportModeModal() (+10 more)

### Community 1 - "Session & Auth Management"
Cohesion: 0.05
Nodes (38): adjustLoyaltyPoints(), adjustWalletBalance(), applySyncedRecord(), finalizePayroll(), getAllForSync(), getAllSupplierBalances(), getDB(), getIngredient() (+30 more)

### Community 2 - "Inventory & Notification Types"
Cohesion: 0.12
Nodes (24): refreshEmployees(), refreshExpenses(), expenseMonthlyEquivalent(), monthlyEquivalent(), formatExpenseCategory(), formatExpenseFrequency(), formatPayType(), CHART_COLORS (+16 more)

### Community 3 - "Platform Owner Admin"
Cohesion: 0.27
Nodes (16): refreshSettings(), iconTextBtn(), formatBusinessType(), BeforeInstallPromptEvent, BUSINESS_TYPE_OPTIONS, formatBytes(), renderDataSection(), renderInstallSection() (+8 more)

### Community 4 - "Reactive Store & Shared Components"
Cohesion: 0.15
Nodes (23): addPlatformInvoice(), DEFAULT_PLATFORM_PRICING, deletePlatformInvoice(), getPlatformPaymentCard(), listPlatformBroadcasts(), listPlatformInvoices(), PlatformBroadcastMessage, platformLockedUntil() (+15 more)

### Community 5 - "Database CRUD Operations"
Cohesion: 0.09
Nodes (44): IngredientInUseError, refreshIngredients(), refreshSales(), refreshShoppingList(), MenuItem, scheduleAutomationRun(), buildCashierRows(), buildSnappfoodRows() (+36 more)

### Community 6 - "Modal Component & State Collections"
Cohesion: 0.09
Nodes (39): addSurveyResponse(), createAutomationTrigger(), createCustomer(), createEmployee(), createExpense(), createIngredient(), createMenuItem(), createNotification() (+31 more)

### Community 7 - "Excel Import Parsing"
Cohesion: 0.09
Nodes (24): buildCustomerRows(), CUSTOMER_FIELD_LABELS, CustomerField, CustomerImportRow, formatDateTime(), AUTOMATION_DEFAULT_TEMPLATES, AUTOMATION_DESCRIPTIONS, AUTOMATION_LABELS (+16 more)

### Community 8 - "Toast UI & AI Menu Engineering"
Cohesion: 0.18
Nodes (9): Employee, Expense, RecipeIngredient, avgGrossMarginRatio(), DailyAggregate, dailySeries(), ItemRecipeCostFn, PeriodPL (+1 more)

### Community 9 - "Database Create/Update Ops"
Cohesion: 0.09
Nodes (22): dependencies, chart.js, idb, workbox-core, workbox-precaching, workbox-routing, workbox-strategies, xlsx (+14 more)

### Community 10 - "Accounting & P&L Reporting"
Cohesion: 0.26
Nodes (13): renderAccessDenied(), el(), emptyState(), renderUsersTab(), importCustomersBtn(), renderCustomersTab(), renderLoyaltyTab(), chartCard() (+5 more)

### Community 11 - "Expense Management"
Cohesion: 0.15
Nodes (17): askClaude(), ClaudeApiResponse, ClaudeResult, classifyMenuItems(), MenuEngineeringItem, MenuEngineeringResult, MenuQuadrant, QUADRANT_DESCRIPTIONS (+9 more)

### Community 12 - "Chart Theming & Cost Calculations"
Cohesion: 0.12
Nodes (5): ApiClient, clearTokens(), isOnline(), request(), setTokens()

### Community 13 - "Seed Data Generator"
Cohesion: 0.19
Nodes (14): buildSalesPlan(), computeConsumption(), INGREDIENTS, MENU_ITEMS, PlannedSale, roundQty(), seedDatabase(), seedExpensesAndPayroll() (+6 more)

### Community 14 - "Automation & SMS"
Cohesion: 0.08
Nodes (34): StoreName, automationTriggers, customers, employees, expenses, ingredients, initThemeWatcher(), isOnline (+26 more)

### Community 15 - "CSV/JSON Export & P&L Calc"
Cohesion: 0.08
Nodes (31): Schema, AppNotificationType, AttendanceRecord, AuthConfig, AutomationTriggerType, BulkSaleBreakdownEntry, BusinessSubscriptionStatus, CampaignRecord (+23 more)

### Community 16 - "User Auth CRUD"
Cohesion: 0.12
Nodes (21): refreshSupplierPayments(), refreshSuppliers(), SaleSource, AccountingTab, bySourceBreakdown(), effectiveSource(), ExpenseSubTab, handleDeleteSupplier() (+13 more)

### Community 17 - "Recipe Cost Calculations"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+7 more)

### Community 18 - "Business Subscription Logic"
Cohesion: 0.16
Nodes (18): createNotificationBell(), NOTIFICATION_ROUTE, createSidebar(), navButton(), ROLE_LABELS, Sidebar, SIDEBAR_LINKS, createAppHeader() (+10 more)

### Community 19 - "Ingredient Deletion Guard"
Cohesion: 0.15
Nodes (12): background_color, description, dir, display, icons, lang, name, orientation (+4 more)

### Community 20 - "Sale Recording Types"
Cohesion: 0.23
Nodes (15): attemptLogin(), checkInactivityTimeout(), hasRole(), isSuperadmin(), login(), LoginResult, logout(), logoutWithReason() (+7 more)

### Community 21 - "Service Worker Entry"
Cohesion: 0.32
Nodes (7): getHashPath(), registerRoutes(), renderCurrent(), Route, RouteRender, routes, startRouter()

### Community 22 - "Community 22"
Cohesion: 0.21
Nodes (15): confirmModal(), ensureContainer(), showToast(), ToastType, handleDeleteUser(), handleDeleteCustomer(), handleDeleteEmployee(), handleDeleteExpense() (+7 more)

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
Cohesion: 0.05
Nodes (100): currentUser, hasFullAccess(), RouteCleanup, ingredientsById(), refreshMenuItems(), refreshNotifications(), ExpenseFrequency, Ingredient (+92 more)

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (10): buildManifest(), crypto, entry(), esbuild, fs, hashFile(), main(), minify (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.14
Nodes (18): FullBackup, BUSINESS_TYPE_OPTIONS, EXTEND_OPTIONS, PLAN_OPTIONS, PLAN_TOTAL_DAYS, renderAdmin(), renderBackupSection(), renderBusinessSection() (+10 more)

### Community 29 - "Community 29"
Cohesion: 0.13
Nodes (15): cacheApiUser(), changeSuperadminPassword(), createUser(), deleteUser(), findUserByUsername(), getAuthConfig(), getUser(), hasSuperadmin() (+7 more)

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (9): اسکریپت‌ها, ذخیره‌سازی و حریم خصوصی, ساختار پروژه, منوبان — MenuBan CostManager, نصب و اجرا, همگام‌سازی چند دستگاهی, ویژگی‌ها, پشته فنی (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.12
Nodes (26): takeSessionExpiredReason(), AlertBannerOptions, createAlertBanner(), dismissedThisSession, ALL_ROUTES, bootstrap(), handleLogoutClick(), maybeShowPlatformBroadcast() (+18 more)

### Community 32 - "Community 32"
Cohesion: 0.15
Nodes (13): SessionUser, createAppNav(), NAV_ITEMS, NavItem, SidebarLink, NewUserInput, UpdateUserInput, currentPath (+5 more)

### Community 33 - "Community 33"
Cohesion: 0.12
Nodes (16): PlatformInvoice, PaidSubscriptionPlan, SubscriptionPaymentStatus, ApiBroadcast, ApiBusiness, ApiPlatformBusiness, ApiPlatformMetrics, ApiPricingRow (+8 more)

### Community 34 - "Community 34"
Cohesion: 0.12
Nodes (17): deleteAttendance(), deleteAutomationTrigger(), deleteCustomer(), deleteEmployee(), deleteExpense(), deleteIngredient(), deleteMenuItem(), deletePayrollRecord() (+9 more)

### Community 35 - "Community 35"
Cohesion: 0.18
Nodes (10): RegisterBusinessInput, getPlatformPricing(), BusinessType, SubscriptionPlan, api, ApiError, BUSINESS_TYPE_OPTIONS, PLAN_OPTIONS (+2 more)

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (10): addMonthsISO(), deleteSale(), effectivePointsPerToman(), extendBusinessSubscription(), getSettings(), importAllData(), registerBusiness(), reverseCustomerVisit() (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.26
Nodes (11): monthlyFixedCost(), periodProfitLoss(), salesInPeriod(), downloadBlob(), downloadCSV(), downloadJSON(), readFileAsJSON(), shareOrCopyText() (+3 more)

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
Cohesion: 0.25
Nodes (8): applyChartTheme(), cssVar(), destroyChart(), instances, palette, renderChart(), sourceBreakdownPanel(), sourceBreakdownRow()

### Community 42 - "Community 42"
Cohesion: 0.24
Nodes (7): featureCard(), FEATURES, LandingCallbacks, renderLandingPage(), authShell(), renderAuthGate(), renderLoginForm()

### Community 43 - "Community 43"
Cohesion: 0.43
Nodes (7): render(), daysUntilBusinessExpiry(), isBusinessExpired(), isBusinessExpiringSoon(), renderRenewalSection(), renderSubscriptionsTab(), renderSetupWizard()

### Community 44 - "Community 44"
Cohesion: 0.06
Nodes (38): BACKUP_STORE_NAMES, DEFAULT_SETTINGS, getCustomer(), getPettyCashBalance(), isDatabaseEmpty(), listAttendance(), listPettyCash(), listSalaryAdvances() (+30 more)

### Community 46 - "Community 46"
Cohesion: 0.50
Nodes (3): ConfirmOptions, ModalHandle, ModalOptions

## Knowledge Gaps
- **218 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `scope` (+213 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `Accounting & P&L Reporting` to `UI Components & Refresh Handlers`, `Inventory & Notification Types`, `Platform Owner Admin`, `Reactive Store & Shared Components`, `Community 37`, `Database CRUD Operations`, `Excel Import Parsing`, `Community 35`, `Community 41`, `Community 42`, `Community 43`, `Expense Management`, `User Auth CRUD`, `Business Subscription Logic`, `Community 22`, `Community 26`, `Community 28`, `Community 31`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `ApiClient` connect `Chart Theming & Cost Calculations` to `Community 32`, `Community 33`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `toPersian()` connect `Community 26` to `Community 32`, `UI Components & Refresh Handlers`, `Platform Owner Admin`, `Reactive Store & Shared Components`, `Database CRUD Operations`, `Community 35`, `Excel Import Parsing`, `Community 41`, `Accounting & P&L Reporting`, `Community 43`, `Expense Management`, `User Auth CRUD`, `Community 24`, `Community 28`, `Community 31`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `name`, `short_name`, `description` to the rest of the system?**
  _218 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Session & Auth Management` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `Inventory & Notification Types` be split into smaller, more focused modules?**
  _Cohesion score 0.12333333333333334 - nodes in this community are weakly interconnected._
- **Should `Reactive Store & Shared Components` be split into smaller, more focused modules?**
  _Cohesion score 0.14814814814814814 - nodes in this community are weakly interconnected._
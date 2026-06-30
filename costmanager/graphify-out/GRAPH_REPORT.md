# Graph Report - costmanager  (2026-06-30)

## Corpus Check
- 56 files · ~66,872 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 999 nodes · 3309 edges · 53 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `85be8e44`
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
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]

## God Nodes (most connected - your core abstractions)
1. `el()` - 183 edges
2. `getDB()` - 111 edges
3. `showToast()` - 85 edges
4. `toPersian()` - 72 edges
5. `formatMoney()` - 62 edges
6. `field()` - 59 edges
7. `nowISO()` - 42 edges
8. `svgIcon()` - 41 edges
9. `openModal()` - 38 edges
10. `selectEl()` - 37 edges

## Surprising Connections (you probably didn't know these)
- `renderUsersTab()` --calls--> `render()`  [INFERRED]
  src/views/admin.ts → scripts/gen-icons.js
- `renderInstallSection()` --calls--> `render()`  [INFERRED]
  src/views/settings.ts → scripts/gen-icons.js
- `renderSubscriptionSection()` --calls--> `render()`  [INFERRED]
  src/views/settings.ts → scripts/gen-icons.js
- `renderSetupWizard()` --calls--> `render()`  [INFERRED]
  src/views/setup.ts → scripts/gen-icons.js
- `renderFixedVariableTab()` --calls--> `el()`  [EXTRACTED]
  src/views/accounting.ts → src/utils/dom.ts

## Import Cycles
- 3-file cycle: `src/db.ts -> src/utils/api.ts -> src/store.ts -> src/db.ts`

## Communities (53 total, 0 thin omitted)

### Community 0 - "UI Components & Refresh Handlers"
Cohesion: 0.20
Nodes (17): iconTextBtn(), formatBusinessType(), pullFromServer(), pushToServer(), syncNow(), BUSINESS_TYPE_OPTIONS, renderBackupSection(), renderBusinessSection() (+9 more)

### Community 1 - "Session & Auth Management"
Cohesion: 0.05
Nodes (39): adjustLoyaltyPoints(), adjustWalletBalance(), applySyncedRecord(), getAllForSync(), getAllSupplierBalances(), getDB(), getIngredient(), getLeaveBalance() (+31 more)

### Community 2 - "Inventory & Notification Types"
Cohesion: 0.27
Nodes (23): openModal(), refreshCustomers(), field(), numberInput(), parseNumberInput(), selectEl(), openPettyCashFormModal(), openRecordSupplierTransactionModal() (+15 more)

### Community 3 - "Platform Owner Admin"
Cohesion: 0.11
Nodes (23): ConfirmOptions, ModalHandle, ModalOptions, refreshEmployees(), PayrollStatus, SalaryAdvanceStatus, formatPayType(), toggleEmployeeActive() (+15 more)

### Community 4 - "Reactive Store & Shared Components"
Cohesion: 0.14
Nodes (26): openPlatformOwnerOverlay(), addPlatformInvoice(), DEFAULT_PLATFORM_PRICING, deletePlatformInvoice(), getPlatformPaymentCard(), listPlatformBroadcasts(), listPlatformInvoices(), PlatformBroadcastMessage (+18 more)

### Community 5 - "Database CRUD Operations"
Cohesion: 0.08
Nodes (33): IngredientInUseError, MenuItem, buildCashierRows(), buildSnappfoodRows(), CASHIER_FIELD_LABELS, CASHIER_KEYWORDS, CashierField, CashierImportRow (+25 more)

### Community 6 - "Modal Component & State Collections"
Cohesion: 0.09
Nodes (40): addSurveyResponse(), createAutomationTrigger(), createCustomer(), createEmployee(), createExpense(), createIngredient(), createMenuItem(), createNotification() (+32 more)

### Community 7 - "Excel Import Parsing"
Cohesion: 0.09
Nodes (19): AutomationTriggerType, buildCustomerRows(), CustomerImportRow, ParsedSheet, AUTOMATION_DEFAULT_TEMPLATES, AUTOMATION_DESCRIPTIONS, AUTOMATION_LABELS, AUTOMATION_TYPES (+11 more)

### Community 8 - "Toast UI & AI Menu Engineering"
Cohesion: 0.15
Nodes (23): refreshMenuItems(), RecipeIngredient, avgFoodCostPct(), DailyAggregate, expenseMonthlyEquivalent(), foodCostPct(), foodCostStatus, grossProfit() (+15 more)

### Community 9 - "Database Create/Update Ops"
Cohesion: 0.09
Nodes (22): dependencies, chart.js, idb, workbox-core, workbox-precaching, workbox-routing, workbox-strategies, xlsx (+14 more)

### Community 10 - "Accounting & P&L Reporting"
Cohesion: 0.18
Nodes (12): navigationIntent, dailyBreakEven(), RFM_SEGMENT_ORDER, breakEvenPanel(), breakEvenPanel(), chartCard(), OnboardingStep, quickActionBtn() (+4 more)

### Community 11 - "Expense Management"
Cohesion: 0.15
Nodes (17): askClaude(), ClaudeApiResponse, ClaudeResult, classifyMenuItems(), MenuEngineeringItem, MenuEngineeringResult, MenuQuadrant, QUADRANT_DESCRIPTIONS (+9 more)

### Community 12 - "Chart Theming & Cost Calculations"
Cohesion: 0.12
Nodes (5): ApiClient, clearTokens(), isOnline(), request(), setTokens()

### Community 13 - "Seed Data Generator"
Cohesion: 0.25
Nodes (4): Listener, lowStockCount(), signal, unreadNotificationCount()

### Community 14 - "Automation & SMS"
Cohesion: 0.15
Nodes (20): StoreName, automationTriggers, customers, employees, expenses, ingredients, isOnline, menuItems (+12 more)

### Community 15 - "CSV/JSON Export & P&L Calc"
Cohesion: 0.09
Nodes (31): Schema, AppNotification, AppNotificationType, AttendanceRecord, AuthConfig, AutomationTrigger, BulkSaleBreakdownEntry, BusinessSubscriptionStatus (+23 more)

### Community 16 - "User Auth CRUD"
Cohesion: 0.10
Nodes (29): renderChart(), PettyCashRequestStatus, avgGrossMarginRatio(), dailySeries(), monthlyFixedCost(), periodProfitLoss(), salesInPeriod(), AccountingTab (+21 more)

### Community 17 - "Recipe Cost Calculations"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+7 more)

### Community 18 - "Business Subscription Logic"
Cohesion: 0.27
Nodes (10): createNotificationBell(), createSidebar(), navButton(), ROLE_LABELS, Sidebar, SIDEBAR_LINKS, createAppHeader(), showBootError() (+2 more)

### Community 19 - "Ingredient Deletion Guard"
Cohesion: 0.15
Nodes (12): background_color, description, dir, display, icons, lang, name, orientation (+4 more)

### Community 20 - "Sale Recording Types"
Cohesion: 0.15
Nodes (11): getPlatformPricing(), PlatformInvoice, BusinessType, PaidSubscriptionPlan, api, ApiError, ApiPricingRow, BUSINESS_TYPE_OPTIONS (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.11
Nodes (41): renderAccessDenied(), el(), emptyState(), iconBtn(), formatDateShort(), formatMoney(), renderPettyCashRow(), renderSupplierPaymentRow() (+33 more)

### Community 22 - "Community 22"
Cohesion: 0.26
Nodes (13): checkInactivityTimeout(), isSuperadmin(), login(), LoginResult, logout(), logoutWithReason(), readSession(), recordActivity() (+5 more)

### Community 23 - "Community 23"
Cohesion: 0.21
Nodes (11): NewIngredientInput, ConsumptionRecord, Ingredient, Sale, WasteEntry, buildContext(), computeDailyConsumption(), computeEstimation() (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.33
Nodes (4): { chromium }, fs, OUT_DIR, path

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+4 more)

### Community 26 - "Community 26"
Cohesion: 0.16
Nodes (21): currentUser, hasFullAccess(), hasRole(), takeNavigationIntent(), PurchaseRecord, inventoryValue(), lowStockIngredients(), kpiCard() (+13 more)

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (10): buildManifest(), crypto, entry(), esbuild, fs, hashFile(), main(), minify (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.08
Nodes (31): buildSalesPlan(), computeConsumption(), INGREDIENTS, MENU_ITEMS, PlannedSale, roundQty(), seedDatabase(), seedExpensesAndPayroll() (+23 more)

### Community 29 - "Community 29"
Cohesion: 0.16
Nodes (21): confirmModal(), ensureContainer(), showToast(), ToastType, handleLogoutClick(), handleDeletePettyCash(), handleDeleteSupplier(), handleDeleteSupplierPayment() (+13 more)

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (9): اسکریپت‌ها, ذخیره‌سازی و حریم خصوصی, ساختار پروژه, منوبان — MenuBan CostManager, نصب و اجرا, همگام‌سازی چند دستگاهی, ویژگی‌ها, پشته فنی (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.15
Nodes (23): takeSessionExpiredReason(), createAppNav(), ALL_ROUTES, bootstrap(), createBreadcrumb(), maybeShowPlatformBroadcast(), renderExpiredScreen(), SYNC_STATUS_ICON_NAME (+15 more)

### Community 32 - "Community 32"
Cohesion: 0.12
Nodes (15): SessionUser, NAV_ITEMS, NavItem, SidebarLink, NewUserInput, UpdateUserInput, currentPath, UserRole (+7 more)

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (16): refreshSettings(), FullBackup, BeforeInstallPromptEvent, BUSINESS_TYPE_OPTIONS, PLAN_OPTIONS, PLAN_TOTAL_DAYS, renderDataSection(), renderInstallSection() (+8 more)

### Community 34 - "Community 34"
Cohesion: 0.12
Nodes (17): deleteAttendance(), deleteAutomationTrigger(), deleteCustomer(), deleteEmployee(), deleteExpense(), deleteIngredient(), deleteMenuItem(), deletePayrollRecord() (+9 more)

### Community 35 - "Community 35"
Cohesion: 0.32
Nodes (17): refreshIngredients(), refreshSales(), refreshShoppingList(), scheduleAutomationRun(), parseSpreadsheetFile(), todayISO(), scheduleRecalculation(), scheduleRfmRecalculation() (+9 more)

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (10): addMonthsISO(), deleteSale(), effectivePointsPerToman(), extendBusinessSubscription(), getSettings(), importAllData(), registerBusiness(), reverseCustomerVisit() (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.12
Nodes (18): applyChartTheme(), cssVar(), destroyChart(), instances, palette, formatExpenseCategory(), renderReportTab(), CHART_COLORS (+10 more)

### Community 38 - "Community 38"
Cohesion: 0.32
Nodes (6): Customer, RFMScore, RFMSegment, assignSegment(), quintileScores(), recalculateAllRfm()

### Community 39 - "Community 39"
Cohesion: 0.33
Nodes (5): DEST_DIR, fs, path, SRC_DIR, WEIGHTS

### Community 40 - "Community 40"
Cohesion: 0.14
Nodes (25): ingredientsById(), refreshNotifications(), formatDate(), formatUnit(), toPersian(), ALERT_ROLES, checkStockAlertsAndNotify(), lowStockMessage() (+17 more)

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (13): SubscriptionPaymentStatus, ApiBroadcast, ApiBusiness, ApiPlatformBusiness, ApiPlatformMetrics, ApiSubscriptionPayment, AuthResult, getAccessToken() (+5 more)

### Community 42 - "Community 42"
Cohesion: 0.26
Nodes (11): applyTemplate(), isEligible(), recencyDaysFor(), runAutomationTriggers(), withinCooldown(), fetchWithTimeout(), KavenegarConfig, KavenegarResponse (+3 more)

### Community 43 - "Community 43"
Cohesion: 0.20
Nodes (12): refreshAll(), refreshAutomationTriggers(), refreshExpenses(), refreshSmsLogs(), refreshSupplierPayments(), refreshSuppliers(), formatDateTime(), toggleSupplierPaymentPaid() (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.06
Nodes (48): BACKUP_STORE_NAMES, cacheApiUser(), changeSuperadminPassword(), DEFAULT_SETTINGS, deleteUser(), finalizePayroll(), findUserByUsername(), getAuthConfig() (+40 more)

### Community 46 - "Community 46"
Cohesion: 0.29
Nodes (9): AlertBannerOptions, createAlertBanner(), dismissedThisSession, watchForUpdates(), checkLowStockAndNotify(), lowStockMessage(), notifiedIds, notifyBrowser() (+1 more)

### Community 47 - "Community 47"
Cohesion: 0.25
Nodes (9): NOTIFICATION_ROUTE, getHashPath(), navigate(), renderCurrent(), Route, RouteCleanup, RouteRender, routes (+1 more)

### Community 48 - "Community 48"
Cohesion: 0.27
Nodes (7): attemptLogin(), featureCard(), FEATURES, LandingCallbacks, renderLandingPage(), authShell(), renderLoginForm()

### Community 49 - "Community 49"
Cohesion: 0.36
Nodes (6): downloadBlob(), downloadCSV(), downloadJSON(), readFileAsJSON(), shareOrCopyText(), toCSV()

### Community 50 - "Community 50"
Cohesion: 0.53
Nodes (6): render(), daysUntilBusinessExpiry(), isBusinessExpired(), isBusinessExpiringSoon(), renderSubscriptionSection(), renderSetupWizard()

### Community 51 - "Community 51"
Cohesion: 0.40
Nodes (6): RecordImportedSaleInput, RecordSaleInput, DeliveryInfo, OrderType, SaleSource, SourceBreakdownEntry

### Community 52 - "Community 52"
Cohesion: 0.67
Nodes (4): formatRfmSegment(), rfmSegmentIcon(), renderSegmentsTab(), rfmSegmentBadge()

## Knowledge Gaps
- **227 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `scope` (+222 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `Community 21` to `UI Components & Refresh Handlers`, `Inventory & Notification Types`, `Platform Owner Admin`, `Reactive Store & Shared Components`, `Database CRUD Operations`, `Excel Import Parsing`, `Toast UI & AI Menu Engineering`, `Accounting & P&L Reporting`, `Expense Management`, `User Auth CRUD`, `Business Subscription Logic`, `Sale Recording Types`, `Community 26`, `Community 29`, `Community 31`, `Community 32`, `Community 33`, `Community 35`, `Community 37`, `Community 40`, `Community 43`, `Community 47`, `Community 48`, `Community 50`, `Community 52`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `ApiClient` connect `Chart Theming & Cost Calculations` to `Community 32`, `Community 41`, `Sale Recording Types`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 29` to `UI Components & Refresh Handlers`, `Community 33`, `Inventory & Notification Types`, `Platform Owner Admin`, `Community 35`, `Community 37`, `Reactive Store & Shared Components`, `Excel Import Parsing`, `Toast UI & AI Menu Engineering`, `Database CRUD Operations`, `Community 40`, `Community 43`, `Expense Management`, `Automation & SMS`, `User Auth CRUD`, `Community 21`, `Community 26`, `Community 31`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `name`, `short_name`, `description` to the rest of the system?**
  _227 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Session & Auth Management` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `Platform Owner Admin` be split into smaller, more focused modules?**
  _Cohesion score 0.10666666666666667 - nodes in this community are weakly interconnected._
- **Should `Reactive Store & Shared Components` be split into smaller, more focused modules?**
  _Cohesion score 0.13793103448275862 - nodes in this community are weakly interconnected._
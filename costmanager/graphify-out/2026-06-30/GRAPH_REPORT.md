# Graph Report - costmanager  (2026-06-30)

## Corpus Check
- 56 files · ~66,262 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 997 nodes · 3286 edges · 49 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c51a3f64`
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

## God Nodes (most connected - your core abstractions)
1. `el()` - 181 edges
2. `getDB()` - 111 edges
3. `showToast()` - 84 edges
4. `toPersian()` - 73 edges
5. `formatMoney()` - 61 edges
6. `field()` - 56 edges
7. `nowISO()` - 42 edges
8. `svgIcon()` - 41 edges
9. `openModal()` - 36 edges
10. `confirmModal()` - 36 edges

## Surprising Connections (you probably didn't know these)
- `renderInstallSection()` --calls--> `render()`  [INFERRED]
  src/views/settings.ts → scripts/gen-icons.js
- `renderRenewalSection()` --calls--> `render()`  [INFERRED]
  src/views/admin.ts → scripts/gen-icons.js
- `renderUsersTab()` --calls--> `render()`  [INFERRED]
  src/views/admin.ts → scripts/gen-icons.js
- `renderSetupWizard()` --calls--> `render()`  [INFERRED]
  src/views/setup.ts → scripts/gen-icons.js
- `renderFixedVariableTab()` --calls--> `el()`  [EXTRACTED]
  src/views/accounting.ts → src/utils/dom.ts

## Import Cycles
- 3-file cycle: `src/db.ts -> src/utils/api.ts -> src/store.ts -> src/db.ts`

## Communities (49 total, 0 thin omitted)

### Community 0 - "UI Components & Refresh Handlers"
Cohesion: 0.27
Nodes (29): openModal(), showToast(), refreshCustomers(), field(), numberInput(), parseNumberInput(), selectEl(), openPettyCashFormModal() (+21 more)

### Community 1 - "Session & Auth Management"
Cohesion: 0.05
Nodes (38): adjustLoyaltyPoints(), adjustWalletBalance(), getAllForSync(), getAllSupplierBalances(), getCustomer(), getDB(), getIngredient(), getMenuItem() (+30 more)

### Community 2 - "Inventory & Notification Types"
Cohesion: 0.12
Nodes (22): refreshExpenses(), ExpenseFrequency, expenseMonthlyEquivalent(), monthlyEquivalent(), formatExpenseCategory(), formatExpenseFrequency(), formatPayType(), CHART_COLORS (+14 more)

### Community 3 - "Platform Owner Admin"
Cohesion: 0.16
Nodes (29): refreshAll(), refreshAutomationTriggers(), refreshSettings(), Theme, iconTextBtn(), formatBusinessType(), formatDateTime(), renderBackupSection() (+21 more)

### Community 4 - "Reactive Store & Shared Components"
Cohesion: 0.13
Nodes (28): openPlatformOwnerOverlay(), addPlatformInvoice(), DEFAULT_PLATFORM_PRICING, deletePlatformInvoice(), getPlatformPaymentCard(), listPlatformBroadcasts(), listPlatformInvoices(), PlatformBroadcastMessage (+20 more)

### Community 5 - "Database CRUD Operations"
Cohesion: 0.12
Nodes (20): buildCustomerRows(), buildSnappfoodRows(), CASHIER_KEYWORDS, CUSTOMER_FIELD_LABELS, CUSTOMER_KEYWORDS, CustomerField, CustomerImportRow, detectCashierColumns() (+12 more)

### Community 6 - "Modal Component & State Collections"
Cohesion: 0.09
Nodes (40): addSurveyResponse(), createAutomationTrigger(), createCustomer(), createEmployee(), createExpense(), createIngredient(), createMenuItem(), createNotification() (+32 more)

### Community 7 - "Excel Import Parsing"
Cohesion: 0.09
Nodes (20): AutomationTriggerType, rfmSegmentIcon(), AUTOMATION_DEFAULT_TEMPLATES, AUTOMATION_DESCRIPTIONS, AUTOMATION_LABELS, AUTOMATION_TYPES, CUSTOMER_IMPORT_FIELDS, DuplicateAction (+12 more)

### Community 8 - "Toast UI & AI Menu Engineering"
Cohesion: 0.17
Nodes (11): RecipeIngredient, avgFoodCostPct(), avgGrossMarginRatio(), DailyAggregate, foodCostPct(), grossProfit(), ItemRecipeCostFn, PeriodPL (+3 more)

### Community 9 - "Database Create/Update Ops"
Cohesion: 0.09
Nodes (22): dependencies, chart.js, idb, workbox-core, workbox-precaching, workbox-routing, workbox-strategies, xlsx (+14 more)

### Community 10 - "Accounting & P&L Reporting"
Cohesion: 0.11
Nodes (25): confirmModal(), refreshSuppliers(), PayrollStatus, SalaryAdvanceStatus, formatDate(), handleDeleteSupplier(), ADVANCE_STATUS_LABELS, ADVANCE_STATUS_TONE (+17 more)

### Community 11 - "Expense Management"
Cohesion: 0.13
Nodes (19): IngredientInUseError, MenuItem, askClaude(), ClaudeApiResponse, ClaudeResult, foodCostStatus, ItemMatch, classifyMenuItems() (+11 more)

### Community 12 - "Chart Theming & Cost Calculations"
Cohesion: 0.06
Nodes (26): SessionUser, NewUserInput, UpdateUserInput, PlatformInvoice, PaidSubscriptionPlan, SubscriptionPaymentStatus, UserRole, ApiBroadcast (+18 more)

### Community 13 - "Seed Data Generator"
Cohesion: 0.17
Nodes (7): NOTIFICATION_ROUTE, Listener, lowStockCount(), notifications, signal, takeNavigationIntent(), unreadNotificationCount()

### Community 14 - "Automation & SMS"
Cohesion: 0.11
Nodes (30): StoreName, automationTriggers, customers, employees, expenses, isOnline, menuItems, navigationIntent (+22 more)

### Community 15 - "CSV/JSON Export & P&L Calc"
Cohesion: 0.10
Nodes (29): Schema, AppNotification, AppNotificationType, AttendanceRecord, AuthConfig, BulkSaleBreakdownEntry, BusinessSubscriptionStatus, CampaignRecord (+21 more)

### Community 16 - "User Auth CRUD"
Cohesion: 0.08
Nodes (28): renderChart(), refreshSupplierPayments(), PettyCashRequestStatus, SaleSource, AccountingTab, bySourceBreakdown(), effectiveSource(), ExpenseSubTab (+20 more)

### Community 17 - "Recipe Cost Calculations"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+7 more)

### Community 18 - "Business Subscription Logic"
Cohesion: 0.21
Nodes (12): NAV_ITEMS, currentPath, getHashPath(), navigate(), renderCurrent(), Route, RouteCleanup, RouteRender (+4 more)

### Community 19 - "Ingredient Deletion Guard"
Cohesion: 0.15
Nodes (12): background_color, description, dir, display, icons, lang, name, orientation (+4 more)

### Community 20 - "Sale Recording Types"
Cohesion: 0.05
Nodes (51): { chromium }, fs, OUT_DIR, path, render(), attemptLogin(), checkInactivityTimeout(), daysUntilBusinessExpiry() (+43 more)

### Community 21 - "Community 21"
Cohesion: 0.16
Nodes (31): el(), iconBtn(), formatDateShort(), formatMoney(), renderPettyCashRow(), renderSupplierPaymentRow(), renderSupplierRow(), renderSupplierTransactionRow() (+23 more)

### Community 22 - "Community 22"
Cohesion: 0.16
Nodes (16): currentUser, hasFullAccess(), hasRole(), ensureContainer(), ToastType, refreshMenuItems(), inventoryValue(), lowStockIngredients() (+8 more)

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
Cohesion: 0.11
Nodes (34): renderAccessDenied(), ingredientsById(), refreshSmsLogs(), emptyState(), kpiCard(), formatIngredientCategory(), formatMoneyShort(), formatRfmSegment() (+26 more)

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (10): buildManifest(), crypto, entry(), esbuild, fs, hashFile(), main(), minify (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.12
Nodes (15): BUSINESS_TYPE_LABELS, dateFmt, dateShortFmt, dateTimeFmt, EXPENSE_CATEGORY_LABELS, EXPENSE_FREQUENCY_LABELS, INGREDIENT_CATEGORY_LABELS, moneyFmt (+7 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (15): buildSalesPlan(), computeConsumption(), INGREDIENTS, MENU_ITEMS, PlannedSale, roundQty(), seedDatabase(), seedExpensesAndPayroll() (+7 more)

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (9): اسکریپت‌ها, ذخیره‌سازی و حریم خصوصی, ساختار پروژه, منوبان — MenuBan CostManager, نصب و اجرا, همگام‌سازی چند دستگاهی, ویژگی‌ها, پشته فنی (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.17
Nodes (21): takeSessionExpiredReason(), createAlertBanner(), createAppNav(), createNotificationBell(), ALL_ROUTES, bootstrap(), createAppHeader(), createBreadcrumb() (+13 more)

### Community 32 - "Community 32"
Cohesion: 0.12
Nodes (20): NavItem, createSidebar(), navButton(), ROLE_LABELS, Sidebar, SIDEBAR_LINKS, SidebarLink, showBootError() (+12 more)

### Community 33 - "Community 33"
Cohesion: 0.13
Nodes (14): buildCashierRows(), CASHIER_FIELD_LABELS, CashierField, CashierImportRow, MatchType, ParsedSheet, parseSpreadsheetFile(), SnappfoodImportRow (+6 more)

### Community 34 - "Community 34"
Cohesion: 0.12
Nodes (17): deleteAttendance(), deleteAutomationTrigger(), deleteCustomer(), deleteEmployee(), deleteExpense(), deleteIngredient(), deleteMenuItem(), deletePayrollRecord() (+9 more)

### Community 35 - "Community 35"
Cohesion: 0.38
Nodes (14): refreshIngredients(), refreshSales(), refreshShoppingList(), scheduleAutomationRun(), todayISO(), scheduleRecalculation(), scheduleRfmRecalculation(), handleDelete() (+6 more)

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (10): addMonthsISO(), deleteSale(), effectivePointsPerToman(), extendBusinessSubscription(), getSettings(), importAllData(), registerBusiness(), reverseCustomerVisit() (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.23
Nodes (12): dailySeries(), monthlyFixedCost(), periodProfitLoss(), salesInPeriod(), downloadBlob(), downloadCSV(), downloadJSON(), readFileAsJSON() (+4 more)

### Community 38 - "Community 38"
Cohesion: 0.32
Nodes (6): Customer, RFMScore, RFMSegment, assignSegment(), quintileScores(), recalculateAllRfm()

### Community 39 - "Community 39"
Cohesion: 0.33
Nodes (5): DEST_DIR, fs, path, SRC_DIR, WEIGHTS

### Community 40 - "Community 40"
Cohesion: 0.25
Nodes (10): NewIngredientInput, refreshNotifications(), Ingredient, ALERT_ROLES, checkStockAlertsAndNotify(), lowStockMessage(), notifiedLowStock, notifiedStockout (+2 more)

### Community 41 - "Community 41"
Cohesion: 0.40
Nodes (5): applyChartTheme(), cssVar(), destroyChart(), instances, palette

### Community 42 - "Community 42"
Cohesion: 0.29
Nodes (8): AlertBannerOptions, dismissedThisSession, settings, checkLowStockAndNotify(), lowStockMessage(), notifiedIds, notifyBrowser(), notifyInApp()

### Community 43 - "Community 43"
Cohesion: 0.25
Nodes (8): dailyBreakEven(), formatPct(), trimmed(), breakEvenPanel(), plRow(), plStatement(), breakEvenPanel(), buildAiPrompt()

### Community 44 - "Community 44"
Cohesion: 0.06
Nodes (48): applySyncedRecord(), BACKUP_STORE_NAMES, cacheApiUser(), changeSuperadminPassword(), createUser(), DEFAULT_SETTINGS, deleteUser(), finalizePayroll() (+40 more)

### Community 46 - "Community 46"
Cohesion: 0.50
Nodes (3): ConfirmOptions, ModalHandle, ModalOptions

### Community 47 - "Community 47"
Cohesion: 0.67
Nodes (4): RecordImportedSaleInput, RecordSaleInput, DeliveryInfo, OrderType

### Community 48 - "Community 48"
Cohesion: 0.50
Nodes (4): refreshEmployees(), handleDeleteEmployee(), toggleEmployeeActive(), renderHr()

## Knowledge Gaps
- **228 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `scope` (+223 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `Community 21` to `UI Components & Refresh Handlers`, `Inventory & Notification Types`, `Platform Owner Admin`, `Reactive Store & Shared Components`, `Excel Import Parsing`, `Toast UI & AI Menu Engineering`, `Accounting & P&L Reporting`, `Expense Management`, `Seed Data Generator`, `Automation & SMS`, `User Auth CRUD`, `Business Subscription Logic`, `Sale Recording Types`, `Community 22`, `Community 26`, `Community 31`, `Community 32`, `Community 33`, `Community 35`, `Community 37`, `Community 43`, `Community 48`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `showToast()` connect `UI Components & Refresh Handlers` to `Community 33`, `Inventory & Notification Types`, `Platform Owner Admin`, `Community 35`, `Reactive Store & Shared Components`, `Excel Import Parsing`, `Accounting & P&L Reporting`, `Expense Management`, `Automation & SMS`, `User Auth CRUD`, `Community 48`, `Sale Recording Types`, `Community 21`, `Community 22`, `Community 26`, `Community 31`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `name`, `short_name`, `description` to the rest of the system?**
  _228 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Session & Auth Management` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Should `Inventory & Notification Types` be split into smaller, more focused modules?**
  _Cohesion score 0.11857707509881422 - nodes in this community are weakly interconnected._
- **Should `Reactive Store & Shared Components` be split into smaller, more focused modules?**
  _Cohesion score 0.13306451612903225 - nodes in this community are weakly interconnected._
- **Should `Database CRUD Operations` be split into smaller, more focused modules?**
  _Cohesion score 0.12121212121212122 - nodes in this community are weakly interconnected._
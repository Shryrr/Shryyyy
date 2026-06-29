# Graph Report - src  (2026-06-29)

## Corpus Check
- Corpus is ~48,051 words - fits in a single context window. You may not need a graph.

## Summary
- 742 nodes · 2622 edges · 22 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Session & Auth Management|Session & Auth Management]]
- [[_COMMUNITY_Platform Owner Admin|Platform Owner Admin]]
- [[_COMMUNITY_Chart Theming & Cost Calculations|Chart Theming & Cost Calculations]]
- [[_COMMUNITY_Accounting & P&L Reporting|Accounting & P&L Reporting]]
- [[_COMMUNITY_Modal Component & State Collections|Modal Component & State Collections]]
- [[_COMMUNITY_UI Components & Refresh Handlers|UI Components & Refresh Handlers]]
- [[_COMMUNITY_Reactive Store & Shared Components|Reactive Store & Shared Components]]
- [[_COMMUNITY_Toast UI & AI Menu Engineering|Toast UI & AI Menu Engineering]]
- [[_COMMUNITY_Database CRUD Operations|Database CRUD Operations]]
- [[_COMMUNITY_Database CreateUpdate Ops|Database Create/Update Ops]]
- [[_COMMUNITY_Ingredient Deletion Guard|Ingredient Deletion Guard]]
- [[_COMMUNITY_Sale Recording Types|Sale Recording Types]]
- [[_COMMUNITY_Business Subscription Logic|Business Subscription Logic]]
- [[_COMMUNITY_User Auth CRUD|User Auth CRUD]]
- [[_COMMUNITY_Inventory & Notification Types|Inventory & Notification Types]]
- [[_COMMUNITY_Seed Data Generator|Seed Data Generator]]
- [[_COMMUNITY_Expense Management|Expense Management]]
- [[_COMMUNITY_Excel Import Parsing|Excel Import Parsing]]
- [[_COMMUNITY_Recipe Cost Calculations|Recipe Cost Calculations]]
- [[_COMMUNITY_Automation & SMS|Automation & SMS]]
- [[_COMMUNITY_CSVJSON Export & P&L Calc|CSV/JSON Export & P&L Calc]]

## God Nodes (most connected - your core abstractions)
1. `el()` - 152 edges
2. `getDB()` - 81 edges
3. `toPersian()` - 75 edges
4. `showToast()` - 67 edges
5. `formatMoney()` - 50 edges
6. `field()` - 47 edges
7. `nowISO()` - 32 edges
8. `selectEl()` - 30 edges
9. `bootstrap()` - 29 edges
10. `numberInput()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `showBootError()` --calls--> `el()`  [EXTRACTED]
  main.ts → utils/dom.ts
- `el()` --calls--> `renderFixedVariableTab()`  [EXTRACTED]
  utils/dom.ts → views/accounting.ts
- `el()` --calls--> `renderSupplierRow()`  [EXTRACTED]
  utils/dom.ts → views/accounting.ts
- `el()` --calls--> `renderSuppliersVatTab()`  [EXTRACTED]
  utils/dom.ts → views/accounting.ts
- `el()` --calls--> `chartCard()`  [EXTRACTED]
  utils/dom.ts → views/dashboard.ts

## Import Cycles
- None detected.

## Communities (22 total, 0 thin omitted)

### Community 1 - "Session & Auth Management"
Cohesion: 0.05
Nodes (73): SessionUser, currentUser, readSession(), writeSession(), restoreSession(), logout(), logoutWithReason(), takeSessionExpiredReason() (+65 more)

### Community 3 - "Platform Owner Admin"
Cohesion: 0.06
Nodes (62): login(), openPlatformOwnerOverlay(), getPlatformPin(), isDefaultPlatformPin(), verifyPlatformPin(), setPlatformPin(), setPlatformOwnerSession(), PlatformPricing (+54 more)

### Community 12 - "Chart Theming & Cost Calculations"
Cohesion: 0.14
Nodes (16): cssVar(), palette, applyChartTheme(), instances, destroyChart(), suppliers, navigationIntent, dailyBreakEven() (+8 more)

### Community 10 - "Accounting & P&L Reporting"
Cohesion: 0.10
Nodes (24): renderChart(), supplierPayments, refreshSupplierPayments(), SaleSource, AccountingTab, PERIOD_OPTIONS, plRow(), plStatement() (+16 more)

### Community 6 - "Modal Component & State Collections"
Cohesion: 0.07
Nodes (40): ModalHandle, ModalOptions, ConfirmOptions, confirmModal(), menuItems, expenses, employees, sales (+32 more)

### Community 0 - "UI Components & Refresh Handlers"
Cohesion: 0.08
Nodes (85): openModal(), showToast(), refreshIngredients(), refreshCustomers(), refreshSmsLogs(), refreshAutomationTriggers(), refreshSuppliers(), refreshSettings() (+77 more)

### Community 4 - "Reactive Store & Shared Components"
Cohesion: 0.05
Nodes (55): NOTIFICATION_ROUTE, Schema, IngredientInUseError, NewIngredientInput, Listener, signal, automationTriggers, notifications (+47 more)

### Community 8 - "Toast UI & AI Menu Engineering"
Cohesion: 0.10
Nodes (33): ToastType, ensureContainer(), refreshMenuItems(), ClaudeResult, ClaudeApiResponse, askClaude(), foodCostStatus, recipeCost() (+25 more)

### Community 5 - "Database CRUD Operations"
Cohesion: 0.06
Nodes (56): StoreName, getDB(), listIngredients(), getIngredient(), updateIngredientEstimation(), RecordPurchaseInput, getMenuItem(), NewMenuItemInput (+48 more)

### Community 9 - "Database Create/Update Ops"
Cohesion: 0.11
Nodes (32): uuid(), nowISO(), createIngredient(), updateIngredient(), recordPhysicalCount(), recordPurchase(), recalcWeightedAvgFromHistory(), updatePurchaseHistoryEntry() (+24 more)

### Community 19 - "Ingredient Deletion Guard"
Cohesion: 0.50
Nodes (4): getRecipesUsingIngredient(), deleteIngredient(), listMenuItems(), listShoppingList()

### Community 20 - "Sale Recording Types"
Cohesion: 0.67
Nodes (4): RecordSaleInput, RecordImportedSaleInput, OrderType, DeliveryInfo

### Community 18 - "Business Subscription Logic"
Cohesion: 0.29
Nodes (8): effectivePointsPerToman(), reverseCustomerVisit(), getSettings(), updateSettings(), addMonthsISO(), registerBusiness(), extendBusinessSubscription(), importAllData()

### Community 16 - "User Auth CRUD"
Cohesion: 0.18
Nodes (11): getAuthConfig(), hasSuperadmin(), findUserByPin(), getUser(), listUsers(), recordLogin(), createUser(), updateUser() (+3 more)

### Community 2 - "Inventory & Notification Types"
Cohesion: 0.06
Nodes (66): renderAccessDenied(), SeedIngredientDef, refreshNotifications(), ingredientsById(), IngredientCategory, Unit, PurchaseRecord, ExpenseFrequency (+58 more)

### Community 13 - "Seed Data Generator"
Cohesion: 0.22
Nodes (12): SeedMenuItemDef, INGREDIENTS, MENU_ITEMS, PlannedSale, weightedPick(), buildSalesPlan(), computeConsumption(), roundQty() (+4 more)

### Community 11 - "Expense Management"
Cohesion: 0.12
Nodes (23): refreshExpenses(), refreshEmployees(), expenseMonthlyEquivalent(), monthlyEquivalent(), formatExpenseCategory(), formatExpenseFrequency(), formatPayType(), EXPENSE_CATEGORY_OPTIONS (+15 more)

### Community 7 - "Excel Import Parsing"
Cohesion: 0.09
Nodes (42): refreshSales(), refreshShoppingList(), scheduleAutomationRun(), ParsedSheet, parseSpreadsheetFile(), parseCell(), CashierField, SnappfoodField (+34 more)

### Community 17 - "Recipe Cost Calculations"
Cohesion: 0.22
Nodes (7): RecipeIngredient, ItemRecipeCostFn, avgGrossMarginRatio(), PeriodPL, DailyAggregate, dailySeries(), ShoppingSuggestion

### Community 14 - "Automation & SMS"
Cohesion: 0.26
Nodes (11): recencyDaysFor(), withinCooldown(), isEligible(), applyTemplate(), runAutomationTriggers(), fetchWithTimeout(), KavenegarConfig, SendSmsResult (+3 more)

### Community 15 - "CSV/JSON Export & P&L Calc"
Cohesion: 0.26
Nodes (11): monthlyFixedCost(), periodProfitLoss(), salesInPeriod(), downloadBlob(), downloadJSON(), toCSV(), downloadCSV(), readFileAsJSON() (+3 more)

## Knowledge Gaps
- **132 isolated node(s):** `AlertBannerOptions`, `dismissedThisSession`, `NAV_ITEMS`, `instances`, `ModalHandle` (+127 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `UI Components & Refresh Handlers` to `Session & Auth Management`, `Inventory & Notification Types`, `Platform Owner Admin`, `Reactive Store & Shared Components`, `Modal Component & State Collections`, `Excel Import Parsing`, `Toast UI & AI Menu Engineering`, `Accounting & P&L Reporting`, `Expense Management`, `Chart Theming & Cost Calculations`, `CSV/JSON Export & P&L Calc`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `toPersian()` connect `Inventory & Notification Types` to `UI Components & Refresh Handlers`, `Session & Auth Management`, `Platform Owner Admin`, `Reactive Store & Shared Components`, `Modal Component & State Collections`, `Excel Import Parsing`, `Toast UI & AI Menu Engineering`, `Accounting & P&L Reporting`, `Chart Theming & Cost Calculations`, `Automation & SMS`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `showToast()` connect `UI Components & Refresh Handlers` to `Session & Auth Management`, `Inventory & Notification Types`, `Platform Owner Admin`, `Modal Component & State Collections`, `Excel Import Parsing`, `Toast UI & AI Menu Engineering`, `Accounting & P&L Reporting`, `Expense Management`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `AlertBannerOptions`, `dismissedThisSession`, `NAV_ITEMS` to the rest of the system?**
  _132 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Session & Auth Management` be split into smaller, more focused modules?**
  _Cohesion score 0.053554040895813046 - nodes in this community are weakly interconnected._
- **Should `Platform Owner Admin` be split into smaller, more focused modules?**
  _Cohesion score 0.055130784708249496 - nodes in this community are weakly interconnected._
- **Should `Chart Theming & Cost Calculations` be split into smaller, more focused modules?**
  _Cohesion score 0.13725490196078433 - nodes in this community are weakly interconnected._
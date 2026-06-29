# Graph Report - .  (2026-06-29)

## Corpus Check
- 58 files · ~57,374 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 897 nodes · 2775 edges · 48 communities (37 shown, 11 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.84)
- Token cost: 0 input · 113,508 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Auth, Components & Store Core|Auth, Components & Store Core]]
- [[_COMMUNITY_Session & Business Expiry|Session & Business Expiry]]
- [[_COMMUNITY_Database CRUD Operations|Database CRUD Operations]]
- [[_COMMUNITY_Seed Data Generator|Seed Data Generator]]
- [[_COMMUNITY_Marketing Landing Page|Marketing Landing Page]]
- [[_COMMUNITY_Platform Owner Admin|Platform Owner Admin]]
- [[_COMMUNITY_Icon Generation & DOM Utils|Icon Generation & DOM Utils]]
- [[_COMMUNITY_Database CreateDelete Ops|Database Create/Delete Ops]]
- [[_COMMUNITY_Cost & Margin Calculations|Cost & Margin Calculations]]
- [[_COMMUNITY_Reactive State Store|Reactive State Store]]
- [[_COMMUNITY_Core Type Definitions|Core Type Definitions]]
- [[_COMMUNITY_CRM Automation & Import|CRM Automation & Import]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_Admin Business Registration|Admin Business Registration]]
- [[_COMMUNITY_Excel Import Parsing|Excel Import Parsing]]
- [[_COMMUNITY_AI Menu Engineering|AI Menu Engineering]]
- [[_COMMUNITY_Settings View|Settings View]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Automation & SMS|Automation & SMS]]
- [[_COMMUNITY_Server Sync Logic|Server Sync Logic]]
- [[_COMMUNITY_PWA Manifest|PWA Manifest]]
- [[_COMMUNITY_Stock Alerts|Stock Alerts]]
- [[_COMMUNITY_Inventory Prediction Engine|Inventory Prediction Engine]]
- [[_COMMUNITY_Service Worker TS Config|Service Worker TS Config]]
- [[_COMMUNITY_Service Worker Build Script|Service Worker Build Script]]
- [[_COMMUNITY_User Auth CRUD|User Auth CRUD]]
- [[_COMMUNITY_CRM Tab Rendering|CRM Tab Rendering]]
- [[_COMMUNITY_Chart Component|Chart Component]]
- [[_COMMUNITY_Business Subscription Logic|Business Subscription Logic]]
- [[_COMMUNITY_RFM Customer Segmentation|RFM Customer Segmentation]]
- [[_COMMUNITY_CSVJSON Export|CSV/JSON Export]]
- [[_COMMUNITY_Font Copy Script|Font Copy Script]]
- [[_COMMUNITY_Modal Component|Modal Component]]
- [[_COMMUNITY_Sale Recording Types|Sale Recording Types]]
- [[_COMMUNITY_Ingredient Deletion Guard|Ingredient Deletion Guard]]
- [[_COMMUNITY_README Architecture Notes|README: Architecture Notes]]
- [[_COMMUNITY_App Icon & Concept|App Icon & Concept]]
- [[_COMMUNITY_README Build Script Notes|README: Build Script Notes]]
- [[_COMMUNITY_README Router Notes|README: Router Notes]]
- [[_COMMUNITY_README Testing & Icons|README: Testing & Icons]]
- [[_COMMUNITY_README Store Notes|README: Store Notes]]
- [[_COMMUNITY_App Icon (192px)|App Icon (192px)]]
- [[_COMMUNITY_App Icon (192px Maskable)|App Icon (192px Maskable)]]
- [[_COMMUNITY_App Icon (512px)|App Icon (512px)]]
- [[_COMMUNITY_README Preview Script|README: Preview Script]]
- [[_COMMUNITY_README Seed Notes|README: Seed Notes]]
- [[_COMMUNITY_README Types Notes|README: Types Notes]]

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
- `Data privacy: no third-party account, optional AI uses user's own API key` --semantically_similar_to--> `WebDAV multi-device sync mechanism`  [INFERRED] [semantically similar]
  competitive-advantage.html → README.md
- `100% offline operation pillar` --semantically_similar_to--> `Progressive Web App (PWA) architecture`  [INFERRED] [semantically similar]
  competitive-advantage.html → README.md
- `Accurate per-item food cost based on recipe` --semantically_similar_to--> `Weighted-average raw material cost calculation`  [INFERRED] [semantically similar]
  competitive-advantage.html → README.md
- `Smart inventory depletion forecasting` --semantically_similar_to--> `Automatic shopping list generation from inventory shortfall`  [INFERRED] [semantically similar]
  competitive-advantage.html → README.md
- `renderRenewalSection()` --calls--> `render()`  [INFERRED]
  src/views/admin.ts → scripts/gen-icons.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Five core competitive pillars of MenuBan** — competitive_advantage_inventory_forecast, competitive_advantage_rfm_marketing, competitive_advantage_bcg_menu_engineering, competitive_advantage_multichannel_pnl, competitive_advantage_offline_100 [EXTRACTED 1.00]
- **Client-side data/storage layer (offline-first architecture)** — readme_indexeddb_storage, readme_src_db_ts, readme_webdav_sync, readme_json_backup_restore [INFERRED 0.85]
- **Front-end source architecture layers (entry, state, routing, views)** — readme_src_main_ts, readme_src_store_ts, readme_src_router_ts, readme_src_views_dir, readme_src_components_dir [INFERRED 0.85]

## Communities (48 total, 11 thin omitted)

### Community 0 - "Auth, Components & Store Core"
Cohesion: 0.06
Nodes (132): currentUser, hasFullAccess(), hasRole(), openModal(), ensureContainer(), showToast(), ToastType, ingredientsById() (+124 more)

### Community 1 - "Session & Business Expiry"
Cohesion: 0.05
Nodes (66): checkInactivityTimeout(), daysUntilBusinessExpiry(), isBusinessExpired(), isBusinessExpiringSoon(), isSuperadmin(), logout(), logoutWithReason(), readSession() (+58 more)

### Community 2 - "Database CRUD Operations"
Cohesion: 0.06
Nodes (58): adjustLoyaltyPoints(), adjustWalletBalance(), BACKUP_STORE_NAMES, DEFAULT_SETTINGS, deleteAutomationTrigger(), deleteCustomer(), deleteEmployee(), deleteExpense() (+50 more)

### Community 3 - "Seed Data Generator"
Cohesion: 0.05
Nodes (53): buildSalesPlan(), computeConsumption(), INGREDIENTS, MENU_ITEMS, PlannedSale, roundQty(), seedDatabase(), seedExpensesAndPayroll() (+45 more)

### Community 4 - "Marketing Landing Page"
Cohesion: 0.05
Nodes (47): Menu engineering via BCG matrix and AI, Comparison table: notebook/Excel vs simple POS vs MenuBan, Data privacy: no third-party account, optional AI uses user's own API key, Accurate per-item food cost based on recipe, 14-day free trial call-to-action, Smart inventory depletion forecasting, Unified multi-channel profit & loss reporting, 100% offline operation pillar (+39 more)

### Community 5 - "Platform Owner Admin"
Cohesion: 0.11
Nodes (39): addPlatformInvoice(), DEFAULT_PLATFORM_PRICING, deletePlatformInvoice(), fetchLatestBroadcast(), fetchPlatformBusinesses(), fetchWithTimeout(), getPlatformPaymentCard(), getPlatformPin() (+31 more)

### Community 6 - "Icon Generation & DOM Utils"
Cohesion: 0.07
Nodes (28): { chromium }, fs, OUT_DIR, path, render(), login(), AppUser, Child (+20 more)

### Community 7 - "Database Create/Delete Ops"
Cohesion: 0.11
Nodes (32): addSurveyResponse(), createAutomationTrigger(), createCustomer(), createEmployee(), createExpense(), createIngredient(), createMenuItem(), createNotification() (+24 more)

### Community 8 - "Cost & Margin Calculations"
Cohesion: 0.11
Nodes (25): navigationIntent, suppliers, RecipeIngredient, avgFoodCostPct(), avgGrossMarginRatio(), DailyAggregate, dailyBreakEven(), dailySeries() (+17 more)

### Community 9 - "Reactive State Store"
Cohesion: 0.12
Nodes (21): NOTIFICATION_ROUTE, automationTriggers, customers, employees, expenses, ingredients, lowStockCount(), menuItems (+13 more)

### Community 10 - "Core Type Definitions"
Cohesion: 0.10
Nodes (25): Schema, AppNotificationType, AuthConfig, AutomationTrigger, AutomationTriggerType, BulkSaleBreakdownEntry, BusinessSubscriptionStatus, CampaignRecord (+17 more)

### Community 11 - "CRM Automation & Import"
Cohesion: 0.11
Nodes (21): refreshAutomationTriggers(), refreshCustomers(), buildCustomerRows(), detectCustomerColumns(), parseSpreadsheetFile(), AUTOMATION_DEFAULT_TEMPLATES, AUTOMATION_DESCRIPTIONS, AUTOMATION_LABELS (+13 more)

### Community 12 - "Package Dependencies"
Cohesion: 0.09
Nodes (22): dependencies, chart.js, idb, workbox-core, workbox-precaching, workbox-routing, workbox-strategies, xlsx (+14 more)

### Community 13 - "Admin Business Registration"
Cohesion: 0.13
Nodes (18): RegisterBusinessInput, BusinessType, SubscriptionPlan, BUSINESS_TYPE_OPTIONS, EXTEND_OPTIONS, PLAN_OPTIONS, PLAN_TOTAL_DAYS, renderBackupSection() (+10 more)

### Community 14 - "Excel Import Parsing"
Cohesion: 0.11
Nodes (20): CASHIER_FIELD_LABELS, CASHIER_KEYWORDS, CashierField, CashierImportRow, CUSTOMER_FIELD_LABELS, CUSTOMER_KEYWORDS, CustomerField, CustomerImportRow (+12 more)

### Community 15 - "AI Menu Engineering"
Cohesion: 0.17
Nodes (16): askClaude(), ClaudeApiResponse, ClaudeResult, classifyMenuItems(), MenuEngineeringItem, MenuEngineeringResult, MenuQuadrant, QUADRANT_DESCRIPTIONS (+8 more)

### Community 16 - "Settings View"
Cohesion: 0.28
Nodes (15): refreshAll(), refreshSettings(), formatBusinessType(), BeforeInstallPromptEvent, BUSINESS_TYPE_OPTIONS, formatBytes(), renderDataSection(), renderInstallSection() (+7 more)

### Community 17 - "TypeScript Config"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+7 more)

### Community 18 - "Automation & SMS"
Cohesion: 0.23
Nodes (12): Settings, applyTemplate(), isEligible(), recencyDaysFor(), runAutomationTriggers(), withinCooldown(), fetchWithTimeout(), KavenegarConfig (+4 more)

### Community 19 - "Server Sync Logic"
Cohesion: 0.26
Nodes (14): applyPayload(), buildPayload(), fetchWithTimeout(), generateSyncCode(), importFromSyncCode(), normalizeBase(), pullFromServer(), pushToServer() (+6 more)

### Community 20 - "PWA Manifest"
Cohesion: 0.15
Nodes (12): background_color, description, dir, display, icons, lang, name, orientation (+4 more)

### Community 21 - "Stock Alerts"
Cohesion: 0.22
Nodes (12): NewIngredientInput, renderExpiredScreen(), refreshNotifications(), Ingredient, formatDate(), ALERT_ROLES, checkStockAlertsAndNotify(), lowStockMessage() (+4 more)

### Community 22 - "Inventory Prediction Engine"
Cohesion: 0.26
Nodes (10): ConsumptionRecord, Sale, WasteEntry, buildContext(), computeDailyConsumption(), computeEstimation(), ConsumptionContext, IngredientEstimation (+2 more)

### Community 23 - "Service Worker TS Config"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+4 more)

### Community 24 - "Service Worker Build Script"
Cohesion: 0.25
Nodes (10): buildManifest(), crypto, entry(), esbuild, fs, hashFile(), main(), minify (+2 more)

### Community 25 - "User Auth CRUD"
Cohesion: 0.18
Nodes (11): changeSuperadminPin(), createUser(), deleteUser(), findUserByPin(), getAuthConfig(), getUser(), hasSuperadmin(), listUsers() (+3 more)

### Community 26 - "CRM Tab Rendering"
Cohesion: 0.24
Nodes (11): renderAccessDenied(), refreshSmsLogs(), emptyState(), formatRfmSegment(), rfmSegmentIcon(), renderCustomerRow(), renderCustomersTab(), renderLoyaltyTab() (+3 more)

### Community 27 - "Chart Component"
Cohesion: 0.32
Nodes (7): applyChartTheme(), cssVar(), destroyChart(), instances, palette, renderChart(), renderReportTab()

### Community 28 - "Business Subscription Logic"
Cohesion: 0.29
Nodes (8): addMonthsISO(), effectivePointsPerToman(), extendBusinessSubscription(), getSettings(), importAllData(), registerBusiness(), reverseCustomerVisit(), updateSettings()

### Community 29 - "RFM Customer Segmentation"
Cohesion: 0.32
Nodes (6): Customer, RFMScore, RFMSegment, assignSegment(), quintileScores(), recalculateAllRfm()

### Community 30 - "CSV/JSON Export"
Cohesion: 0.36
Nodes (6): downloadBlob(), downloadCSV(), downloadJSON(), readFileAsJSON(), shareOrCopyText(), toCSV()

### Community 31 - "Font Copy Script"
Cohesion: 0.33
Nodes (5): DEST_DIR, fs, path, SRC_DIR, WEIGHTS

### Community 32 - "Modal Component"
Cohesion: 0.33
Nodes (5): confirmModal(), ConfirmOptions, ModalHandle, ModalOptions, handleDeleteUser()

### Community 33 - "Sale Recording Types"
Cohesion: 0.40
Nodes (6): RecordImportedSaleInput, RecordSaleInput, DeliveryInfo, OrderType, SaleSource, SourceBreakdownEntry

### Community 34 - "Ingredient Deletion Guard"
Cohesion: 0.50
Nodes (3): IngredientInUseError, MenuItem, ItemMatch

### Community 35 - "README: Architecture Notes"
Cohesion: 0.67
Nodes (3): Chart.js (charting library), src/components/ (reusable UI components: modal, toast, chart), src/views/ (main app pages: dashboard, inventory, menu, costs, sales)

## Ambiguous Edges - Review These
- `App Maskable Icon (192px)` → `App Maskable Icon (192px)`  [AMBIGUOUS]
  assets/icons/icon-192-maskable.png · relation: conceptually_related_to

## Knowledge Gaps
- **236 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `scope` (+231 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `App Maskable Icon (192px)` and `App Maskable Icon (192px)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `el()` connect `Auth, Components & Store Core` to `Session & Business Expiry`, `Seed Data Generator`, `Platform Owner Admin`, `Icon Generation & DOM Utils`, `Cost & Margin Calculations`, `Reactive State Store`, `CRM Automation & Import`, `Admin Business Registration`, `AI Menu Engineering`, `Settings View`, `Server Sync Logic`, `Stock Alerts`, `CRM Tab Rendering`, `Chart Component`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `toPersian()` connect `Auth, Components & Store Core` to `Session & Business Expiry`, `Seed Data Generator`, `Platform Owner Admin`, `Icon Generation & DOM Utils`, `Cost & Margin Calculations`, `Reactive State Store`, `CRM Automation & Import`, `Admin Business Registration`, `AI Menu Engineering`, `Settings View`, `Automation & SMS`, `Server Sync Logic`, `Stock Alerts`, `CRM Tab Rendering`, `Chart Component`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Auth, Components & Store Core` to `Modal Component`, `Session & Business Expiry`, `Seed Data Generator`, `Platform Owner Admin`, `Reactive State Store`, `CRM Automation & Import`, `Admin Business Registration`, `AI Menu Engineering`, `Settings View`, `Server Sync Logic`, `CRM Tab Rendering`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `name`, `short_name`, `description` to the rest of the system?**
  _238 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth, Components & Store Core` be split into smaller, more focused modules?**
  _Cohesion score 0.05703263476175581 - nodes in this community are weakly interconnected._
- **Should `Session & Business Expiry` be split into smaller, more focused modules?**
  _Cohesion score 0.05368421052631579 - nodes in this community are weakly interconnected._
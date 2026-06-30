# Graph Report - Shryyyy  (2026-06-30)

## Corpus Check
- 70 files · ~71,899 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1158 nodes · 3555 edges · 53 communities (50 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `62425bfc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
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
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]

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
  costmanager/src/views/admin.ts → costmanager/scripts/gen-icons.js
- `renderInstallSection()` --calls--> `render()`  [INFERRED]
  costmanager/src/views/settings.ts → costmanager/scripts/gen-icons.js
- `askClaude()` --calls--> `fetch()`  [INFERRED]
  costmanager/src/utils/ai.ts → costmanager/sw.js
- `renderFixedVariableTab()` --calls--> `el()`  [EXTRACTED]
  costmanager/src/views/accounting.ts → costmanager/src/utils/dom.ts
- `renderSuppliersVatTab()` --calls--> `el()`  [EXTRACTED]
  costmanager/src/views/accounting.ts → costmanager/src/utils/dom.ts

## Import Cycles
- 3-file cycle: `costmanager/src/db.ts -> costmanager/src/utils/api.ts -> costmanager/src/store.ts -> costmanager/src/db.ts`

## Communities (53 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (97): currentUser, hasFullAccess(), hasRole(), isSuperadmin(), renderAccessDenied(), ingredientsById(), refreshIngredients(), refreshSales() (+89 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (44): activate(), addToCacheList(), _awaitComplete(), B(), cacheMatch(), cachePut(), cacheWillUpdate(), constructor() (+36 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (52): buildSalesPlan(), computeConsumption(), INGREDIENTS, MENU_ITEMS, PlannedSale, roundQty(), seedDatabase(), seedExpensesAndPayroll() (+44 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (50): BACKUP_STORE_NAMES, cacheApiUser(), changeSuperadminPassword(), createUser(), DEFAULT_SETTINGS, deleteUser(), findUserByUsername(), getAuthConfig() (+42 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (45): refreshMenuItems(), Employee, Expense, RecipeIngredient, askClaude(), ClaudeApiResponse, ClaudeResult, avgFoodCostPct() (+37 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (46): applyChartTheme(), cssVar(), destroyChart(), instances, palette, renderChart(), refreshSupplierPayments(), refreshSuppliers() (+38 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (39): addSurveyResponse(), createAutomationTrigger(), createCustomer(), createEmployee(), createExpense(), createIngredient(), createMenuItem(), createNotification() (+31 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (39): adjustLoyaltyPoints(), adjustWalletBalance(), applySyncedRecord(), finalizePayroll(), getAllForSync(), getAllSupplierBalances(), getCustomer(), getDB() (+31 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (30): NOTIFICATION_ROUTE, StoreName, automationTriggers, customers, employees, expenses, isOnline, lowStockCount() (+22 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (32): takeSessionExpiredReason(), AlertBannerOptions, createAlertBanner(), dismissedThisSession, createAppNav(), createNotificationBell(), ALL_ROUTES, bootstrap() (+24 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (29): refreshAutomationTriggers(), refreshSmsLogs(), buildCustomerRows(), CUSTOMER_FIELD_LABELS, CustomerField, CustomerImportRow, AUTOMATION_DEFAULT_TEMPLATES, AUTOMATION_DESCRIPTIONS (+21 more)

### Community 11 - "Community 11"
Cohesion: 0.17
Nodes (31): openModal(), refreshCustomers(), refreshEmployees(), field(), numberInput(), parseNumberInput(), selectEl(), openPettyCashFormModal() (+23 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (30): Schema, AppNotification, AppNotificationType, AttendanceRecord, AuthConfig, AutomationTriggerType, BulkSaleBreakdownEntry, BusinessSubscriptionStatus (+22 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (25): openPlatformOwnerOverlay(), addPlatformInvoice(), DEFAULT_PLATFORM_PRICING, deletePlatformInvoice(), getPlatformPaymentCard(), getPlatformPricing(), listPlatformBroadcasts(), listPlatformInvoices() (+17 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (28): formatDate(), activeEmployees(), ADVANCE_STATUS_LABELS, ADVANCE_STATUS_TONE, ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_OPTIONS, ATTENDANCE_STATUS_TONE, badge() (+20 more)

### Community 15 - "Community 15"
Cohesion: 0.16
Nodes (23): refreshSettings(), Theme, el(), iconTextBtn(), renderVatSubTab(), renderRecipes(), BeforeInstallPromptEvent, BUSINESS_TYPE_OPTIONS (+15 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (25): refreshAll(), FullBackup, formatBusinessType(), formatDateTime(), pullFromServer(), pushToServer(), syncNow(), BUSINESS_TYPE_OPTIONS (+17 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (20): NavItem, createSidebar(), navButton(), ROLE_LABELS, Sidebar, SIDEBAR_LINKS, SidebarLink, showBootError() (+12 more)

### Community 18 - "Community 18"
Cohesion: 0.16
Nodes (20): attemptLogin(), checkInactivityTimeout(), login(), LoginResult, logout(), logoutWithReason(), readSession(), recordActivity() (+12 more)

### Community 19 - "Community 19"
Cohesion: 0.12
Nodes (5): ApiClient, clearTokens(), isOnline(), request(), setTokens()

### Community 20 - "Community 20"
Cohesion: 0.09
Nodes (22): dependencies, chart.js, idb, workbox-core, workbox-precaching, workbox-routing, workbox-strategies, xlsx (+14 more)

### Community 21 - "Community 21"
Cohesion: 0.10
Nodes (20): dependencies, bcrypt, better-sqlite3, cors, dotenv, express, express-rate-limit, helmet (+12 more)

### Community 22 - "Community 22"
Cohesion: 0.19
Nodes (17): confirmModal(), ensureContainer(), showToast(), ToastType, handleLogoutClick(), handleDeletePettyCash(), handleDeleteSupplierTransaction(), handleReviewPettyCash() (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (17): deleteAttendance(), deleteAutomationTrigger(), deleteCustomer(), deleteEmployee(), deleteExpense(), deleteIngredient(), deleteMenuItem(), deletePayrollRecord() (+9 more)

### Community 24 - "Community 24"
Cohesion: 0.16
Nodes (12): signAccessToken(), signRefreshToken(), bcrypt, createSession(), crypto, { db }, express, hashToken() (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+7 more)

### Community 26 - "Community 26"
Cohesion: 0.21
Nodes (13): AutomationTrigger, Settings, applyTemplate(), isEligible(), recencyDaysFor(), runAutomationTriggers(), withinCooldown(), fetchWithTimeout() (+5 more)

### Community 27 - "Community 27"
Cohesion: 0.15
Nodes (13): SubscriptionPaymentStatus, ApiBroadcast, ApiBusiness, ApiPlatformBusiness, ApiPlatformMetrics, ApiSubscriptionPayment, AuthResult, getAccessToken() (+5 more)

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (12): Database, fs, migrate(), path, apiLimiter, app, authLimiter, cors (+4 more)

### Community 29 - "Community 29"
Cohesion: 0.21
Nodes (11): jwt, requireAuth(), requirePlatformAuth(), requireRole(), verifyAccessToken(), verifyRefreshToken(), { db }, express (+3 more)

### Community 30 - "Community 30"
Cohesion: 0.15
Nodes (12): background_color, description, dir, display, icons, lang, name, orientation (+4 more)

### Community 31 - "Community 31"
Cohesion: 0.22
Nodes (11): NAV_ITEMS, currentPath, getHashPath(), navigate(), renderCurrent(), Route, RouteCleanup, RouteRender (+3 more)

### Community 32 - "Community 32"
Cohesion: 0.26
Nodes (10): ConsumptionRecord, Sale, WasteEntry, buildContext(), computeDailyConsumption(), computeEstimation(), ConsumptionContext, IngredientEstimation (+2 more)

### Community 33 - "Community 33"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution, noEmit (+4 more)

### Community 34 - "Community 34"
Cohesion: 0.21
Nodes (10): { chromium }, fs, OUT_DIR, path, render(), daysUntilBusinessExpiry(), isBusinessExpired(), isBusinessExpiringSoon() (+2 more)

### Community 35 - "Community 35"
Cohesion: 0.25
Nodes (10): buildManifest(), crypto, entry(), esbuild, fs, hashFile(), main(), minify (+2 more)

### Community 36 - "Community 36"
Cohesion: 0.25
Nodes (10): NewIngredientInput, refreshNotifications(), Ingredient, ALERT_ROLES, checkStockAlertsAndNotify(), lowStockMessage(), notifiedLowStock, notifiedStockout (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.20
Nodes (9): اسکریپت‌ها, ذخیره‌سازی و حریم خصوصی, ساختار پروژه, منوبان — MenuBan CostManager, نصب و اجرا, همگام‌سازی چند دستگاهی, ویژگی‌ها, پشته فنی (+1 more)

### Community 38 - "Community 38"
Cohesion: 0.22
Nodes (10): addMonthsISO(), deleteSale(), effectivePointsPerToman(), extendBusinessSubscription(), getSettings(), importAllData(), registerBusiness(), reverseCustomerVisit() (+2 more)

### Community 39 - "Community 39"
Cohesion: 0.22
Nodes (8): 1. Get the code onto the server, 2. Run setup, 3. Install the systemd service, 4. Wire up nginx, 5. Smoke test, 6. Updating later, Deploying costmanager-api to the VPS (91.107.249.240), Notes

### Community 40 - "Community 40"
Cohesion: 0.25
Nodes (6): bcrypt, { db }, express, { requireAuth, requireRole }, router, { v4: uuid }

### Community 41 - "Community 41"
Cohesion: 0.25
Nodes (6): bcrypt, { db }, express, router, { signAccessToken, requirePlatformAuth }, { v4: uuid }

### Community 42 - "Community 42"
Cohesion: 0.32
Nodes (6): Customer, RFMScore, RFMSegment, assignSegment(), quintileScores(), recalculateAllRfm()

### Community 43 - "Community 43"
Cohesion: 0.29
Nodes (6): db, { db }, express, { requireAuth }, router, { v4: uuid }

### Community 44 - "Community 44"
Cohesion: 0.29
Nodes (5): SessionUser, NewUserInput, UpdateUserInput, UserRole, ApiUser

### Community 45 - "Community 45"
Cohesion: 0.29
Nodes (5): PlatformInvoice, BusinessType, PaidSubscriptionPlan, ApiPricingRow, WizardState

### Community 46 - "Community 46"
Cohesion: 0.33
Nodes (5): DEST_DIR, fs, path, SRC_DIR, WEIGHTS

### Community 48 - "Community 48"
Cohesion: 0.50
Nodes (3): ConfirmOptions, ModalHandle, ModalOptions

### Community 49 - "Community 49"
Cohesion: 0.67
Nodes (4): RecordImportedSaleInput, RecordSaleInput, DeliveryInfo, OrderType

## Knowledge Gaps
- **295 isolated node(s):** `jwt`, `path`, `fs`, `Database`, `name` (+290 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `el()` connect `Community 15` to `Community 0`, `Community 2`, `Community 34`, `Community 4`, `Community 5`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 13`, `Community 14`, `Community 16`, `Community 17`, `Community 18`, `Community 22`, `Community 31`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `fetch()` connect `Community 1` to `Community 26`, `Community 4`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `askClaude()` connect `Community 4` to `Community 1`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `jwt`, `path`, `fs` to the rest of the system?**
  _295 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05406434418427565 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07130333138515488 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0512987012987013 - nodes in this community are weakly interconnected._
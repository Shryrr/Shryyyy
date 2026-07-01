import { settings } from '../store';
import type { AuditLogEntry, PaidSubscriptionPlan, PettyCashPermission, PurchaseRequest, PurchaseRequestItem, SubscriptionPaymentStatus, UserRole } from '../types';

const TOKEN_KEY = 'apiAccessToken';
const REFRESH_KEY = 'apiRefreshToken';
const EXPIRES_KEY = 'apiExpiresAt';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Defaults to the page's own origin — nginx reverse-proxies /api/ on the same
 * origin the PWA is served from (see costmanager-api/deploy/nginx-costmanager-api.conf),
 * so this works under both http://<ip> and https://<domain> without ever hardcoding
 * a protocol/host that could mismatch the page's scheme (mixed-content blocking).
 * Strips a trailing slash and a trailing /api (older settings.apiBaseUrl values
 * included it) so callers can append /api/... paths without doubling it.
 */
function baseUrl(): string {
  return (settings.get()?.apiBaseUrl || window.location.origin).replace(/\/+$/, '').replace(/\/api$/, '');
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY);
}

export function hasStoredSession(): boolean {
  return !!getAccessToken();
}

/** refreshToken may be null for platform-scope logins, which the backend never issues a refresh token for. */
function setTokens(token: string, refreshToken: string | null, expiresAt: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
  sessionStorage.setItem(EXPIRES_KEY, expiresAt);
}

export function clearTokens(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${baseUrl()}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${refreshToken}` },
        });
        if (!res.ok) return false;
        const data = await res.json();
        setTokens(data.token, refreshToken, data.expiresAt);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  /** Attach the stored access token and retry once via refresh on 401. Default true. */
  auth?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!isOnline()) throw new ApiError(0, 'OFFLINE');
  const { method = 'GET', body, auth = true } = opts;

  const doFetch = (): Promise<Response> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return fetch(`${baseUrl()}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  };

  let res: Response;
  try {
    res = await doFetch();
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR');
  }

  if (res.status === 401 && auth && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      try {
        res = await doFetch();
      } catch {
        throw new ApiError(0, 'NETWORK_ERROR');
      }
    }
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // empty body (e.g. some 204s) — leave data as null
  }

  if (!res.ok) {
    const message = (data as { message?: string } | null)?.message || `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

// ---------- Shared response shapes ----------

export interface ApiUser {
  id: string;
  username: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  role: UserRole;
  isActive: boolean;
  lastLogin?: string | null;
}

export interface ApiBusiness {
  id: string;
  name: string;
  type: string;
  city?: string | null;
  subscriptionPlan: string;
  subscriptionExpires: string;
  subscriptionStatus: string;
}

export interface AuthResult {
  token: string;
  refreshToken: string;
  user: ApiUser;
  business: ApiBusiness;
  expiresAt: string;
}

export interface ApiPlatformBusiness {
  id: string;
  name: string;
  type: string;
  city: string | null;
  subscriptionPlan: string;
  subscriptionExpires: string;
  subscriptionStatus: string;
  isActive: boolean;
  createdAt: string;
  userCount: number;
  lastSyncAt: string | null;
  totalRevenue: number;
}

/** Raw subscription_payments row — server returns DB columns as-is (snake_case), not remapped. */
export interface ApiSubscriptionPayment {
  id: string;
  business_id: string;
  plan: PaidSubscriptionPlan;
  amount: number;
  transfer_ref: string | null;
  description: string | null;
  status: SubscriptionPaymentStatus;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  note: string | null;
  /** Only present in /platform/payments/pending (joined). */
  business_name?: string;
}

/** Raw subscription_pricing row. */
export interface ApiPricingRow {
  plan: PaidSubscriptionPlan;
  amount: number;
  updated_at: string;
}

export interface ApiPettyCashTransaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'expense';
  amount: number;
  reason: string;
  requestedBy: string;
  requestedByName: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string | null;
  approvedAt?: string | null;
  date: string;
  createdAt: string;
  receiptUrl?: string | null;
}

export interface ApiPlatformMetrics {
  total: number;
  active: number;
  trial: number;
  expired: number;
  totalRevenue: number;
}

export interface ApiBroadcast {
  id: string;
  message: string;
  created_at: string;
}

export interface SyncRecord {
  store: string;
  id: string;
  data: unknown;
  updatedAt: string;
  isDeleted: boolean;
}

export interface SyncConflict {
  id: string;
  store: string;
  serverData: unknown;
  clientData: unknown;
}

// ---------- Client ----------

export class ApiClient {
  // ----- Business auth -----

  async register(input: {
    businessName: string;
    businessType: string;
    city?: string;
    managerName: string;
    username: string;
    password: string;
    email?: string;
    phone?: string;
    plan?: string;
  }): Promise<AuthResult> {
    const data = await request<AuthResult>('/api/auth/register', { method: 'POST', body: input, auth: false });
    setTokens(data.token, data.refreshToken, data.expiresAt);
    return data;
  }

  async login(username: string, password: string, businessId?: string): Promise<AuthResult> {
    const data = await request<AuthResult>('/api/auth/login', { method: 'POST', body: { username, password, businessId }, auth: false });
    setTokens(data.token, data.refreshToken, data.expiresAt);
    return data;
  }

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      // best-effort revoke; clear local tokens regardless
    }
    clearTokens();
  }

  async me(): Promise<{ user: ApiUser; business: ApiBusiness }> {
    return request('/api/auth/me');
  }

  // ----- Platform owner -----

  async platformLogin(username: string, password: string): Promise<{ token: string; expiresAt: string }> {
    const data = await request<{ token: string; expiresAt: string }>('/api/platform/login', {
      method: 'POST',
      body: { username, password },
      auth: false,
    });
    setTokens(data.token, null, data.expiresAt);
    return data;
  }

  async listBusinesses(): Promise<ApiPlatformBusiness[]> {
    const data = await request<{ businesses: ApiPlatformBusiness[] }>('/api/platform/businesses');
    return data.businesses;
  }

  async getBusiness(id: string): Promise<{ business: ApiPlatformBusiness; users: ApiUser[]; payments: ApiSubscriptionPayment[] }> {
    return request(`/api/platform/businesses/${id}`);
  }

  async updateBusinessSubscription(
    id: string,
    input: { plan?: string; expiresAt?: string; status?: string },
  ): Promise<{ business: ApiPlatformBusiness }> {
    return request(`/api/platform/businesses/${id}/subscription`, { method: 'PATCH', body: input });
  }

  async listPendingPayments(): Promise<ApiSubscriptionPayment[]> {
    const data = await request<{ payments: ApiSubscriptionPayment[] }>('/api/platform/payments/pending');
    return data.payments;
  }

  async approvePayment(id: string, note?: string): Promise<{ ok: boolean; newExpiry: string }> {
    return request(`/api/platform/payments/${id}/approve`, { method: 'POST', body: { note } });
  }

  async rejectPayment(id: string, note?: string): Promise<{ ok: boolean }> {
    return request(`/api/platform/payments/${id}/reject`, { method: 'POST', body: { note } });
  }

  async platformMetrics(): Promise<ApiPlatformMetrics> {
    return request('/api/platform/metrics');
  }

  async getPlatformPricing(): Promise<ApiPricingRow[]> {
    const data = await request<{ pricing: ApiPricingRow[] }>('/api/platform/pricing');
    return data.pricing;
  }

  async setPlatformPricing(plan: PaidSubscriptionPlan, amount: number): Promise<ApiPricingRow[]> {
    const data = await request<{ pricing: ApiPricingRow[] }>('/api/platform/pricing', { method: 'PATCH', body: { plan, amount } });
    return data.pricing;
  }

  async sendBroadcast(message: string): Promise<{ ok: boolean }> {
    return request('/api/platform/broadcast', { method: 'POST', body: { message } });
  }

  async getLatestBroadcast(): Promise<ApiBroadcast | null> {
    const data = await request<{ broadcast: ApiBroadcast | null }>('/api/platform/broadcast/latest');
    return data.broadcast;
  }

  // ----- Business user management -----

  async listUsers(): Promise<ApiUser[]> {
    const data = await request<{ users: ApiUser[] }>('/api/business/users');
    return data.users;
  }

  async createUser(input: { username: string; password: string; fullName: string; role: UserRole; email?: string; phone?: string }): Promise<ApiUser> {
    const data = await request<{ user: ApiUser }>('/api/business/users', { method: 'POST', body: input });
    return data.user;
  }

  async updateUser(
    id: string,
    input: Partial<{ fullName: string; role: UserRole; email: string; phone: string; isActive: boolean; password: string }>,
  ): Promise<ApiUser> {
    const data = await request<{ user: ApiUser }>(`/api/business/users/${id}`, { method: 'PATCH', body: input });
    return data.user;
  }

  async deleteUser(id: string): Promise<void> {
    await request<Record<string, never>>(`/api/business/users/${id}`, { method: 'DELETE' });
  }

  // ----- Subscription (business scope) -----

  async getSubscriptionStatus(): Promise<{ plan: string; status: string; expiresAt: string; pendingPayment: ApiSubscriptionPayment | null }> {
    return request('/api/subscription/status');
  }

  async submitSubscriptionPayment(input: {
    plan: PaidSubscriptionPlan;
    amount: number;
    transferRef?: string;
    description?: string;
  }): Promise<ApiSubscriptionPayment> {
    const data = await request<{ payment: ApiSubscriptionPayment }>('/api/subscription/payment', { method: 'POST', body: input });
    return data.payment;
  }

  async getSubscriptionPricing(): Promise<ApiPricingRow[]> {
    const data = await request<{ pricing: ApiPricingRow[] }>('/api/subscription/pricing');
    return data.pricing;
  }

  // ----- Petty cash -----

  async listPettyCash(): Promise<{ transactions: ApiPettyCashTransaction[]; balance: number }> {
    return request('/api/petty-cash');
  }

  async createPettyCash(input: { type: string; amount: number; reason: string; date?: string; receiptUrl?: string }): Promise<ApiPettyCashTransaction> {
    const data = await request<{ transaction: ApiPettyCashTransaction }>('/api/petty-cash', { method: 'POST', body: input });
    return data.transaction;
  }

  async approvePettyCash(id: string): Promise<ApiPettyCashTransaction> {
    const data = await request<{ transaction: ApiPettyCashTransaction }>(`/api/petty-cash/${id}/approve`, { method: 'POST' });
    return data.transaction;
  }

  async rejectPettyCash(id: string): Promise<ApiPettyCashTransaction> {
    const data = await request<{ transaction: ApiPettyCashTransaction }>(`/api/petty-cash/${id}/reject`, { method: 'POST' });
    return data.transaction;
  }

  async deletePettyCash(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/petty-cash/${id}`, { method: 'DELETE' });
  }

  async getPettyCashPermissions(): Promise<{ permissions: PettyCashPermission[]; users: ApiUser[] }> {
    return request('/api/petty-cash/permissions');
  }

  async setPettyCashPermission(userId: string, perm: { canView: boolean; canWithdraw: boolean; canRequest: boolean }): Promise<void> {
    await request(`/api/petty-cash/permissions/${userId}`, { method: 'PUT', body: perm });
  }

  // ----- Purchase requests -----

  async listPurchaseRequests(): Promise<PurchaseRequest[]> {
    const data = await request<{ requests: PurchaseRequest[] }>('/api/purchase-requests');
    return data.requests;
  }

  async createPurchaseRequest(input: {
    ingredientId: string;
    requestedQty: number;
    neededByDatetime: string;
    estimatedTotal?: number;
    note?: string;
  }): Promise<PurchaseRequest> {
    const data = await request<{ request: PurchaseRequest }>('/api/purchase-requests', { method: 'POST', body: input });
    return data.request;
  }

  async acceptPurchaseRequest(id: string, estimatedPurchaseDatetime?: string): Promise<PurchaseRequest> {
    const data = await request<{ request: PurchaseRequest }>(`/api/purchase-requests/${id}/accept`, { method: 'POST', body: { estimatedPurchaseDatetime } });
    return data.request;
  }

  async completePurchaseRequest(id: string, input: {
    actualPrice?: number;
    actualQty?: number;
    paymentMethod?: 'cash' | 'credit' | 'split';
    cashAmount?: number;
    creditAmount?: number;
    supplierId?: string;
    invoiceRef?: string;
    invoiceImageUrl?: string;
    receiptUrl?: string;
    note?: string;
  }): Promise<PurchaseRequest> {
    const data = await request<{ request: PurchaseRequest }>(`/api/purchase-requests/${id}/complete`, { method: 'POST', body: input });
    return data.request;
  }

  async cancelPurchaseRequest(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/purchase-requests/${id}/cancel`, { method: 'POST' });
  }

  async batchCompletePurchaseRequests(items: Array<{
    id: string;
    actualPrice?: number;
    actualQty?: number;
    paymentMethod?: 'cash' | 'credit' | 'split';
    cashAmount?: number;
    creditAmount?: number;
    supplierId?: string;
    invoiceRef?: string;
    invoiceImageUrl?: string;
    receiptUrl?: string;
    note?: string;
  }>): Promise<{ completed: string[]; errors: Array<{ id: string; message: string }> }> {
    return request<{ completed: string[]; errors: Array<{ id: string; message: string }> }>('/api/purchase-requests/batch-complete', { method: 'POST', body: { items } });
  }

  async listSuppliers(): Promise<Array<{ id: string; name: string; phone?: string; balance: number }>> {
    const data = await request<{ suppliers: Array<{ id: string; name: string; phone?: string; balance: number }> }>('/api/suppliers');
    return data.suppliers;
  }

  // ----- Audit log -----

  async listAuditLog(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
    const data = await request<{ log: AuditLogEntry[] }>(`/api/audit?limit=${limit}&offset=${offset}`);
    return data.log;
  }

  // ----- File uploads -----

  async uploadFile(file: File): Promise<{ id: string; url: string }> {
    if (!isOnline()) throw new ApiError(0, 'OFFLINE');
    const token = getAccessToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${baseUrl()}/api/uploads`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    let data: unknown = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new ApiError(res.status, (data as { message?: string } | null)?.message ?? `HTTP ${res.status}`);
    return data as { id: string; url: string };
  }

  // ----- Sync -----

  async syncPull(since: string, stores?: string[]): Promise<{ records: SyncRecord[]; serverTime: string }> {
    const params = new URLSearchParams({ since });
    if (stores && stores.length) params.set('stores', stores.join(','));
    return request(`/api/sync/pull?${params.toString()}`);
  }

  async syncPush(deviceId: string, records: SyncRecord[]): Promise<{ accepted: number; conflicts: SyncConflict[] }> {
    return request('/api/sync/push', { method: 'POST', body: { deviceId, records } });
  }
}

export const api = new ApiClient();

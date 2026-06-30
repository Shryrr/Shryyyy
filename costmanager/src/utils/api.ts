import { settings } from '../store';
import type { PaidSubscriptionPlan, SubscriptionPaymentStatus, UserRole } from '../types';

/** Falls back to this when settings.apiBaseUrl is unset (matches the type comment in types.ts). */
const DEFAULT_API_BASE_URL = 'http://91.107.249.240/api';

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

function baseUrl(): string {
  return (settings.get()?.apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
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
        const res = await fetch(`${baseUrl()}/auth/refresh`, {
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
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
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
    const data = await request<AuthResult>('/auth/register', { method: 'POST', body: input, auth: false });
    setTokens(data.token, data.refreshToken, data.expiresAt);
    return data;
  }

  async login(username: string, password: string, businessId?: string): Promise<AuthResult> {
    const data = await request<AuthResult>('/auth/login', { method: 'POST', body: { username, password, businessId }, auth: false });
    setTokens(data.token, data.refreshToken, data.expiresAt);
    return data;
  }

  async logout(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {
      // best-effort revoke; clear local tokens regardless
    }
    clearTokens();
  }

  async me(): Promise<{ user: ApiUser; business: ApiBusiness }> {
    return request('/auth/me');
  }

  // ----- Platform owner -----

  async platformLogin(username: string, password: string): Promise<{ token: string; expiresAt: string }> {
    const data = await request<{ token: string; expiresAt: string }>('/platform/login', {
      method: 'POST',
      body: { username, password },
      auth: false,
    });
    setTokens(data.token, null, data.expiresAt);
    return data;
  }

  async listBusinesses(): Promise<ApiPlatformBusiness[]> {
    const data = await request<{ businesses: ApiPlatformBusiness[] }>('/platform/businesses');
    return data.businesses;
  }

  async getBusiness(id: string): Promise<{ business: ApiPlatformBusiness; users: ApiUser[]; payments: ApiSubscriptionPayment[] }> {
    return request(`/platform/businesses/${id}`);
  }

  async updateBusinessSubscription(
    id: string,
    input: { plan?: string; expiresAt?: string; status?: string },
  ): Promise<{ business: ApiPlatformBusiness }> {
    return request(`/platform/businesses/${id}/subscription`, { method: 'PATCH', body: input });
  }

  async listPendingPayments(): Promise<ApiSubscriptionPayment[]> {
    const data = await request<{ payments: ApiSubscriptionPayment[] }>('/platform/payments/pending');
    return data.payments;
  }

  async approvePayment(id: string, note?: string): Promise<{ ok: boolean; newExpiry: string }> {
    return request(`/platform/payments/${id}/approve`, { method: 'POST', body: { note } });
  }

  async rejectPayment(id: string, note?: string): Promise<{ ok: boolean }> {
    return request(`/platform/payments/${id}/reject`, { method: 'POST', body: { note } });
  }

  async platformMetrics(): Promise<ApiPlatformMetrics> {
    return request('/platform/metrics');
  }

  async getPlatformPricing(): Promise<ApiPricingRow[]> {
    const data = await request<{ pricing: ApiPricingRow[] }>('/platform/pricing');
    return data.pricing;
  }

  async setPlatformPricing(plan: PaidSubscriptionPlan, amount: number): Promise<ApiPricingRow[]> {
    const data = await request<{ pricing: ApiPricingRow[] }>('/platform/pricing', { method: 'PATCH', body: { plan, amount } });
    return data.pricing;
  }

  async sendBroadcast(message: string): Promise<{ ok: boolean }> {
    return request('/platform/broadcast', { method: 'POST', body: { message } });
  }

  async getLatestBroadcast(): Promise<ApiBroadcast | null> {
    const data = await request<{ broadcast: ApiBroadcast | null }>('/platform/broadcast/latest');
    return data.broadcast;
  }

  // ----- Business user management -----

  async listUsers(): Promise<ApiUser[]> {
    const data = await request<{ users: ApiUser[] }>('/business/users');
    return data.users;
  }

  async createUser(input: { username: string; password: string; fullName: string; role: UserRole; email?: string; phone?: string }): Promise<ApiUser> {
    const data = await request<{ user: ApiUser }>('/business/users', { method: 'POST', body: input });
    return data.user;
  }

  async updateUser(
    id: string,
    input: Partial<{ fullName: string; role: UserRole; email: string; phone: string; isActive: boolean; password: string }>,
  ): Promise<ApiUser> {
    const data = await request<{ user: ApiUser }>(`/business/users/${id}`, { method: 'PATCH', body: input });
    return data.user;
  }

  // ----- Subscription (business scope) -----

  async getSubscriptionStatus(): Promise<{ plan: string; status: string; expiresAt: string; pendingPayment: ApiSubscriptionPayment | null }> {
    return request('/subscription/status');
  }

  async submitSubscriptionPayment(input: {
    plan: PaidSubscriptionPlan;
    amount: number;
    transferRef?: string;
    description?: string;
  }): Promise<ApiSubscriptionPayment> {
    const data = await request<{ payment: ApiSubscriptionPayment }>('/subscription/payment', { method: 'POST', body: input });
    return data.payment;
  }

  async getSubscriptionPricing(): Promise<ApiPricingRow[]> {
    const data = await request<{ pricing: ApiPricingRow[] }>('/subscription/pricing');
    return data.pricing;
  }

  // ----- Sync -----

  async syncPull(since: string, stores?: string[]): Promise<{ records: SyncRecord[]; serverTime: string }> {
    const params = new URLSearchParams({ since });
    if (stores && stores.length) params.set('stores', stores.join(','));
    return request(`/sync/pull?${params.toString()}`);
  }

  async syncPush(deviceId: string, records: SyncRecord[]): Promise<{ accepted: number; conflicts: SyncConflict[] }> {
    return request('/sync/push', { method: 'POST', body: { deviceId, records } });
  }
}

export const api = new ApiClient();

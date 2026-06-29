import { uuid } from './db';
import type { PaidSubscriptionPlan } from './types';

const PIN_KEY = 'platformOwnerPin';
const SESSION_KEY = 'platformOwnerSession';
const PRICING_KEY = 'platformPricing';
const PAYMENT_CARD_KEY = 'platformPaymentCard';
const INVOICES_KEY = 'platformInvoices';
const BROADCASTS_KEY = 'platformBroadcasts';

export const DEFAULT_PLATFORM_PIN = '000000';

export function getPlatformPin(): string {
  return localStorage.getItem(PIN_KEY) || DEFAULT_PLATFORM_PIN;
}

export function isDefaultPlatformPin(): boolean {
  return getPlatformPin() === DEFAULT_PLATFORM_PIN;
}

export function verifyPlatformPin(pin: string): boolean {
  return pin === getPlatformPin();
}

export function setPlatformPin(pin: string): void {
  localStorage.setItem(PIN_KEY, pin);
}

export function isPlatformOwnerSession(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function setPlatformOwnerSession(active: boolean): void {
  if (active) sessionStorage.setItem(SESSION_KEY, '1');
  else sessionStorage.removeItem(SESSION_KEY);
}

export type PlatformPricing = Record<PaidSubscriptionPlan, number>;

const DEFAULT_PLATFORM_PRICING: PlatformPricing = { '1m': 0, '3m': 0, '6m': 0, '12m': 0 };

export function getPlatformPricing(): PlatformPricing {
  try {
    const raw = localStorage.getItem(PRICING_KEY);
    return raw ? { ...DEFAULT_PLATFORM_PRICING, ...JSON.parse(raw) } : DEFAULT_PLATFORM_PRICING;
  } catch {
    return DEFAULT_PLATFORM_PRICING;
  }
}

export function setPlatformPricing(pricing: PlatformPricing): void {
  localStorage.setItem(PRICING_KEY, JSON.stringify(pricing));
}

/** Card number businesses transfer payment to for manual (non-gateway) subscription renewal. */
export function getPlatformPaymentCard(): string {
  return localStorage.getItem(PAYMENT_CARD_KEY) || '';
}

export function setPlatformPaymentCard(cardNumber: string): void {
  localStorage.setItem(PAYMENT_CARD_KEY, cardNumber);
}

export interface PlatformInvoice {
  id: string;
  businessName: string;
  plan: PaidSubscriptionPlan;
  amount: number;
  paidAt: string;
}

export function listPlatformInvoices(): PlatformInvoice[] {
  try {
    const raw = localStorage.getItem(INVOICES_KEY);
    return raw ? (JSON.parse(raw) as PlatformInvoice[]) : [];
  } catch {
    return [];
  }
}

export function addPlatformInvoice(input: Omit<PlatformInvoice, 'id'>): PlatformInvoice {
  const invoice: PlatformInvoice = { ...input, id: uuid() };
  const all = [...listPlatformInvoices(), invoice];
  localStorage.setItem(INVOICES_KEY, JSON.stringify(all));
  return invoice;
}

export function deletePlatformInvoice(id: string): void {
  localStorage.setItem(INVOICES_KEY, JSON.stringify(listPlatformInvoices().filter((i) => i.id !== id)));
}

export interface PlatformBroadcastMessage {
  id: string;
  message: string;
  createdAt: string;
}

export function listPlatformBroadcasts(): PlatformBroadcastMessage[] {
  try {
    const raw = localStorage.getItem(BROADCASTS_KEY);
    return raw ? (JSON.parse(raw) as PlatformBroadcastMessage[]) : [];
  } catch {
    return [];
  }
}

export function recordPlatformBroadcast(message: string): PlatformBroadcastMessage {
  const entry: PlatformBroadcastMessage = { id: uuid(), message, createdAt: new Date().toISOString() };
  localStorage.setItem(BROADCASTS_KEY, JSON.stringify([entry, ...listPlatformBroadcasts()]));
  return entry;
}

export interface PlatformBusinessSummary {
  businessId: string;
  businessName: string;
  lastSyncAt?: string;
  userCount?: number;
}

const FETCH_TIMEOUT_MS = 6000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Best-effort fetch of all businesses known to the sync server; returns [] on any failure (offline server, etc.).
 * There's no listing endpoint on the static WebDAV directory, so this reads the shared `_registry.json`
 * file that every business upserts itself into on push (see `updateRegistry` in `utils/sync.ts`).
 */
export async function fetchPlatformBusinesses(serverUrl: string): Promise<PlatformBusinessSummary[]> {
  const base = serverUrl.trim().replace(/\/+$/, '');
  if (!base || !navigator.onLine) return [];
  try {
    const res = await fetchWithTimeout(`${base}/_registry.json`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.businesses) ? (data.businesses as PlatformBusinessSummary[]) : [];
  } catch {
    return [];
  }
}

/**
 * Best-effort broadcast push to the server so all business devices can pick it up; never throws.
 * The sync server is a plain WebDAV directory with no application routes (see `_registry.json`
 * in `utils/sync.ts`), so this writes a static `_broadcast.json` file rather than POSTing to a
 * `/admin/broadcast` endpoint that doesn't exist anywhere on that server.
 */
export async function sendPlatformBroadcast(serverUrl: string, message: string): Promise<{ ok: boolean }> {
  const base = serverUrl.trim().replace(/\/+$/, '');
  const entry = recordPlatformBroadcast(message);
  if (!base || !navigator.onLine) return { ok: false };
  try {
    const res = await fetchWithTimeout(`${base}/_broadcast.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

/** Best-effort fetch of the latest broadcast for display to business users; returns null on any failure. */
export async function fetchLatestBroadcast(serverUrl: string): Promise<PlatformBroadcastMessage | null> {
  const base = serverUrl.trim().replace(/\/+$/, '');
  if (!base || !navigator.onLine) return null;
  try {
    const res = await fetchWithTimeout(`${base}/_broadcast.json`);
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.message ? (data as PlatformBroadcastMessage) : null;
  } catch {
    return null;
  }
}

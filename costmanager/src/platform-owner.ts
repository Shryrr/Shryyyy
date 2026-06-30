import { uuid } from './db';
import type { PaidSubscriptionPlan } from './types';

const ATTEMPTS_KEY = 'platformOwnerFailedAttempts';
const LOCKED_UNTIL_KEY = 'platformOwnerLockedUntil';
const SESSION_KEY = 'platformOwnerSession';
const PRICING_KEY = 'platformPricing';
const PAYMENT_CARD_KEY = 'platformPaymentCard';
const INVOICES_KEY = 'platformInvoices';
const BROADCASTS_KEY = 'platformBroadcasts';

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

/** Persisted in localStorage (not in-memory) so a page reload can't reset the lockout window. */
export function platformLockedUntil(): number {
  return Number(localStorage.getItem(LOCKED_UNTIL_KEY) ?? 0);
}

/** Returns the lockout end timestamp if this attempt just tripped the lockout, otherwise 0. */
export function recordPlatformFailedAttempt(): number {
  const attempts = Number(localStorage.getItem(ATTEMPTS_KEY) ?? 0) + 1;
  localStorage.setItem(ATTEMPTS_KEY, String(attempts));
  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    const until = Date.now() + LOGIN_LOCKOUT_MS;
    localStorage.setItem(LOCKED_UNTIL_KEY, String(until));
    return until;
  }
  return 0;
}

export function resetPlatformLoginAttempts(): void {
  localStorage.removeItem(ATTEMPTS_KEY);
  localStorage.removeItem(LOCKED_UNTIL_KEY);
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

/** Records this device's send in the local broadcast history; delivery itself goes through api.sendBroadcast. */
export function recordPlatformBroadcast(message: string): PlatformBroadcastMessage {
  const entry: PlatformBroadcastMessage = { id: uuid(), message, createdAt: new Date().toISOString() };
  localStorage.setItem(BROADCASTS_KEY, JSON.stringify([entry, ...listPlatformBroadcasts()]));
  return entry;
}

import * as db from './db';
import { signal } from './store';
import type { AppUser, Settings, UserRole } from './types';

const SESSION_KEY = 'currentUser';
const LAST_ACTIVITY_KEY = 'lastActivityAt';
const SESSION_EXPIRED_KEY = 'sessionExpiredReason';
const INACTIVITY_LIMIT_MS = 8 * 60 * 60 * 1000;

interface SessionUser {
  id: string;
  name: string;
  role: UserRole;
}

export const currentUser = signal<AppUser | null>(null);

function readSession(): SessionUser | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

function writeSession(user: AppUser | null): void {
  if (!user) {
    sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, name: user.name, role: user.role }));
}

/** Re-validates against the freshest AuthConfig.users on each load, so an admin edit elsewhere can't leave a stale session. */
export async function restoreSession(): Promise<AppUser | null> {
  const session = readSession();
  if (!session) return null;
  const user = await db.getUser(session.id);
  if (!user || !user.isActive) {
    writeSession(null);
    currentUser.set(null);
    return null;
  }
  writeSession(user);
  currentUser.set(user);
  return user;
}

export async function login(user: AppUser): Promise<void> {
  writeSession(user);
  currentUser.set(user);
  recordActivity();
  await db.recordLogin(user.id);
}

/** Full reload, deliberately: router.ts has no route-clear mechanism, so a reload is the simplest way to reset all module state for whichever role logs in next. */
export function logout(): void {
  writeSession(null);
  sessionStorage.removeItem(LAST_ACTIVITY_KEY);
  location.reload();
}

/** Logs out and stashes a reason message the login screen reads once (via takeSessionExpiredReason) and clears. */
export function logoutWithReason(reason: string): void {
  sessionStorage.setItem(SESSION_EXPIRED_KEY, reason);
  logout();
}

export function takeSessionExpiredReason(): string | null {
  const reason = sessionStorage.getItem(SESSION_EXPIRED_KEY);
  sessionStorage.removeItem(SESSION_EXPIRED_KEY);
  return reason;
}

function recordActivity(): void {
  sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

/** Called on every navigation; auto-logs-out a session idle for more than 8h. Returns true if it logged out. */
export function checkInactivityTimeout(): boolean {
  if (!currentUser.get()) return false;
  const lastActivity = Number(sessionStorage.getItem(LAST_ACTIVITY_KEY) ?? 0);
  if (lastActivity && Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
    logoutWithReason('جلسه شما به دلیل عدم فعالیت منقضی شد');
    return true;
  }
  recordActivity();
  return false;
}

export async function refreshCurrentUser(): Promise<void> {
  const user = currentUser.get();
  if (!user) return;
  const fresh = await db.getUser(user.id);
  if (!fresh || !fresh.isActive) {
    logout();
    return;
  }
  writeSession(fresh);
  currentUser.set(fresh);
}

export function hasRole(...roles: UserRole[]): boolean {
  const user = currentUser.get();
  return !!user && roles.includes(user.role);
}

export function isSuperadmin(): boolean {
  return hasRole('superadmin');
}

/** superadmin + manager share full operational access; the only thing superadmin alone can do is manage users. */
export function hasFullAccess(): boolean {
  return hasRole('superadmin', 'manager');
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Subscription is per-business: every user, including the superadmin, is gated the same way. */
export function daysUntilBusinessExpiry(settings: Settings): number {
  const diff = new Date(settings.subscriptionExpiry).getTime() - Date.now();
  return Math.ceil(diff / DAY_MS);
}

export function isBusinessExpired(settings: Settings): boolean {
  return settings.subscriptionPlan !== 'unlimited' && daysUntilBusinessExpiry(settings) < 0;
}

export function isBusinessExpiringSoon(settings: Settings): boolean {
  return !isBusinessExpired(settings) && settings.subscriptionPlan !== 'unlimited' && daysUntilBusinessExpiry(settings) <= 7;
}

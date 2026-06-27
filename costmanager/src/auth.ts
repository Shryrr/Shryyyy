import * as db from './db';
import { signal } from './store';
import type { AppUser, UserRole } from './types';

const SESSION_KEY = 'currentUser';

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
  await db.recordLogin(user.id);
}

/** Full reload, deliberately: router.ts has no route-clear mechanism, so a reload is the simplest way to reset all module state for whichever role logs in next. */
export function logout(): void {
  writeSession(null);
  location.reload();
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

export function daysUntilExpiry(user: AppUser): number {
  const diff = new Date(user.subscriptionExpiry).getTime() - Date.now();
  return Math.ceil(diff / DAY_MS);
}

export function isExpired(user: AppUser): boolean {
  return user.role !== 'superadmin' && daysUntilExpiry(user) < 0;
}

export function isExpiringSoon(user: AppUser): boolean {
  return user.role !== 'superadmin' && !isExpired(user) && daysUntilExpiry(user) <= 7;
}

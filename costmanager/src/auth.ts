import * as db from './db';
import { signal } from './store';
import type { AppUser, UserRole } from './types';

const SESSION_KEY = 'costmanager_current_user_id';

export const currentUser = signal<AppUser | null>(null);

/** Re-validates against the freshest AuthConfig.users on each load, so an admin edit elsewhere can't leave a stale session. */
export async function restoreSession(): Promise<AppUser | null> {
  const id = sessionStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const user = await db.getUser(id);
  if (!user || !user.isActive) {
    sessionStorage.removeItem(SESSION_KEY);
    currentUser.set(null);
    return null;
  }
  currentUser.set(user);
  return user;
}

export function login(user: AppUser): void {
  sessionStorage.setItem(SESSION_KEY, user.id);
  currentUser.set(user);
}

/** Full reload, deliberately: router.ts has no route-clear mechanism, so a reload is the simplest way to reset all module state for whichever role logs in next. */
export function logout(): void {
  sessionStorage.removeItem(SESSION_KEY);
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
  currentUser.set(fresh);
}

export function hasRole(...roles: UserRole[]): boolean {
  const user = currentUser.get();
  return !!user && roles.includes(user.role);
}

export function isAdmin(): boolean {
  return hasRole('admin');
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntilExpiry(user: AppUser): number {
  const diff = new Date(user.subscriptionExpiry).getTime() - Date.now();
  return Math.ceil(diff / DAY_MS);
}

export function isExpired(user: AppUser): boolean {
  return user.role !== 'admin' && daysUntilExpiry(user) < 0;
}

export function isExpiringSoon(user: AppUser): boolean {
  return user.role !== 'admin' && !isExpired(user) && daysUntilExpiry(user) <= 7;
}

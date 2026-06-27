import * as db from '../db';
import { login as setSession } from '../auth';
import { el, field } from '../utils/dom';
import { toPersian } from '../utils/format';
import type { AppUser } from '../types';

const DEFAULT_PIN = '1234';
const LOCKOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

let failedAttempts = 0;
let lockoutUntil = 0;

/** Renders the setup wizard or PIN screen into `container` and resolves once a user is authenticated. */
export async function renderAuthGate(container: HTMLElement): Promise<AppUser> {
  const [config, settings] = await Promise.all([db.getAuthConfig(), db.getSettings()]);
  const businessName = settings?.businessName || 'منوبان';

  return new Promise((resolve) => {
    if (!config.isSetup) renderSetupWizard(container, businessName, resolve);
    else renderLoginScreen(container, businessName, resolve);
  });
}

function authShell(children: HTMLElement[]): HTMLElement {
  return el('div', { class: 'auth-screen' }, [el('div', { class: 'auth-card' }, children)]);
}

function renderSetupWizard(container: HTMLElement, businessName: string, onDone: (user: AppUser) => void): void {
  container.innerHTML = '';

  const pinInput = el('input', {
    type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 8,
    class: 'input auth-pin-input', value: DEFAULT_PIN,
  });
  const confirmInput = el('input', {
    type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 8, class: 'input auth-pin-input',
  });
  const errorEl = el('p', { class: 'auth-error', hidden: true }, []);

  function showError(msg: string): void {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  async function submit(): Promise<void> {
    const pin = pinInput.value.trim();
    const confirmPin = confirmInput.value.trim();
    errorEl.hidden = true;

    if (pin.length < 4) return showError('پین باید حداقل ۴ رقم باشد');
    if (pin === DEFAULT_PIN) return showError('لطفاً پین پیش‌فرض (۱۲۳۴) را تغییر دهید');
    if (pin !== confirmPin) return showError('پین و تکرار آن یکسان نیستند');

    const config = await db.completeAuthSetup(pin);
    const admin = config.users[0];
    setSession(admin);
    onDone(admin);
  }

  const form = el('form', { class: 'auth-form', onsubmit: (e: Event) => { e.preventDefault(); submit(); } }, [
    el('div', { class: 'boot-logo auth-logo' }, ['م']),
    el('span', { class: 'auth-brand' }, [businessName]),
    el('h2', { class: 'auth-title' }, ['راه‌اندازی اولیه']),
    el('p', { class: 'auth-subtitle' }, ['برای مدیر یک پین جدید تعیین کنید (پین پیش‌فرض را تغییر دهید)']),
    field('پین مدیر', pinInput),
    field('تکرار پین', confirmInput),
    errorEl,
    el('button', { type: 'submit', class: 'btn btn-primary auth-submit' }, ['تایید و شروع']),
  ]);

  container.appendChild(authShell([form]));
  pinInput.focus();
  pinInput.select();
}

function renderLoginScreen(container: HTMLElement, businessName: string, onDone: (user: AppUser) => void): void {
  container.innerHTML = '';

  const pinInput = el('input', {
    type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 8, class: 'input auth-pin-input',
  });
  const submitBtn = el('button', { type: 'submit', class: 'btn btn-primary auth-submit' }, ['ورود']);
  const errorEl = el('p', { class: 'auth-error', hidden: true }, []);
  const lockEl = el('p', { class: 'auth-lockout', hidden: true }, []);

  let lockTimer: ReturnType<typeof setInterval> | undefined;

  function showError(msg: string): void {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function tickLock(): void {
    const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
    if (remaining <= 0) {
      lockEl.hidden = true;
      pinInput.disabled = false;
      submitBtn.disabled = false;
      if (lockTimer) clearInterval(lockTimer);
      return;
    }
    lockEl.hidden = false;
    lockEl.textContent = `به دلیل ورود پین اشتباه، ${toPersian(remaining)} ثانیه صبر کنید`;
    pinInput.disabled = true;
    submitBtn.disabled = true;
  }

  if (Date.now() < lockoutUntil) {
    tickLock();
    lockTimer = setInterval(tickLock, 1000);
  }

  async function submit(): Promise<void> {
    if (Date.now() < lockoutUntil) return;
    errorEl.hidden = true;
    const pin = pinInput.value.trim();
    if (!pin) return;

    const user = await db.findUserByPin(pin);
    if (!user) {
      failedAttempts += 1;
      pinInput.value = '';
      pinInput.focus();
      if (failedAttempts >= MAX_ATTEMPTS) {
        failedAttempts = 0;
        lockoutUntil = Date.now() + LOCKOUT_MS;
        tickLock();
        lockTimer = setInterval(tickLock, 1000);
      } else {
        showError(`پین نادرست است (${toPersian(MAX_ATTEMPTS - failedAttempts)} تلاش باقی‌مانده)`);
      }
      return;
    }

    failedAttempts = 0;
    if (lockTimer) clearInterval(lockTimer);
    setSession(user);
    onDone(user);
  }

  const form = el('form', { class: 'auth-form', onsubmit: (e: Event) => { e.preventDefault(); submit(); } }, [
    el('div', { class: 'boot-logo auth-logo' }, ['م']),
    el('h2', { class: 'auth-title' }, [businessName]),
    el('p', { class: 'auth-subtitle' }, ['برای ورود پین خود را وارد کنید']),
    field('پین', pinInput),
    errorEl,
    lockEl,
    submitBtn,
  ]);

  container.appendChild(authShell([form]));
  if (!pinInput.disabled) pinInput.focus();
}

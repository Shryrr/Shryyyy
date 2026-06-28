import * as db from '../db';
import { login as setSession } from '../auth';
import { renderLandingPage } from './landing';
import { renderSetupWizard } from './setup';
import { openPlatformOwnerGate } from './platform-admin';
import { el } from '../utils/dom';
import { toPersian } from '../utils/format';
import type { AppUser, UserRole } from '../types';

const LOCKOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;

const PLATFORM_GATE_TAPS = 7;
const PLATFORM_GATE_WINDOW_MS = 2500;

let failedAttempts = 0;
let lockoutUntil = 0;

const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'مدیر اصلی',
  manager: 'مدیر',
  warehouse: 'انباردار',
  buyer: 'خریدار',
};

/** Renders the setup wizard or the user-grid login screen into `container` and resolves once a user is authenticated. */
export async function renderAuthGate(container: HTMLElement): Promise<AppUser> {
  const [config, settings] = await Promise.all([db.getAuthConfig(), db.getSettings()]);
  const businessName = settings?.businessName || 'منوبان';

  return new Promise((resolve) => {
    if (!config.isSetup || !config.users.some((u) => u.role === 'superadmin')) {
      const showLanding = () => renderLandingPage(container, {
        onRegister: () => showWizard('business'),
        onJoin: () => showWizard('join'),
      });
      const showWizard = (initialStep: 'business' | 'join') => renderSetupWizard(container, {
        onDone: resolve,
        onJoined: () => { renderAuthGate(container).then(resolve); },
        onBack: showLanding,
      }, initialStep);
      showLanding();
    } else {
      renderUserGrid(container, businessName, config.users.filter((u) => u.isActive), resolve);
    }
  });
}

function authShell(children: HTMLElement[], wide = false): HTMLElement {
  return el('div', { class: 'auth-screen' }, [el('div', { class: `auth-card${wide ? ' auth-card--wide' : ''}` }, children)]);
}

/** Hidden platform-owner entry point: tapping the login logo this many times in a row opens the PIN gate. */
function wirePlatformOwnerGate(logo: HTMLElement, container: HTMLElement): void {
  let taps: number[] = [];
  logo.addEventListener('click', () => {
    const now = Date.now();
    taps = taps.filter((t) => now - t < PLATFORM_GATE_WINDOW_MS);
    taps.push(now);
    if (taps.length >= PLATFORM_GATE_TAPS) {
      taps = [];
      openPlatformOwnerGate(container);
    }
  });
}

function renderUserGrid(container: HTMLElement, businessName: string, users: AppUser[], onDone: (user: AppUser) => void): void {
  container.innerHTML = '';

  const grid = el(
    'div',
    { class: 'auth-user-grid' },
    users.map((u) =>
      el(
        'button',
        {
          type: 'button',
          class: 'auth-user-card',
          onclick: () => renderPinEntry(container, businessName, u, onDone, () => renderUserGrid(container, businessName, users, onDone)),
        },
        [
          el('span', { class: 'auth-user-card__avatar' }, [u.name.slice(0, 1)]),
          el('span', { class: 'auth-user-card__name' }, [u.name]),
          el('span', { class: `auth-role-badge auth-role-badge--${u.role}` }, [ROLE_LABELS[u.role]]),
        ],
      ),
    ),
  );

  if (!users.length) {
    grid.appendChild(el('p', { class: 'auth-subtitle' }, ['هیچ کاربر فعالی یافت نشد.']));
  }

  const logo = el('div', { class: 'boot-logo auth-logo' }, ['م']);
  wirePlatformOwnerGate(logo, container);

  container.appendChild(
    authShell(
      [
        logo,
        el('span', { class: 'auth-brand' }, [businessName]),
        el('h2', { class: 'auth-title' }, ['انتخاب کاربر']),
        el('p', { class: 'auth-subtitle' }, ['برای ورود، کاربر خود را انتخاب کنید']),
        grid,
      ],
      true,
    ),
  );
}

function renderPinEntry(
  container: HTMLElement,
  businessName: string,
  user: AppUser,
  onDone: (user: AppUser) => void,
  onBack: () => void,
): void {
  container.innerHTML = '';

  let digits = '';
  const circles = Array.from({ length: 4 }, () => el('span', { class: 'auth-pin-circle' }));
  const circleRow = el('div', { class: 'auth-pin-circles' }, circles);
  const hiddenInput = el('input', {
    type: 'tel', inputmode: 'numeric', autocomplete: 'off', maxlength: 4, class: 'auth-pin-hidden-input',
  });
  const errorEl = el('p', { class: 'auth-error', hidden: true }, []);
  const lockEl = el('p', { class: 'auth-lockout', hidden: true }, []);

  let lockTimer: ReturnType<typeof setInterval> | undefined;

  function showError(msg: string): void {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function renderCircles(): void {
    circles.forEach((c, i) => c.classList.toggle('auth-pin-circle--filled', i < digits.length));
  }

  function tickLock(): void {
    const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
    if (remaining <= 0) {
      lockEl.hidden = true;
      hiddenInput.disabled = false;
      if (lockTimer) clearInterval(lockTimer);
      return;
    }
    lockEl.hidden = false;
    lockEl.textContent = `به دلیل ورود پین اشتباه، ${toPersian(remaining)} ثانیه صبر کنید`;
    hiddenInput.disabled = true;
  }

  if (Date.now() < lockoutUntil) {
    tickLock();
    lockTimer = setInterval(tickLock, 1000);
  }

  async function submit(): Promise<void> {
    errorEl.hidden = true;
    if (digits !== user.pin) {
      failedAttempts += 1;
      digits = '';
      hiddenInput.value = '';
      renderCircles();
      circleRow.classList.add('auth-pin-circles--shake');
      setTimeout(() => circleRow.classList.remove('auth-pin-circles--shake'), 300);
      if (failedAttempts >= MAX_ATTEMPTS) {
        failedAttempts = 0;
        lockoutUntil = Date.now() + LOCKOUT_MS;
        tickLock();
        lockTimer = setInterval(tickLock, 1000);
      } else {
        showError(`پین نادرست است (${toPersian(MAX_ATTEMPTS - failedAttempts)} تلاش باقی‌مانده)`);
      }
      if (!hiddenInput.disabled) hiddenInput.focus();
      return;
    }
    failedAttempts = 0;
    if (lockTimer) clearInterval(lockTimer);
    await setSession(user);
    onDone(user);
  }

  hiddenInput.addEventListener('input', () => {
    digits = hiddenInput.value.replace(/\D/g, '').slice(0, 4);
    hiddenInput.value = digits;
    renderCircles();
    if (digits.length === 4 && Date.now() >= lockoutUntil) submit();
  });

  circleRow.addEventListener('click', () => {
    if (!hiddenInput.disabled) hiddenInput.focus();
  });

  container.appendChild(
    authShell([
      el('button', { type: 'button', class: 'auth-back-btn', onclick: onBack }, ['→ بازگشت']),
      el('div', { class: 'boot-logo auth-logo' }, ['م']),
      el('span', { class: 'auth-brand' }, [businessName]),
      el('h2', { class: 'auth-title' }, [user.name]),
      el('p', { class: 'auth-subtitle' }, ['پین ۴ رقمی خود را وارد کنید']),
      circleRow,
      hiddenInput,
      errorEl,
      lockEl,
    ]),
  );

  setTimeout(() => {
    if (!hiddenInput.disabled) hiddenInput.focus();
  }, 50);
}

import * as db from '../db';
import { attemptLogin } from '../auth';
import { renderLandingPage } from './landing';
import { renderSetupWizard } from './setup';
import { el, field } from '../utils/dom';
import type { AppUser } from '../types';

/** Renders the landing/login screen into `container` and resolves once a user is authenticated. */
export async function renderAuthGate(container: HTMLElement): Promise<AppUser> {
  const [config, settings] = await Promise.all([db.getAuthConfig(), db.getSettings()]);
  const businessName = settings?.businessName || 'منوبان';

  return new Promise((resolve) => {
    if (!config.isSetup || !config.users.some((u) => u.role === 'superadmin')) {
      const showLanding = () => renderLandingPage(container, {
        onRegister: () => showWizard('business'),
        onJoin: () => showWizard('join'),
        onLogin: () => renderLoginForm(container, businessName, resolve, showLanding),
      });
      const showWizard = (initialStep: 'business' | 'join') => renderSetupWizard(container, {
        onDone: resolve,
        onJoined: () => { renderAuthGate(container).then(resolve); },
        onBack: showLanding,
      }, initialStep);
      showLanding();
    } else {
      renderLoginForm(container, businessName, resolve);
    }
  });
}

function authShell(children: HTMLElement[], wide = false): HTMLElement {
  return el('div', { class: 'auth-screen' }, [el('div', { class: `auth-card${wide ? ' auth-card--wide' : ''}` }, children)]);
}

function openPlatformLogin(): void {
  location.hash = '/platform-login';
  location.reload();
}

function renderLoginForm(
  container: HTMLElement,
  businessName: string,
  onDone: (user: AppUser) => void,
  onBack?: () => void,
): void {
  container.innerHTML = '';

  const usernameInput = el('input', { type: 'text', class: 'input', autocomplete: 'username', dir: 'ltr' }) as HTMLInputElement;
  const passwordInput = el('input', { type: 'password', class: 'input', autocomplete: 'current-password', dir: 'ltr' }) as HTMLInputElement;
  const errorEl = el('p', { class: 'auth-error', hidden: true }, []);
  const submitBtn = el('button', { type: 'submit', class: 'btn btn-primary auth-submit' }, ['ورود']) as HTMLButtonElement;

  let submitting = false;

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (submitting) return;
    errorEl.hidden = true;
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || !password) {
      errorEl.textContent = 'نام کاربری و رمز عبور را وارد کنید';
      errorEl.hidden = false;
      return;
    }
    submitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'در حال ورود…';
    try {
      const result = await attemptLogin(username, password);
      if (!result.ok || !result.user) {
        errorEl.textContent = result.error || 'نام کاربری یا رمز عبور اشتباه است';
        errorEl.hidden = false;
        return;
      }
      onDone(result.user);
    } finally {
      submitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'ورود';
    }
  }

  const form = el('form', { class: 'auth-form', onsubmit: submit }, [
    field('نام کاربری', usernameInput),
    field('رمز عبور', passwordInput),
    errorEl,
    submitBtn,
  ]);

  const children: HTMLElement[] = [];
  if (onBack) children.push(el('button', { type: 'button', class: 'auth-back-btn', onclick: onBack }, ['→ بازگشت']));
  children.push(
    el('div', { class: 'boot-logo auth-logo' }, ['م']),
    el('span', { class: 'auth-brand' }, [businessName]),
    el('h2', { class: 'auth-title' }, ['ورود به حساب']),
    form,
    el('button', { type: 'button', class: 'auth-platform-link', onclick: openPlatformLogin }, ['پنل پلتفرم']),
  );

  container.appendChild(authShell(children));

  setTimeout(() => usernameInput.focus(), 50);
}

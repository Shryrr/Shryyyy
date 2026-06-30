/** SHA-256(salt + password), hex-encoded — no external crypto library, browser-native SubtleCrypto. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSalt(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  return (await hashPassword(password, salt)) === expectedHash;
}

export function validateUsername(username: string): string | null {
  if (username.length < 4) return 'نام کاربری باید حداقل ۴ کاراکتر باشد';
  if (/\s/.test(username)) return 'نام کاربری نباید فاصله داشته باشد';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'رمز عبور باید حداقل ۸ کاراکتر باشد';
  if (!/[a-z]/.test(password)) return 'رمز عبور باید حداقل یک حرف کوچک انگلیسی داشته باشد';
  if (!/[A-Z]/.test(password)) return 'رمز عبور باید حداقل یک حرف بزرگ انگلیسی داشته باشد';
  if (!/[0-9]/.test(password)) return 'رمز عبور باید حداقل یک رقم داشته باشد';
  if (!/[^a-zA-Z0-9]/.test(password)) return 'رمز عبور باید حداقل یک نماد (مثل !@#$) داشته باشد';
  return null;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

const STRENGTH_LABELS = ['ضعیف', 'متوسط', 'خوب', 'قوی', 'بسیار قوی'];

/** Simple heuristic meter (not zxcvbn): length + character-class diversity. Purely for UI feedback, not a gate. */
export function passwordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  const clamped = Math.min(4, score) as PasswordStrength['score'];
  return { score: clamped, label: STRENGTH_LABELS[clamped] };
}

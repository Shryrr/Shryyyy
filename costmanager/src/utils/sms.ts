const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface KavenegarConfig {
  apiKey: string;
  senderLine?: string;
}

export interface SendSmsResult {
  ok: boolean;
  error?: string;
}

interface KavenegarResponse {
  return?: { status?: number; message?: string };
}

/** Sends an SMS via Kavenegar's REST API. `receptor` may be a single number or a comma-separated list for a broadcast. */
export async function sendKavenegarSms(config: KavenegarConfig, receptor: string, message: string): Promise<SendSmsResult> {
  if (!config.apiKey) return { ok: false, error: 'کلید API کاوه‌نگار تنظیم نشده است' };
  if (!receptor) return { ok: false, error: 'گیرنده‌ای انتخاب نشده است' };
  if (!navigator.onLine) return { ok: false, error: 'اتصال اینترنت برقرار نیست' };
  try {
    const params = new URLSearchParams({ receptor, message });
    if (config.senderLine) params.set('sender', config.senderLine);
    const res = await fetchWithTimeout(`https://api.kavenegar.com/v1/${config.apiKey}/sms/send.json?${params.toString()}`);
    if (!res.ok) return { ok: false, error: `خطای سرور کاوه‌نگار (${res.status})` };
    const data = (await res.json()) as KavenegarResponse;
    if (data.return?.status && data.return.status !== 200) {
      return { ok: false, error: data.return.message ?? 'ارسال پیامک ناموفق بود' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'ارتباط با سرویس پیامک برقرار نشد' };
  }
}

/** Sends the same message to every recipient in one call — Kavenegar broadcasts to a comma-separated receptor list. */
export async function sendBulkSms(config: KavenegarConfig, receptors: string[], message: string): Promise<SendSmsResult> {
  if (!receptors.length) return { ok: false, error: 'هیچ گیرنده‌ای انتخاب نشده است' };
  return sendKavenegarSms(config, receptors.join(','), message);
}

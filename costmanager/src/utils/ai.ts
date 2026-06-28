const FETCH_TIMEOUT_MS = 20_000;
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_MAX_TOKENS = 1000;

export interface ClaudeResult {
  ok: boolean;
  text?: string;
  error?: string;
}

interface ClaudeApiResponse {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
}

/** Calls the Anthropic Messages API directly from the browser using a user-supplied key. Opt-in only, never bundled. */
export async function askClaude(apiKey: string, prompt: string): Promise<ClaudeResult> {
  if (!apiKey) return { ok: false, error: 'کلید API هوش مصنوعی تنظیم نشده است' };
  if (!navigator.onLine) return { ok: false, error: 'اتصال اینترنت برقرار نیست' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as ClaudeApiResponse | null;
    if (!res.ok) return { ok: false, error: data?.error?.message ?? `خطای سرویس هوش مصنوعی (${res.status})` };
    const text = data?.content?.find((c) => c.type === 'text')?.text;
    if (!text) return { ok: false, error: 'پاسخی از سرویس هوش مصنوعی دریافت نشد' };
    return { ok: true, text };
  } catch {
    return { ok: false, error: 'ارتباط با سرویس هوش مصنوعی برقرار نشد' };
  } finally {
    clearTimeout(timer);
  }
}

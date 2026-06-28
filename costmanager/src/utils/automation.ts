import * as db from '../db';
import { formatMoney, toPersian } from './format';
import { sendKavenegarSms } from './sms';
import type { AutomationTrigger, Customer, Settings } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const AUTOMATION_DEBOUNCE_MS = 10_000;
/** Minimum gap before the same trigger can fire again for the same customer, so a lapsed/birthday rule doesn't re-fire on every recompute pass. */
const COOLDOWN_DAYS = 7;

function recencyDaysFor(customer: Customer, nowMs: number): number {
  const ref = customer.lastVisit ?? customer.firstVisit ?? customer.createdAt;
  return Math.floor((nowMs - new Date(ref).getTime()) / DAY_MS);
}

function withinCooldown(customer: Customer, triggerId: string, nowMs: number): boolean {
  return customer.campaignHistory.some(
    (c) => c.triggerId === triggerId && nowMs - new Date(c.sentAt).getTime() < COOLDOWN_DAYS * DAY_MS,
  );
}

function isEligible(trigger: AutomationTrigger, customer: Customer, nowMs: number): boolean {
  if (withinCooldown(customer, trigger.id, nowMs)) return false;
  const recencyDays = recencyDaysFor(customer, nowMs);
  switch (trigger.type) {
    case 'welcome':
      return customer.visitCount === 1;
    case 'birthday': {
      if (!customer.birthday) return false;
      const today = new Date(nowMs);
      const bday = new Date(customer.birthday);
      return bday.getMonth() === today.getMonth() && bday.getDate() === today.getDate();
    }
    case 'lapsed_14':
      return customer.visitCount > 0 && recencyDays >= 14 && recencyDays < 30;
    case 'lapsed_30':
      return customer.visitCount > 0 && recencyDays >= 30;
    case 'post_survey':
      return customer.visitCount > 0 && recencyDays === 0;
    case 'milestone_5':
      return customer.visitCount > 0 && customer.visitCount % 5 === 0;
    case 'custom':
    default:
      // 'custom' triggers have no built-in condition — they're fired manually from the CRM UI, not auto-evaluated here.
      return false;
  }
}

function applyTemplate(template: string, customer: Customer, settings: Settings): string {
  const vars: Record<string, string> = {
    name: customer.name,
    businessName: settings.businessName,
    points: toPersian(customer.loyaltyPoints),
    visitCount: toPersian(customer.visitCount),
    totalSpent: formatMoney(customer.totalSpent),
    walletBalance: formatMoney(customer.walletBalance),
  };
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}

/** Evaluates every active automation trigger against every customer and sends matching SMS messages. */
export async function runAutomationTriggers(): Promise<void> {
  const settings = await db.getSettings();
  if (!settings.kavenegarApiKey) return;

  const [triggers, customers] = await Promise.all([db.listAutomationTriggers(), db.listCustomers()]);
  const activeTriggers = triggers.filter((t) => t.isActive);
  if (!activeTriggers.length) return;

  const nowMs = Date.now();
  const nowISO = new Date(nowMs).toISOString();

  for (const trigger of activeTriggers) {
    for (const customer of customers) {
      if (!customer.phone || !customer.isActive) continue;
      if (!isEligible(trigger, customer, nowMs)) continue;

      const message = applyTemplate(trigger.action.messageTemplate, customer, settings);
      const result = await sendKavenegarSms(
        { apiKey: settings.kavenegarApiKey, senderLine: settings.kavenegarSenderLine },
        customer.phone,
        message,
      );

      await db.recordCampaign(customer.id, {
        type: 'automation',
        triggerId: trigger.id,
        triggerName: trigger.name,
        message,
        status: result.ok ? 'sent' : 'failed',
      });
      await db.recordSmsLog({
        recipients: [customer.phone],
        message,
        status: result.ok ? 'sent' : 'failed',
        error: result.error,
        sentAt: nowISO,
      });
      await db.recordAutomationRun(trigger.id, result.ok);
    }
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Call after any visit-affecting write (sale recorded). Debounced like inventory-engine's scheduleRecalculation. */
export function scheduleAutomationRun(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    runAutomationTriggers().catch((err) => console.error('[automation] run failed:', err));
  }, AUTOMATION_DEBOUNCE_MS);
}

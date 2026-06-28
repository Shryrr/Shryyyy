import * as db from '../db';
import type { Customer, RFMScore, RFMSegment } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const RFM_DEBOUNCE_MS = 10_000;

function recencyDaysFor(customer: Customer, nowMs: number): number {
  const ref = customer.lastVisit ?? customer.firstVisit ?? customer.createdAt;
  return Math.max(0, Math.floor((nowMs - new Date(ref).getTime()) / DAY_MS));
}

/** Quintile-buckets a metric into a 1 (worst) – 5 (best) score, ranked relative to the rest of the active customer base. */
function quintileScores(values: number[], higherIsBetter: boolean): number[] {
  const n = values.length;
  const ranked = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const scores = new Array<number>(n);
  ranked.forEach(({ i }, rank) => {
    const bucket = Math.min(5, Math.floor((rank / n) * 5) + 1);
    scores[i] = higherIsBetter ? bucket : 6 - bucket;
  });
  return scores;
}

/** Standard RFM segment heuristic, checked most-specific first; 'regular' is the catch-all middle bucket. */
function assignSegment(recency: number, frequency: number, monetary: number, visitCount: number): RFMSegment {
  if (visitCount <= 1) return 'new';
  if (recency >= 4 && frequency >= 4 && monetary >= 4) return 'champions';
  if (frequency >= 4 && recency >= 3) return 'loyal';
  if (recency >= 4 && frequency <= 3) return 'potential';
  if (recency <= 1 && frequency <= 2) return 'lost';
  if (recency <= 2 && frequency <= 2 && monetary <= 2) return 'hibernating';
  if (recency <= 2 && frequency >= 3) return 'at_risk';
  return 'regular';
}

/**
 * Recomputes percentile-based RFM scores and segments for every customer with at least one
 * recorded visit. Customers with zero visits keep the neutral 'new' state set at creation —
 * there is nothing yet to rank them against.
 */
export async function recalculateAllRfm(): Promise<void> {
  const customers = await db.listCustomers();
  const now = new Date();
  const nowMs = now.getTime();
  const active = customers.filter((c) => c.visitCount > 0);
  if (!active.length) return;

  const recencyDays = active.map((c) => recencyDaysFor(c, nowMs));
  const recencyScores = quintileScores(recencyDays, false);
  const frequencyScores = quintileScores(active.map((c) => c.visitCount), true);
  const monetaryScores = quintileScores(active.map((c) => c.totalSpent), true);

  for (let i = 0; i < active.length; i++) {
    const customer = active[i];
    const rfmScore: RFMScore = {
      recency: recencyScores[i],
      frequency: frequencyScores[i],
      monetary: monetaryScores[i],
      recencyDays: recencyDays[i],
      calculatedAt: now.toISOString(),
    };
    const segment = assignSegment(rfmScore.recency, rfmScore.frequency, rfmScore.monetary, customer.visitCount);
    await db.updateCustomerSegment(customer.id, segment, rfmScore);
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Call after any visit-affecting write (sale recorded/deleted, customer import). Debounced like inventory-engine's scheduleRecalculation. */
export function scheduleRfmRecalculation(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    recalculateAllRfm().catch((err) => console.error('[rfm] recalculation failed:', err));
  }, RFM_DEBOUNCE_MS);
}

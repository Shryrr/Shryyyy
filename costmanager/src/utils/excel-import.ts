import * as XLSX from 'xlsx';
import { parsePersianDigits } from './format';
import type { MenuItem } from '../types';

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const [headerRow, ...dataRows] = raw;
  const headers = (headerRow ?? []).map((h) => String(h ?? '').trim());
  const rows = dataRows
    .filter((r) => r.some((cell) => String(cell ?? '').trim() !== ''))
    .map((r) => headers.map((_, i) => String(r[i] ?? '').trim()));
  return { headers, rows };
}

/** Parses a numeric cell that may use Persian digits and/or thousands separators. */
export function parseCell(value: string | undefined): number {
  if (!value) return 0;
  const normalized = parsePersianDigits(value).replace(/,/g, '').trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export type CashierField = 'itemName' | 'quantity' | 'unitPrice' | 'total';
export type SnappfoodField = 'itemName' | 'quantity' | 'price' | 'discount' | 'commission' | 'netAmount';

export const CASHIER_FIELD_LABELS: Record<CashierField, string> = {
  itemName: 'نام آیتم',
  quantity: 'تعداد',
  unitPrice: 'قیمت واحد',
  total: 'مجموع',
};

export const SNAPPFOOD_FIELD_LABELS: Record<SnappfoodField, string> = {
  itemName: 'نام آیتم',
  quantity: 'تعداد',
  price: 'قیمت',
  discount: 'تخفیف',
  commission: 'کمیسیون',
  netAmount: 'مبلغ دریافتی',
};

const CASHIER_KEYWORDS: Record<CashierField, string[]> = {
  itemName: ['نام آیتم', 'نام کالا', 'item', 'product', 'کالا', 'شرح'],
  quantity: ['تعداد', 'qty', 'quantity', 'مقدار', 'count'],
  unitPrice: ['قیمت واحد', 'unit price', 'قیمت', 'price'],
  total: ['جمع کل', 'مجموع', 'total', 'جمع'],
};

const SNAPPFOOD_KEYWORDS: Record<SnappfoodField, string[]> = {
  itemName: ['نام آیتم', 'item name', 'item'],
  quantity: ['تعداد', 'quantity'],
  price: ['قیمت', 'price'],
  discount: ['تخفیف', 'discount'],
  commission: ['کمیسیون', 'commission'],
  netAmount: ['مبلغ دریافتی', 'net amount', 'net'],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

function detectColumns<F extends string>(headers: string[], keywords: Record<F, string[]>, priority: F[]): Record<F, number> {
  const result = {} as Record<F, number>;
  const used = new Set<number>();
  for (const field of priority) {
    const kws = keywords[field].map(normalizeHeader);
    const idx = headers.findIndex((h, i) => !used.has(i) && kws.some((kw) => normalizeHeader(h).includes(kw)));
    result[field] = idx;
    if (idx !== -1) used.add(idx);
  }
  return result;
}

export function detectCashierColumns(headers: string[]): Record<CashierField, number> {
  return detectColumns(headers, CASHIER_KEYWORDS, ['itemName', 'quantity', 'unitPrice', 'total']);
}

export function detectSnappfoodColumns(headers: string[]): Record<SnappfoodField, number> {
  return detectColumns(headers, SNAPPFOOD_KEYWORDS, ['itemName', 'quantity', 'price', 'discount', 'commission', 'netAmount']);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '');
}

/** Similarity ratio in [0,1]; 1 = identical (ignoring case/whitespace). */
export function similarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na && !nb) return 1;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length, 1);
}

export type MatchType = 'exact' | 'fuzzy' | 'none';

export interface ItemMatch {
  menuItem: MenuItem | null;
  score: number;
  matchType: MatchType;
}

const FUZZY_THRESHOLD = 0.7;

export function matchMenuItem(name: string, menuItems: MenuItem[]): ItemMatch {
  const exact = menuItems.find((m) => normalizeName(m.name) === normalizeName(name));
  if (exact) return { menuItem: exact, score: 1, matchType: 'exact' };

  let best: MenuItem | null = null;
  let bestScore = 0;
  for (const m of menuItems) {
    const score = similarity(m.name, name);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  if (best && bestScore > FUZZY_THRESHOLD) return { menuItem: best, score: bestScore, matchType: 'fuzzy' };
  return { menuItem: null, score: bestScore, matchType: 'none' };
}

export interface CashierImportRow {
  rowIndex: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  match: ItemMatch;
}

export function buildCashierRows(sheet: ParsedSheet, mapping: Record<CashierField, number>, menuItems: MenuItem[]): CashierImportRow[] {
  return sheet.rows.map((row, i) => {
    const itemName = mapping.itemName >= 0 ? row[mapping.itemName] ?? '' : '';
    const quantity = mapping.quantity >= 0 ? parseCell(row[mapping.quantity]) : 0;
    const rawUnitPrice = mapping.unitPrice >= 0 ? parseCell(row[mapping.unitPrice]) : 0;
    const rawTotal = mapping.total >= 0 ? parseCell(row[mapping.total]) : 0;
    const total = rawTotal || rawUnitPrice * quantity;
    const unitPrice = rawUnitPrice || (quantity > 0 ? total / quantity : 0);
    return { rowIndex: i, itemName, quantity, unitPrice, total, match: matchMenuItem(itemName, menuItems) };
  });
}

export interface SnappfoodImportRow {
  rowIndex: number;
  itemName: string;
  quantity: number;
  price: number;
  discount: number;
  commission: number;
  netAmount: number;
  match: ItemMatch;
}

export function buildSnappfoodRows(
  sheet: ParsedSheet,
  mapping: Record<SnappfoodField, number>,
  menuItems: MenuItem[],
): SnappfoodImportRow[] {
  return sheet.rows.map((row, i) => {
    const itemName = mapping.itemName >= 0 ? row[mapping.itemName] ?? '' : '';
    const quantity = mapping.quantity >= 0 ? parseCell(row[mapping.quantity]) : 0;
    const price = mapping.price >= 0 ? parseCell(row[mapping.price]) : 0;
    const discount = mapping.discount >= 0 ? parseCell(row[mapping.discount]) : 0;
    const commission = mapping.commission >= 0 ? parseCell(row[mapping.commission]) : 0;
    const netAmount = mapping.netAmount >= 0 ? parseCell(row[mapping.netAmount]) : 0;
    return { rowIndex: i, itemName, quantity, price, discount, commission, netAmount, match: matchMenuItem(itemName, menuItems) };
  });
}

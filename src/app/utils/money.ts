import { Pipe, PipeTransform } from '@angular/core';

/**
 * Currency-aware money formatting. KHR (riel) is whole with a trailing ៛;
 * USD shows a leading $ with two decimals. Keeps the app from hardcoding "riel"
 * now that positions can be in different currencies (see campulse-backend markets.py).
 */
const SYMBOL: Record<string, string> = { KHR: '៛', USD: '$' };
const DECIMALS: Record<string, number> = { KHR: 0, USD: 2 };

export function currencySymbol(currency?: string | null): string {
  const cur = (currency || 'KHR').toUpperCase();
  return SYMBOL[cur] ?? cur;
}

export function formatMoney(
  value: number | null | undefined,
  currency?: string | null,
  opts: { sign?: boolean } = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const cur = (currency || 'KHR').toUpperCase();
  const dp = DECIMALS[cur] ?? 2;
  const sym = currencySymbol(cur);
  const sign = opts.sign && value > 0 ? '+' : '';
  const num = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp
  }).format(value);
  return cur === 'USD' ? `${sign}${sym}${num}` : `${sign}${num} ${sym}`;
}

@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, currency?: string | null, sign = false): string {
    return formatMoney(value, currency, { sign });
  }
}

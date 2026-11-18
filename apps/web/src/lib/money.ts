/* apps/web/src/lib/money.ts — shared money formatting.
 * Currency is explicit today (ZAR default) and becomes property-driven when
 * the Phase 4 settings architecture lands; every page sweep (#71) routes here. */
export function formatMoney(amount: number, currency = 'ZAR', fractionDigits = 2): string {
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `R ${amount.toFixed(2)}`;
  }
}

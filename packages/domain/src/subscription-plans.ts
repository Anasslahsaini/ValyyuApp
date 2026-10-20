/** Pure: turns RevenueCat offering packages into the two plans the paywall shows. */
export type StorePackage = {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    priceString: string;
    price: number;
    currencyCode: string;
    introPrice?: { price: number; periodUnit: string; periodNumberOfUnits: number } | null;
  };
};
export type Plan = {
  id: string;
  kind: 'monthly' | 'annual';
  price: string;
  amount: number;
  currency: string;
  /** Annual only: the yearly price divided by 12, formatted. */
  perMonth: string | null;
  /** Free trial length in days, when the store offers one. */
  trialDays: number | null;
};

const DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };

export function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function plansFromPackages(packages: readonly StorePackage[], locale = 'fr'): Plan[] {
  const plans: Plan[] = [];
  for (const kind of ['annual', 'monthly'] as const) {
    const p = packages.find((x) => x.packageType === (kind === 'annual' ? 'ANNUAL' : 'MONTHLY'));
    if (!p) continue;
    const intro = p.product.introPrice;
    const trialDays =
      intro && intro.price === 0 ? intro.periodNumberOfUnits * (DAYS[intro.periodUnit] ?? 0) || null : null;
    plans.push({
      id: p.identifier,
      kind,
      price: p.product.priceString,
      amount: p.product.price,
      currency: p.product.currencyCode,
      perMonth:
        kind === 'annual'
          ? formatMoney(Math.floor((p.product.price / 12) * 100) / 100, p.product.currencyCode, locale)
          : null,
      trialDays,
    });
  }
  return plans;
}

/** "-55 %" style saving of the annual plan versus 12 monthly payments; null when not meaningful. */
export function annualSavingsPercent(plans: readonly Plan[]): number | null {
  const a = plans.find((p) => p.kind === 'annual'),
    m = plans.find((p) => p.kind === 'monthly');
  if (!a || !m || m.amount <= 0 || a.currency !== m.currency) return null;
  const pct = Math.round((1 - a.amount / (m.amount * 12)) * 100);
  return pct > 0 ? pct : null;
}

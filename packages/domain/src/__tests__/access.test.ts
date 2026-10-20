import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gateFor, resolveAccess } from '../access';
import { annualSavingsPercent, plansFromPackages } from '../subscription-plans';

const base = {
  authConfigured: true,
  authLoaded: true,
  signedIn: true,
  devPass: false,
  subscription: 'active' as const,
  onboarded: true as boolean | null,
};

test('nobody reaches the app without an account', () => {
  assert.equal(gateFor({ ...base, signedIn: false }), 'signin');
  assert.equal(gateFor({ ...base, authConfigured: false }), 'signin');
  assert.equal(gateFor({ ...base, authLoaded: false }), 'loading');
});
test('signed-in users without a subscription see the paywall', () => {
  assert.equal(gateFor({ ...base, subscription: 'inactive' }), 'paywall');
  assert.equal(gateFor({ ...base, subscription: 'loading' }), 'loading');
  assert.equal(gateFor(base), 'app');
});
test('the development pass skips account and paywall, not the first-launch questions', () => {
  assert.equal(
    gateFor({ ...base, authConfigured: false, signedIn: false, subscription: 'inactive', devPass: true }),
    'app',
  );
  assert.equal(
    gateFor({ ...base, authConfigured: false, signedIn: false, devPass: true, onboarded: false }),
    'onboarding',
  );
  assert.equal(gateFor({ ...base, devPass: true, onboarded: null }), 'loading');
});
test('first-launch questions come after sign-in and before the paywall', () => {
  assert.equal(gateFor({ ...base, onboarded: false, subscription: 'inactive' }), 'onboarding');
  assert.equal(gateFor({ ...base, onboarded: null }), 'loading');
  assert.equal(gateFor({ ...base, signedIn: false, onboarded: false }), 'signin');
  assert.equal(gateFor({ ...base, onboarded: true, subscription: 'inactive' }), 'paywall');
});

test('store purchase or enforcing server unlocks; admins always pass', () => {
  const off = { state: 'off' } as const,
    pending = { state: 'pending' } as const;
  const server = (active: boolean, admin = false, enforced = true) =>
    ({ state: 'done', value: { active, admin, enforced } }) as const;
  assert.equal(resolveAccess({ state: 'done', value: true }, off), 'active');
  assert.equal(resolveAccess(off, server(true)), 'active');
  assert.equal(resolveAccess(off, server(false, true)), 'active');
  assert.equal(resolveAccess({ state: 'done', value: false }, server(false)), 'inactive');
  assert.equal(resolveAccess(off, off), 'inactive');
  assert.equal(resolveAccess(pending, server(false)), 'loading');
  assert.equal(resolveAccess(pending, server(true)), 'active');
});
test('a server without RevenueCat never unlocks by itself', () => {
  assert.equal(
    resolveAccess(
      { state: 'off' },
      { state: 'done', value: { active: true, admin: false, enforced: false } },
    ),
    'inactive',
  );
});

const pkg = (
  packageType: string,
  price: number,
  intro?: { price: number; periodUnit: string; periodNumberOfUnits: number },
) => ({
  identifier: `$rc_${packageType.toLowerCase()}`,
  packageType,
  product: {
    identifier: `valyyu_${packageType.toLowerCase()}`,
    priceString: `${price} €`,
    price,
    currencyCode: 'EUR',
    introPrice: intro ?? null,
  },
});

test('plans: annual first, monthly price and free trial', () => {
  const plans = plansFromPackages(
    [
      pkg('MONTHLY', 12.99),
      pkg('ANNUAL', 69.99, { price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 1 }),
      pkg('LIFETIME', 199),
    ],
    'fr',
  );
  assert.deepEqual(
    plans.map((p) => p.kind),
    ['annual', 'monthly'],
  );
  assert.equal(plans[0]!.trialDays, 7);
  assert.equal(plans[0]!.perMonth?.replace(/\s/g, ' '), '5,83 €');
  assert.equal(plans[1]!.trialDays, null);
  assert.equal(plans[1]!.perMonth, null);
  assert.equal(annualSavingsPercent(plans), 55);
});
test('paid intro offers are not shown as free trials; missing plans are skipped', () => {
  assert.equal(
    plansFromPackages([
      pkg('ANNUAL', 69.99, { price: 9.99, periodUnit: 'MONTH', periodNumberOfUnits: 1 }),
    ])[0]!.trialDays,
    null,
  );
  assert.deepEqual(plansFromPackages([]), []);
  assert.equal(annualSavingsPercent(plansFromPackages([pkg('MONTHLY', 12.99)])), null);
});

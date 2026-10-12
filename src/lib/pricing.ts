// Copied verbatim from the website (livreee/lib/subscription/pricing.ts) to display
// the same prices; the server recomputes the charged amount.
export type PaidPlanCode = "pro" | "enterprise";

export const PLAN_MONTHLY_MAD: Record<PaidPlanCode, number> = {
  pro: 300,
  enterprise: 500,
};

export type BillingCadence = "monthly" | "quarterly" | "annual";

export const CADENCE_MONTHS: Record<BillingCadence, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
};

const CADENCE_DISCOUNT: Record<BillingCadence, number> = {
  monthly: 0,
  quarterly: 0.1,
  annual: 0.2,
};

export const CADENCE_PERIOD_DAYS: Record<BillingCadence, number> = {
  monthly: 30,
  quarterly: 90,
  annual: 365,
};

export function computeCadencePrice(monthlyMad: number, cadence: BillingCadence) {
  const months = CADENCE_MONTHS[cadence];
  const discount = CADENCE_DISCOUNT[cadence];
  const totalMad = Math.round(monthlyMad * months * (1 - discount));
  const perMonthMad = Math.round(totalMad / months);
  return { totalMad, perMonthMad, months };
}

export function isPaidPlanCode(value: string): value is PaidPlanCode {
  return value === "pro" || value === "enterprise";
}

export function isBillingCadence(value: string): value is BillingCadence {
  return value === "monthly" || value === "quarterly" || value === "annual";
}

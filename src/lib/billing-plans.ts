export type BillingPlan = 'free' | 'basic' | 'pro';

export type BillingPlanConfig = {
  key: BillingPlan;
  label: string;
  billable: boolean;
  limits: {
    instances: number;
    users: number;
  };
};

export const BILLING_PLANS: Record<BillingPlan, BillingPlanConfig> = {
  free: {
    key: 'free',
    label: 'Free',
    billable: false,
    limits: { instances: 1, users: 1 },
  },
  basic: {
    key: 'basic',
    label: 'Basic',
    billable: true,
    limits: { instances: 1, users: 2 },
  },
  pro: {
    key: 'pro',
    label: 'Pro',
    billable: true,
    limits: { instances: 2, users: 10 },
  },
};

export function normalizePlan(value: string | null | undefined): BillingPlan {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'basic' || v === 'pro' || v === 'free') return v;
  if (v.includes('pro') || v.includes('premium') || v.includes('prof')) return 'pro';
  if (v.includes('basic') || v.includes('bás') || v.includes('bas')) return 'basic';
  if (v.includes('free') || v.includes('grat')) return 'free';
  return 'free';
}

export function planLabel(value: string | null | undefined) {
  return BILLING_PLANS[normalizePlan(value)].label;
}

export function planIsBillable(value: string | null | undefined) {
  return BILLING_PLANS[normalizePlan(value)].billable;
}

export function planLimits(value: string | null | undefined) {
  return BILLING_PLANS[normalizePlan(value)].limits;
}


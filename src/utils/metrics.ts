import type { AppData, Filters, FinalStatus } from "../types/data";

export const initialFilters: Filters = {
  district: "All", area: "All", industry: "All", merchantSize: "All", branchProximity: "All",
  finalStatus: "All", promotionDriven: "All", onboardingMonth: "All", search: ""
};

export type MerchantView = AppData["merchantMaster"][number] & {
  onboarding: AppData["onboardingRecords"][number];
  outcome: AppData["merchantOutcomes"][number];
  pricing: AppData["merchantPricingProfiles"][number];
  usage: AppData["monthlyUsage"];
};

const industryShortLabels: Record<string, string> = {
  "Fruit Retail & Wholesale": "Fruit Trade",
  "Apparel & Daily Goods": "Apparel & Goods",
  "Education & Training": "Education"
};

export const shortIndustryLabel = (industry: string) => industryShortLabels[industry] ?? industry;

export function merchantViews(data: AppData, filters: Filters): MerchantView[] {
  const onboarding = new Map(data.onboardingRecords.map((x) => [x.merchant_id, x]));
  const outcomes = new Map(data.merchantOutcomes.map((x) => [x.merchant_id, x]));
  const pricing = new Map(data.merchantPricingProfiles.map((x) => [x.merchant_id, x]));
  const usage = new Map<string, AppData["monthlyUsage"]>();
  data.monthlyUsage.forEach((x) => usage.set(x.merchant_id, [...(usage.get(x.merchant_id) ?? []), x]));
  return data.merchantMaster.map((master) => ({ ...master, onboarding: onboarding.get(master.merchant_id)!, outcome: outcomes.get(master.merchant_id)!, pricing: pricing.get(master.merchant_id)!, usage: usage.get(master.merchant_id) ?? [] }))
    .filter((m) =>
      (filters.district === "All" || m.district === filters.district) &&
      (filters.area === "All" || m.area === filters.area) &&
      (filters.industry === "All" || m.industry === filters.industry) &&
      (filters.merchantSize === "All" || m.merchant_size === filters.merchantSize) &&
      (filters.branchProximity === "All" || m.branch_proximity === filters.branchProximity) &&
      (filters.finalStatus === "All" || m.outcome.final_usage_status === filters.finalStatus) &&
      (filters.promotionDriven === "All" || String(m.outcome.promotion_driven_tag) === filters.promotionDriven) &&
      (filters.onboardingMonth === "All" || m.onboarding_month === filters.onboardingMonth) &&
      (!filters.search || `${m.merchant_id} ${m.synthetic_merchant_name}`.toLowerCase().includes(filters.search.toLowerCase()))
    );
}

export const percent = (part: number, total: number) => total ? part / total : 0;
export const formatPct = (v: number) => `${(v * 100).toFixed(1)}%`;
export const formatRate = (v: number) => `${(v * 100).toFixed(2)}%`;
export const statusOrder: FinalStatus[] = ["Primary User", "Secondary User", "Backup User", "Churned", "Insufficient Observation"];

export const statusLabel = (status: FinalStatus) => ({
  "Primary User": "Primary Channel",
  "Secondary User": "Secondary Channel",
  "Backup User": "Backup Only",
  "Churned": "Stopped Using",
  "Insufficient Observation": "Insufficient Observation"
}[status]);

export type MetricValue = { value: number | null; numerator: number; denominator: number; rule: string };
const metric = (numerator: number, denominator: number, rule: string): MetricValue => ({ value: denominator ? numerator / denominator : null, numerator, denominator, rule });
const activeAtAge = (merchant: MerchantView, age: number) => merchant.usage.some((usage) => usage.merchant_age_month === age && usage.active_at_month_end);
const activatedWithin30Days = (merchant: MerchantView) => {
  const onboarding = new Date(`${merchant.onboarding_date}T00:00:00Z`).getTime();
  const firstTransaction = new Date(`${merchant.onboarding.first_real_transaction_date}T00:00:00Z`).getTime();
  return Math.floor((firstTransaction - onboarding) / 86400000) <= 30;
};

export function retentionSummary(merchants: MerchantView[]) {
  const activationEligible = merchants.filter((merchant) => merchant.eligible_for_30d_activation);
  const m3Eligible = merchants.filter((merchant) => merchant.eligible_for_3m_retention);
  const m6Eligible = merchants.filter((merchant) => merchant.eligible_for_6m_retention);
  const primaryEligible = merchants.filter((merchant) => merchant.eligible_for_primary_conversion);
  const finalEligible = merchants.filter((merchant) => merchant.eligible_for_final_outcome);
  return {
    activation: metric(activationEligible.filter(activatedWithin30Days).length, activationEligible.length, "First genuine Bank QR transaction within 30 days of onboarding."),
    m3: metric(m3Eligible.filter((merchant) => activeAtAge(merchant, 3)).length, m3Eligible.length, "Activated merchants active at lifecycle month 3, with three fully observable months after first transaction."),
    m6: metric(m6Eligible.filter((merchant) => activeAtAge(merchant, 6)).length, m6Eligible.length, "Activated merchants active at lifecycle month 6, with six fully observable months after first transaction."),
    primary: metric(primaryEligible.filter((merchant) => merchant.usage.some((usage) => usage.merchant_age_month === 3 && usage.usage_level === "Primary")).length, primaryEligible.length, "Primary Channel at lifecycle month 3 among merchants with that evaluation window."),
    stopped: metric(finalEligible.filter((merchant) => merchant.outcome.final_usage_status === "Churned").length, finalEligible.length, "Stopped Using among merchants with a fully observable final-outcome window."),
    rightCensored: {
      m3: merchants.filter((merchant) => !merchant.eligible_for_3m_retention).length,
      m6: merchants.filter((merchant) => !merchant.eligible_for_6m_retention).length,
      final: merchants.filter((merchant) => !merchant.eligible_for_final_outcome).length
    }
  };
}

export function rowsByMonth(merchants: MerchantView[]) {
  const usageByPortfolioMonth = new Map<string, AppData["monthlyUsage"]>();
  merchants.forEach((merchant) => merchant.usage.forEach((row) => usageByPortfolioMonth.set(row.portfolio_month, [...(usageByPortfolioMonth.get(row.portfolio_month) ?? []), row])));
  return Array.from({ length: 24 }, (_, index) => {
    const month = `202${index < 12 ? 4 : 5}-${String((index % 12) + 1).padStart(2, "0")}`;
    const rows = usageByPortfolioMonth.get(month) ?? [];
    const activeRows = rows.filter((row) => row.active_at_month_end);
    const activeMerchantIds = new Set(activeRows.map((row) => row.merchant_id));
    if (activeMerchantIds.size !== activeRows.length) throw new Error(`Monthly active merchants must be unique for ${month}`);
    const bankValue = activeRows.reduce((sum, row) => sum + row.bank_qr_transaction_value, 0);
    const allReceipts = activeRows.reduce((sum, row) => sum + row.all_channel_receipts, 0);
    const campaign = month >= "2024-01" && month <= "2024-03" || month >= "2025-11" && month <= "2025-12";
    return { month, onboarded: merchants.filter((merchant) => merchant.onboarding_month === month).length, active: activeMerchantIds.size, stopped: merchants.filter((merchant) => merchant.eligible_for_final_outcome && merchant.outcome.final_usage_status === "Churned" && merchant.usage.some((row) => row.portfolio_month === month && row.merchant_age_month === merchant.outcome.churn_month)).length, share: percent(bankValue, allReceipts), bankValue, allReceipts, pricingRegime: rows[0]?.pricing_regime_id ?? "N/A", campaign: campaign ? "Marketing campaign" : "Business as usual" };
  });
}

export function cohortRows(merchants: MerchantView[]) {
  const cohorts = new Map<string, MerchantView[]>();
  merchants.forEach((merchant) => cohorts.set(merchant.onboarding_month, [...(cohorts.get(merchant.onboarding_month) ?? []), merchant]));
  return [...cohorts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, rows]) => {
    const summary = retentionSummary(rows);
    return { month, merchants: rows.length, activation: summary.activation, m3: summary.m3, m6: summary.m6, primary: summary.primary, eligibleM3: summary.m3.denominator, eligibleM6: summary.m6.denominator, finalEligible: summary.stopped.denominator };
  });
}

export function pricingRegimeRows(merchants: MerchantView[]) {
  const regimes = ["REGIME_A", "REGIME_B", "REGIME_C", "REGIME_D"] as const;
  return regimes.map((id) => {
    const rows = merchants.flatMap((merchant) => merchant.usage).filter((row) => row.pricing_regime_id === id);
    const average = (key: keyof typeof rows[number]) => percent(rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0), rows.length);
    return { id, rows: rows.length, freeQuota: average("total_free_quota"), chargeable: average("chargeable_transaction_value"), value: average("bank_qr_transaction_value"), fee: average("estimated_monthly_fee"), effectiveRate: average("effective_fee_rate"), appliedRate: average("applicable_flat_rate") };
  });
}

export function campaignComparison(merchants: MerchantView[]) {
  const groups = [{ name: "Campaign onboarding", rows: merchants.filter((merchant) => merchant.onboarding.campaign_period !== "Non-campaign") }, { name: "Non-campaign onboarding", rows: merchants.filter((merchant) => merchant.onboarding.campaign_period === "Non-campaign") }];
  return groups.map(({ name, rows }) => {
    const summary = retentionSummary(rows);
    return { name, merchants: rows.length, activation: summary.activation, m3: summary.m3, m6: summary.m6, primary: summary.primary, promotion: metric(rows.filter((merchant) => merchant.outcome.promotion_driven_tag).length, rows.length, "Promotion-driven onboarding among all merchants in the group."), complaint: metric(rows.filter((merchant) => merchant.pricing.pricing_complaint).length, rows.length, "Merchants with a recorded pricing complaint among all merchants in the group."), decline: metric(rows.filter((merchant) => merchant.usage.some((usage) => usage.pricing_related_usage_decline)).length, rows.length, "Merchants with a pricing-related usage decline among all merchants in the group.") };
  });
}

export function feeBurdenByIndustry(merchants: MerchantView[]) {
  const groups = new Map<string, MerchantView[]>();
  merchants.forEach((merchant) => groups.set(merchant.industry, [...(groups.get(merchant.industry) ?? []), merchant]));
  return [...groups.entries()].map(([fullName, rows]) => { const usage = rows.flatMap((merchant) => merchant.usage); return { name: shortIndustryLabel(fullName), fullName, fee: percent(usage.reduce((sum, row) => sum + row.estimated_monthly_fee, 0), usage.length), effectiveRate: percent(usage.reduce((sum, row) => sum + row.effective_fee_rate, 0), usage.length) }; }).sort((a, b) => b.fee - a.fee);
}

export function statusRows(merchants: MerchantView[]) {
  return statusOrder.map((status) => ({ name: statusLabel(status), value: merchants.filter((m) => m.outcome.final_usage_status === status).length }));
}

export function rootCauseRows(merchants: MerchantView[]) {
  const normalized: Record<string, string> = {
    "Pricing Increase": "Pricing Increase",
    "Pricing Expectation Gap": "Pricing Expectation Gap",
    "Rate Notification Not Understood": "Rate Change Not Understood",
    "Promotion Ended": "Promotion-led Adoption",
    "Existing WeChat Habit": "Existing WeChat Habit",
    "Settlement Account Inconvenience": "Settlement Account Friction",
    "Repeated Speaker Failure": "Speaker Reliability Issue",
    "Settlement Information Uncertainty": "Other Operational Factors",
    "Bank QR Remained Non-primary": "Other Operational Factors"
  };
  const counts = new Map<string, number>();
  merchants.filter((m) => m.eligible_for_final_outcome && m.outcome.final_usage_status === "Churned").forEach((m) => {
    const name = normalized[m.outcome.likely_root_cause] ?? "Other Operational Factors";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function industryRows(merchants: MerchantView[]) {
  const map = new Map<string, MerchantView[]>();
  merchants.forEach((m) => map.set(m.industry, [...(map.get(m.industry) ?? []), m]));
  return [...map.entries()].map(([fullName, rows]) => ({ name: shortIndustryLabel(fullName), fullName, merchants: rows.length, churn: percent(rows.filter((m) => m.outcome.final_usage_status === "Churned").length, rows.length), primary: percent(rows.filter((m) => m.outcome.final_usage_status === "Primary User").length, rows.length) })).sort((a, b) => b.merchants - a.merchants);
}

export function exportRows(merchants: MerchantView[]) {
  return merchants.map((m) => ({
    merchant_id: m.merchant_id, merchant_name: m.synthetic_merchant_name, industry: m.industry, size: m.merchant_size,
    final_status: m.outcome.final_usage_status, churn_month: m.outcome.churn_month ?? "", final_bank_qr_share: m.outcome.final_bank_qr_share,
    rate_affected: m.pricing.affected_by_rate_change, rate_understood: m.pricing.merchant_understood_rate_change,
    pricing_gap: m.pricing.pricing_expectation_gap, pricing_related_churn: m.pricing.pricing_related_churn,
    root_cause: m.outcome.likely_root_cause, priority: m.outcome.priority, action: m.outcome.recommended_action
  }));
}

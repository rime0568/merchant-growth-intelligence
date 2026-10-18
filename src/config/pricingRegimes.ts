export const PRICING_ASSUMPTION_LABEL = "Experience-informed synthetic assumptions";

export const SYNTHETIC_EXCESS_RATE = 0.0025;

export type AllowanceFormulaMode = "BASE_PLUS_DEPOSIT_LINKED" | "MAX_OF_BASE_OR_DEPOSIT_LINKED" | "BASE_WITH_CONDITIONAL_ADDITIONAL";

export const allowanceFormulaMode: AllowanceFormulaMode = "BASE_PLUS_DEPOSIT_LINKED";

export const allowanceFormulaInterpretations: Record<AllowanceFormulaMode, string> = {
  BASE_PLUS_DEPOSIT_LINKED: "Under the current synthetic configuration, the total monthly Free Transaction Allowance equals RMB 100,000 plus twice the merchant's previous-month average daily deposit.",
  MAX_OF_BASE_OR_DEPOSIT_LINKED: "Under this synthetic configuration, the total monthly Free Transaction Allowance is the greater of RMB 100,000 and twice the merchant's previous-month average daily deposit.",
  BASE_WITH_CONDITIONAL_ADDITIONAL: "Under this synthetic configuration, RMB 100,000 is the base Free Transaction Allowance and an additional deposit-linked allowance applies only when the configured condition is met."
};

export type PricingRegimeId = "REGIME_A" | "REGIME_B" | "REGIME_C" | "REGIME_D";

export interface PricingRegime {
  id: PricingRegimeId;
  startDate: string;
  endDate: string;
  label: string;
  model: "quota" | "flat";
  baseFreeQuota: number;
  depositMultiplier: number;
  flatRate: number;
}

export const PRICING_REGIMES: PricingRegime[] = [
  { id: "REGIME_A", startDate: "2024-01-01", endDate: "2024-06-30", label: "Base Allowance + Deposit-linked Allowance", model: "quota", baseFreeQuota: 100000, depositMultiplier: 2, flatRate: 0 },
  { id: "REGIME_B", startDate: "2024-07-01", endDate: "2025-02-28", label: "Deposit-linked Allowance Only", model: "quota", baseFreeQuota: 0, depositMultiplier: 2, flatRate: 0 },
  { id: "REGIME_C", startDate: "2025-03-01", endDate: "2025-08-31", label: "Flat rate 0.20%", model: "flat", baseFreeQuota: 0, depositMultiplier: 0, flatRate: 0.002 },
  { id: "REGIME_D", startDate: "2025-09-01", endDate: "2025-12-31", label: "Flat rate 0.25%", model: "flat", baseFreeQuota: 0, depositMultiplier: 0, flatRate: 0.0025 }
];

export function totalFreeTransactionAllowance(baseFreeAllowance: number, depositLinkedAllowance: number): number {
  if (allowanceFormulaMode === "MAX_OF_BASE_OR_DEPOSIT_LINKED") return Math.max(baseFreeAllowance, depositLinkedAllowance);
  if (allowanceFormulaMode === "BASE_WITH_CONDITIONAL_ADDITIONAL") return baseFreeAllowance + depositLinkedAllowance;
  return baseFreeAllowance + depositLinkedAllowance;
}

export function pricingRegimeForMonth(portfolioMonth: string): PricingRegime {
  const date = `${portfolioMonth}-01`;
  const regime = PRICING_REGIMES.find((item) => date >= item.startDate && date <= item.endDate);
  if (!regime) throw new Error(`No pricing regime configured for ${portfolioMonth}`);
  return regime;
}

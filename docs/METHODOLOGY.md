# Methodology and Assumptions

## Scope and disclosure

This portfolio project uses deterministic synthetic data. All pricing numbers, dates, formulas, campaign timing, behaviours, and root-cause labels are Experience-informed synthetic assumptions, not official history for any financial institution.

## Time structure

Portfolio Calendar Time is the 24-month natural calendar from 2024-01 to 2025-12. Merchant Lifecycle Age is measured from each merchant's onboarding date, beginning at M0. Monthly records stop at 2025-12-31, so merchants onboarding late in 2025 do not have a common six-month follow-up period.

30-day activation requires a first genuine Bank QR transaction within 30 days of onboarding. M3 and M6 retention include only activated merchants with sufficient follow-up after that first transaction, and are aggregated with merchant-weighted denominators. A merchant without sufficient follow-up is right-censored for the relevant metric and shown as Insufficient Observation for final outcome reporting; it is neither counted as retained nor as Stopped Using.

## Pricing regimes

1. REGIME_A, 2024-01-01 to 2024-06-30: base free quota plus deposit-linked additional quota.
2. REGIME_B, 2024-07-01 to 2025-02-28: deposit-linked free quota only.
3. REGIME_C, 2025-03-01 to 2025-08-31: flat rate 0.20%.
4. REGIME_D, 2025-09-01 to 2025-12-31: flat rate 0.25%.

A Free Transaction Allowance is the monthly Bank QR transaction value processed without a simulated transaction fee. It is not an account balance, credit facility, daily limit, or monthly transaction cap. It applies only to Bank QR transaction value, not estimated all-channel merchant receipts.

The current `allowanceFormulaMode` is `BASE_PLUS_DEPOSIT_LINKED`. Under that configurable synthetic interpretation, Regime A total allowance equals RMB 100,000 plus twice the previous-month average daily deposit. Supported alternatives are `MAX_OF_BASE_OR_DEPOSIT_LINKED` and `BASE_WITH_CONDITIONAL_ADDITIONAL`. The selected interpretation does not represent a confirmed historical policy.

For allowance-based regimes, chargeable transaction value is the positive difference between Bank QR transaction value and total Free Transaction Allowance; estimated fee uses the configured synthetic excess rate. For flat regimes, estimated fee is transaction value multiplied by the applicable flat rate. These are distinct calculation mechanisms and are not presented as one continuous fixed-rate series.

## Campaign and seasonality

Campaign onboarding peaks are simulated in 2024 Jan-Mar and 2025 Nov-Dec. The late-2025 peak is intentionally right-censored because no 2026 data is generated. Fruit retail and wholesale has a Dec-Mar seasonal peak in receipts, transactions, active days, and fee sensitivity. Seasonality does not override pricing, settlement-account fit, or existing payment habits.

## Outcome terminology

Stopped Using is the user-interface name for the analytical concept of merchant churn: a merchant generated real activity and then stopped using the Bank QR channel within the defined observable period. Primary Channel, Secondary Channel, Backup Only, and Insufficient Observation remain separate outcomes or display states.

## Pricing KPI denominators

- Rate-change Affected: affected merchants divided by currently filtered merchants.
- Rate Change Understood: affected merchants confirmed to understand the prior mechanism, new mechanism, effective date, and likely fee impact, divided by affected merchants.
- Stopped-use Cases with Pricing-related Factors: sufficiently observed Stopped Using merchants with a recorded pricing transition, expectation gap, or communication factor, divided by sufficiently observed Stopped Using merchants.
- Open Pricing Complaints: unresolved pricing complaints out of total pricing complaints in the filtered portfolio; the page also reports the resolution rate.

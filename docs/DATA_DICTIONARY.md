# Data Dictionary

## Core entities

| Dataset | Grain | Purpose |
| --- | --- | --- |
| `merchantMaster` | One row per merchant | 308-merchant portfolio, profile, onboarding and observation fields. |
| `onboardingRecords` | One row per merchant | Onboarding dates, campaign attributes, and promotion signals. |
| `monthlyUsage` | Merchant by portfolio month | Usage, pricing, communication, seasonality, and lifecycle fields. |
| `merchantPricingProfiles` | One row per merchant | Pricing expectation, notification and complaint profile. |
| `merchantOutcomes` | One row per merchant | Final usage status, retention flags, root cause and action priority. |

## Time and observation fields

| Field | Definition |
| --- | --- |
| `onboarding_date` / `onboarding_month` | Merchant onboarding date and calendar month. |
| `portfolio_month` | Natural calendar month from 2024-01 to 2025-12. |
| `merchant_age_month` | Lifecycle month after onboarding, starting at M0. |
| `observation_end_date` | Last observable date, no later than 2025-12-31. |
| `observable_months` | Count of observable lifecycle months. |
| `eligible_for_3m_retention` / `eligible_for_6m_retention` | Eligibility flags for lifecycle retention. |
| `right_censored` | Insufficient observation; excluded from churn and retention outcome denominators. |

## Pricing fields

`pricing_regime_id` identifies REGIME_A through REGIME_D. In the interface, `base_free_quota`, `deposit_linked_free_quota`, and `total_free_quota` are labelled Base Free Allowance, Deposit-linked Allowance, and Total Free Transaction Allowance. The current configurable `allowanceFormulaMode` is `BASE_PLUS_DEPOSIT_LINKED`; supported values also include `MAX_OF_BASE_OR_DEPOSIT_LINKED` and `BASE_WITH_CONDITIONAL_ADDITIONAL`.

`previous_month_average_daily_deposit`, `base_free_quota`, `deposit_linked_free_quota`, and `total_free_quota` apply only to allowance-based charging. `chargeable_transaction_value`, `applicable_flat_rate`, `estimated_monthly_fee`, and `effective_fee_rate` record the simulated monthly calculation. Allowance-based fees apply only above the Free Transaction Allowance, while flat-rate fees apply to all Bank QR transaction value. `merchant_expected_fee`, `merchant_expected_rate`, and `pricing_expectation_gap` represent synthetic merchant expectations.

Communication fields distinguish sent, received, acknowledged, and understood notifications. `pricing_complaint` and `pricing_related_usage_decline` are synthetic diagnostic signals, not causal proof.

## Campaign and seasonality fields

`campaign_period`, `campaign_name`, `campaign_driven_onboarding`, `promotion_or_gift_motivated`, and `onboarding_quality_score` describe simulated onboarding campaigns. `seasonal_peak_flag`, `industry_seasonality_multiplier`, `pre_holiday_peak`, and `post_holiday_peak` describe seasonal conditions, especially the Dec-Mar fruit trade peak.

## Status values

The interface displays Primary Channel, Secondary Channel, Backup Only, Stopped Using, and Insufficient Observation. Stopped Using corresponds to the internal analytical churn status.

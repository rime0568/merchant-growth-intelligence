# AI Decision-Brief Evaluation

The AI layer should be evaluated independently from the deterministic metric tests.

## Acceptance criteria

| Dimension | Check | Pass condition |
|---|---|---|
| Schema | Response contains the four required sections | 100% |
| Evidence grounding | Every evidence item uses an allowed metric key | 100% |
| Numeric integrity | Displayed values come from the server metric map | 100% by construction |
| Boundary language | No causal or real-bank claim | 100% |
| Actionability | At least two specific human-reviewed actions | 100% |
| Failure handling | Missing key/provider error returns labelled demo mode | 100% |

## Scenario set

1. High pricing-related stopped-use share and low understanding.
2. Low pricing signal but weak primary-channel conversion.
3. Small filtered portfolio where cautious language is required.
4. Zero stopped-use cases without division errors.
5. High rate exposure with no open complaints.

## Review protocol

For each scenario, save the prompt version, model name, run date, structured output and reviewer notes. Do not compare models using anecdotal examples alone; report pass counts for every acceptance criterion.

## Automated contract coverage

`npm run test:ai` verifies the no-key fallback, trusted server formatting, rejection of incomplete metric payloads and rejection of unsupported HTTP methods. Provider-quality results are intentionally reported separately and must include saved run metadata.

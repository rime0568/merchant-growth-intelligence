# AI Architecture and Guardrails

## Design objective

The AI layer turns a validated portfolio snapshot into a concise decision brief. It is not allowed to calculate retention, pricing or complaint metrics. Those values remain owned by deterministic application code.

## Request boundary

The client sends only seven aggregate fields:

- portfolio size
- primary-user rate
- observed stopped-use rate
- pricing-related share of stopped-use cases
- rate-change exposure
- rate-change understanding
- open pricing complaints

No merchant names, customer identifiers, transaction rows or free-form user data are sent to the model.

## Structured response

The server requests four fields through a strict JSON Schema:

- `summary`
- `evidence`
- `actions`
- `limitations`

For evidence, the model selects a `metric_key` from a fixed enum and supplies only an interpretation. The server maps that key back to the trusted label and value. This prevents the model from replacing a calculated portfolio value with an invented number.

## Failure handling

The application returns a reviewed demo brief when:

- no server-side API key is configured;
- the provider request fails;
- the response is incomplete;
- structured output cannot be parsed.

The UI labels `Live AI` and `Reviewed demo` separately.

## Human control

Recommendations are decision support. The application does not send messages, change pricing, update merchant records or initiate any external action.

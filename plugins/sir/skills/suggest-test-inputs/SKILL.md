---
name: suggest-test-inputs
description: Given a CapabilityRef contract, propose a list of input cases that exercise the function's domain — boundary values, common cases, edge cases the spec implies. **You suggest inputs only — never expected outputs.** The orchestrator combines your suggestions with type-aware heuristic boundary cases, then runs a separate Python reference to derive expected values deterministically. Used as Pass 2 of the J.7 oracle pipeline.
argument-hint: <a CapabilityRef contract — name, signature, behavioral_description; you do NOT see the Python reference>
---

You are proposing test inputs for a single capability's spec. Your job is
to think about what input cases best exercise the function's behavior —
the boundaries, the common operating range, the corner cases the spec
implies, and any domain-specific quirks worth covering.

**You never write expected output values. You write inputs only.** A
separate deterministic step runs a Python reference function on your
inputs to produce the expected values. The architectural separation
protects Claim 11: the LLM authoring inputs has no way to bias toward
inputs the reference happens to handle correctly, because you do not
see the reference.

## What you're producing

A JSON object with a `suggested_inputs` array. Each entry is itself an
array of positional argument values matching the contract's signature.

Example output for a `gcd(a: i64, b: i64) -> i64` contract:

```json
{
  "rationale": "GCD has interesting cases at boundaries (0, 1, equal inputs), with one negative argument (sign behavior often diverges across implementations), and at extreme magnitudes including INT64_MIN where naive abs() overflows.",
  "suggested_inputs": [
    [48, 18],
    [100, 100],
    [0, 5],
    [5, 0],
    [1, 1],
    [-12, 8],
    [-100, 75],
    [9223372036854775806, -9223372036854775808],
    [1, 1000000007],
    [9999999, 1]
  ]
}
```

## Type marshaling

Match the contract's signature param types:

| IR type | JSON value type for inputs |
|---|---|
| `i64`, `i32`, `i1` | integer |
| `double` | number (float) |
| `ptr` (`bytes_input`) | string (UTF-8 if printable) or array of int 0..255 (binary) |
| `ptr` (`array_input`) | array of integers |
| `ptr` (`output_buffer`) | OMIT — orchestrator allocates, your suggestions don't include it |
| `ptr` (`buffer_size`) | OMIT — orchestrator handles based on output_buffer size |

For v0, scalar-only contracts work most reliably. Pointer-typed
contracts: do your best; the deterministic pipeline may filter
incompatible inputs.

## What makes good inputs

- **Boundary values** the spec implies (e.g., for a function defined on
  non-negative ints: 0, 1, large values; for indexed ops: empty,
  single-element, max-index)
- **Common operating range** — if the spec describes the function being
  used for X, suggest inputs from X's typical workload
- **Symmetry / sign cases** — for arithmetic ops, mix positive,
  negative, zero
- **Algorithm-specific corners** — for hash functions: empty input,
  single byte, multi-block boundary; for parsers: well-formed +
  one-byte-off-spec inputs
- **Spec-mentioned edge cases** — if `behavioral_description` mentions
  "returns 0 if n < 0", include negative inputs
- **Magnitude diversity** — small, medium, near-max, at-max

## What NOT to do

- **No expected outputs.** Anywhere. Not in the JSON, not in comments.
  Suggest inputs only.
- **No catalog references.** This is about exercising the contract's
  spec; you don't decide which catalog primitive matches.
- **No more than ~15 inputs.** The orchestrator combines your list
  with ~10 type-aware boundary cases; together that's plenty for v0.
  Quality > quantity.
- **No inputs that violate the spec's documented preconditions** (e.g.,
  for a function specced on non-negative inputs, don't suggest -100
  unless behavioral_description says it handles that).
- **No inputs whose expected output would overflow i64** for
  fast-growing algorithms. The IR operates in 64-bit signed integers
  ([-2^63, 2^63-1] ≈ ±9.2e18). For algorithms with output growth —
  factorial (n! grows super-exponentially; n=21 is the largest fitting
  in i64), Fibonacci/Tribonacci (≈φ^n; n≈92 for Fibonacci, smaller for
  Tribonacci), exponentiation (a^n) — bound your inputs so expected
  outputs stay in range. Use the behavioral_description and the
  algorithm name to estimate. The deterministic generator filters
  overflow with a warning, but suggesting unrunnable inputs wastes
  your input budget.

## Your tools

You have ONE deterministic tool to verify your inputs parse cleanly:

```bash
scripts/decomposer-tools validate-suggested-inputs \
  /tmp/inputs_draft.json <signature>
```

Returns `{"ok": bool, "errors": [...]}`. Validates: each input has the
right arity, types are compatible with the signature.

## Output

After validation passes, output ONLY the validated JSON object on the
last line of your response (wrapped in a JSON code block). No prose
around it. The orchestrator extracts the last JSON block.

## Argument

$ARGUMENTS

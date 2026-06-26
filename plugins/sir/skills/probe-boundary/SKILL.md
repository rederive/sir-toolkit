---
name: probe-boundary
description: Given an INSTALLED CapabilityRef contract, propose adversarial boundary inputs that exercise the function's edges — off-by-one, INT_MIN/MAX, empty/single-element/single-byte buffers, just-below and just-above documented limits, signed/unsigned-confusion seams, and boundary values implied by the spec. **You suggest inputs only — never expected outputs.** The audit-orchestrator runs a separate Python reference on your inputs to derive expected values deterministically. Used by Workstream K.1's audit pipeline.
argument-hint: <a CapabilityRef contract — name, signature, behavioral_description; you do NOT see the Python reference and you do NOT see the IR>
---

You are proposing **boundary** test inputs against an installed
capability — the kind of input that finds bugs near the edges of the
function's domain. Not random fuzzing; not common-case sampling.
Boundary cases.

**You never write expected output values. You write inputs only.** A
separate deterministic step runs a Python reference function on your
inputs to produce the expected values. The architectural separation
protects Claim 11: you have no way to bias toward inputs the reference
happens to handle correctly, because you do not see the reference. You
also do not see the IR — the spec and signature are all you get.

## What you're producing

A JSON object with a `suggested_inputs` array. Each entry is itself an
array of positional argument values matching the contract's signature.

Example output for a `gcd(a: i64, b: i64) -> i64` contract:

```json
{
  "rationale": "GCD's edges: identity element 0, both-zero, INT64_MIN where naive abs() overflows, adjacent ±1 transitions across zero, primes near INT64_MAX where the algorithm converges slowly, signed/unsigned confusion at the high bit.",
  "suggested_inputs": [
    [0, 0],
    [0, 1],
    [1, 0],
    [-1, 1],
    [1, -1],
    [-9223372036854775808, 1],
    [-9223372036854775808, -9223372036854775808],
    [-9223372036854775808, 2],
    [9223372036854775807, 1],
    [9223372036854775807, 9223372036854775806],
    [9223372036854775807, 9223372036854775807],
    [-9223372036854775807, -9223372036854775807]
  ]
}
```

## What "boundary" means concretely

**Numeric (i64 / i32 / i1 / double) parameters:**
- `0`, `1`, `-1` (identity / sign transitions)
- `INT64_MIN` (`-9223372036854775808`), `INT64_MIN + 1`,
  `INT64_MAX` (`9223372036854775807`), `INT64_MAX - 1`
- `INT32_MIN` / `INT32_MAX` (sign-extended seams when an i32 arg is
  passed as i64 register)
- For `double`: `0.0`, `-0.0`, smallest subnormal, largest finite,
  one-ULP-from-zero, one-ULP-from-INT64_MAX-as-double
- **Spec-implied edges**: if `behavioral_description` says "for n ≥ 0",
  test 0 and -1 (just inside / just outside the documented domain)

**Pointer parameters (`bytes_input`, `string_input`, `array_input`,
`mutable_state_buffer`):**
- Empty buffer (length 0)
- Single byte / single element
- Length 1 less than / 1 more than any documented power-of-two boundary
  (e.g., for SHA-256 block size 64: try 63, 64, 65)
- All-zero buffer
- All-0xFF buffer
- Embedded NUL (for string-typed inputs — does the IR treat NUL as
  terminator vs ignore it?)

**Boolean / enum-like (`i1`):**
- 0 and 1 only — no boundary surface

## What NOT to do

- **No expected outputs.** Anywhere. Not in the JSON, not in comments.
- **No catalog references.** This is about exercising the contract's
  spec; you don't decide which catalog primitive matches.
- **No more than ~15 inputs.** Quality > quantity. Boundary cases that
  the reference doesn't crash on and the IR can plausibly mishandle
  are more valuable than 50 same-class variations.
- **No inputs whose expected output would overflow i64** for
  fast-growing algorithms. The IR operates in 64-bit signed integers
  ([-2^63, 2^63-1] ≈ ±9.2e18). For factorial / Fibonacci / Tribonacci /
  exponentiation, bound your inputs so expected outputs stay in range.
  Use `behavioral_description` and the algorithm name to estimate. The
  deterministic generator filters overflow with a warning, but
  suggesting unrunnable inputs wastes your input budget.
- **No inputs that violate documented preconditions** unless the spec
  explicitly says they're handled. (A function specced for "a > 0,
  b > 0" should not get 0 unless the description mentions zero
  behavior.)

## Calibration

These are the canonical boundary findings the audit channel exists to
catch. If the contract you're given matches one of these algorithm
classes, your suggestions should include the relevant boundary:

| Algorithm class | Boundary that historically broke things |
|---|---|
| GCD / LCM / abs | `INT64_MIN` (naive abs() overflows: `-INT64_MIN` is undefined in i64) |
| Tribonacci / Fibonacci / factorial | The first n where `expected ≥ 2^63` (overflow into i64 negative) |
| String length / hash | Empty input; single-byte input; embedded NUL |
| SHA-256 / hash compress | Inputs at multi-block boundary (55, 56, 119, 120 bytes for SHA-256 padding) |
| Modular arithmetic | base = 0, modulus = 1, modulus = 2 |
| Array reduction | Empty array, length-1 array |

If the contract doesn't match a known class, fall back to the generic
numeric boundaries above plus 1-2 spec-implied edges.

## Type marshaling

Match the contract's signature param types:

| IR type | JSON value type for inputs |
|---|---|
| `i64`, `i32`, `i1` | integer |
| `double` | number (float) |
| `ptr` (`bytes_input`) | string (UTF-8 if printable) or array of int 0..255 |
| `ptr` (`string_input`) | string |
| `ptr` (`array_input`) | array of integers |
| `ptr` (`output_buffer`) | OMIT — orchestrator allocates |
| `ptr` (`buffer_size`) | OMIT — orchestrator handles based on output_buffer size |

For v0, scalar-only contracts work most reliably. Pointer-typed
contracts: do your best; the deterministic pipeline filters
incompatible inputs.

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

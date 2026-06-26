---
name: write-oracle
description: Write a Python reference function that implements the spec of a CapabilityRef contract. The function will be executed deterministically by the orchestrator on a list of inputs to produce (input, expected) test vectors — so the LLM (you) writes the algorithm, NEVER the expected outputs. Used by the SDK doesNotUnderstand path and by anywhere that needs to derive test vectors for a novel primitive.
argument-hint: <a CapabilityRef contract — name, signature, behavioral_description, param_semantics>
---

You are writing an executable Python reference for a single capability's
spec. Your output is exactly ONE Python source code block defining ONE
function. That function will be `exec()`'d and called by the orchestrator
on a separately-supplied list of inputs to produce the (input, expected)
test vector pairs. **You never write expected output values.**

## What you're producing

A standalone Python function that:

1. Has the **exact name** specified by the contract's `name` field.
2. Takes **positional arguments matching the contract's signature** (one
   Python parameter per IR parameter, in order).
3. Returns the value the contract specifies as its return type.
4. Implements the algorithm described in `behavioral_description`.
5. Is **pure**: no I/O, no global state, no `print()`, no file access.

Example output for a `tribonacci` contract with signature `i64 -> i64`:

```python
def tribonacci(n):
    if n < 0:
        return 0
    if n < 3:
        return [0, 0, 1][n]
    T = [0, 0, 1]
    for i in range(3, n + 1):
        T.append(T[i-1] + T[i-2] + T[i-3])
    return T[n]
```

## Type marshaling (Python ↔ IR)

| IR type | Python type the orchestrator passes you |
|---|---|
| `i64`, `i32`, `i1` | `int` |
| `double` | `float` |
| `ptr` (`bytes_input`) | `bytes` (the buffer contents) |
| `ptr` (`array_input`) | `list[int]` |
| `ptr` (`output_buffer`) | NOT passed — outputs are returned via your return value |
| `ptr` (`mutable_state_buffer`) | `list[int]` (you may mutate AND must return the new state) |

For contracts with `output_buffer` semantics, your function should
return what would be written into that buffer — usually as `bytes` or
`list[int]`. The orchestrator handles the executor-side packing.

For now (J.7 v0): scalar-only contracts (i64/i32/i1/double in/out) are
fully supported. Pointer-typed contracts work in principle but the
v0 vector generator's heuristic input cases only cover scalars; if you
get a contract with ptr params, do your best with the description
and the orchestrator will warn.

## Hard rules

1. **Output ONE function definition.** No imports outside the function
   body (you may use `import` inside the function if needed). No
   top-level code besides the `def`. **When a canonical stdlib
   implementation of the algorithm exists, CALL IT — do not
   re-implement.** See rule #9 below.

2. **Function name must match `contract.name` EXACTLY.** The orchestrator
   looks it up by name from the namespace produced by `exec()`.

3. **Positional args only.** No `*args`, `**kwargs`, default values that
   change arity. The validator rejects non-positional shapes.

4. **Must contain a `return` statement.** No print-only or side-effect-
   only functions. The validator checks this structurally.

5. **NEVER write hardcoded expected outputs anywhere.** If the spec
   includes test cases ("for n=7 the answer is 13"), you may use them
   to *verify your implementation by reading*, but DO NOT include them
   as code (no `if n == 7: return 13` shortcuts). The validator can't
   catch that pattern; trust on this is the human-audit gate.

6. **Pure function.** No `print`, no file I/O, no network, no
   `global`/`nonlocal` writes outside the function body, no `os.system`.
   Pure computation only.

7. **Handle obvious edge cases the spec mentions.** If the spec says
   "return 0 if n < 0", do that. The orchestrator will exercise
   boundary inputs (INT64_MIN/MAX, 0, 1, -1) and inputs the
   suggest-test-inputs skill proposed.

8. **The IR operates in i64; do NOT add wrap-around logic.** The
   contract's signature uses `i64` (or `i32`/`i1`); the synthesized IR
   will compute in those types and may wrap on overflow. Your Python
   reference uses arbitrary-precision integers — that's correct.
   Write the algorithm naturally without bit-masking or modulo-2^64
   tricks. The deterministic vector generator skips test cases whose
   expected value falls outside [INT64_MIN, INT64_MAX], so you only
   verify the IR against vectors it can actually represent. Do not
   try to second-guess this — natural Python is what's wanted.

9. **PREFER CANONICAL STDLIB IMPLEMENTATIONS over re-implementation.**
   This is **load-bearing for the audit channel**. If the algorithm
   has a stdlib implementation that's been tested and tuned for decades,
   USE IT directly rather than writing your own version of the same
   algorithm. Why: the IR being audited was synthesized by an LLM that
   may have the same algorithmic blind spots you do. If you re-implement
   `hypot` as `sqrt(a*a + b*b)`, the reference inherits the IR's overflow
   bug and the audit literally cannot detect divergence — both produce
   the same wrong answer. Calling `math.hypot(a, b)` gives an
   independent implementation that surfaces the IR's bug.

   Common cases where a canonical exists — call it directly:

   | Spec asks for | Use this canonical, not re-implementation |
   |---|---|
   | `hypot(a, b)` | `math.hypot(a, b)` (uses internal scaling — naive `sqrt(a*a+b*b)` overflows) |
   | `gcd(a, b)`, `lcm(a, b)` | `math.gcd(a, b)`, `math.lcm(a, b)` (handle INT_MIN correctly) |
   | `sqrt(x)`, `log(x)`, `exp(x)`, `sin/cos/tan` etc. | `math.sqrt`, `math.log`, etc. |
   | `log1p(x)`, `expm1(x)` | `math.log1p(x)`, `math.expm1(x)` (designed for catastrophic cancellation) |
   | `factorial(n)` | `math.factorial(n)` |
   | `is_prime`, `next_prime` | `sympy.isprime` if available, else careful trial division |
   | SHA-256, SHA-1, MD5, BLAKE2 | `hashlib.sha256(...).digest()`, etc. |
   | HMAC | `hmac.new(key, msg, hashlib.sha256).digest()` |
   | base64 encode / decode | `base64.b64encode/b64decode` |
   | `crc32` | `zlib.crc32` |
   | Levenshtein distance | re-implement (no stdlib); use the simple two-row DP |
   | Date / time arithmetic | `datetime` module |
   | Sorting | `sorted(arr)` (TimSort — battle-tested) |

   You can `import` inside the function body — the validator allows
   it. Prefer importing one well-known function over writing 5 lines
   of error-prone math. The "natural Python is what's wanted" rule
   from #8 was about i64-overflow specifically; for algorithm choice,
   "use the canonical" is the hierarchy-of-needs above naturalness.

   **Counter-example of what NOT to do** (this is the actual bug
   pattern that motivated this rule):

   ```python
   # WRONG — re-implements hypot naively, shares overflow bug with the IR.
   def hypot(a, b):
       import math
       if math.isinf(a) or math.isinf(b): return float('inf')
       if math.isnan(a) or math.isnan(b): return float('nan')
       return math.sqrt(a * a + b * b)   # overflows when a*a > DBL_MAX
   ```

   ```python
   # RIGHT — calls the canonical implementation; reference ≠ IR's blind spot.
   def hypot(a, b):
       import math
       return math.hypot(a, b)
   ```

   When in doubt: a one-line reference that calls a stdlib function
   is better than a 10-line hand-roll. The reference's correctness IS
   the audit's correctness; an LLM-hand-rolled algorithm is exactly
   the kind of code the audit channel is supposed to be checking.

## Your tools

You have ONE deterministic tool you MUST use to verify the reference
parses cleanly before returning:

```bash
scripts/decomposer-tools validate-python-reference \
  /tmp/reference_draft.py <function_name> <expected_arity>
```

Returns `{"ok": bool, "errors": [...]}`. Iterate until ok.

## Output

After validation passes, output ONLY the validated Python source on the
last line of your response, wrapped in a single ```python ...``` code
block. No prose around it. The orchestrator extracts the last code block.

## Argument

$ARGUMENTS

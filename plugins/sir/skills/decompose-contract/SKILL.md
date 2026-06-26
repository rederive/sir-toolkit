---
name: decompose-contract
description: Design ONE CapabilityRef contract for a single primitive in a recipe-based decomposition. Use the validator and catalog-lookup tools to iterate until valid.
argument-hint: <primitive name and behavioral role, plus any spec references>
---

You are designing a single primitive's contract for the Semantic Compiler's recipe-based synthesis pipeline. The primitive is one piece of a larger algorithmic decomposition. Your output is exactly ONE JSON object describing that primitive's contract.

## What you're producing

A `CapabilityRef`-shaped JSON object:

```json
{
  "name": "primitive_name",
  "exists": false,
  "description": "one-line description",
  "signature": "param_types -> return_type",
  "param_semantics": [
    {"name": "msg", "type": "ptr", "semantic": "bytes_input"},
    {"name": "msg_len", "type": "i64"},
    {"name": "out", "type": "ptr", "semantic": "output_buffer"},
    {"name": "out_size", "type": "i64", "semantic": "buffer_size"}
  ],
  "test_cases": [],
  "depends_on": ["names of other capabilities this primitive calls"],
  "algorithm_tags": ["sha256"],
  "behavioral_description": "Multi-paragraph spec. Include FIPS section refs or canonical algorithm citations. State the formula or step-by-step ops if known."
}
```

## Your tools

You have two deterministic Python tools you MUST use during your reasoning:

### 1. Catalog lookup — check if this primitive is already installed

Before designing a contract, check if a matching capability exists in the catalog. Run:

```bash
scripts/decomposer-tools catalog-match "<behavioral description>" "<signature>" --tag "<algorithm_tag>"
```

The tool returns a JSON list of matches with structural-match scores. **If a match has `score >= 0.8`, that primitive is almost certainly already installed — set `"exists": true` with `"name"` matching the catalog id, and stop.** Do NOT design a new contract for something that exists.

If no match scores >= 0.8 but a match scores 0.5–0.8, treat that as a hint: your proposed signature or description may be slightly off from what's installed. Inspect the matches and either adjust or proceed as new.

### 2. Validator — check your contract before returning it

When you've drafted a contract, write it to `/tmp/contract_draft.json` and validate:

```bash
scripts/decomposer-tools validate-contract /tmp/contract_draft.json
```

Returns JSON `{"ok": bool, "errors": [...], "warnings": [...]}`. If `ok` is false, READ THE ERRORS and fix. Iterate until `ok: true`. Do not return a contract that fails validation.

## Hard rules

- **`test_cases` MUST be `[]` (empty).** A separate oracle-anchored pass derives test vectors from a curated reference implementation. Authoring expected values is a Claim 11 / Hard Rule #6 violation.
- **Every `ptr` parameter MUST have a `semantic` from this vocabulary:** `bytes_input`, `output_buffer`, `mutable_state_buffer`, `buffer_size`, `array_input`, `array_output`, `array_length`. The validator rejects if any ptr lacks a semantic. The vocabulary is your communication protocol with the synthesizer — without it, the synthesizer guesses.
- **`signature` types are exactly:** `i64`, `i32`, `i1`, `ptr`, `double`. No others.
- **`depends_on` lists DIRECT calls only.** If your primitive calls `@sigma0` and `@sigma1`, list both. Don't list transitive dependencies (those are linked automatically). Don't list LLM intrinsics (those are always available).

## Semantic vocabulary guide

- `bytes_input` — caller-supplied immutable bytes. The function reads only.
- `output_buffer` — caller-allocated; function writes here. Pair with a `buffer_size` param so the function knows the capacity.
- `mutable_state_buffer` — caller-supplied state that the function reads AND writes in place. Use this for accumulator patterns (hash state H[8], cipher state, round state).
- `buffer_size` — i64 paired with a preceding `output_buffer`.
- `array_input` / `array_output` / `array_length` — for i64-element arrays (less common).

## Output

After validation passes, output ONLY the validated JSON contract on the last line of your response. No prose around it. The orchestrator parses your last JSON block.

## Argument

$ARGUMENTS

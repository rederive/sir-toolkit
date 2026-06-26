---
name: decompose-intent
description: Decompose a natural-language intent into a loose plan — list of capabilities (existing + missing), composition sketch, gaps, optional domain/interaction_pattern/recipe_id. The third skill in the family; used by program-build flows (iterative_compose) and the SDK doesNotUnderstand path. Does NOT require a top-level contract input.
argument-hint: <intent string and optional domain hint; the orchestrator embeds the catalog>
---

You are decomposing a user's intent into a structured plan that downstream consumers will use to either drive `iterative_compose` (build a program/binary) or directly synthesize the gap capabilities.

This skill is the third member of the decomposer skill family:

- `decompose-contract` — design ONE primitive's contract (you have a sketch)
- `decompose-recipe` — propose a recipe SHAPE (you have a top-level contract)
- **`decompose-intent`** (this one) — propose a loose PLAN (you have only an intent string)

You output exactly ONE JSON object describing the plan.

## What you're producing

A `DecompositionPlan`-shaped JSON object:

```json
{
  "intent": "<verbatim user intent>",
  "capabilities": [
    {
      "name": "capability_name",
      "exists": true,
      "pattern_id": "exact_catalog_id",
      "description": "what it does (one line)",
      "signature": "param_types -> return_type"
    },
    {
      "name": "new_thing",
      "exists": false,
      "description": "what it does",
      "signature": "param_types -> return_type",
      "param_semantics": [
        {"name": "x", "type": "i64"},
        {"name": "out", "type": "ptr", "semantic": "output_buffer"}
      ],
      "test_cases": [],
      "depends_on": ["names of other capabilities this gap calls"]
    }
  ],
  "composition_sketch": "pseudocode showing how capabilities wire together (main loop, glue, etc.)",
  "gaps": ["names of capabilities where exists is false"],
  "domain": "snake|tetris|crypto|game_physics|... or null",
  "interaction_pattern": "element_wise|reduction|pipeline|cross_product|fan_out or null",
  "recipe_id": "matching_recipe_id_from_catalog or null",
  "platform": ["threading", "crypto_random", ...]
}
```

The orchestrator embeds the full Method Dictionary catalog into the prompt context for you. Use it.

## Your tools

You have deterministic Python tools you MUST use during your reasoning:

### 1. Catalog match — confirm catalog references

When you mark a capability as `exists: true`, verify the pattern_id by running:

```bash
scripts/decomposer-tools catalog-match "<description>" "<signature>" --tag "<algorithm_tag>"
```

If the top match has `score >= 0.8`, that's your pattern_id. If you can't find a match at score >= 0.8 for something you thought existed, you were wrong — mark it as a gap (exists: false) and proceed.

### 2. Validator — check your plan before returning it

When you've drafted the plan, write it to `/tmp/decomposition_plan_draft.json` and validate:

```bash
scripts/decomposer-tools validate-decomposition-plan /tmp/decomposition_plan_draft.json
```

Returns JSON `{"ok": bool, "errors": [...], "warnings": [...]}`. If `ok` is false, READ THE ERRORS and fix. Iterate until `ok: true`.

The validator catches: well-formedness, catalog refs that don't resolve, Claim 11 violations (test_cases on gaps), I/O capabilities (which belong in glue, not as caps), depends_on entries that reference unknown names, and composition sketch sanity.

## Hard rules

1. **REUSE EXISTING capabilities.** The catalog (embedded in the prompt) is comprehensive. Search it thoroughly. For existing capabilities, set `exists: true` and copy the catalog id exactly into `pattern_id`.

2. **For genuinely new capabilities (gaps), set `exists: false`** and include description, signature, param_semantics, depends_on, and `test_cases: []` (ALWAYS empty — Claim 11).

3. **`test_cases` MUST be `[]` for every gap.** A separate oracle-anchored pass derives test vectors from a curated reference. Authoring expected values is a Claim 11 / Hard Rule #6 violation. The validator rejects.

4. **I/O IS GLUE, NOT A CAPABILITY.** Reading from stdin (scanf, fgets, getchar), writing to stdout (printf, puts), terminal I/O (term_*), file I/O, sleep/timing — ALL belong in the glue layer. NEVER create capabilities for `read_line_stdin`, `write_stdout`, `print_line`, `read_integer`, etc. The validator rejects these names. Composition sketch shows I/O via libc (scanf/printf/fgets) or terminal shims (term_read_key/term_write_raw).

5. **Terminal shims are pre-available.** For terminal games, mark these as `exists: true` (they don't need pattern_ids — they're platform shims):
   - `term_raw_mode`, `term_restore`, `term_read_key`, `term_usleep`
   - `term_write_raw`, `term_hide_cursor`, `term_show_cursor`

6. **Each capability does ONE thing.** Keep them simple and testable. Initialization logic (setting up arrays, initial values) belongs in the main loop glue, NOT as a separate capability. If something can be done with `state_set`, `state_get`, `array_fill`, or a simple loop in the glue, do that instead.

7. **Composition sketch must show the main loop:** init → input → update → render → sleep (for games) or read → process → write (for CLI).

8. **NEVER more than 2 pointer parameters per capability.** If you need more pointers, that's a composition of simpler primitives. The inner operation is a capability; the outer iteration is glue.

9. **`param_semantics` for EVERY parameter** of a gap (one entry per param, in order). Vocabulary: `bytes_input`, `output_buffer`, `mutable_state_buffer`, `buffer_size`, `array_input`, `array_output`, `array_length`. Omit `semantic` for plain scalar params.

10. **`depends_on` lists DIRECT calls only.** If a gap calls `@gcd` and `@hash_string`, list both. Don't list transitive. Don't list LLM intrinsics (always available).

11. **PLATFORM FEATURES** — declare in `platform` array if the program needs:
    - `threading` — lock-free ring buffers, atomic load/store
    - `crypto_random` — secure random from OS entropy

12. **RECIPE shortcircuit** — if a [RECIPE] in the catalog matches your intent, set `recipe_id` to its id. The downstream consumer (iterative_compose) will use the recipe's pre-built glue instead of re-generating. Don't re-decompose what a recipe already solves.

13. **INTERACTION PATTERN** — classify before planning:
    - `element_wise`: each output depends on one input (map, single loop)
    - `reduction`: many inputs → one output (fold, single loop with accumulator)
    - `pipeline`: output of one step feeds next (sequential)
    - `cross_product`: each output depends on combinations across multiple collections (matrix multiply: NEVER one function — decompose into nested loops via glue)
    - `fan_out`: one input feeds multiple independent computations

14. **TOP-LEVEL DEPENDS_ON** — if the intent describes a top-level capability that composes others, that capability's `depends_on` MUST list the sub-primitives.

15. **BOUNDARY-CUT** — separate representation-change ops (parsing, padding, endianness conversion) from core computation. Inlining padding into compression hurts cross-variant reuse (SHA-256 and SHA-512 share compression structure but have different padding constants).

## Output

After the validator returns `ok: true`, output ONLY the JSON plan on the last line of your response. No prose around it. The orchestrator parses your last JSON block.

## Argument

$ARGUMENTS

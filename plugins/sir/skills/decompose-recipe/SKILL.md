---
name: decompose-recipe
description: Propose the SHAPE of a recipe — list of primitive sketches with names, roles, signature hints, and dependency edges. Each primitive is later expanded into a full contract by decompose-contract. Use the validator and catalog-lookup tools to iterate until valid.
argument-hint: <intent + top-level capability description, including any spec references>
---

You are decomposing an intent into a recipe SHAPE. The shape is a list of primitive sketches that — once each is expanded into a full contract by `decompose-contract` — will compose into the requested capability. Your output is exactly ONE JSON object describing the shape.

You are NOT designing full contracts here. You are deciding:
1. Which primitives the recipe needs
2. What each primitive does (one-line role)
3. The dependency edges between them (the DAG)
4. Whether each primitive already exists in the catalog (lookup) or must be designed (decompose-contract handles this later)

## What you're producing

A `RecipeShape`-shaped JSON object:

```json
{
  "intent": "Compute HMAC-SHA256 of a message with a given key",
  "primitives": [
    {
      "name": "sha256",
      "role": "Compute SHA-256 hash of a byte string",
      "signature_hint": "ptr,i64,ptr -> i64",
      "depends_on": [],
      "exists": true,
      "pattern_id": "sha256"
    },
    {
      "name": "hmac_sha256",
      "role": "Compute HMAC-SHA256: H((K' XOR opad) || H((K' XOR ipad) || msg)) where K' is key (or H(key) if too long)",
      "signature_hint": "ptr,i64,ptr,i64,ptr -> i64",
      "depends_on": ["sha256"],
      "exists": false
    }
  ]
}
```

## Field semantics

- `intent` — verbatim copy of the input intent string (for traceability)
- `primitives[]` — ordered list, with the **top-level last** by convention (so consumers can find the recipe entry point at `primitives[-1]`)
- `name` — the primitive's identifier. Use snake_case. Match catalog ids exactly when `exists: true`.
- `role` — one-line behavioral description. Will be expanded by `decompose-contract` into a full contract; precision here saves iterations later.
- `signature_hint` — best-guess signature in `param_types -> return_type` form. Types are exactly: `i64`, `i32`, `i1`, `ptr`, `double`. The decompose-contract step will refine; this is a hint.
- `depends_on` — list of primitive names this primitive directly calls. Names must reference either (a) other primitives in this same shape, or (b) catalog entries. **List DIRECT calls only.** Transitive dependencies are linked automatically.
- `exists` — `true` if you found a catalog hit (score ≥ 0.8); `false` otherwise.
- `pattern_id` — when `exists: true`, the catalog id that matched. Omit when `exists: false`.

## Your tools

You have two deterministic Python tools you MUST use during your reasoning:

### 1. Catalog lookup — find existing primitives to reuse

For each candidate primitive in your proposed shape, check whether it's already installed:

```bash
scripts/decomposer-tools catalog-match "<role description>" "<signature_hint>" --tag "<algorithm_tag>"
```

The tool returns a JSON list of matches with structural-match scores. **If a match has `score >= 0.8`, set `exists: true` with `pattern_id` matching the catalog id.** This is the recipe-composing-a-recipe path: reuse what's installed instead of redesigning.

For the top-level intent itself, also run a catalog-match — if the WHOLE recipe is already installed (e.g., user asks for SHA-256 and it exists), your shape can be just one primitive marked exists=true.

### 2. Validator — check your shape before returning it

When you've drafted a shape, write it to `/tmp/recipe_shape_draft.json` and validate:

```bash
scripts/decomposer-tools validate-recipe-shape /tmp/recipe_shape_draft.json
```

Returns JSON `{"ok": bool, "errors": [...], "warnings": [...]}`. If `ok` is false, READ THE ERRORS and fix. Iterate until `ok: true`. Do not return a shape that fails validation.

The validator checks:
- DAG is acyclic at this layer (no design-tree cycles; runtime-recursion is fine and shows as a primitive's name appearing in the depends_on of one of its callees in the shape — that's link-time, not design-time)
- Every primitive has a non-empty name, role, and signature_hint
- `depends_on` entries reference either other primitives in the shape OR known catalog entries
- Top-level primitive (last in the list) has a non-empty depends_on when the intent implies composition (a single-primitive shape is fine when the intent is itself primitive-shaped)
- No duplicate primitive names

## Hard rules

- **Catalog hits must be exact name matches.** When `exists: true`, the `name` and `pattern_id` must equal the catalog id. Don't paraphrase; the orchestrator looks up by name.
- **Don't design contracts here.** No `behavioral_description`, no `param_semantics`, no `test_cases`. That's `decompose-contract`'s job, expansion happens later.
- **Recipe-shape DAG is acyclic.** Runtime recursion (e.g., `bencode_decode_value ↔ bencode_decode_list`) is realized at link time and shows as a primitive listing another in its depends_on; that's fine. **Design-tree** cycles (where you'd recursively decompose the same primitive) are forbidden — the cap-recursion mechanism handles this externally.
- **Keep the shape shallow when possible.** If the intent is well-served by one new primitive depending on installed catalog entries, propose ONE new primitive. Don't over-decompose into micro-primitives. (The orchestrator's downstream `probe-decomposability` skill will eventually catch this; until then, exercise judgment.)
- **Prefer named, well-known primitives in your shape.** A good primitive has a name worth saying out loud — appears in literature, RFCs, FIPS specs, or canonical library APIs. `sha256_pad_message` is a good name; `init_dp_row_for_levenshtein` probably isn't (too narrow).

## Output

After validation passes, output ONLY the validated JSON shape on the last line of your response. No prose around it. The orchestrator parses your last JSON block.

## Argument

$ARGUMENTS

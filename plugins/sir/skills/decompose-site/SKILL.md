---
name: decompose-site
description: Synthesize a complete Flatpack site (flatpack/<site>/ directory) from an intent description. Iterates against the build driver until `flatpack build <site> --target lambda` produces a Lambda-ready bootstrap.zip. Pure orchestration over existing catalog caps — does NOT synthesize new caps (if missing caps are required, escalate by listing what's needed).
argument-hint: <site-name> <intent description, e.g. "status page with /healthz">
---

You are synthesizing a complete Flatpack site from an intent. A site is a self-contained directory under `flatpack/<site>/` that compiles to a Lambda-ready binary via `python -m flatpack.compiler.build <site> --target lambda`. Your job is to author the Forth + HTML + (optional) data backend, then iterate against the build driver until it produces `bootstrap.zip`.

You author. The Forth compiler emits IR. The verified caps from the catalog are the leaves. The build driver is your validator. You succeed when the build succeeds.

## Architecture you're working in

Read these first (they're the source of truth, this prompt is a summary):
- `docs/FLATPACK_INTERNAL.md` — the design
- `flatpack/hello/` — reference site (the only one that exists today)
- `flatpack/shared/backends/lambda-runtime.fth` — the Lambda runtime loop (already there, you call into it via `dispatch`)

## Required site layout

```
flatpack/<site>/
  site.fth              ← `include` lines pulling routes/data/targets
  routes.fth            ← defines `dispatch ( i64 i64 -- i64 i64 i64 )`
  data.fth              ← `cap` declarations for any data backend (empty if none)
  pages/                ← one `.fth` per page composer word
    <page>.fth
  components/           ← one `.html` per HTML chunk
    <component>.html
  backends/data-impl/
    stub.c              ← C/Rust impl of any data caps (or stub if none)
  targets/
    lambda.fth          ← entry: includes shared/backends/lambda-runtime.fth + defines flatpack-main
```

Mirror `flatpack/hello/` exactly for shape. Only the contents differ.

## The Forth subset the compiler supports

**Builtins:** `dup drop swap over rot -rot @ ! c@ c! + - = <> < > <= >= 0= 0<> 0< 0>`
**Control flow:** `if else then`, `begin while repeat`, `begin ... until`, `case of endof endcase`
**Literals:** integer literals, `true` (=1), `false` (=0), `z" string"` (null-terminated)
**Declarations:** `variable`, `constant`, `create <name> <size> allot`, `cap <name> ( ptr/i64... -- ptr/i64? )`
**Word definition:** `: name ( ptr/i64... -- ptr/i64... ) body ;`

**NOT supported (will fail the compile):** `2swap 2dup 2drop >r r> i j literal allot-without-size` and anything else not listed above. Use `drop drop` for `2drop`, etc. Use globals (`variable` + `!`/`@`) instead of return-stack tricks.

**Stack-effect comments are mandatory.** The parser uses them to seed `%arg0..%argN` at function entry. Every `:` definition MUST be followed by `( in-types -- out-types )` with `ptr` or `i64` tokens. Comments inside `( ... )` are stripped, but the FIRST `( ... -- ... )` after `:` is the typed signature.

**Pages return three values:** `( -- response-ptr response-len status )`. Your `dispatch` calls a page word and propagates those three values.

## The catalog of verified caps you can call

List all available caps:
```bash
ls semcom/patterns/core/*.json | grep -v _status.json | xargs -I {} basename {} .json
```

For each cap you intend to call, read its JSON to learn the signature + behavior:
```bash
.venv/bin/python -c "import json; d=json.load(open('semcom/patterns/core/<name>.json')); print('sig:', d['param_signature']); print('desc:', d.get('behavioral_summary',''))"
```

You declare each cap you use at the top of its referring `.fth` file:
```forth
cap <name> ( <in-types> -- <out-type> )
```

Types are exactly `ptr` or `i64`. Function pointers / data pointers are both `ptr`. Booleans, lengths, fds are `i64`.

**Already-available caps that compose useful sites:**
- `flatpack_render` — Mustache subset; takes template + args_table + partials_registry + output buffer
- `http_build_request`, `http_response_complete` — HTTP framing (used by `shared/backends/lambda-runtime.fth`, no need to call directly)
- `lambda_response_envelope_v3` — wraps response body in Lambda's JSON envelope (status, content-type, body)
- `substring_copy` — bounded memcpy
- `string_starts_with`, `string_concat`
- `json_extract_string_value`, `json_extract_dynamodb_string_attr_v2`
- `args_lookup`, `args_list_at`, `partial_lookup` — Mustache renderer accessors (pulled in transitively, you don't usually call them)
- TLS, crypto, AWS SigV4, DynamoDB getitem — available if you need them

## Component getter caps (auto-generated)

For every `flatpack/<site>/components/<stem>.html`, the build generates:
```
cap comp_<stem>_ptr ( -- ptr )
cap comp_<stem>_len ( -- i64 )
```

You declare them in the page that uses them and call them. The build wires the implementations automatically.

## Empty args + partials

Most pages have no Mustache args (just `{{{body}}}`-style fill, no `{{name}}`). For those, allocate 8-byte zero buffers as the args + partials:

```forth
create empty-args 8 allot              \ n_keys = 0
create empty-partials 8 allot          \ n_partials = 0
```

Pass them to `flatpack_render` with length 8.

## The closed loop

After authoring all files, run:
```bash
.venv/bin/python -m flatpack.compiler.build <site> --target lambda
```

Read the output carefully:

- **"missing required file" / "missing required directory"** → file/directory shape is wrong, fix the layout
- **"MISSING CAPS"** → caps you referenced don't exist in the catalog. Two responses: (a) rewrite using only existing caps (preferred for v0), OR (b) report which caps need synthesis (don't try to synthesize them yourself, that's a separate skill)
- **"unknown word 'X' in body of 'Y'"** → Forth compiler doesn't know X. Either X is a typo, or X is a Forth feature not in the supported subset, or X is a user word you forgot to define
- **"stack underflow"** → your stack effect comment understates the input count, OR you call something that expects more than the stack has
- **"begin/while/repeat: body changes stack depth"** → loop body changes the depth; ensure each iteration leaves the stack at the same depth as begin saw it
- **llc / clang errors** → IR is malformed; usually means a cap signature you declared doesn't match what the catalog cap actually expects

Fix and re-run. Repeat until you see `Build complete: ... bootstrap.zip` lines.

## Auto-chain to cap synthesis when blocked

If the build reports `MISSING CAPS`, you have a CHOICE:

### Option A (preferred): synthesize the missing caps inline

For each missing cap, identify (a) its name, (b) its signature (`ptr,i64,... -> i64`), and (c) a behavioral description precise enough to derive a Python reference oracle. Then invoke the **`synthesize`** skill via the Skill tool with:

```
skill: synthesize
args: <cap_name> <full behavioral description including signature>
```

The synthesize skill designs the oracle, derives test cases, runs `cc_synth`, verifies via ctypes, and installs the cap into `semcom/patterns/core/<name>.json`. It can take 5-15 minutes per cap.

Synthesize each missing cap one at a time. After each successful synthesis, re-run `flatpack build <site> --target lambda` to confirm the cap resolved. When all caps land, finish authoring (e.g. fill in the page composer body that you'd previously left undefined) and re-run the build until it succeeds.

**When to choose Option A:** the missing cap is a clean computation (no I/O), the behavior is RFC- or spec-grounded, and a Python reference is straightforward to write. Examples: `secure_random_bytes`, `format_uuid_v4`, `url_decode`, `markdown_to_html` (for a fixed subset).

### Option B (fallback): escalate

If the missing cap has properties the synthesize skill won't handle well — needs syscalls (caps don't do I/O), depends on platform state, has no clean oracle, or requires deep RFC interpretation — escalate with a `BLOCKED:` report. The same BLOCKED format described in "Output" below.

**When to choose Option B:** the cap requires `getrandom(2)` or similar syscall (caps are pure; this belongs in a Forth word calling a syscall shim), the oracle is unclear, or the spec is too large for a focused synth session.

## Hard rules

- **NEVER hand-author or modify IR.** You author Forth; the compiler emits IR. Same rule as the rest of the project. Cap synthesis ALWAYS goes through the `synthesize` skill — never write IR yourself.
- **NEVER bypass `flatpack build`.** It's the validator. If you skip it, you've not verified anything.
- **NEVER edit `flatpack/shared/`.** That's reusable infrastructure across sites. Only edit `flatpack/<your-site>/`.
- **The user's site name and the directory name must match.** First argument is the site name.
- **Cap NAME is permanent.** Once you ask the synthesize skill to install a cap as `<name>`, you cannot rename it. Choose canonical names (RFC terms, FIPS specs, library APIs) on the first pass.

## Output

Author the site under `flatpack/<site>/`. Run `flatpack build`. Iterate until clean. Report one of three terminal states:

### SUCCESS — no synthesis was needed

```
SUCCESS: flatpack/<site>/ builds clean
  bootstrap.zip: <bytes>
  files authored:
    flatpack/<site>/site.fth, routes.fth, data.fth, ...
  caps used: <list>
  build iterations: <count>
```

### RECOVERED — auto-chained through cap synthesis

```
RECOVERED: flatpack/<site>/ builds clean after synthesizing N caps
  bootstrap.zip: <bytes>
  files authored: ...
  caps synthesized this run:
    - <name1> (signature, ~minutes to synthesize, install OK)
    - <name2> ...
  caps reused from catalog: <list>
  build iterations: <count>  (initial + per-synth retries)
```

### BLOCKED — synthesis path not appropriate; needs human/different skill

```
BLOCKED: flatpack/<site>/ requires caps the synthesize skill won't handle
  needed:
    - <cap_name> ( <sig> )
        <reason synthesis path is unsuitable — syscall? no oracle? deep spec?>
  files authored (incomplete): ...
  next step: <pointer to who/what should handle this>
```

## Arguments

$ARGUMENTS

---
name: sir-verify
description: Verify or migrate a code unit by reconstructing it from a spec + a frozen oracle and proving it on HELD-OUT inputs the implementation never saw (quorum of independent re-emissions). Use to migrate a function/route to new code (lift-and-shift, the original is the oracle), to verify novel code against properties (round-trip/idempotence/invariants), or to harden an existing unit. The held-out split is what distinguishes a correct port from a confident hallucination.
---

# sir-verify — the verified-recompose loop, as a tool

You turn "reimplement this unit" into a **supervised-learning problem with a held-out test set**:
frozen oracle = training set (in the prompt), held-out = test set (the impl never sees it),
quorum = ensemble agreement, coverage = hard-example mining. An in-prompt pass means nothing
(train accuracy is always ~100%); the **held-out pass** is the only evidence of generalization.

Toolkit: `experiments/sir-toolkit/`
- `verify.py <bundle> [--n 3] [--rounds 2] [--force]` — the quorum re-emit + held-out gate.
- `rails/stamp.mts` — differential stamper (runs the REAL fn to fill expecteds; never hand-author).
- `rails/check.mts` — vector-mode held-out check.
- `rails/propcheck.mts` — property-mode held-out check (generator + named properties).

## Step 1 — source the oracle (the only real decision)

"Where does the held-out ground truth come from?" Walk this in order (strongest first):

1. **Original/reference exists** (migration, lift-and-shift) → **vectors mode**: run the original
   on inputs to STAMP expecteds. Free + perfect. The original is the oracle.
2. **Known algorithm/protocol** (sha256, base32, semver) → vectors mode, expecteds from published
   test vectors or a reference lib you run.
3. **Trivially-correct slow version writable** → write it, it stamps the clever one (vectors mode).
4. **No exact outputs, but invariants hold** (novel code) → **property mode**: round-trip
   (decode∘encode=id), idempotence, determinism, charset/regex, conservation, monotonicity. The
   oracle is a `(generator, properties)` pair, not a table. Property oracles verify
   *correctness-of-contract*, not identity-to-a-reference — the right tool for greenfield.
5. **Effectful** → record/replay (inject the boundary; capture the trace as values) or a
   contract/schema oracle. (Boundary-injection adapters: clock/fetch/rand/fs/env — compose, don't
   author. See the migration captures in `experiments/decompile-middleware/roundtrip_effect/`.)
6. **Genuine judgment** (a product decision, a "should it 404 or 200?") → the human authors ONE
   frozen vector; the tool's job is to SURFACE the decision, never invent it.

A "novel" unit is rarely uniformly oracle-poor: **decompose to named leaves** (which are
oracle-rich by node 1–3) + property oracles for the thin glue + frozen human rulings for judgment.
Decomposition *is* oracle-sourcing.

## Step 2 — build the bundle

`<bundle>/spec.md` — the contract (signature + behavior; for migration, the SIR skeleton). The
spec must NOT contain the original source — re-emit is original-deleted.

`<bundle>/oracle.json`:
- vectors mode: `{"mode":"vectors","exportName":"fn","unit":"fn","vectors":[FROZEN],"heldout":[DISJOINT]}`.
  Author INPUTS only (`{name,args}`) in two files, then `tsx rails/stamp.mts <inputs.json>` fills
  `expected` from the REAL fn (execution-derived, never hand-authored); assemble into the two keys.
  `vectors` goes in the prompt (frozen oracle); **only `heldout` is graded**, and `verify.py`
  ABORTS if any held-out input duplicates a frozen input (leakage). A vectors-mode bundle with no
  `heldout` is train==test and `verify.py` says so loudly. (Worked example: `demo/jsonpatch/apply/`.)
- property mode: `{"mode":"property","module_exports":["encode","decode"],"generator":"gen.mts",
  "n":300,"properties":[{"name","kind",…}], "harness":"<path>" }` with `gen.mts` exporting
  `gen(i)->args[]` (deterministic by index, so reproducible; the rail varies the seed for fresh
  draws). Property kinds: roundtrip/inverse, deterministic, regex, idempotent, invariant. Optional
  `harness` = a VERIFIED reference module exposed as `H` inside `invariant` asserts (also `eq`,
  `clone`), so a glue property can round-trip through an already-verified leaf — e.g.
  `eq(H.applyPatch(clone(args[0]), out), args[1])`. (Worked example: `demo/jsonpatch/diff/`, whose
  harness is a quorum-verified `apply` emission. Composition: a verified leaf oracles the next layer.)

`<bundle>/anchors.json` (optional) — exact vectors to PIN a specific behavior/format where
identity matters (property oracles under-constrain; anchors add the identity the properties miss).

**Smoke-test the oracle before the loop**: run the rail against a known-good and a known-WRONG
impl and confirm it passes one and fails the other. An oracle that can't fail is theater.

**Saturate multi-value coverage** (quorum is only as strong as held-out coverage): run
`tsx rails/coverage_audit.mts <vectors.json>` on both frozen and held-out. It flags any
category/op value that never pairs with a ≥2-element list arg. For each real gap (an op that folds
over that list — ANY/ALL/tries-each), add a DISCRIMINATING vector where only a NON-FIRST element
satisfies — a `[matches, …]` case does not discriminate, `[no-match, matches]` does. A single-element
list never tests "tries every element," so a first-element-only reconstruction passes quorum
undetected (the `demo/junction_paywall_fleet` finding: 2 of 3 emissions silently wrong, majority
wrong, until a multi-pattern vector was added). The `sir-fleet` captor runs this audit automatically.

## Step 3 — run the loop

`SIR_REEMIT_TIMEOUT=900 python3 experiments/sir-toolkit/verify.py <bundle> --n 3`

It re-emits N=3 independent implementations (spec + oracle only, original absent), checks each vs
held-out, and reports QUORUM = ≥2 pass the FULL held-out set. On miss it adds a counterexample
(property mode freezes the violating input as an anchor; vectors mode wants fresh class vectors)
and re-emits once. Each round writes `runs/emit_r<round>_<k>.ts`.

## Orchestrating a whole TARGET (decompose → plan → execute → report)

When the target is more than one unit (a file, a module, a feature), this is the top-level flow —
the parent does the judgment, emits a reviewable plan, then a deterministic driver fans the units
out over the single-unit engine above. Four phases:

**A. Decompose & source (the value-add).** Break the target into units (`experiments/sir-toolkit/
sir_decompile.mts` gives a kind-graph — leaf / glue / effect / judgment — as a starting point; refine
by reasoning). Decompose until leaves are *nameable* (nameable = oracle-able). For each unit, walk
Step 1's decision tree to pick an oracle node, then author its bundle (Step 2): `<plandir>/<bundle>/
{spec.md,oracle.json}`. Flag any unit that hits node 6 (judgment) — it needs a human ruling frozen
into its oracle before the run.

**B. Plan + gate (do NOT skip).** Emit `<plandir>/plan.json` and present it for approval — this gate
is the product's trust surface (which oracle each unit gets, which seams need a ruling, the priced
estimate from `COST.md`):

    { "target": "...", "n": 3, "rounds": 1, "model": "sonnet", "escalate": "claude-opus-4-8",
      "units": [ { "unit": "applyPatch", "bundle": "apply", "kind": "leaf",
                   "oracleNode": "2", "seam": false }, ... ] }

Present: unit · kind · oracle node · held-out count · ⚠ seams-to-rule · est $. The human approves,
rules seams (freezes the vector), and picks fan-out vs one-at-a-time.

**C. Execute.** `python3 experiments/sir-toolkit/orchestrate.py <plandir> [--parallel] [--model M]
[--escalate M]`. Runs `verify.py` per unit (bundle path is relative to `<plandir>`, or absolute to
reuse an existing bundle), `--parallel` = fan-out, default = one-at-a-time. On a unit's **NO-QUORUM**
with `--escalate M`, it re-emits that unit once at the stronger tier — quorum is the self-policing
model-tier knob (push the tier cheap; quorum<2 is the signal to escalate). A unit with existing
`runs/` emissions and no `--force` is **re-checked, not re-paid** — so a plan can mix fresh + already
verified units cheaply.

**D. Report.** `orchestrate.py` writes `<plandir>/plan_report.json` + a scoreboard (per-unit quorum /
node / model / cost, totals, and any NO-QUORUM units). Each bundle's `verify_result.json` +
`oracle.json` are the permanent CI contract. (Worked example: `demo/jsonpatch/plan.json` — pointer +
apply + diff, where pointer re-emits fresh and apply/diff re-check.)

Single unit → skip the plan, call `verify.py` directly. Whole-module *Workflow* fan-out (heavier,
in-session subagents) → the fleet below.

## Interactive executor (DEFAULT — cheapest, and it ASKS at the forks)

When YOU (the main agent) drive the loop interactively, you are both the cheapest executor and the
only one that can resolve judgment live. Capture + verify run as your own Bash calls (≈free — the
session you're already in); only the re-emit is delegated to cheap, isolated workers. Measured:
~$0.15/unit (3 workers × ~11k tok) vs ~$2/unit for the autonomous Workflow fleet. No API key, no
`claude -p` cold-start.

Per unit:
1. **Source + author the oracle** (Step 1/2) with Bash: write inputs, `tsx rails/stamp.mts` (run the
   original = node 1), `tsx rails/coverage_audit.mts` on frozen + held-out, fill real multi-value
   gaps with discriminating vectors.
2. **Re-emit** — spawn N `sir-reemitter` agents via the **Agent tool, IN PARALLEL (one message, N
   tool-uses)**. Each is Write-only / Read-denied (structural original-deleted), so inline the oracle
   in its prompt: `tsx rails/worked.mts <frozen.json> <exportName>` prints the worked-examples block.
   Give each worker the spec + that block + a DISTINCT output path; tell it not to look for the source.
3. **Verify** with Bash: `tsx rails/check.mts <emit_k> <heldout.json> <unit>` per emission; QUORUM = ≥2
   pass the FULL held-out set. (You ran the check yourself — that IS the disk-truth re-verify.)
4. On a miss/divergence, add coverage or escalate — see the ASK list.

### When to ASK the human (use AskUserQuestion — these are genuinely the user's call)

- **Oracle source is ambiguous** — no original to run and no obvious reference. Which node: a
  property oracle, a reference you write, or the user's ruling?
- **A node-6 judgment seam** — the spec leaves a real policy decision open (a "should it 404 or
  200?"). The user rules it; you freeze that one vector.
- **The original does something SURPRISING** — returns `undefined` on a bad op, vacuous-truth
  default-open, a NaN comparator. Ask: *intended (freeze it as the contract) or a bug (flag it, do
  not preserve)?* This is the migration's most valuable findings, asked live instead of post-hoc.
- **Divergence / NO-QUORUM** — workers disagree, or quorum < 2. Show the split (the discriminating
  input + each output) and ask: which is correct / escalate the model tier / add coverage and re-emit?

### When NOT to ask (decide it yourself — don't pepper)

Authoring inputs, stamping, running the audit/check, computing quorum, coverage gaps the spec
clearly resolves, anything with a sensible default. Ask at the genuine fork, not the mechanics.

For a fully hands-off / background run (no human present to answer), use the Workflow fleet below
instead — it trades the asking for autonomy (and pays for the scaffolding subagents).

## Resynth a sirpm package (the trust-nothing local rebuild)

`sirpm` packages (`~/sirpm`, e.g. `@sirpm/colors`) ship a CONTRACT — `sir/` spec + `specs/<unit>.md`
behavioral contract + a held-out `oracles/<unit>.json` — not trusted bytes. A consumer rebuilds the
implementation LOCALLY from that contract rather than trusting the publisher's `src/`. The CLI can't
spawn subagents, so it splits the work with YOU:

1. **Prepare** — `sirpm resynth <pkg> [--unit U] [--n 3]` writes ready-to-spawn prompts to
   `<pkg>/.resynth/<unit>/prompt_K.txt` (one per worker; spec + frozen oracle + a distinct output
   path) and a `plan.json`.
2. **Spawn (your job)** — for each unit, spawn N `sir-reemitter` agents IN PARALLEL (Agent tool, one
   message), each given the verbatim contents of one `prompt_K.txt`. They're Write-only /
   original-deleted; they write to the `emit_K.ts` path named in their prompt.
3. **Apply** — `sirpm resynth <pkg> --apply [--unit U]` grades every emission on the HELD-OUT set,
   requires QUORUM (≥2 full), copies the winner into `src/<unit>` (with a provenance header),
   updates the manifest `srcSha256`, and re-runs `sirpm check`. Deterministic — no tokens.
4. **On NO-QUORUM** — add a discriminating frozen vector (coverage) or escalate the worker tier, then
   re-prepare + re-spawn. (Same self-policing signal as everywhere.)

This is the cheap in-session substrate (no API key, no `claude -p` cold-start) — the interactive
executor pointed at a package contract. `sirpm check` alone (no resynth) verifies the SHIPPED `src/`
against the oracle + content hashes, deterministically, and catches any tamper (behavioral miss +
hash mismatch).

## Whole-module fan-out (the fleet)

For verifying every unit of a module in parallel, use the saved workflow
`.claude/workflows/sir-fleet.js` (captor → N isolated quorum re-emitters → held-out verify →
coverage, per unit, concurrent). Re-emitters run as the `sir-reemitter` agent (Write-only, **no
Read**) so original-deleted is structural — the captor returns the stamped oracle and the workflow
inlines it into each re-emitter's prompt.

Invoke it via **scriptPath, not name** — the `name` path does not forward `args` (the script reads
`args` as a JSON string and parses it):

    Workflow({ scriptPath: ".../.claude/workflows/sir-fleet.js", args: {
      tsx, railsDir, runsDir, importPath,           // absolute paths
      n: 3,
      units: [ { unit, exportName, sig, spec } ]
    }})

`importPath` is a module exporting each unit (for non-exported internals, an all-exports
instrumented copy aliased `__t_<unit>` — see `experiments/decompile-editorconfig/fleet/instrument.mjs`).
Single-unit interactive runs don't need the fleet — use `verify.py`.

## Step 4 — read the result honestly

- **QUORUM** → the passing emission is the verified artifact; ship it + the bundle (the oracle
  becomes a permanent CI contract).
- **Emissions DISAGREE** (some pass held-out, some don't) → quorum just caught a luck/divergence
  that a single-emission run would have shipped blind. The minority is the bug.
- **All emissions miss the same held-out class** → a shared wrong prior = a real quirk/finding of
  the unit. Density-cover it (several fresh inputs of that class, not one) and re-run.
- **Never trust the loop's own prose summary** — re-run the rail on the emit files. (The fleet's
  own synthesis agent once misreported which round a miss happened in; the disk was ground truth.)

## Rules (non-negotiable, learned the hard way)

- Held-out inputs are FRESH and DISJOINT from frozen — reusing one is train/test leakage.
- A round closes only when ≥2 independent emissions agree on the FULL held-out set (one passing
  emission is luck).
- Oracles assert BEHAVIOR (wire bytes, claims, status, properties), never the source library's
  representation (error-string wording, object-vs-string body). Freezing representation is a trap.
- Expecteds are derived by EXECUTION, never authored by the model.

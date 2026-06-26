# SIR Schema — v0.1 FROZEN (2026-06-10) + v0.2 additions (2026-06-26)

> v0.2 (§§11–14, at the bottom) adds `KIND STATE`, fidelity variants, decision-table fidelity, and a
> `specVersion`'d bundle. v0.1 below is unchanged. **Generation now targets v0.2.**

---

## v0.1 — FROZEN (2026-06-10)

This resolves the six open grammar decisions of `SIR_HARNESS_ROADMAP.md` Part VI, plus three
additions forced by this week's evidence. **Generation targets this document.** Changes after
this point are versioned (v0.2, …), never silent. Each decision cites the specimen that
forced it — nothing here is resolved from taste alone.

Evidence base: dotenv-core (12 units, both round-trip tiers proven, coverage loop closed
IV.8) and editorconfig-core-js (held-out: firewall 19/19 cold, parse_string round-trip
25/25 + 18/18 ×2). Commits `397768c…95b4307`.

---

## 0. The invariants (unchanged, restated as frozen)

- One recursive tree of `KIND`-discriminated nodes; the discriminator **leads** — it is never
  inferred from shape (`feedback_discriminators_over_validators`).
- **The firewall:** a `FUNCTIONAL` subtree may not contain an `EFFECT`.
- **The oracle is the substrate.** A SIR artifact is self-contained = spec + frozen
  differential vectors. Prose (`INVARIANT`/`NOTES`) is an unverified prior — useful,
  optional, never load-bearing (proven: structural-only + coverage = 18/18 held-out, twice,
  two repos; and prose can be *wrong* — the `expand_variables.sir` author error).
- Expecteds are differential (run the original), never hand-authored.
- A unit's verification status is earned by the round-trip gate, original deleted.

## 1. Common header (every unit)

```
SIR     <name>                          # snake_case; a "name worth saying"
KIND    FUNCTIONAL | EFFECT | STATE     # STATE earns kindhood in v0.2 §11
SRC     <file>:<Class.>?<symbol>        # provenance; review diffs anchor here
SIG     (<params>) -> <result>
TRIGGER call | http(<route>) | cli | cron | <custom>     # OPTIONAL; default call. See §8.
REACH   entry | internal | off-path                       # See §6.
ORACLE  value | trace  @vectors: <path>  [VERIFIED <evidence>] | [not captured]
```

## 2. Decision 1 — LOOP accumulator: unit-level STATE only

`LOOP` gets **no first-class accumulator binding**. A unit that reads or writes an
accumulator declares it once, at unit level:

```
STATE  <name> (in) | (out) | (in/out)     # e.g. STATE map (in/out)   STATE cache (out)
```

*Evidence:* dotenv's `parse` fold (reads the in-progress map) and editorconfig's
`options.cache`/`options.files` accumulators both round-tripped from skeleton + vectors with
nothing more than a unit-level STATE marker — the **oracle carries fold semantics**
(18/18 ×2, both repos). A richer LOOP-accumulator slot would be prose-tier metadata; the
skeleton stays minimal. Caller-provided accumulators (a passed-in Map/array) are STATE, not
world effects — `processFileContents`'s `cache.set` stays FUNCTIONAL.

## 3. Decision 2 — emit/inject duality: EMIT may bind a result

```
EMIT    <boundary.op>(<args>) -> <name>    # outbound WITH meaningful reply: one node
EMIT    <boundary.op>(<args>)              # outbound, fire-and-forget
REQUEST <boundary.op>(<args>) -> <name>    # purely inbound (fs.read, env.read, clock, rand)
```

An outbound call with a reply (dotenv's `exec` → `spawn.sync`) is **one protocol step**: the
trace records the emission and the injected reply together. Splitting it into an EMIT+REQUEST
pair created artificial ordering ambiguity (which §5's canonical form would then have to
paper over). REQUEST survives for effects with no outbound payload.

## 4. Decision 3 — ON-ERROR is a BRANCH, not a kind

```
BRANCH on-error(<op>) { <arm> -> … }       # sugar; desugars to BRANCH with an error predicate
```

A kind must earn a **distinct verification obligation**; error arms verify exactly like
branch arms (arm coverage by captured inputs). *Evidence:* editorconfig's `getConfigSync`
try/catch (error → undefined contents → negative-cache path) is just an arm selected by an
injected outcome. Pure-tier error behavior (parse_string's error-TRUNCATION quirk) doesn't
even reach the skeleton — the vectors carry it (proven, round 1→2).

## 5. Decision 4 — traces are ordered; PAR is an explicit unordered window

- A trace is an **ordered sequence** of EMIT/REQUEST records. Canonicalization may normalize
  *representation* (key formatting, serialization) — **never ordering**.
- `PAR { … }` declares the only ordering exception: within a PAR block, the canonical form is
  the **sorted multiset** of the block's sub-traces. Verification is order-sensitive outside
  PAR windows, order-insensitive within.

*Evidence:* dotenv multi-file `load` order is load-bearing (later files override). **PAR is
frozen as design but UNVALIDATED — no specimen yet.** First concurrency specimen must test
it before PAR claims verification semantics (flagged, roadmap "harder effect cases").

## 6. Decision 5 — off-path units are kept, marked REACH

```
REACH entry      # on a public path from the module surface
REACH internal   # called only by other units
REACH off-path   # exported but uncalled on any module path
```

*Evidence:* dotenv's `is_ignored_line`, editorconfig's deprecated-but-exported
`parseFromFiles*` and "limited utility" `matcher`. Off-path units are part of the public
behavior surface — someone imports them; dropping them is **silent API loss in a migration**,
which is exactly the "unknowns" failure mode the harness exists to prevent. Cheap metadata,
no new kind, decompiler computes it from the export table + call graph.

## 7. Decision 6 — boundary descriptors are `<domain>.<verb>`, two levels

```
<domain> ∈ { fs, env, net, proc, db, time, rand, log, ipc, ui }      # closed set, versioned
<verb>   = operation class: read | write | stat | spawn | query | exec | fetch | set | …
```

- **Not per-API-function.** `fs.readFileSync` and `fs.readFile` are both `fs.read` — sync/async
  is calling-convention metadata, *proven irrelevant to the trace* (editorconfig's `getConfig`
  and `getConfigSync` produce identical trace shapes).
- Args stay on the node (`REQUEST fs.read(filepath)`), so finer-grained audit remains possible.
- The MODULE `SURFACE` line and the PR-review auditor diff operate at `domain.verb` level —
  a new `net.fetch` edge in a diff is exactly the red line a reviewer must see.
- Cap resolution maps a descriptor → a semcom cap when the catalog has one; otherwise it stays
  a typed boundary descriptor (the honest IV.4 state).

## 8. Forced addition 1 — TRIGGER is metadata, never structure

The spine rule ("an effect is an effect; the trigger is metadata") gets a frozen slot. A Next.js
route handler, a Nest controller method, a CLI subcommand, and a cron job with the same
choreography have the **same SIR body** and different `TRIGGER` lines. **This is the
migration invariant:** Next→Nest = re-emit with a rewritten TRIGGER, verified against the
same frozen trace oracle.

## 9. Forced addition 2 — opaque dependencies must be NAMED (the parse_to_uint32array lesson)

```
DEPENDS-ON <unit>, <unit>                      # in-module units
DEPENDS-ON OPAQUE(<module>.<symbol>), …        # external calls not on the known-pure allowlist
```

*Evidence:* editorconfig's `parse_buffer` semantics live in `@one-ini/wasm` — the v0 skeleton
never mentioned it, and the oracle silently carried the entire tokenizer (it worked, but a
reviewer couldn't see that the oracle was load-bearing there). Naming opaque deps makes the
firewall's blind spot visible.

**Tri-state firewall (resolves IV.2 as policy, not per-fixture tuning):**

| bucket | meaning |
|---|---|
| `EFFECT` | direct or transitive world effect detected |
| `FUNCTIONAL` | pure, all external calls on the known-pure allowlist (or none) |
| `FUNCTIONAL?` (suspect) | pure-shaped, but has OPAQUE deps not on the allowlist |

Unknown externals never silently pass as pure (the soundness fix) and never falsely claim
world effects (the noise fix). A suspect unit **with a passing value-oracle round-trip** is
behaviorally pinned even though purity is assumed — the badge upgrades trust, not kind.
The known-pure allowlist is a versioned artifact (starts: language builtins, `path.*` minus
cwd-dependence noted in GROUND_TRUTH strictness levels, `semver`, `minimatch`).

## 10. Forced addition 3 — frozen oracle-bundle contract

A **self-contained bundle** is:

```
bundle/
  sir/<unit>.sir            # specs per this schema
  oracles/<cluster>.json    # { unit, captured_from, vectors: [{name, (round,)? input|args, expected}] }
```

- Vectors are frozen at capture; coverage rounds append `cov_*`-prefixed vectors (fresh
  inputs; a disjointness guard MUST refuse any held-out string).
- The re-emit gate consumes ONLY the bundle (original deleted).
- **Closure rule (the editorconfig lessons, frozen as protocol):** a coverage round is closed
  only when (a) the full held-out set is re-run (new vectors can regress passing seams), and
  (b) **N≥2 independent emissions agree** (a pass on an uncovered class is luck). Priors are
  outvoted by evidence density, not overridden by single contradictions.

---

## Deferred (named, not frozen)

- `PAR` verification semantics (no specimen — §5 flag).
- Transactions / compensation, multi-process effects.
- An ambient-read tier (`env.cwd`, locale, TZ) — currently a GROUND_TRUTH strictness note.
- The `ui` domain verbs (frontend T3 is a non-goal at this phase).

---

# SIR Schema v0.2 — additions (2026-06-26)

Builds on v0.1 (frozen, above; unchanged). **New evidence:** the STATE-mutation re-grade of the shipped
catalog. `lodash.pullat` (runner STOPPED rather than ship — surfaced a *vacuous* STATE differential),
`aws4` (an `extraHeadersToInclude` signed-vs-canonical desync), and `lodash.defaultsdeep` (an `assignMergeValue`
wrong-leaf-rule). The `grade.mjs` STATE-differential fix (`8c33f80`) and the 20-unit re-grade under it (18 sound,
**2 real defects caught that the old gate had passed**) force three additions plus a bundle-versioning slot.
Nothing here is resolved from taste — each cites the specimen that forced it.

## 11. Forced addition 4 — `KIND STATE` earns kindhood: the `{result, post}` observable

```
KIND  STATE                                  # mutates a caller-provided argument in place
```

A kind must earn a **distinct verification obligation** (§4's rule). `STATE` does: a unit that mutates a
caller-provided argument in place is observed as **`{result, post}`** — the return value AND the post-call
state of the mutated argument — and its differential MUST **isolate arguments per call** (a fresh structural
clone per invocation).

*Evidence:* `lodash.pullat`. The v1 differential handed **one** decoded arg object to both the original and the
re-emission in sequence: the original mutated it and returned a reference, the re-emission then operated on the
**already-mutated** arg and returned the same reference → `r === w` **vacuously**, so a do-nothing mutator scored
200/200. (`decode()` passes live values *by reference*, so re-decoding does not un-alias — `structuredClone` does.)
Two follow-on defects had shipped VERIFIED under that vacuum (`aws4`, `defaultsdeep`); the sound gate caught both
on first run.

- **Mutate-and-return units** (`result === post` — the returned ref *is* the mutated arg): the held-out already
  pins the mutation through the return value; the fix is the per-call isolation in the differential.
- **Return≠post units** (`pullat` returns *removed elements*, a different object): **both** `result` and `post`
  are load-bearing and must be observed; value-mode that watches only the return is unsound for these → such a
  unit is quarantined unless the oracle observes `{result, post}`.

This **supersedes** v0.1 §2's "in-place mutation of a caller accumulator stays `FUNCTIONAL` + a `STATE` marker"
**for units whose *distinguishing* behavior is the mutation** — those are `KIND STATE`. The §2 unit-level `STATE
<name> (in/out)` marker remains for `FUNCTIONAL` units that merely thread a caller accumulator without their
identity depending on the mutation (the `processFileContents` case).

## 12. Forced addition 5 — fidelity variants: package-anchored vs spec-anchored

A unit may carry **≥1 fidelity variant**, each an independently verified artifact anchored to its own
**immovable** source — never a hand-written notion of "correct":

```
VARIANT package                              # default; anchored to the source package's actual bytes
VARIANT spec   ANCHOR <authority>            # anchored to an external authority (RFC vectors / reference impl / invariant)
```

- `package` (the implicit default for every unit to date): byte-faithful drop-in; the oracle is the source
  package run as today.
- `spec`: oracle anchored to an external authority — published RFC/test vectors, a reference implementation, or a
  spec **invariant**. Verified against THAT, not the package.
- The **gap** between two variants is the executed differential = the auto-generated **fidelity report**.

*Evidence:* `aws4`. Real aws4 forces a header into the `SignedHeaders` *list* via `extraHeadersToInclude` but omits
it from the canonical-headers *block* (the two builders use different filters) → a desynced signature. The
`package` variant reproduces that bug-for-bug (the byte-compatible drop-in); a `spec` variant anchored to the
**SigV4 consistency invariant** (`SignedHeaders names ≡ canonical-block names`) is the "correct" build. Both are
*earned*, neither hand-declared.

**Scope gate (when the feature switches on):** a `spec` variant exists ONLY where a second authority exists —
crypto, TLS, SigV4, encodings, HTTP semantics. For ad-hoc utilities (`lodash.pull`, `set-value`, …) the package
*is* the only truth; there is only ever a `package` variant and the feature stays silent. The on/off switch is
purely: does a spec oracle exist?

## 13. Forced addition 6 — decision-table fidelity: verify every cell against the original

The leaf / decision rule MUST be verified **cell-by-cell against the original package**, never modeled from the
prose hint or a plausible mental model. The decomposer runs the full Cartesian table (e.g. `dest` value-class ×
`src` value-class, including nested and array-index positions) against the original and encodes the **true**
observable per cell.

*Evidence:* `lodash.defaultsdeep`. The v0 SIR asserted *"a srcValue of `undefined` performs NO fill — no-op."*
Real lodash uses `assignMergeValue` — assign iff `(value !== undefined && !eq(dest[key], value)) || (value ===
undefined && !(key in dest))` — so `defaultsDeep({}, {a: undefined}) → {a: undefined}` **creates** the key. The
artifact faithfully implemented a *wrong SIR*, and the vacuous STATE differential masked it. Prose models
(`INVARIANT`/`NOTES`) remain unverified priors (§0); the decision table is **differential**, not prose.

## 14. Bundle contract v0.2 — `specVersion` + `variants`

Extends §10. The manifest records the spec a bundle was built against, and units may carry variants:

```
manifest.specVersion = "0.2"                 # the SIR Schema version this bundle targets; rdv asserts compatibility
units[].variants = {                          # OPTIONAL; absence ⇒ implicit single { package } variant (back-compat)
  package: { src, anchor: {kind:"package", ref}, verified },
  spec:    { src, anchor: {kind:"spec",    ref}, verified },
}
```

- **Back-compat:** a manifest with no `specVersion` is pre-0.2 (v0.1); a unit with no `variants` is an implicit
  single `package` variant. All 218 shipped units remain valid unchanged.
- `rdv check` verifies **each** variant against its own anchor and asserts `specVersion` is one it understands
  (the missing mechanical link between a shipped package and the spec it was built against).

---

## Deferred (v0.2)

- `spec`-variant *anchoring mechanism* for cross-language reference oracles (boto3 for `aws4`) — design only.
- `rdv add --fidelity <variant>` install-time selection — gated on the `rdv` installer existing.
- Promote `STATE` substructure (which arg is mutated) from oracle-carried to skeleton, IF a specimen forces it.

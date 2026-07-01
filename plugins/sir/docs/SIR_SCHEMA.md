# SIR Schema — v0.1 FROZEN (2026-06-10) + v0.2 additions (2026-06-26) + v0.3 additions (2026-07-01)

> **Canonical home: [github.com/rederive/sir-spec](https://github.com/rederive/sir-spec).** This copy ships with
> the plugin and is kept in sync.
>
> v0.2 (§§11–14) adds `KIND STATE`, fidelity variants, decision-table fidelity, and a `specVersion`'d bundle.
> v0.3 (§§15–18, at the bottom) codifies four features already implemented in `sir-factory` + `rdv`:
> `ORACLE-CLASS`/`TRACE-SEAM`, export-shape `SEAM`s, the `ENVELOPE`, and carried-data authority attestation.
> Earlier sections are unchanged. **Generation now targets v0.3.**

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

---

# SIR Schema v0.3 — additions (2026-07-01)

Builds on v0.1 + v0.2 (frozen, above; unchanged). **New evidence:** the three cold-agent UATs (`del` 2026-06-29,
`boxen` 2026-06-29, `query-string` 2026-06-30) and `@rederive/request`'s trace unit shipping in the OSS `rdv`.
Every addition here **codifies machinery already implemented** in `sir-factory` and `rdv` and exercised by shipped
bundles — v0.3 closes the gap between the practiced schema and the written one. Each cites the specimen that
forced it; nothing is resolved from taste.

## 15. Forced addition 7 — `ORACLE-CLASS` + `TRACE-SEAM`: an effect unit declares its injectable boundary

```
ORACLE-CLASS deterministic | trace | non-deterministic (<seam>)
TRACE-SEAM   <domain>                     # ONLY for trace-mode units: the injected boundary's domain (§7 set)
```

- `deterministic` → value-mode oracle (the default; pure function of its arguments).
- `trace` → the unit performs an EFFECT across an **injectable** boundary. It is stamped under a scripted fake
  boundary and its oracle records `{emitted, result}` — the ordered EMIT/REQUEST trace (§5 semantics) plus the
  final value. `TRACE-SEAM` names the domain so the harness knows which fake to build; the injected-boundary
  adapters live **in the verifier** (`rdv`), never in the package — a trust-nothing consumer must not run
  publisher-shipped harness code to check publisher code.
- `non-deterministic` with **no** injectable seam → **QUARANTINE**. The factory refuses to stamp a value-mode
  oracle for it; declaring `TRACE-SEAM` on a boundary that cannot actually be injected is a decomposer error.

*Evidence:* `@rederive/request`'s `httpRequest` (a `net` seam — ordered EMIT + injected response, record/replay
verified by the OSS CLI); chalk's `supports-color` ambient read (`env`/`tty`), injected as a collaborator in the
boxen run so the styling logic above the seam is value-verifiable.

## 16. Forced addition 8 — `SEAM`: export-shape adapters for non-callable exports

```
SEAM index | builder                      # OPTIONAL; absent ⇒ the export is invoked directly as a function
```

Value-mode grading drives the real export as a function. Real packages also ship two non-callable shapes:

- `index` — the export is a **pure data object** whose observable contract is property access (a consumer does
  `obj[key]`). The harness drives both sides as `key => obj[key]`.
- `builder` — the export is a **chainable constructor**: construct, walk a property/call chain, invoke. The
  harness drives both sides as `(opts, chain, input)`, where a string step is a property access and an
  `[name, ...args]` step is an access-then-call.

A seam adapter contains **zero domain knowledge** — it only navigates and invokes the *real* package, so it can
never rescue a wrong reconstruction. A non-callable export with no declared `SEAM` **quarantines** (the default
stays refuse-don't-guess). The reconstruction must export a plain function of the seam's calling convention; the
`SIG` line pins it.

*Evidence:* the boxen UAT — `cli-boxes` (a border-glyph table; property access *is* the contract) and `chalk`
(a default instance plus named `Chalk`; `new Chalk({level}).red.bold(x)`, `.hex('#f0f')(x)`). The gap was serious
enough that a cold agent, blocked by it, patched the toolkit to pass its own work — codifying the seam removes
the trigger; the immutability guardrail removes the capability.

## 17. Forced addition 9 — `ENVELOPE`: the verified input scope is part of the contract

```
ENVELOPE <one-line input scope>           # the input domain this unit is verified FOR
```

Verification is **evidence within an input distribution**, not a universal proof. When a unit is verified for a
subset of its potential domain, the envelope says so, and a consumer reusing it outside that scope knows they are
off the verified map. `pack` carries the envelope into the manifest and README; `rdv check` displays it. Absent
⇒ the unit claims its full documented signature domain. Together with §12's `FIDELITY`/`VARIANT` line, the
envelope makes a bundle state exactly *what was proven, against what anchor, over which inputs*.

*Evidence:* the del UAT (finding F5) — a glob engine verified against one project's pattern classes was correct
but **over-claiming** as a general drop-in; the envelope is the honest boundary. Same mechanism labels every
`spec`-fidelity divergence scope (the color-string percent correction).

## 18. Forced addition 10 — carried data: byte-exact extraction + an independent authority

```
CARRIED   <name> FROM <source-ref>        # extracted byte-exact by the TOOLCHAIN, never transcribed by a model
AUTHORITY { expr, equals }…               # re-runnable assertions anchoring the data to a PUBLISHED standard
```

Version-dependent tables (Unicode ranges, glyph charts, name→value maps) are **copied mechanically** at build
time (comment-safe const extraction; JSON sources parsed, not eval'd), content-hashed, and shipped as a data
module the reconstruction imports — a model never reproduces a 1,024-entry table from memory. Trust in carried
data comes from three independent legs:

1. the **oracle** exercises it (wrong data fails behavior);
2. the **content hash** pins it (any byte change is caught);
3. **authority assertions** check it against an *independent published standard* — UAX #11 for east-asian
   widths, the Unicode box-drawing chart for `cli-boxes` — not the source package's own bytes.

No assertions ⇒ **unattested** ⇒ the gate refuses by default. `rdv check` re-runs the authority assertions at
verify time, so a consumer re-verifies the attestation itself, not merely the hash.

*Evidence:* the boxen UAT — `get-east-asian-width`'s ranges and `cli-boxes`' glyph table (the terminal-stack
profile is carried-data-heavy); plus the extraction hardening the run forced (comments inside source literals,
pure-JSON sources).

## Bundle contract v0.3

`manifest.specVersion = "0.3"`. **Back-compat:** v0.2 bundles remain valid unchanged — every v0.3 field is
optional, and absence means the safe default (`ORACLE-CLASS deterministic`, direct-call export, full-signature
envelope, no carried data). `rdv` asserts `specVersion` compatibility per §14.

---

## Deferred (v0.3)

- `rdv normalize` (Mode 2, behavior-lock against a retained original) as a shipped one-command workflow — the
  method is validated on real modules; the command is not yet a product surface.
- A carried-data authority *registry* (named standards → canonical assertion sets), so common tables (UAX #11,
  box-drawing) attach attestations by reference.
- `PAR` verification semantics — still no forcing specimen (§5 flag stands).

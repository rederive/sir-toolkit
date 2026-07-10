---
name: greenfield-quorum
description: >
  Build NEW code (a feature or an app) leaf-by-leaf as verified, ZERO-DEPENDENCY units — and surface the genuine
  decisions the ecosystem disagrees on so a human decides them on purpose instead of by accident. Use when
  implementing greenfield functionality whose sub-problems are NAMED behaviors the npm ecosystem already
  implements (slug, currency/number/date formatting, rounding, transliteration, parsing, pluralize, humanize,
  etc.). The flow: doesNotUnderstand-decompose the feature into named leaves + glue → for each leaf, discover a
  QUORUM of reference packages → run them (sandboxed) to find where they AGREE (the contract) and DISAGREE (the
  decisions) → surface only the GENUINE forks to the human at product altitude → stamp an oracle from the chosen
  reference → synthesize a verified zero-dep implementation via blind quorum → install. You keep the behavior;
  you ship none of the packages. NOT for pure-novel logic with no reference (that falls to property oracles /
  a human ruling) — see BOUNDARIES.
---

# greenfield-quorum

The insight: today `npm install <x>` grabs bytes you trust and ship, and it silently accepts every decision the
package's author baked in — you never even see a decision was made. This flow inverts that. It uses the ecosystem
for its **behavior** (run a quorum of implementations once, in a sandbox, to derive oracles and surface where they
disagree) not its **bytes** (you ship your own verified, zero-dep implementation). The disagreements become
*decisions you make on purpose*. The 650-dependencies problem and "how do I verify greenfield code" are the same
move: harvest npm safely.

You drive this leaf-by-leaf. Each leaf is a full pass of the loop below. Delegate the synthesis + verification to
the existing SIR machinery (the `sir-reemitter-cr` role agent, `sir-factory stamp`, `rdv check`); this skill owns
the two NEW parts — **reference discovery/quorum** and **the decision-surfacer**.

## The loop (per named leaf)

0. **DECOMPOSE (doesNotUnderstand).** Break the feature into NAMED LEAVES + GLUE. A leaf is a behavior with a
   name worth saying that the ecosystem likely implements (`money_round`, `format_currency`, `slug`). Glue is the
   orchestration that composes leaves; it has no reference and is verified by PROPERTIES (step 9). If a leaf has
   no name and no npm implementation, it is not a quorum leaf — see BOUNDARIES.

1. **DISCOVER the reference set.** Find 3–5 packages implementing the leaf (your knowledge + `npm search`).
   **Always include the platform builtin as a spec-anchor when one exists** (`Intl.NumberFormat`,
   `Intl.DateTimeFormat`, `Intl.PluralRules`, `URL`, `TextEncoder`). The builtin is the standard AND zero-dep —
   often the quorum reveals the packages are strictly worse than what's already in the runtime.

2. **QUORUM STAMP (sandboxed).** In a throwaway dir: `npm init -y && npm i --ignore-scripts <the packages>`.
   Write ONE call-adapter per reference (each API differs — that's the discovery work) and a **stratified +
   CHAOS** input set (normal cases, boundaries, AND out-of-domain garbage — empty, wrong-type, non-finite,
   other-locale — because you only find the disagreements your inputs hit). Then let the helper do the mechanics:
   ```
   import { runQuorum, report } from '<this skill dir>/quorum.mjs';
   console.log(report(runQuorum(adapters, inputs)));
   ```
   It computes agreement, the disagreement set, and pairwise-agreement CLUSTERS.

3. **SPLIT.** Where all references agree = the **invariant contract** (the base behavior, not up for debate).
   Where they disagree = the **decision surface**.

4. **CHARACTERIZE + DISENTANGLE.** For each disagreement, name the AXIS in plain language (reason over the
   diverging outputs — the clusters tell you which references share a "school"). A single output can differ on
   several axes at once (case AND transliteration AND separator) — SEPARATE them into independent decisions.
   Then bucket each axis:
   - **OBVIOUS** → auto-resolve, capture the reasoning (e.g. a float-naive rounder that returns literally wrong
     money; a locale-blind formatter vs the standard). Do NOT ask the human about these.
   - **GENUINE CALL** → a real decision with real consequences. Save for step 5.
   - **DIFFERENT ALGORITHM** (clusters that implement different things, e.g. Damerau- vs classic-Levenshtein;
     pinyin vs drop for CJK) → this is ambiguity in the INTENT itself; surface as "which behavior did you mean?"

5. **SURFACE — only the genuine forks — via `AskUserQuestion`.** This is the crown of the flow. Obey all four:
   - **(a) Proven fork.** Never ask a question the quorum hasn't PROVEN is a real disagreement. No manufactured
     permission-asking — every question has a measured fork under it.
   - **(b) Product altitude.** You did the technical characterization upstream; the human sees "banker's vs
     half-up, and who requires which," never "IEEE-754 half-way ties." Resolve the technical part before asking.
   - **(c) Strip the obvious.** Only the genuine calls reach the human. Asking about auto-resolvable things is
     what makes a flow feel like nagging.
   - **(d) Frame as tradeoff + consequence, not preference.** Each option states what it optimizes and who needs
     it ("banker's: unbiased over many transactions; some tax authorities require it"). The human judges on what
     they care about, not on taste.

6. **RULINGS.** Record each answer as a **project ruling** (a small `RULINGS.md`). Rulings are reusable and
   inherited: index them by intent ("this project: locale-aware, de-DE; rounding: banker's, at-total") so the
   NEXT leaf that hits the same axis does not re-ask. The human is consulted once per *intent*, not per occurrence.

7. **STAMP THE ORACLE from the CHOSEN reference.** The oracle is `sir-factory stamp`-style: execute the reference
   that embodies the ruling (the package + config, OR the builtin spec-anchor) over the stratified + CHAOS inputs;
   expected values are ALWAYS execution-derived, never hand-authored. Capture the out-of-domain behavior (what the
   reference does on garbage) — it goes in the SIR's `OUT-OF-DOMAIN` stanza. Split frozen (teaching) / held-out
   (grading), disjoint.

8. **SYNTHESIZE (blind quorum).** Write a SPEC-FIDELITY SIR that states the RULING (the behavior + its
   discriminators + the out-of-domain note) — NOT an implementation; leave the technique open. Spawn N ≥ 3
   `sir-reemitter-cr` agents against a clean room (the SIR + the FROZEN oracle only; held-out hidden). Grade every
   emission against the FULL oracle including held-out; require quorum (≥2 agree on the full held-out set). A
   held-out miss = the SIR was ambiguous → harden it and re-emit. Install the winner as the verified zero-dep leaf.

9. **GLUE by PROPERTIES.** The orchestration that composes verified leaves has no reference — verify it with
   property oracles (round-trip, idempotence, conservation, ordering, monotonicity) plus the project rulings that
   govern composition (e.g. "sum exact, round once at the total"). No reference needed; the properties are the
   oracle.

10. **INSTALL + LEARN.** The verified leaf + its rulings go into the project (and, if catalog-worthy, the
    catalog). Next feature that needs this leaf already understands it — greenfield novelty shrinks with use.

## SANDBOX discipline (non-negotiable)

You are running untrusted packages to derive oracles. Do it once, in an EPHEMERAL throwaway dir, with
`--ignore-scripts` (no install hooks), no credentials in the environment, ideally no network after install. Keep
ONLY the stamped vectors (they are data). DISCARD the packages — none of them ship. The install-hook worm cannot
touch a run-once-and-discard.

## BOUNDARIES (say which truth-source you are standing on)

- **Quorum covers NAMED leaves with references.** Genuinely novel logic (nobody has built it) has no quorum → it
  falls to a **property oracle** (step 9) or a **frozen human ruling**. Do not pretend a novel leaf is quorum-able.
- **Quorum is CONSENSUS, not TRUTH.** If every reference forked the same buggy gist, they agree on the wrong
  thing. Where a real standard exists (an RFC, ISO 4217, a builtin), anchor a `spec`-fidelity oracle to IT, not to
  package consensus. (The currency case: three packages "agreed" and were all wrong vs the Intl/ISO standard.)
- **You only find disagreements your inputs hit.** Weak inputs → missed forks. Throw CHAOS (out-of-domain) inputs;
  that is where silent-degradation decisions hide.
- Verification strength is unchanged by this skill: a leaf is only "verified" via held-out blind quorum, same as
  any recompose. This skill adds discovery + decisions in front of that; it does not weaken the gate.

## The payoff

Every leaf ships zero dependencies and is verified against a held-out oracle. Every ecosystem-disagreement
decision was made on purpose, framed as a real tradeoff, and recorded. The bug where a German site silently
strips German characters — or an invoice silently rounds with `toFixed` and half-up — is caught at AUTHORSHIP, as
a question you actually answer, not discovered in production.

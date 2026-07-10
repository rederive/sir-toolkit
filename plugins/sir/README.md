# sir — SIR verified-recompose toolkit

Decompile a package into a **verified, self-contained re-implementation**. A *sighted* decomposer reads the source once and emits a SIR (a `KIND`-discriminated behavior tree) plus a held-out oracle; *N blind clean-room* emitters reconstruct the unit from that contract alone (original deleted); two gates decide — a **held-out quorum** (≥2 independent emitters pass the full held-out set) and a **saturation differential** (the winner vs the real package, N=400). The verified bundle ships its *contract*, not trusted bytes; a consumer re-verifies with `rdv` or rebuilds locally.

Conforms to **SIR Schema v0.4** ([canonical repo](https://github.com/rederive/sir-spec); synced copy at `docs/SIR_SCHEMA.md`): `KIND STATE` with `{result, post}` observation, fidelity variants (`package` vs `spec`), `ORACLE-CLASS`/`TRACE-SEAM` effect declarations, export-shape `SEAM`s, the verified-scope `ENVELOPE`, carried-data authority attestation, the concurrency layer (validated `PAR`, virtual time, the resource-lifecycle channel, `RING`), and `specVersion`'d bundles.

## Components

**Agents** (`agents/`)
- `sir-decomposer` — the only sighted role; reads source, writes the SIR + oracle generator, runs the harden loop.
- `sir-reemitter` / `sir-reemitter-cr` — blind emitters (no Read of source; clean-room reads the SIR file only).
- `sir-factory-runner` — orchestrates a unit end-to-end: drives the `sir-factory` CLI + spawns the role agents, enforces the gates, quarantines what it can't soundly verify.

**Skills** (`skills/`)
- `sir-verify` — the verified-recompose loop as a tool: drives the `sir-factory` CLI (install → decompose → stamp → re-emit → grade → pack) and `rdv` (check / resynth) via the role agents. Holds the oracle-sourcing decision tree, the two-legs discipline (differential + quorum, non-substitutable), the off-fit-class guidance, and the grader-soundness checklist.
- `preflight` — build a measured-strength characterization oracle for zero-test / weakly-tested code before you re-derive or migrate it (coverage → adversarial review → mutation testing → chaos; gate on a mutation score).
- `greenfield-quorum` — build NEW code leaf-by-leaf as verified zero-dep units, using a QUORUM of npm references (run once, sandboxed) to derive each leaf's oracle AND surface the genuine decisions the ecosystem disagrees on — so a human decides them on purpose, at product altitude, instead of by accident. Includes `quorum.mjs` (the mechanical agreement/clustering helper).

## Dependencies (shipped separately, NOT bundled)

Per the split decision, the heavy engines are their own CLIs the agents call out to:

| dep | what | used by |
|---|---|---|
| **`sir-factory`** | build orchestrator (`factory.mjs` + `lib/`: install → decompose → stamp → re-emit → grade → pack) | `sir-factory-runner` |
| **`rdv`** | trust-nothing verifier (`rederive` CLI) — `check` / `resynth` | `sir-verify`, consumers |

## Status

Structure, manifests, components, **engine split, path wiring, and cold-install hygiene are done**:
1. ✅ **Paths de-hardcoded** — agent/skill prompts invoke the `sir-factory` CLI (a global command) + `rdv`, not monorepo paths.
2. ✅ **`sir-factory` extracted** — its own zero-dep CLI ([github.com/rederive/sir-factory](https://github.com/rederive/sir-factory)), the canonical home of the orchestrator (the monorepo copy is retired).
3. ✅ **Cold-install-clean** — `sir-verify` rewritten to drive only the shipped `sir-factory` + `rdv`; the misfiled semcom decomposition skills (LLVM-typed capability contracts) removed. The plugin is now SIR-recompose only: one skill (`sir-verify`) + the four role agents.
4. ✅ **Smoke test** — `marketplace add` → `install sir@sir-toolkit` (clean) → drove a fresh unit
   (`escape-string-regexp@5`) end-to-end: sighted decompose → stamp → 3× blind clean-room re-emit →
   **grade VERIFIED (quorum 3/3, differential 500/500)** → pack → **`rdv check`: ALL UNITS VERIFIED**. The three
   blind emitters independently derived **two distinct implementations** from the contract SIR — real independence,
   not transcription.

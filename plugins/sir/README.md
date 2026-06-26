# sir — SIR verified-recompose toolkit

Decompile a package into a **verified, self-contained re-implementation**. A *sighted* decomposer reads the source once and emits a SIR (a `KIND`-discriminated behavior tree) plus a held-out oracle; *N blind clean-room* emitters reconstruct the unit from that contract alone (original deleted); two gates decide — a **held-out quorum** (≥2 independent emitters pass the full held-out set) and a **saturation differential** (the winner vs the real package, N=400). The verified bundle ships its *contract*, not trusted bytes; a consumer re-verifies with `rdv` or rebuilds locally.

Conforms to **SIR Schema v0.2** (`docs/SIR_SCHEMA.md`): `KIND STATE` with `{result, post}` observation, fidelity variants (`package` vs `spec`), decision-table fidelity, and `specVersion`'d bundles.

## Components

**Agents** (`agents/`)
- `sir-decomposer` — the only sighted role; reads source, writes the SIR + oracle generator, runs the harden loop.
- `sir-reemitter` / `sir-reemitter-cr` — blind emitters (no Read of source; clean-room reads the SIR file only).
- `sir-factory-runner` — orchestrates a unit end-to-end: drives the `sir-factory` CLI + spawns the role agents, enforces the gates, quarantines what it can't soundly verify.

**Skills** (`skills/`)
- `decompose-contract` / `decompose-recipe` / `decompose-intent` / `decompose-site` — the capped-recursion decomposition family.
- `write-oracle` · `discover-edge-cases` · `suggest-test-inputs` · `probe-boundary` — oracle construction + coverage.
- `sir-verify` — drive `rdv` to verify / locally rebuild a bundle.

**Commands** (`commands/`) — `synth` (synthesize a capability). *(More are project-specific and intentionally left out.)*

## Dependencies (shipped separately, NOT bundled)

Per the split decision, the heavy engines are their own CLIs the agents call out to:

| dep | what | used by |
|---|---|---|
| **`sir-factory`** | build orchestrator (`factory.mjs` + `lib/`: install → decompose → stamp → re-emit → grade → pack) | `sir-factory-runner` |
| **`rdv`** | trust-nothing verifier (`rederive` CLI) — `check` / `resynth` | `sir-verify`, consumers |

## ⚠️ Wiring TODO (scaffold → working plugin)

This is the **scaffold** — structure + manifests + components in place. Before it's a working plugin:
1. **De-hardcode paths.** The copied agent/skill prompts reference monorepo paths (e.g. `…/orchestrator/factory.mjs`). Replace with the `sir-factory` CLI entrypoint (resolved via PATH or `${CLAUDE_PLUGIN_ROOT}`), and `rdv` similarly.
2. **Publish `sir-factory`** as its own CLI/npm package (split from `experiments/sir-toolkit/orchestrator`), and document install.
3. **Smoke test:** `/plugin marketplace add` → `install` → run `sir-factory-runner` on one fresh unit end-to-end.

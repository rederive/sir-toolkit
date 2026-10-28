# sir-toolkit — a Claude Code plugin marketplace

> **Legacy (SIR v0.4).** This plugin is superseded by **`rederive@rederive`**, which supports SIR v0.5 — one
> language-neutral primary plus a file per language (JavaScript, TypeScript, Rust), graded against one canonical oracle.
> Install it instead: `/plugin marketplace add rederive/rederive` then `/plugin install rederive@rederive`, and run
> `rdv init --yes` in your project. This repository stays available for existing v0.4 workflows and receives no new features.

Distributes the **SIR verified-recompose** methodology as a Claude Code plugin.

> **Two channels, two artifact types.** The *factory* (this methodology — skills + agents + the `sir-factory`/`rdv` CLIs) ships here, as a Claude plugin. The *output* (verified, self-contained units) ships as npm `@rederive/*`.

## Add the marketplace

```
/plugin marketplace add rederive/sir-toolkit
/plugin install sir@sir-toolkit
```

The plugin tracks `main` (rolling release — no pinned version), so `/plugin marketplace update sir-toolkit` followed by `/reload-plugins` always pulls the latest agents and skills.

Then install the two CLIs the plugin drives:

```
npm i -g rederive sir-factory     # the rdv verifier + the build orchestrator (both on npm)
```

(Developing locally? `/plugin marketplace add ~/sir-toolkit` works from a checkout.)

## What's in it

One plugin, [`sir`](plugins/sir/) — see its [README](plugins/sir/README.md). It contributes the SIR skills and agents; it **depends on** two CLIs that are shipped separately (not bundled):

- **`sir-factory`** — the build orchestrator (`factory.mjs` + `lib/`), split out of the monorepo into its own CLI/npm package. The `sir-factory-runner` agent drives it.
- **`rdv`** — the trust-nothing verifier (the `rederive` CLI). `sir-verify` and consumers use it.

## Layout

```
sir-toolkit/
  .claude-plugin/marketplace.json     # this marketplace
  plugins/
    sir/                              # the plugin (see plugins/sir/README.md)
      .claude-plugin/plugin.json
      agents/    skills/    commands/    docs/SIR_SCHEMA.md
```

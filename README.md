# sir-toolkit — a Claude Code plugin marketplace

Distributes the **SIR verified-recompose** methodology as a Claude Code plugin.

> **Two channels, two artifact types.** The *factory* (this methodology — skills + agents + the `sir-factory`/`rdv` CLIs) ships here, as a Claude plugin. The *output* (verified, self-contained units) ships as npm `@rederive/*`.

## Add the marketplace

```
/plugin marketplace add rederive/sir-toolkit     # once it's pushed to GitHub
/plugin install sir@sir-toolkit
```

Or, before it's on GitHub, from a local checkout:

```
/plugin marketplace add ~/sir-toolkit
/plugin install sir@sir-toolkit
```

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

#!/usr/bin/env node
// F.1 consumer 3 — DERIVE an agent's prompt payload from declared features.
//
// The payload is computed, not maintained: a role gets exactly the fragments for
// the features it may use, intersected with what the verifier actually
// implements. Two consequences, both load-bearing:
//
//   * a construct rdv cannot check NEVER reaches a decomposer's context, so the
//     prompt layer cannot drift ahead of the verifier the way the schema did;
//   * a re-emitter reconstructing a pure function reads not one word about
//     concurrency.
//
//   payload.mjs --features par-interleaving,ring      # explicit
//   payload.mjs --sir path/to/unit.sir                # detected from the SIR
//   payload.mjs --all                                 # everything implemented
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const index = JSON.parse(readFileSync(join(ROOT, 'fragments/_index.json'), 'utf8'));

// The capability model and the ONE feature detector live in rederive beside rdv (SIR_V05_PLAN W.0c). This
// plugin used to keep its own capabilities.json and a detector that saw only the v0.4 features, while
// sir-factory's saw only v0.2/v0.3 — so the factory could not stamp a v0.4 bundle. No local copy now.
let features;
try { features = await import('rederive/cli/features.mjs'); }
catch {
  console.error('payload.mjs needs the rederive package (cli/features.mjs + cli/capabilities.json). Install or link it: `npm link rederive`.');
  process.exit(2);
}
const { capabilities: caps, implementedFeatures, generableFeatures, detectFeatures } = features;
const implemented = implementedFeatures();

// A payload is what teaches a role to WRITE a construct, so it is gated by
// `generable` — the Phase 5 claim that cold re-emitters converge on it from the
// SIR alone — not merely by `implemented`, which only says rdv can check one if
// it already exists. Verifiable-but-not-writable is a real state, and a feature
// sitting in it must not reach a decomposer's context.
const generable = generableFeatures();

/** Mechanically detect the features a SIR uses (A7). Delegates to the shared detector. */
export const featuresOfSir = (text) => detectFeatures({ sirText: text });

export function payloadFor(features) {
  // Three outcomes, and the third must never be silent: a feature we have a
  // fragment for AND the verifier implements is usable; one the verifier cannot
  // check is refused; and one we do not recognize at all is ALSO refused, because
  // quietly dropping it would teach a decomposer nothing while looking like it did.
  // Refusal is about the FEATURE's standing, not about whether a fragment file
  // happens to exist. A generable feature with no fragment is COVERED — the
  // invariant core of the prompt already carries it (that is why the factory has
  // been emitting `vectors` units since before fragments existed). Conflating
  // "nothing to inject" with "unknown" is what made --all refuse its own catalog.
  const refused = features
    .filter((f) => !generable.has(f))
    .map((f) => (!caps.features[f] ? `${f} (unknown feature)`
      : !implemented.has(f) ? `${f} (not implemented by the verifier)`
      : `${f} (implemented but not generable — no evidence a cold re-emitter can build it from the SIR alone)`));
  const ok = features.filter((f) => generable.has(f));
  const usable = ok.filter((f) => index.fragments[f]);
  const covered = ok.filter((f) => !index.fragments[f]);
  const parts = usable.map((f) => readFileSync(join(ROOT, 'fragments', index.fragments[f]), 'utf8').trim());
  return { usable, covered, refused, text: parts.join('\n\n---\n\n') };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
  let features = [];
  if (process.argv.includes('--all')) features = [...generable];
  else if (arg('--sir')) features = featuresOfSir(readFileSync(arg('--sir'), 'utf8'));
  else if (arg('--features')) features = arg('--features').split(',').map((s) => s.trim());
  const { usable, covered, refused, text } = payloadFor(features);
  if (refused.length) {
    console.error(`REFUSED: ${refused.join('; ')}`);
    console.error(`A decomposer must not emit a construct nothing can check; teach it only what rdv verifies.`);
    process.exit(1);
  }
  if (covered.length) console.error(`(covered by the invariant core, no fragment needed: ${covered.join(', ')})`);
  if (!usable.length) { console.error('(no fragments — this unit needs no v0.4 guidance)'); process.exit(0); }
  console.log(text);
}

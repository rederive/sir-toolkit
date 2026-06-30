#!/usr/bin/env node
// PreToolUse guard for the SIR toolkit. The verifier must be IMMOVABLE from the seat of the party being
// verified — the boxen run proved a cold agent will patch rdv/pack/factory to make its own work pass if it
// CAN. This hook makes it so it CANNOT: any tool call that would MODIFY the toolkit (rdv / sir-factory source
// or installed bins) is DENIED. The agent may freely READ and RUN the toolkit; it may never write it.
//
// On a genuine toolkit bug/limitation the agent must HALT and REPORT it (what failed, on which unit) or
// QUARANTINE the unit — never patch the gate. (Edit/Write are blocked airtight here; Bash write-intent is
// best-effort — the `chmod` seal in scripts/seal-toolkit.sh is the airtight backstop for the Bash path.)
import { realpathSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve, sep } from 'node:path';

// Resolve the toolkit package roots from the `rdv` and `sir-factory` commands on PATH (covers both the
// installed bins and, when they symlink to dev source, the source repos).
function pkgRoot(bin) {
  try {
    const p = execSync(`command -v ${bin} 2>/dev/null`, { encoding: 'utf8' }).trim();
    if (!p) return null;
    let d = dirname(realpathSync(p));
    for (let i = 0; i < 10 && d !== '/'; i++) { if (existsSync(`${d}/package.json`)) return realpathSync(d); d = dirname(d); }
  } catch {}
  return null;
}
const roots = [...new Set(['rdv', 'sir-factory'].map(pkgRoot).filter(Boolean))];

let buf = '';
process.stdin.on('data', (c) => (buf += c)).on('end', () => {
  let j = {}; try { j = JSON.parse(buf); } catch {}
  const tool = j.tool_name;
  const ti = j.tool_input || {};
  const deny = (reason) => {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
    process.exit(0);
  };
  const REASON =
    'BLOCKED — the SIR toolkit (rdv / sir-factory) is IMMUTABLE from your seat: the verifier cannot be edited ' +
    'by the party being verified, or its green checks mean nothing. You hit a real toolkit bug or limitation — ' +
    'do NOT patch the toolkit. Instead: HALT and REPORT it (what command/check failed, on which unit, the error), ' +
    'or QUARANTINE the unit you cannot soundly verify. Protected roots: ' + (roots.join(', ') || '(unresolved)') + '.';

  if (!roots.length) { process.exit(0); } // can't resolve the toolkit → don't false-block; rely on prompt + seal

  const underToolkit = (p) => { try { const r = resolve(p); return roots.some((root) => r === root || r.startsWith(root + sep)); } catch { return false; } };

  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    if (ti.file_path && underToolkit(ti.file_path)) deny(REASON);
  } else if (tool === 'Bash') {
    const cmd = String(ti.command || '');
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Target-aware: deny only when a toolkit root is the WRITE TARGET (not merely mentioned — so reads like
    // `grep rm factory.mjs` or `cat rdv.mts > /tmp/x` are allowed). Best-effort; the chmod seal is airtight.
    const writesToToolkit = roots.some((root) => {
      const r = esc(root);
      return new RegExp(`>>?\\s*['"]?${r}`).test(cmd)                                            // redirect target in toolkit
        || new RegExp(`\\b(tee|sed\\s+-i|chmod|truncate|install)\\b[^|;&]*${r}`).test(cmd)        // tee/sed -i/chmod/install → toolkit
        || new RegExp(`(cd\\s+${r}|--prefix[= ]['"]?${r})[^|]*npm\\s+(run\\s+build|install|ci|rebuild)`).test(cmd) // npm build/install IN toolkit
        || new RegExp(`\\b(cp|mv)\\b[^|;&]*\\s['"]?${r}`).test(cmd)                               // cp/mv INTO toolkit
        || new RegExp(`git\\s+-C\\s+['"]?${r}\\s+(checkout|reset|apply|restore)`).test(cmd);      // git-mutate in toolkit
    });
    if (writesToToolkit) deny(REASON);
  }
  process.exit(0); // allow everything else
});

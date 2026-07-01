#!/usr/bin/env node
// PreToolUse guard for the SIR toolkit. The verifier must be IMMOVABLE from the seat of the party being
// verified — the boxen run proved a cold agent will patch rdv/pack/factory to make its own work pass if it
// CAN. This hook makes it so it CANNOT: any tool call that would MODIFY the toolkit (rdv / sir-factory source
// or installed bins) is DENIED. The agent may freely READ and RUN the toolkit; it may never write it.
//
// On a genuine toolkit bug/limitation the agent must HALT and REPORT it (what failed, on which unit) or
// QUARANTINE the unit — never patch the gate. (Edit/Write are blocked airtight here; Bash write-intent is
// best-effort — the `chmod` seal in scripts/seal-toolkit.sh is the airtight backstop for the Bash path.)
import { realpathSync, existsSync, appendFileSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve, sep } from 'node:path';

// Resolve the toolkit package roots from the `rdv` and `sir-factory` commands on PATH. Resolution is
// DELIBERATELY conservative and fails SAFE (block nothing) rather than loud (block everything): it only
// accepts a package.json that IS the toolkit (matched by name), walks PAST unrelated package.json files
// (a project's, a monorepo root's, a stray ~/package.json), and never accepts an over-broad root ($HOME,
// `/`, or any ancestor of $HOME). If it cannot confidently locate the toolkit, it returns null and the hook
// allows the edit. (The chmod seal remains the airtight backstop; this hook is best-effort by design.)
const HOME = process.env.HOME || '';
const TOOLKIT_NAMES = new Set(['rederive', 'rdv', '@rederive/rdv', 'sir-factory', 'sir-toolkit']);
// A toolkit root must be a SPECIFIC package directory — never home, filesystem root, or an ancestor of home.
function isSafeRoot(root) {
  if (!root || root === '/' || root === HOME) return false;
  if (HOME && (HOME + sep).startsWith(root + sep)) return false; // root is $HOME or an ancestor of it
  return true;
}
// MAINTAINER OVERRIDE — a HUMAN deliberately opens a maintenance window to fix the toolkit ITSELF (rdv/sir-factory).
// OFF by default. Open it either way (both read LIVE per tool-call, so it works mid-session with no restart):
//   • `export SIR_ALLOW_TOOLKIT_EDITS=1` in the environment that launched Claude Code, or
//   • create the marker file:  `touch ~/.sir-allow-toolkit-edits`   (remove it to close the window).
// This is the SANCTIONED path for editing the toolkit. An agent must NEVER open it itself without explicit human
// authorization — opening the window is the owner's decision, exactly like lifting the chmod seal. Uses are audited.
function maintenanceWindowOpen() {
  try { return process.env.SIR_ALLOW_TOOLKIT_EDITS === '1' || existsSync(`${HOME}/.sir-allow-toolkit-edits`); } catch { return false; }
}
function pkgRoot(bin) {
  try {
    const p = execSync(`command -v ${bin} 2>/dev/null`, { encoding: 'utf8' }).trim();
    if (!p) return null;
    let d = dirname(realpathSync(p));
    for (let i = 0; i < 12 && d !== '/'; i++) {
      const pj = `${d}/package.json`;
      if (existsSync(pj)) {
        let name = '';
        try { name = JSON.parse(readFileSync(pj, 'utf8')).name || ''; } catch {}
        if (TOOLKIT_NAMES.has(name)) { const root = realpathSync(d); return isSafeRoot(root) ? root : null; }
        // a NON-toolkit package.json (project / monorepo / home): do NOT stop here — keep walking up.
      }
      d = dirname(d);
    }
  } catch {}
  return null;
}
const roots = [...new Set(['rdv', 'sir-factory'].map(pkgRoot).filter(Boolean))];

let buf = '';
process.stdin.on('data', (c) => (buf += c)).on('end', () => {
  let j = {}; try { j = JSON.parse(buf); } catch {}
  const tool = j.tool_name;
  const ti = j.tool_input || {};
  // Sanctioned maintenance window (human-authorized)? Allow everything, but leave an audit trail.
  if (maintenanceWindowOpen()) {
    try {
      const FEED = '/Users/lanethompson/sir-lab/feed.jsonl';
      if (existsSync(FEED)) appendFileSync(FEED, JSON.stringify({ ts: new Date().toISOString(), tool: 'GUARD-BYPASS(maintenance):' + tool, brief: String(ti.file_path || ti.command || '').replace(/\s+/g, ' ').slice(0, 120) }) + '\n');
    } catch { /* never block on audit failure */ }
    process.exit(0);
  }
  const deny = (reason) => {
    // Optional audit trail: if a monitoring feed exists (UAT runs), record the blocked attempt so a read-only
    // observer can see the guard fire (a denied tool never reaches PostToolUse). Silent in production (no feed).
    try {
      const FEED = '/Users/lanethompson/sir-lab/feed.jsonl';
      if (existsSync(FEED)) appendFileSync(FEED, JSON.stringify({ ts: new Date().toISOString(), tool: 'GUARD-DENY:' + tool, brief: String(ti.file_path || ti.command || '').replace(/\s+/g, ' ').slice(0, 180) }) + '\n');
    } catch { /* never block on audit failure */ }
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

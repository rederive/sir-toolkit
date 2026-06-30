#!/usr/bin/env bash
# Seal/unseal the SIR toolkit (rdv + sir-factory) as read-only — the airtight backstop to the PreToolUse
# guard-hook. A running agent can READ and RUN the verifier but the OS denies it WRITE, so it physically
# cannot patch the gate it is graded by (the boxen-run finding). `seal` before spawning an agent run;
# `unseal` when YOU (the maintainer) need to apply a reviewed toolkit fix; re-`seal` after.
#
# Seals the toolkit CODE (everything under each package root) but keeps .git and node_modules writable so
# normal maintenance/git still works. Resolves the roots from the `rdv` + `sir-factory` commands on PATH.
set -o pipefail

resolve_roots() {
  local roots=() bin p d
  for bin in rdv sir-factory; do
    p="$(command -v "$bin" 2>/dev/null || true)"; [ -z "$p" ] && continue
    d="$(dirname "$(readlink -f "$p" 2>/dev/null || realpath "$p" 2>/dev/null || echo "$p")")"
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      [ -f "$d/package.json" ] && { roots+=("$d"); break; }
      [ "$d" = "/" ] && break; d="$(dirname "$d")"
    done
  done
  printf '%s\n' "${roots[@]}" | sort -u
}

ROOTS=()
while IFS= read -r line; do [ -n "$line" ] && ROOTS+=("$line"); done < <(resolve_roots)
[ "${#ROOTS[@]}" -eq 0 ] && { echo "no toolkit roots found (is rdv / sir-factory on PATH?)"; exit 2; }

case "${1:-}" in
  seal)
    for r in "${ROOTS[@]}"; do
      chmod -R a-w "$r" 2>/dev/null
      [ -d "$r/.git" ] && chmod -R u+w "$r/.git" 2>/dev/null
      [ -d "$r/node_modules" ] && chmod -R u+w "$r/node_modules" 2>/dev/null
      echo "  SEALED (read-only): $r"
    done ;;
  unseal)
    for r in "${ROOTS[@]}"; do chmod -R u+w "$r" 2>/dev/null; echo "  UNSEALED (writable): $r"; done ;;
  status)
    for r in "${ROOTS[@]}"; do
      f="$r/factory.mjs"; [ -f "$f" ] || f="$(ls "$r"/cli/*.mts 2>/dev/null | head -1)"
      [ -n "$f" ] && [ -w "$f" ] && echo "  WRITABLE: $r" || echo "  sealed:   $r"
    done ;;
  *) echo "usage: seal-toolkit.sh seal|unseal|status"; echo "  roots: ${ROOTS[*]}"; exit 2 ;;
esac

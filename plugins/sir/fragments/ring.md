## Writing a `RING` unit (token-coordinated concurrency)

A ring is a single circulating permission: only the token-holder acts. The token
lives on the gate — `gate.token.take(who)`, `gate.token.pass(from, to)`,
`gate.token.release(who)` — so the verifier can watch it.

**A ring is a REFINEMENT.** Every ring run must be a run the unconstrained unit
could also produce: it may DROP outcomes, never INVENT one. If you are imposing a
ring on racy code (rather than recognizing one already there), say so in the SIR —
silently narrowing what a unit can do is how a contract lies politely.

**`RING` is a HINT.** State these as `INVARIANT` lines:

- SAFETY — the outcome set is a subset of the unconstrained unit's
- LIVENESS, mutual exclusion — at most ONE holder at any instant
- LIVENESS, no loss — every token taken is eventually released

Those last two are the only two ways a ring can break, and both are invisible on
the value channel: a unit with a lost or duplicated token still returns the right
answer.

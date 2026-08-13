## Writing a `RING` unit (token-coordinated concurrency)

A ring is a single circulating permission: only the token-holder acts. The token
lives on the gate — `gate.token.take(who)`, `gate.token.pass(from, to)`,
`gate.token.release(who)` — so the verifier can watch it.

**A ring is a REFINEMENT.** Every ring run must be a run the unconstrained unit
could also produce: it may DROP outcomes, never INVENT one. If you are imposing a
ring on racy code (rather than recognizing one already there), say so in the SIR —
silently narrowing what a unit can do is how a contract lies politely.

**The token discipline is asymmetric — say it exactly.** There is ONE token, so
it is TAKEN exactly once, by the first actor. Every later actor RECEIVES it via
`pass(from, to)` and must never call `take()`. It is RELEASED exactly once, by
the last actor. Writing "the token is taken n times, once per actor" contradicts
mutual exclusion and is the single most common way this contract goes wrong: a
weak model wrote precisely that, and blind emitters split on whether later actors
also call `take()` — same values, same output, different protocol. Nothing on the
value channel can see that split, so the SIR has to settle it.

**`RING` is a HINT.** State these as `INVARIANT` lines:

- SAFETY — the outcome set is a subset of the unconstrained unit's
- PROTOCOL — one `take` by the first actor, `pass` for every handoff, one
  `release` by the last; name who does each
- LIVENESS, mutual exclusion — at most ONE holder at any instant
- LIVENESS, no loss — nobody holds the token when the unit returns

Those liveness properties are the only two ways a ring can break, and both are
invisible on the value channel: a unit with a lost or duplicated token still
returns the right answer.

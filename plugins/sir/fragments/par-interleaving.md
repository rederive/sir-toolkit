## Writing a `PAR` unit (concurrency over an injected gate)

A unit whose sub-work runs concurrently takes the completion order from the
harness, not the runtime: it awaits `gate.open(value)` once per concurrent slot,
and the harness decides which slot settles next. That is what lets the verifier
explore the space of interleavings instead of whichever order the machine picked.

**Signature convention:** the gate is the LAST parameter — `unit(…args, gate)`.

**`PAR` is a HINT, not the contract.** State the behavior in `INVARIANT` lines,
because a blind re-emitter reconstructs from the SIR alone and must not need this
document to understand it. At minimum:

- what the output is keyed by (input position? completion order? — this is the
  single most common concurrency bug, so say it outright)
- the concurrency bound, if there is one ("at most min(concurrency, n) in flight")
- whether the sub-traces are independent (commuting) or share state

**Worth stating explicitly in `DESCRIPTION`:** that each concurrent step is
`await gate.open(x)`, since the re-emitter has no other way to learn the protocol.

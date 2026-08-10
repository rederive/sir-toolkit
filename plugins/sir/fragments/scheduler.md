## Writing a scheduled unit (timers + microtasks on virtual time)

A clock READ is an ordinary injected input. SCHEDULING is different — it decides
when deferred work runs relative to everything else — so it comes from the
boundary: `http.timers.setTimer(fn, ms)`, `clearTimer(id)`, `schedule(fn)` for
microtasks, `now()`.

Never call `setTimeout`, `queueMicrotask`, or `Date.now()` directly. On the real
clock a race resolves however the machine feels; the verifier drives virtual time
so BOTH branches of a race are reachable and replayable.

**State in `INVARIANT` lines** which branch does what — "the response winning the
race cancels the armed timer", "the timeout rejects with `timeout after <ms>ms`" —
so a blind re-emitter knows the race is real and which way each outcome goes.

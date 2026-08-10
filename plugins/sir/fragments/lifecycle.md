## Declaring a resource lifecycle

A unit that arms a cancellable resource (timer, handle, subscription) carries a
THIRD oracle channel beside value and trace: `armed / fired / cancelled`.

It exists because cancellation is invisible to the other two — a leaked timer
still fires, but as a no-op on already-settled state, so the value and the emit
order are byte-identical while the resource leaks.

**State the lifecycle as an `INVARIANT`**, e.g. "the response winning the race
CANCELS the armed timer (no leaked resource)" or "every armed timer is cleared".
A `LIFECYCLE` line may summarize it; the `INVARIANT` is the contract.

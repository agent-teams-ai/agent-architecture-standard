# Resource accounting v0@1 semantics

This file is the sole complete identity-bound authority for resource-accounting
v0@1. Other specifications name counters and cite this artifact; they do not
independently define mutable counter semantics.

All counters and ceilings are safe nonnegative I-JSON integers. Addition MUST
be checked before it is performed and overflow MUST fail closed. An effective
ceiling is the componentwise minimum of the request ceiling, analysis-key
ceiling, every selected binding ceiling, and every target-overlay ceiling.
There is no scalar budget and no source may omit a component.

The exact mapping is `inputBytes`/`maxInputBytes`, `depth`/`maxDepth`,
`pathSegments`/`maxPathSegments`, `pathBytes`/`maxPathBytes`,
`entries`/`maxEntries`, `logicalBytes`/`maxLogicalBytes`,
`readBytes`/`maxReadBytes`, `peakEntryBytes`/`maxPerEntryBytes`,
`overlayOperations`/`maxOverlayOperations`, `targets`/`maxTargets`,
`evidenceReferences`/`maxEvidenceReferences`,
`extensionBytes`/`maxExtensionBytes`, `diagnostics`/`maxDiagnostics`,
`outputBytes`/`maxOutputBytes`, `peakConcurrency`/`maxConcurrency`, and
`totalWork`/`maxTotalWork`.

`inputBytes` is the exact octet length of the received request representation,
including insignificant whitespace; a canonical reserialization is not a
substitute. `extensionBytes` is the UTF-8 byte length of canonical JSON for the
complete request and target optional/critical extension maps together with
their scopes. `outputBytes` is the UTF-8 byte length of canonical JSON for the
complete result including self-identities and the final `outputBytes` value;
the value is the unique fixed point obtained by repeated replacement and the
operation fails closed if it does not converge.

`targets`, `overlayOperations`, `entries`, `evidenceReferences`, and
`diagnostics` count occurrences, including retried or revisited occurrences;
deduplication does not refund work. `logicalBytes` and `readBytes` are sums of
bytes logically processed and physically read respectively, again charging
every retry or revisit. `depth`, `pathSegments`, `pathBytes`, `peakEntryBytes`,
and `peakConcurrency` are peaks. Path bytes are UTF-8 bytes and path segments
are slash-delimited segments after validation under the identity-bound path
profile.

Per-target occurrence and byte counters are summed into aggregate counters.
Peak counters are the maximum across targets, never their sum. Aggregate
evaluation MUST stop before a next charge would exceed an effective ceiling.
Preflight MUST reject known lower bounds already over ceiling: exact input
bytes, target count, total overlay-operation count, exact extension bytes,
known path segment/byte maxima, and `targets + overlayOperations +
extensionBytes` as the minimum known `totalWork`.

`totalWork` is exactly the checked sum of `entries`, `logicalBytes`,
`readBytes`, `overlayOperations`, `targets`, `evidenceReferences`,
`extensionBytes`, and `diagnostics`. Peak counters, input bytes, and output
bytes are not added again. Retry and revisit charges already present in their
component counters therefore participate exactly once.

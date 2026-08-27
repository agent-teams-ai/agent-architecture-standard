# Resource accounting v0@1 semantics

All counters and ceilings are safe nonnegative integers. Effective ceilings are
the componentwise minimum across the request, analysis key, every selected
binding, and every target overlay. `totalWork` is the safe sum of `entries`,
`logicalBytes`, `readBytes`, `overlayOperations`, `targets`,
`evidenceReferences`, `extensionBytes`, and `diagnostics`.

The exact counter-to-ceiling mapping is: `inputBytes`/`maxInputBytes`,
`depth`/`maxDepth`, `pathSegments`/`maxPathSegments`, `pathBytes`/`maxPathBytes`,
`entries`/`maxEntries`, `logicalBytes`/`maxLogicalBytes`,
`readBytes`/`maxReadBytes`, `peakEntryBytes`/`maxPerEntryBytes`,
`overlayOperations`/`maxOverlayOperations`, `targets`/`maxTargets`,
`evidenceReferences`/`maxEvidenceReferences`,
`extensionBytes`/`maxExtensionBytes`, `diagnostics`/`maxDiagnostics`,
`outputBytes`/`maxOutputBytes`, `peakConcurrency`/`maxConcurrency`, and
`totalWork`/`maxTotalWork`.

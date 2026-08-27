# Registry index and lifecycle

Status: normative index; private Phase 1 editions; all values provisional and unpublished

Registries own identifier spelling, kind, allocation, owner, and lifecycle.
Their general lifecycle is defined in [core §7](../spec/core.md#7-registry-lifecycle). Registries are checked-in
immutable ledgers, not hosted discovery services or marketplaces.

No value is active. The private edition-1 files below are provisional and MUST
NOT support a public claim.

| Registry file | Owns | Edition | Status |
| --- | --- | --- | --- |
| [`actions.json`](actions.json) | closed remediation action identifiers | 1 | provisional |
| [`operations.json`](operations.json) | operation identifiers and profile association | 1 | provisional |
| [`problems.json`](problems.json) | closed envelope negotiation problem codes | 1 | provisional |
| [`resolutions.json`](resolutions.json) | closed core resolution identifiers | 1 | provisional |
| [`diagnostics.json`](diagnostics.json) | stable diagnostic codes | 1 | provisional |
| [`profiles.json`](profiles.json) | core canonicalization, path, security, and conformance profile IDs | 1 | provisional |
| [`extensions.json`](extensions.json) | centrally reserved extension IDs and allowed locations | 1 | provisional |
| [`envelope-versions.json`](envelope-versions.json) | immutable envelope versions and deterministic ordering | 1 | provisional |

The following is an index-entry checklist projected from
[core §3](../spec/core.md#3-artifact-authority-and-conflicts) and
[core §7](../spec/core.md#7-registry-lifecycle); it is
not a second lifecycle authority. Every registry definition artifact records an
edition, prior edition, and change record. Its own raw `contentDigest`, artifact
`aasIdentity`, byte length, media type, approvals, and qualification evidence
MUST be recorded only in a later external qualification sidecar that points to
the finalized registry artifact. The registry artifact MUST NOT point back to
that sidecar or contain its own digest or identity.

The checklist below applies to admission beyond `provisional`; it is not a
claim that edition-1 placeholders have passed admission. A provisional
pre-admission entry may retain an empty `vectors` array, but MUST remain
provisional, MUST NOT support a conformance or publication claim, and MUST gain
language-neutral positive and negative vectors before activation. An admitted
entry records:

- exact identifier and kind;
- `provisional`, `active`, `deprecated`, `withdrawn`, or `reserved` status;
- accountable owner and contact path;
- semantic authority citation;
- introduction edition and, if applicable, replacement;
- exact schema/profile `aasIdentity` where the value denotes immutable semantics;
- positive and negative vector references;
- collision and security review evidence.

Admission, activation, deprecation, withdrawal, reservation, non-reassignment,
and historical decoding are governed only by [core §7](../spec/core.md#7-registry-lifecycle).

External namespacing and the distinction between registration, trust,
conformance, publication, and availability are governed only by [core §7](../spec/core.md#7-registry-lifecycle).

# Registry index and lifecycle

Status: normative index; Phase 0 placeholders only; all values provisional

Registries own identifier spelling, kind, allocation, owner, and lifecycle.
Their general lifecycle is defined in [core §7](../spec/core.md#7-registry-lifecycle). Registries are checked-in
immutable ledgers, not hosted discovery services or marketplaces.

No value is active in Phase 0. Text that resembles an identifier in the
specification is provisional and MUST NOT support a public claim.

| Future registry | Owns | Initial status |
| --- | --- | --- |
| `operations` | operation identifiers and profile association | provisional |
| `resolutions` | closed core resolution and problem reason identifiers | provisional |
| `diagnostics` | stable diagnostic and remediation action codes | provisional |
| `profiles` | core canonicalization, path, security, and conformance profile IDs | provisional |
| `extensions` | centrally reserved extension IDs and allowed locations | provisional |

The following is an index-entry checklist projected from
[core §3](../spec/core.md#3-artifact-authority-and-conflicts) and
[core §7](../spec/core.md#7-registry-lifecycle); it is
not a second lifecycle authority. Every registry definition artifact records an
edition, prior edition, and change record. Its own raw `contentDigest`, artifact
`aasIdentity`, byte length, media type, approvals, and qualification evidence
MUST be recorded only in a later external qualification sidecar that points to
the finalized registry artifact. The registry artifact MUST NOT point back to
that sidecar or contain its own digest or identity. Every entry records:

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

# AAS v0 identity and canonicalization profile

Status: normative Phase 0 scaffold; unpublished; profile identifiers provisional

## 1. Applicability

This document is the sole semantic authority for validating identity-bearing
JSON, producing canonical bytes, framing artifact-specific digest domains, and
deciding which fields belong to each core identity.

The provisional profile name is `agent-architecture-canonical-json-rfc8785@0`.
It MUST NOT be advertised in a public conformance claim until activated by the
registry and governance process.

## 2. Strict I-JSON input profile

An identity document MUST be valid UTF-8 JSON and MUST satisfy RFC 8785 input
requirements plus every restriction below before canonicalization.

An identity decoder MUST reject:

- duplicate object member names at any depth;
- byte-order marks, invalid UTF-8, and non-shortest UTF-8 encodings;
- lone UTF-16 surrogate values or any non-Unicode-scalar string value;
- non-finite numbers and negative zero;
- a number that is not an integer;
- an integer outside `-(2^53-1)` through `2^53-1`, inclusive;
- non-JSON numeric spellings, leading zeros, or implementation-specific values;
- unpaired or invalid escape sequences;
- a member unknown to a closed schema;
- a value exceeding the applicable schema or profile limit.

The exact integer range is -9007199254740991 through 9007199254740991.
Quantities outside that range MUST be represented by a schema-defined canonical
decimal string or rejected. A decimal-string field MUST define its sign, zero,
leading-zero, and length rules in its schema.

Object member names MUST be sorted exactly as RFC 8785 specifies: lexicographic
order over their UTF-16 code units, compared as unsigned values. This is not
Unicode scalar-value order. In particular, the surrogate pair for U+1F600 sorts
before U+E000 because its first UTF-16 code unit is `D83D`. String values and
member-name spellings are otherwise preserved. General strings MUST NOT be
normalized, case-folded, locale-transformed, or line-ending-transformed. A
schema-defined portable path is validated by its path profile before
canonicalization; invalid paths are rejected rather than rewritten.

Duplicate detection occurs on decoded member names. Implementations MUST reject
both textual duplicates and differently escaped spellings that decode to the
same member name. Unicode normalization-equivalent but scalar-distinct general
strings remain distinct unless a field-specific profile rejects the collision.

## 3. Canonical bytes

After strict validation, implementations MUST serialize the identity document
exactly according to RFC 8785 JSON Canonicalization Scheme. They MUST NOT add a
newline, byte-order mark, media header, indentation, or platform line ending.

Schema defaults MUST be materialized before identity production when, and only
when, the normative schema declares that field identity-bearing and the
semantic prose defines its default. An absent optional field and a present field
MUST NOT be treated as equivalent unless the identity table explicitly says so.

An object's own `aasIdentity` field MUST be omitted from its identity projection.
No other field is omitted unless the identity table explicitly excludes it. An
implementation MUST NOT substitute a raw `contentDigest` for an `aasIdentity` and
MUST NOT resolve references, execute code, read environment variables,
interpolate configuration, or fetch remote content while canonicalizing.

Canonical bytes are observable behavior. Golden vectors own the exact bytes for
their named examples. A disagreement between an implementation and a vector is
a conformance failure even when both decode to equivalent data.

### Acyclic definition and qualification records

An artifact MUST NOT identity-bind its own digest or identity, directly or through a
cycle. The identity projection of a definition artifact MUST omit every field
that purports to qualify that same artifact, including its own `contentDigest`,
artifact `aasIdentity`, approval, report, or qualification-sidecar identity.
Those values MUST instead appear in a separate external qualification sidecar.

A qualification sidecar MUST point to the already finalized subject artifact by
raw `contentDigest`, artifact `aasIdentity`, byte length, and media type and MAY
also bind approvals and evidence. The subject MUST NOT point back to that
sidecar. A sidecar's own integrity or qualification, if needed, MUST be recorded
in a later sidecar; it MUST NOT self-bind. This strict direction applies to
schemas, registries, profiles, vector suites, reports, claims, matrices, and
release artifacts.

Qualifying approvals MUST occur only in an external sidecar finalized after all
subjects and evidence that it qualifies. A subject's identity projection,
including a policy, binding, exception, promotion record, claim, matrix, or
release manifest, MUST NOT include approval evidence or an approver identity.

Profile construction uses two vector classes. Definition vectors are finalized
first and MUST identify the profile only by its textual profile ID and definition
version; they MUST NOT contain the eventual profile `aasIdentity`. Their suite
artifact `aasIdentity` MAY then participate in the profile identity projection.
Qualification vectors and reports are constructed only after the profile
identity exists and MUST bind that finalized identity. Qualification vectors,
reports, and sidecars MUST NOT participate in the profile identity. A suite that
mixes the two classes is invalid.

The release order is also acyclic: semantics and definition vectors, then
profiles, then qualification vectors and reports, then claims, then
traceability matrices, then claim-qualification sidecars, and finally the
release manifest. Each stage MAY refer only to an already finalized earlier
stage. A claim MUST NOT refer forward to its matrix or qualification sidecar;
the matrix MAY refer backward to its claim, and the later qualification sidecar
MUST bind both. In particular, a claim, matrix, or qualification sidecar MUST
NOT contain the identity of its future release manifest; the manifest MUST point
backward to them.

## 4. Length-delimited domain framing

Every AAS SHA-256 identity uses artifact-specific domain separation. An
implementation MUST NOT use concatenated text prefixes or NUL-delimited strings.

The digest preimage is the following byte sequence:

```text
u32be(len("AAS-ID")) || UTF8("AAS-ID") ||
u32be(len(domain))   || UTF8(domain)   ||
u32be(len(profile))  || UTF8(profile)  ||
u64be(len(payload))  || payload
```

`domain` is the exact ASCII domain tag from the identity table. `profile` is the
exact ASCII canonicalization profile identifier. `payload` is the canonical
bytes or, for raw artifacts, the exact artifact bytes. Lengths are unsigned,
big-endian byte counts. A field length that cannot be represented in its prefix
is invalid. No terminator or implicit string encoding is permitted.

The AAS identity string is provisional syntax
`aas:v0:sha256:<64-lowercase-hex-digits>`. Implementations MUST calculate SHA-256
over the complete framed preimage. They MUST reject uppercase, truncated,
padded, algorithm-omitted, or raw-`contentDigest` strings in an `aasIdentity`
field.

A raw content digest is `sha256:<64-lowercase-hex-digits>` computed directly over
the exact content bytes without this frame. A `contentDigest` MUST use that
syntax, and an implementation MUST NOT accept an `aas:v0:` value in that field.
The field name and prefix therefore make the two constructions unambiguous.

The framing version is changed by selecting a new canonicalization profile, not
by silently modifying this preimage.

## 5. Normative identity table

All listed JSON bodies use the strict profile and omit their own `aasIdentity`
field. `artifact` alone uses exact raw bytes as the framed payload. Fields named
“included” are semantic categories whose exact wire names belong to schemas.

| Identity | Domain tag | Included | Explicitly excluded |
| --- | --- | --- | --- |
| artifact | `aas.artifact.v0` | exact raw bytes | `contentDigest`, media type, location, filename, timestamps |
| snapshot | `aas.snapshot.v0` | repository ID, capture profile `aasIdentity`, ordered entries and artifact `aasIdentity` values, declared observation coverage, portable path profile | absolute root, inode, user, host, wall clock |
| profile | `aas.profile.v0` | profile kind/ID/version, schema `aasIdentity` values, dependencies, limits, semantics artifact `aasIdentity` values, definition-vector-suite `aasIdentity` values | qualification-vector/report/sidecar identities, publication time, mutable URL, provider metadata |
| effective policy | `aas.policy.v0` | policy schema version, fully materialized rules/parameters/defaults, governed exception `aasIdentity` values, source-provenance artifact `aasIdentity` values | local source paths, compiler identity, timestamps |
| repository revision | `aas.revision.v0` | repository ID, revision-system profile `aasIdentity`, exact immutable native revision identifier, revision content/tree `aasIdentity` | branch or tag name, checkout path, wall clock |
| exception | `aas.exception.v0` | exact rule and scope, owner, reason, already-finalized earlier creation-policy `aasIdentity`, exact repository-revision `aasIdentity` as `validForRevision` | approval evidence or approver identity, timestamp or duration, mutable issue state, wall clock |
| promotion record | `aas.promotion.v0` | rule, consumer, policy/profile/analyzer `aasIdentity` values, rollout scope, mode transition, observation-evidence artifact `aasIdentity` values, denominators, counters, thresholds, incidents, owner, rollback and SLA | approval evidence or approver identity, mutable dashboard, current feature flag, later observations |
| binding | `aas.binding.v0` | consumer/repository ID, exact scope, complete rollout scope, mode, profile `aasIdentity` values, policy `aasIdentity`, budgets/accounting profile, exception `aasIdentity` values, promotion-record `aasIdentity` when promoted | local file location, environment, installation state |
| analyzer | `aas.analyzer.v0` | immutable implementation artifact `aasIdentity` values, analyzer configuration, supported profile `aasIdentity` values | process ID, host path, runtime clock |
| overlay | `aas.overlay.v0` | base snapshot `aasIdentity`, ordered operations, portable paths, preconditions, content artifact `aasIdentity` values, limits | working directory, author, timestamp |
| request | `aas.request.v0` | envelope/operation versions, unique targets, snapshot/policy/binding/profile/analyzer/overlay `aasIdentity` values, budgets/accounting profile, extensions | correlation-only metadata, transport fields |
| analysis key | `aas.analysis.v0` | operation/profile/evaluator `aasIdentity` values, all substantive input `aasIdentity` values, declared budgets, accounting-profile `aasIdentity`, understood semantic extensions | realized counters, deadline clock, cancellation token, cache location |
| result | `aas.result.v0` | request and analysis-key `aasIdentity` values, per-target resolutions, coverage, evidence, omissions, deterministic diagnostic identity projections, realized output counters | every self `resultAasIdentity` projection, logs, elapsed wall time, rendering |
| receipt | `aas.receipt.v0` | result and binding `aasIdentity` values, integration snapshot/revision/worktree state, exception-validity revision, qualification context | signer transport metadata, publication time |
| release manifest | `aas.release-manifest.v0` | cohort name, member artifact `aasIdentity`/`contentDigest`/versions, dependency edges, already-finalized claim/matrix/qualification-sidecar `aasIdentity` values, governance role IDs | approval evidence or approver identity, any forward reference from an earlier artifact, dist-tag lookup result, mutable registry metadata |

`baseRevision` participates in snapshot identity when the capture profile declares
it semantic. Worktree or integration state participates through explicit
snapshot entries and receipt fields and MUST NOT participate through a
machine-local directory.

Budgets participate in request identity. The declared deterministic limits and
exact accounting-profile semantics participate in the pre-evaluation analysis
key. Realized counters do not exist until evaluation and MUST NOT participate in
that key; they participate in result identity. Wall-clock deadlines and external
cancellation are reported but excluded from deterministic identities.

All extension maps participate in request identity. An understood extension
that affects semantics also participates in the analysis key and result.
Unknown optional extensions remain request-bound but MUST NOT affect core
semantics. Critical unknown extensions prevent the relevant evaluation.

### Result self-identity projection

The result body exposes its own top-level `aasIdentity`. Each embedded diagnostic
header MAY copy that value in `resultAasIdentity`. To construct result identity,
an implementation MUST omit the top-level `aasIdentity` and recursively omit each
schema-defined diagnostic `resultAasIdentity`, canonicalize and frame that
projection, and then populate every omitted occurrence with the one computed
value. The diagnostic copies are presentation projections, not result-identity
inputs. No other nested identity is omitted. A populated copy that differs from
the recomputed top-level value makes the result invalid, not a second result
identity.

## 6. Mutation and collision requirements

Changing any included semantic input MUST change the corresponding identity.
Changing only an explicitly excluded field MUST NOT change it. Reordering a JSON
object MUST NOT change it; reordering an identity-bearing array MUST change it
unless the owning schema declares and defines deterministic set ordering.

Identical artifact bytes in different semantic domains MUST yield different
identities. Different domain tags or canonicalization profile identifiers MUST
yield different identities. Implementations MUST NOT reuse a raw `contentDigest`
or an artifact `aasIdentity` as a snapshot, policy, result, or receipt
`aasIdentity`.

Before a conformance claim is possible, vectors MUST cover both integer
boundaries and adjacent rejection cases, duplicate decoded keys, RFC 8785 UTF-16
ordering including a BMP/supplementary inversion, normalization-distinct strings,
escapes, exact result self-identity projection, raw/framed digest distinction,
domain/profile length boundaries, domain substitution, empty payloads, and every
identity-input mutation.

At least two independently authored canonicalizers MUST agree on exact bytes
and digests. They MUST share neither production canonicalization code nor a
generated runtime codec. Any identity disagreement blocks qualification and
withdraws the affected claim until a versioned resolution is published.

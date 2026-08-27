# AAS v0 core contract

Status: normative Phase 0 scaffold; unpublished; all identifiers provisional

## 1. Purpose and boundary

The Agent Architecture Standard defines how an implementation states what it
evaluated, which immutable inputs governed the evaluation, what it can conclude,
and why that conclusion is fresh or stale. It standardizes declared facts and
evidence. It does not design architecture.

The static semantic standard is AAS. Agent Architecture Protocol (AAP) is the
transport-neutral envelope, request, response, problem, and negotiation
component within AAS. A transport binding MAY later carry AAP documents, but no
transport is defined in v0.

The v0 core MUST be implementable from normative prose, schemas, registries,
and vectors without importing an implementation or Foundation code. Repository
bytes and repository-controlled configuration MUST be treated as inert data.

No public conformance claim is permitted while this scaffold's governance roles
are unassigned. A private implementation MAY use provisional identifiers for
experimentation, but it MUST label every produced claim and receipt
`provisional` and MUST NOT publish them as qualified AAS evidence.

## 2. Glossary

The definitions in this section are the sole normative meanings of these terms.

**analyzer**: The immutable implementation and configuration that observes or
derives facts. Its identity is separate from a profile and a provider.

**artifact**: A bounded byte sequence with a media type and byte length. Its raw
`contentDigest` is SHA-256 over the exact bytes; its storage-independent
`aasIdentity` is SHA-256 over the domain-framed bytes defined by `identity.md`.

**AAS identity (`aasIdentity`)**: A domain-separated identity encoded as
`aas:v0:sha256:<64-lowercase-hex-digits>` and computed only by `identity.md`.
It MUST NOT be confused with or populated from a raw `contentDigest`.

**binding**: A closed declaration that selects one exact effective policy and
applicable profiles for an explicit consumer scope and enforcement mode.

**canonical bytes**: The bytes produced by the canonicalization profile in
`identity.md` from an already validated identity document.

**claim**: A statement that a named implementation satisfies a named,
immutable conformance profile for named versions and artifacts.

**coverage**: A stage-specific accounting of a declared denominator in which
every unit has exactly one terminal disposition.

**content digest (`contentDigest`)**: Raw SHA-256 over an exact byte sequence,
encoded as `sha256:<64-lowercase-hex-digits>`. It establishes byte integrity
only and is not an AAS identity.

**diagnostic**: A bounded, stable, machine-readable explanation of a result. A
diagnostic is not itself a verdict.

**effective policy**: A closed, immutable, fully materialized set of consumer
rules, parameters, defaults, and provenance that requires no composition step at
evaluation time.

**enforcement mode**: One of `shadow`, `advisory`, or `required`; it determines
the consequence of an evaluated finding, not where rollout applies.

**evidence**: An immutable reference and provenance statement used to support a
fact or decision. A `contentDigest` or `aasIdentity` proves integrity under its
construction, not truth or producer authority.

**finding**: A profile-defined observation about one target, carrying a stable
code, severity, evidence references, and remediation metadata.

**overlay**: A bounded ordered declaration of add, replace, and delete
operations against an exact base snapshot. It is planned state, not observed
state.

**problem**: A request- or provider-boundary failure for which no valid result
envelope exists. It is distinct from an epistemic resolution.

**profile**: An immutable, `aasIdentity`-bound definition of operation or evaluator
semantics, limits, permitted variance, and conformance vectors.

**provenance**: The ordered explanation of the authoritative sources and
decisions that produced an artifact. Provenance is not producer authentication.

**provider**: An implementation endpoint that describes capabilities and
accepts AAP invocations. Its name and version are self-asserted unless external
evidence establishes otherwise.

**receipt**: An immutable result artifact binding a decision to exact snapshot,
policy, profile, analyzer, request, coverage, and, when applicable, overlay and
integration state.

**relation**: A role-named directional candidate between opaque subjects under
a named vocabulary. Declared, observed, inferred, and planned relations are
different states.

**resolution**: Exactly one terminal epistemic state for one valid requested
target: `decided`, `needs-input`, `indeterminate`, `unsupported`, or `stale`.

**rollout scope**: The immutable cohort, repository, path, target, or rule
selection to which a binding applies. It is orthogonal to enforcement mode.

**snapshot**: An immutable identity over repository content and its declared
observation coverage under an exact capture profile.

**subject**: An opaque, snapshot-scoped reference to something classified or
related by a profile. A subject is not necessarily a path.

**target**: One uniquely identified unit requested for resolution in an
operation invocation.

## 3. Artifact authority and conflicts

Each claim has exactly one authoritative artifact class:

| Claim | Authority | Other artifacts |
| --- | --- | --- |
| Required/optional fields, JSON types, closed objects, numeric and size bounds | JSON Schema | Prose explains intent; vectors exercise instances |
| Registered identifier spelling, status, owner, and allocation | Registry entry | Schemas validate syntax; prose defines lifecycle |
| Semantics, invariants, algorithms, precedence, and conformance obligations | Normative prose | Schemas MUST NOT weaken them; vectors demonstrate them |
| Exact canonical bytes, `contentDigest`, `aasIdentity`, ordering, and observable outcome for a named case | Golden vector | Prose defines the general algorithm |
| Language binding or implementation behavior | No normative authority | MUST conform to the four artifact classes above |

An artifact MUST NOT duplicate a claim owned by another class as an independent
rule. It MAY cite or mechanically project that claim. A projection MUST identify
its source and MUST fail generation or validation when it drifts.

If artifacts disagree, an implementer MUST apply the authority row for the
specific disputed claim; it MUST NOT choose whichever artifact is convenient.
The disagreement MUST be reported as a specification defect. A normative
maintainer MUST resolve it by changing the non-authoritative artifact, or by a
versioned normative change if the authority itself is wrong. Published identity
meaning and historical receipts MUST NOT be silently reinterpreted.

An ambiguity with no matrix owner MUST be treated as a blocking specification
defect. A conformance claim covering that ambiguity MUST NOT be issued or
renewed.

Research, READMEs outside the indexed authority statements, generated types,
sample code, Foundation behavior, consumer policy, and agent instructions are
nonnormative.

## 4. Core result invariants

A valid plural request MUST assign a unique target identifier to every target.
Duplicate or malformed target identifiers invalidate the entire request and
produce one problem with no result envelope.

A valid result envelope MUST contain exactly one resolution for every requested
target and no resolution for an unrequested target. Result ordering MUST follow
the operation profile and MUST be deterministic.

The core resolution states are closed:

- `decided` means the named profile reached a decision over sufficient valid
  inputs. Evaluation verdicts `pass`, `fail`, and `not-applicable` occur only
  inside `decided`.
- `needs-input` means named caller-supplied information is absent and the
  profile defines how supplying it could permit evaluation.
- `indeterminate` means evaluation was attempted but relevant evidence,
  coverage, stability, or a valid resource budget prevented a decision.
- `unsupported` means the provider does not implement a required version,
  profile, platform guarantee, feature, or critical extension.
- `stale` means an expected immutable identity differs from the observed one.

A malformed envelope, invalid budget declaration, negotiation failure, provider
crash, corrupt response, or invocation-boundary loss is a problem. It MUST NOT
be encoded as `fail`, `unsupported`, `indeterminate`, or an incomplete result.

After accepting a valid request, a provider that returns a result envelope MUST
resolve every target, including targets affected by cancellation or exhausted
budgets. If it cannot produce a structurally complete valid envelope, the caller
MUST treat the invocation as a provider problem.

Negative claims such as "no relation exists" or `pass` MUST name the observation
denominator and MUST have complete relevant coverage. Unreadable, unsupported,
unstable, unknown, or budget-exhausted relevant units make the resolution
`indeterminate`; they MUST NOT be treated as absence.

Every substantive resolution MUST bind the exact standard, envelope, operation,
profile, snapshot, policy, analyzer, request, and result identities. It MUST
also bind coverage, omissions, evidence references, relevant budgets, and any
overlay or integration state on which it depends.

## 5. Coverage and evidence

Coverage MUST be reported independently for discovery, capture,
classification, evaluation, and overlay reevaluation when those stages apply.
Each stage MUST name its denominator and MUST place every denominator unit into
exactly one of: `included`, `policy-excluded`, `unreadable`, `unsupported`,
`unstable`, `unknown`, or `budget-exhausted`.

A percentage without the denominator and terminal counts is not coverage.
Policy-excluded units count as complete only when the bound effective policy
explicitly excludes them from that stage and claim.

Every evidence reference MUST resolve to immutable content in the same bound
snapshot or to an explicitly identified external immutable artifact. A portable
v0 implementation MUST NOT dereference a network location to resolve evidence.
Unresolved external content remains `unresolved` and MUST NOT support a required
decision.

Evidence assurance fields are orthogonal:

- `integrityStatus`: `unresolved`, `digest-matched`, or `snapshot-bound`;
- `producerAssurance`: `self-asserted`, `policy-allowlisted`, or
  `externally-attested`;
- `semanticStatus`: `unchecked`, `schema-valid`, or `conformance-checked`.

An implementation MUST NOT infer one assurance dimension from another.

## 6. Compatibility axes

### Initial public operation boundary

`validate-overlay@1` is the only operation profile eligible for the initial
public surface. `classify-subjects@1` and `evaluate-relations@1` are internal or
experimental and MUST NOT appear as public core operations or satisfy a public
core conformance claim. Advertising either experimentally MUST label it
experimental and outside the claim. Moving either to the public surface
requires a versioned normative decision, registry admission, and independent
qualification.

The following axes are independently versioned: standard semantics,
canonicalization, core envelope schema, operation profile, vocabulary profile,
evaluator profile, registry edition, schema bundle, vector suite, conformance
suite, and artifact manifest.

Provider, analyzer, and implementation versions are evidence metadata, not
substitutes for compatibility axes. Exact profile ID and `aasIdentity`, not SemVer
alone, establish profile substitutability.

A published envelope version and profile `aasIdentity` are immutable. Adding an
optional profile or a new immutable envelope version does not require a standard
major version. Changing a required field, a default, identity input,
canonicalization behavior, existing registered meaning, or normative semantic
requires a standard major version and replacement artifacts.

Peers MUST advertise supported immutable envelope versions. They MUST select the
highest mutually supported version under the registry's deterministic ordering
unless the request pins another mutually supported version. They MUST emit only
the selected version. No overlap produces a bootstrap version problem; peers
MUST NOT silently downgrade.

Closed core objects reject unknown fields. Extension locations are explicit.
Unknown critical extensions fail the envelope or resolve the affected target as
`unsupported`, according to their registered location. Optional extensions MUST
NOT alter core semantics. Experimental extensions MUST NOT satisfy a core
conformance requirement.

Historical receipts MUST remain decodable under their original schema and
identity meaning. Withdrawal stops new claims; it does not mutate old bytes.

## 7. Registry lifecycle

Core registries are minimal allocation ledgers, not marketplaces or discovery
services. A registry entry is semantically complete only if it conveys an
identifier, kind, owner, status, semantic authority citation, introduced edition,
and, where applicable, exact schema or profile `aasIdentity`. Its JSON Schema is
the sole authority for field names and requiredness.

Identifier statuses are `provisional`, `active`, `deprecated`, `withdrawn`, and
`reserved`. All identifiers in Phase 0 are `provisional`. A provisional value
MUST NOT appear in a public conformance claim.

Across adjacent editions a retained ID freezes its kind, role (when present),
semantic authority, introduction edition, ordering rank (when present), and any
existing `semanticsAasIdentity`. An absent `semanticsAasIdentity` MAY be
established once only while a reserved or provisional entry enters or remains
provisional; once present it is immutable. The only status transitions are: `reserved` to
`provisional`; `provisional` to `active`, `deprecated`, or `withdrawn`; `active`
to `deprecated` or `withdrawn`; and `deprecated` to `withdrawn`. Retaining the
same status is permitted. `withdrawn` is terminal. Reactivation and every other
transition are forbidden.

Admission requires a complete definition, authority citation, positive and
negative vectors, collision review, and a named maintainer. External operations,
profiles, findings, reasons, and extensions SHOULD use URI or reverse-DNS
namespaces and normally require no central allocation.

Activation requires neutral normative approval and a released registry edition.
Deprecation MUST name a replacement or explain why none exists, retain decoding,
and follow the compatibility window. Withdrawal prohibits new production but
MUST preserve historical interpretation. An identifier MUST never be reassigned.

Normal removal requires at least two minor releases and twelve months, and
occurs only in the next major version. An emergency security action MAY disable
unsafe production sooner but MUST NOT change historical meaning.

Registry changes and artifact publication are separate events. A registry entry
does not prove implementation, conformance, availability, or trust.

## 8. Deferred surface

V0 reserves only closed extension maps, independent version axes,
transport-neutral serializable envelopes, content descriptors, immutable
descriptors, explicit budgets, deterministic analysis keys, a statically wired
provider boundary, and black-box conformance manifests.

The following are outside the normative scaffold: executable plugins, dynamic
provider discovery, transports, daemons, remote content, hosted registries,
sessions, caches, locks, a universal rule DSL, module/preset composition,
architecture inference, framework catalogs, signatures, certification, and
central telemetry. Adding any one requires a separately approved threat model,
compatibility contract, and demonstrated multi-consumer need.

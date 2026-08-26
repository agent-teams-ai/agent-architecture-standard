# AAS v0 portable-bounded security and conformance

Status: normative Phase 0 scaffold; unpublished; all claim IDs provisional

## 1. Security posture

The first AAS security profile is portable-bounded. It is intended to produce an
honest, bounded snapshot across common platforms without executing repository
content. It does not claim confidentiality or race-free containment against a
hostile process running as the same operating-system user.

The provisional profile ID is `agent-architecture-snapshot-portable-bounded@0`.
An implementation MUST NOT present this profile as hardened containment. A future
handle-relative or sandboxed profile requires its own threat model, identifiers,
vectors, and conformance claim.

Portable-bounded results MAY support shadow or advisory operation. They MUST NOT
satisfy a required binding whose accepted attacker model demands protection
from undetectable same-user ancestor swaps, hostile kernel behavior, or a
stronger platform guarantee.

## 2. Actors and trust boundaries

The profile considers repository files, names, links, configuration, generated
artifacts, analyzer output, and rendered text untrusted. It separately considers:

1. static malicious repository state;
2. cooperative or accidental concurrent mutation that can be observed;
3. a hostile same-user process capable of racing path resolution;
4. a malicious or defective analyzer/provider;
5. an operator-controlled verifier and static allowlist.

The profile prevents root escape for accepted static state and rejects observed
drift. It does not claim to prevent every undetectable mutation in actor 3. When
a required guarantee cannot be established, the provider returns `unsupported`
or `indeterminate` according to whether the platform lacks the guarantee or an
individual capture became unstable.

Provider names, versions, and self-reported `contentDigest` or `aasIdentity`
values are self-asserted until
verified by separately trusted evidence. SHA-256 integrity does not authenticate
a producer or establish semantic truth.

## 3. Portable path requirements

The immutable portable-path profile is provisionally identified as
`agent-architecture-portable-path-unicode17@1`. Its definition version is `1`
and its Unicode version is exactly `17.0.0`. A snapshot, overlay, policy, or
binding using portable paths MUST bind both this exact profile ID/version and
its computed profile `aasIdentity`; a bare Unicode version or implementation
library version is insufficient.

The profile definition MUST bind the following official Unicode 17.0.0 source
files by exact URL and raw SHA-256 `contentDigest`:

| Source | SHA-256 |
| --- | --- |
| `https://www.unicode.org/Public/17.0.0/ucd/UnicodeData.txt` | `sha256:2e1efc1dcb59c575eedf5ccae60f95229f706ee6d031835247d843c11d96470c` |
| `https://www.unicode.org/Public/17.0.0/ucd/DerivedNormalizationProps.txt` | `sha256:71fd6a206a2c0cdd41feb6b7f656aa31091db45e9cedc926985d718397f9e488` |
| `https://www.unicode.org/Public/17.0.0/ucd/CompositionExclusions.txt` | `sha256:2f239196ef3b5b61db5cc476e9bd80f534d15aa1b74e1be1dea5d042a344c85f` |
| `https://www.unicode.org/Public/17.0.0/ucd/CaseFolding.txt` | `sha256:ff8d8fefbf123574205085d6714c36149eb946d717a0c585c27f0f4ef58c4183` |

These digests are identity inputs, not retrieval instructions. Conforming
implementations MUST use locally supplied, digest-verified copies and MUST NOT
fetch them while validating a repository.

Each accepted path and each of its segments MUST already be in Unicode NFC as
defined by the bound Unicode 17.0.0 normalization data. An implementation MUST
reject a non-NFC spelling; it MUST NOT normalize and accept it. The accepted NFC
spelling, including `/` separators, is the canonical identity-bearing path form.

For collision detection, an implementation MUST compute
`NFC(full-default-case-fold(NFC(canonical-path)))` using the bound Unicode
17.0.0 data. Full default case folding is locale-independent: mappings with
status `C` and `F` in `CaseFolding.txt` apply, `F` takes precedence over `S`,
and Turkic status `T` mappings MUST be excluded. Distinct accepted paths with
equal collision keys MUST be rejected. The collision key is validation data and
MUST NOT replace the canonical path in an identity.

The Windows reserved-device basename table for this profile is the following
immutable ASCII set, matched after ASCII case folding:

```text
CON PRN AUX NUL CLOCK$ CONIN$ CONOUT$
COM1 COM2 COM3 COM4 COM5 COM6 COM7 COM8 COM9
LPT1 LPT2 LPT3 LPT4 LPT5 LPT6 LPT7 LPT8 LPT9
```

For this check, the basename is the portion of a segment before its first `.`;
an exact segment without `.` is its basename. A segment whose folded basename
equals a table entry MUST be rejected. A conforming implementation MUST use
exactly this set under this profile identity, regardless of the host on which it
runs. It MUST NOT add or subtract an entry based on a host API, locale,
filesystem, or mutable operating-system table.

The exact rejected control-code-point table is:

```text
U+0000..U+001F
U+007F..U+009F
U+061C
U+200E..U+200F
U+202A..U+202E
U+2066..U+2069
```

The first two ranges are the profile's complete control set; the remaining
entries are its complete bidi-control set. This literal table is identity-bearing.
Implementations MUST NOT derive, add, or remove entries using a host library,
locale, mutable Unicode property, or a different Unicode version.

The exact identity-bearing path bounds are 255 UTF-8 bytes per segment, 64
segments per path, and 4096 UTF-8 bytes for the complete canonical path including
its `/` separators. Counts are taken over the accepted NFC spelling encoded as
UTF-8; a segment and the complete path MUST each satisfy their applicable bound.

The profile identity projection MUST include its ID, definition version,
Unicode version, the four source URL/digest pairs in the order shown, the exact
NFC and case-fold algorithms above, the exact reserved-device table and matching
algorithm, and all path bounds. A future Unicode upgrade MUST introduce a new
portable-path profile version and a new `aasIdentity`, retain the old definition
and data bindings for historical decoding, and provide migration and collision
vectors; it MUST NOT revise `@1` in place.

Every repository path MUST be root-relative and use `/` separators. A provider
MUST reject, never normalize and accept:

- empty paths where a concrete entry is required;
- absolute, UNC, drive-relative, drive-absolute, or device paths;
- `.` or `..` segments, repeated separators, backslashes, or NUL;
- invalid UTF-8, lone surrogates, or a code point in the exact control/bidi table
  above;
- trailing dot or space in any segment;
- reserved-device basenames under the immutable ASCII table above;
- a path that collides under the profile's pinned Unicode normalization or
  default case-fold comparison;
- a segment longer than 255 UTF-8 bytes, a path deeper than 64 segments, or a
  complete canonical path longer than 4096 UTF-8 bytes including separators.

Accepted NFC path spelling is identity-bearing and MUST NOT be silently
rewritten.

## 4. Capture behavior

A portable-bounded provider MUST receive an explicit root and manifest scope. It
MUST NOT infer a parent root from repository content or the current directory.

It MUST NOT follow symlinks, junctions, reparse points, mounts admitted as links,
or repository-controlled aliases. It MUST reject devices, sockets, FIFOs, and
other non-regular entry types. For every relevant regular file, the provider MUST
observe the platform link count before and after reading. If either observation
is unavailable or untrustworthy, or if the initial count is not exactly one, the
file is `unsupported`. If the initial count is one and the count changes during
capture, including a final count other than one, the file is `unstable`. In both
cases its bytes MUST be discarded and relevant coverage is incomplete. This
rule rejects both an in-root hard link and a repository path hard-linked to an
outside file while distinguishing absent platform support from an observed
capture race.

Where the platform exposes no-follow handles, the provider MUST use them for
terminal files. It MUST validate opened type, identity, size, and applicable
link metadata before and after reading. It MUST revalidate root ancestry and
discard captured bytes and evidence on observed drift.

A platform that cannot establish the named portable guarantee MUST report
`unsupported`. It MUST NOT substitute a weaker traversal mode under the same
profile ID. An entry that changes during a supported capture is `unstable` and
prevents complete relevant coverage.

Capture MUST be read-only. A provider MUST NOT write, lock, rename, chmod,
touch, stage, checkout, or partially apply an overlay in the target repository.
Overlay validation is virtual, atomic, and stale-base-safe.

## 5. Inert data and denied capabilities

The provider MUST NOT execute repository scripts, hooks, imports, binaries,
package managers, installers, build tools, model calls, shell expansions, or
configuration callbacks. It MUST NOT load executable plugins or dynamically
discover provider code from the repository.

The provider MUST NOT make network requests or dereference URLs, redirects,
registries, remote content descriptors, Git submodule locations, or schema
references. Remote descriptors are `unsupported` in v0.

Repository configuration MAY select only exact statically allowed identifiers
and `aasIdentity` values. It MUST NOT select executable paths, commands, environment values,
or trust roots. Operator allowlisting occurs outside repository authority.

Analyzer output MUST be decoded as untrusted bounded data, checked against its
schema, and reconciled with snapshot-bound evidence where possible. Analyzer
prose MUST NOT become remediation commands or instructions.

## 6. Resource limits and privacy

The profile MUST define deterministic ceilings and accounting units for encoded
input bytes, nesting, path segments and bytes, entries, logical bytes, read
bytes, per-entry bytes, overlay operations, requested targets, evidence
references, extension bytes, diagnostics, output bytes, concurrency, and total
work.

Aggregate budgets MUST NOT reset per target, extension, retry, or page.
Implementations MUST validate before allocation and MUST detect integer
overflow, sparse-file amplification, repeated-reference amplification, and
diagnostic amplification. Exhausting a valid per-target budget yields
`indeterminate` with terminal coverage and exact counter evidence.

Elapsed deadline and external cancellation are separate from deterministic
counters. They MUST NOT yield a partial successful result. Invalid budgets are
request problems.

Portable reports MUST exclude absolute paths, environment data, secrets, source
snippets, and provider prose by default. Root-relative paths are sensitive local
metadata. A redacted export is a new derived artifact bound to the original
result `aasIdentity` and MUST NOT masquerade as the original receipt.

## 7. Security stop conditions

Qualification stops if any accepted case permits root escape, forbidden-link
following, repository mutation, execution, network access, resource-limit
bypass, stale overlay acceptance, partial overlay application, false exact pass
with incomplete coverage, or evidence resolution outside the bound snapshot.

Observed canonicalizer disagreement, nondeterministic identities, provider
self-assertion presented as authentication, or an unverifiable required-evidence
issuer also stops the affected claim and publication.

Stop conditions are failures, not opportunities to weaken a profile silently.
The implementation either corrects the defect under unchanged semantics or
introduces a versioned replacement.

## 8. Conformance claim structure

A conformance claim is profile-specific, immutable, and independently
verifiable. It is semantically complete only if it conveys all of the following
information. The claim JSON Schema is the sole authority for field names and
requiredness:

- claim schema version and initial `provisional` status;
- claimant name and immutable provider artifact `aasIdentity` and `contentDigest`;
- exact standard, canonicalization, envelope, schema-bundle, registry-edition,
  vector-suite, and conformance-suite versions and `aasIdentity` values;
- every claimed operation, evaluator, vocabulary, security, and diagnostic
  profile ID and `aasIdentity`;
- supported platforms and explicit unsupported areas;
- exact conformance manifest and report artifact identities;
- complete test disposition, omissions, and replay artifacts;
- independent oracle identities and dependency/lineage audit;
- issue and expiry boundaries;
- withdrawal and rollback references.

The claim MUST exclude qualifying approvals and conformance-authority approval
evidence. Only a later external qualification sidecar MAY bind those approvals
to the already finalized claim and its evidence.

A claim MUST NOT use a bare implementation version as its scope. Claiming one
profile does not imply another. Experimental extensions MUST NOT satisfy a core
claim. Conformance establishes contract behavior only; it does not establish
analyzer truth, producer trust, architecture quality, or fitness for a consumer.

Before neutral roles are operational, the status MUST be `provisional`, the
claim MUST remain private, and a conformance mark MUST NOT be used.

## 9. Conformance evidence

Every normative `MUST` in the claimed surface MUST map to at least one positive
and one negative vector in the traceability matrix. A claim MUST NOT omit a
mandatory security vector as unsupported while advertising that security
profile.

The runner MUST exercise the provider as a black box through its public
description and invocation boundary. It MUST NOT import production provider
code, its canonicalizer, generated runtime codecs, or transitive identity
helpers.

At least one identity oracle MUST be independently authored and independently
reviewed. The claim MUST disclose shared dependencies and lineage. Deliberately
nonconforming providers and seeded canonicalizer defects MUST be detected to
show that the runner is not only replaying production assumptions.

Evidence MUST include exact-byte identity vectors; strict JSON failures; old/new
version negotiation; duplicate target and mixed-batch reconciliation; unknown
optional and critical extensions; coverage gaps; stale identities; profile
substitution; inert configuration; hostile paths and filesystems; overlay
atomicity; budget amplification; diagnostic escaping; and historical receipt
decoding.

Reports MUST bind repository and source revision, runner artifact, provider,
profiles, all fixture `contentDigest` and `aasIdentity` values, platform/toolchain, inputs, results, coverage,
omissions, durations, and replay seeds. Results from different source revisions
or runner attempts MUST NOT be combined into one claim.

## 10. Conformance lifecycle

Claim qualification states are `provisional`, `qualified`, `suspended`,
`withdrawn`, and `expired`. The immutable claim itself records only its initial
`provisional` state. A neutral conformance authority MAY establish a later state
only in an external qualification sidecar finalized after the claim and evidence;
the claim MUST NOT be amended or identity-bind that sidecar.

A semantic defect, identity disagreement, security stop condition, false
advertisement, expired evidence window, or withdrawn dependency suspends or
withdraws the affected profile claim. Historical reports remain immutable and
decodable. Requalification produces a new claim artifact.

An implementation MUST advertise only currently qualified exact profiles in a
public conformance context. It MAY separately describe experimental capability,
clearly outside its claim.

## 11. Release manifest requirements

Publication uses an immutable cohort release manifest. It is semantically
complete only if it conveys all of the following information. The release-
manifest JSON Schema is the sole authority for field names and requiredness:

- manifest schema version, cohort ID, and experimental maturity;
- each member's public name, numeric or prerelease version, artifact
  `aasIdentity`, raw `contentDigest`,
  byte length, media type, and provenance/SBOM identities;
- exact dependency edges and pins among members;
- schema, registry, vector, profile, and conformance claim `aasIdentity` values;
- source and release commit identities;
- already-finalized qualification-sidecar identities;
- registry installation, package inventory, upgrade, downgrade, public API,
  rollback, and consumer-canary evidence;
- publication order and completion status;
- already-finalized normative, conformance, and release approval-sidecar
  identities;
- known limitations, supported versions, and withdrawal instructions.

A release manifest is constructed last and MUST point strictly backward to
already finalized artifacts, claims, reports, matrices, and qualification
sidecars. None of those referenced artifacts MAY contain or identity-bind the
identity of the future release manifest. This ordering is part of manifest
validity and prevents a qualification fixed point.

The manifest MUST NOT reproduce approval evidence, approver identities, or
issuer identities from those sidecars; it binds only the identities of the
already finalized external sidecars that carry that information.

A partial cohort is not qualified. The manifest closes only after all members
are published and their immutable registry bytes match qualified artifacts. A
mutable dist-tag, registry page, or workspace link is not evidence of content.

Published artifacts MUST NOT be overwritten or silently repaired. Failure after
publication is fixed forward with a new version; consumers MAY retain an exact
last-known-good pin. Unpublishing is not a normative rollback mechanism.

## 12. Separate dependency and publication DAGs

The code dependency DAG and qualification/publication DAG are different and
MUST be evaluated separately.

The provisional dependency shape is:

```text
standard <- reference
standard <- conformance
standard <- consumer adapter
reference <- consumer adapter
conformance -X-> reference production code
```

No Foundation package is normative. Conformance is a sibling consumer of the
standard, not a child of the reference implementation.

The publication DAG requires: normative standard artifacts first; independently
versioned reference and conformance artifacts after their prerequisites;
consumer adapters only after exact public dependencies exist; and a final cohort
manifest after every release-owned qualification succeeds.

Dogfood and consumer adoption do not add reverse code dependencies. A clean
bootstrap MUST be possible without invoking the new dogfood gate, followed by
dogfood of built artifacts and isolated qualification of packed artifacts.

## 13. Release channel sequence

The accepted v0 publication sequence is a public release candidate whose
immutable SemVer is exactly `X.Y.Z-rc.N`. `X`, `Y`, and `Z` are canonical SemVer
nonnegative decimal integers with no leading zeroes except `0`; `N` is a
canonical positive decimal integer matching `[1-9][0-9]*`. Build metadata and
additional prerelease identifiers are forbidden. The RC MUST use a non-`latest`
dist-tag. It is followed by a separately built and qualified numeric 0.x
release whose exact SemVer is `0.Y.Z`, with canonical nonnegative `Y` and `Z`
and no prerelease or build metadata. The numeric release MUST be a separately
immutable artifact cohort; it MUST NOT reuse RC bytes, be a dist-tag promotion,
or otherwise substitute relabeling for qualification.

An RC MUST remain explicitly experimental, MUST NOT use `latest`, and MUST have
its own release manifest and provisional or qualified claim status. External RC
installation evidence MAY inform the numeric release but MUST NOT replace its
exact-artifact qualification.

The numeric 0.x release remains experimental and MUST NOT be described as
stable v1 or universal production assurance. `latest` assignment, if any, is a
release-governance decision after numeric qualification and is not implied by
this scaffold.

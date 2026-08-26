# Normative traceability matrix template

Status: normative process template; copy into a versioned evidence artifact

Every public conformance claim MUST be accompanied by a complete matrix for its
claimed surface. The claim is finalized first and MUST NOT point forward to the
matrix. The matrix MAY identify the already finalized claim, and a later
qualification sidecar MUST bind both identities. One row represents one
normative `MUST`; combined rows are forbidden unless the same atomic assertion
and evidence prove every listed requirement.

## Claim header projection

This table projects the semantic claim obligations in
`../spec/security-and-conformance.md` and the future claim schema's wire-shape
requirements. It does not independently make fields required.

| Field | Required value |
| --- | --- |
| Claim artifact ID | Immutable claim identity |
| Claimed profiles | Exact IDs and `aasIdentity` values |
| Standard and envelope versions | Exact immutable versions |
| Schema/registry/vector editions | Exact IDs and `aasIdentity` values |
| Provider artifact | Exact `aasIdentity`, `contentDigest`, and byte length |
| Conformance suite | Exact artifact `aasIdentity` and `contentDigest` |
| Independent oracle | Exact artifact and lineage audit IDs |

## Requirement rows

| Requirement ID | Exact normative text | Claim area | Authority artifact and anchor | Positive vector | Negative vector | Supported version pairs | Evidence artifact | Owner | Promotion/claim state | Rollback drill | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PROVISIONAL-TEMPLATE | Replace with one atomic `MUST` | — | — | — | — | — | — | — | provisional | — | unproven |

`Result` is one of `proven`, `failed`, `not-claimed`, or `blocked-by-defect`.
Missing, indirect, skipped, or unverifiable evidence is not `proven`.

## Required audit checks

- Every claimed normative `MUST` appears exactly once.
- Every row names its claim-specific authority under the authority matrix.
- Positive and negative vectors use immutable exact suite versions.
- Version-pair coverage matches the full advertised compatibility surface.
- Evidence is bound to the exact provider, suite, inputs, platform, and result.
- Identity-critical evidence uses an independent oracle and disclosed lineage.
- Mandatory security cases are not skipped as unsupported.
- Promotion state and enforcement scope are not conflated.
- Each required rule has a stable diagnostic code and tested rollback.
- Historical decoding and claim withdrawal preserve old artifact meaning.
- Qualifying approvals and approver identities occur only in the later external
  qualification sidecar, not in the claim or matrix.

The completed matrix MUST itself be immutable. The claim MUST NOT list the
matrix; a later external qualification sidecar MUST list the already finalized
claim and matrix. The matrix and sidecar MUST NOT contain or identity-bind a
future release-manifest identity. A release manifest, constructed later, MUST
point backward to the finalized claim, matrix, and sidecar. Any normative change
invalidating a row requires a new matrix and claim; it MUST NOT amend historical
evidence in place.

# Conformance vector index

Status: normative index; Phase 0 placeholders only; no evidence produced

Golden vectors are the sole authority for exact observable bytes, raw
`contentDigest` values, framed `aasIdentity` values,
ordering, and outcomes of their named cases. Normative prose owns the general
algorithm. A vector MUST NOT introduce a rule absent from its semantic or schema
authority.

Phase 0 contains one provisional remediation suite. It supplies exact examples
for specification review but has not received independent-oracle review and
cannot support a conformance claim. Future suites MUST be immutable,
language-neutral, and indexed exactly once here. Their own digest, artifact
identity, and qualification belong in a later external sidecar, never in the
suite itself.

A suite used in profile construction MUST declare exactly one of two classes. A
definition-vector suite MUST identify its subject profile by textual profile ID
and definition version and MUST NOT contain the eventual profile `aasIdentity`;
its finalized suite artifact identity MAY be an input to profile identity. A
qualification-vector suite MUST instead bind an already finalized profile
`aasIdentity` and MUST NOT participate in that profile identity.

| Suite path | Owns exact examples for | Authority citations | Status |
| --- | --- | --- | --- |
| [phase-0-remediation-v1.md](phase-0-remediation-v1.md) | UTF-16 ordering, raw/framed identity, result self-identity, exception freshness, static hard-link rejection, and link-count race instability | `identity.md` §§2, 4–6; `policy-and-enforcement.md` §§7–9; `security-and-conformance.md` §4 | provisional; independently recomputed, not qualified |

Minimum future suites are:

- strict I-JSON acceptance and rejection;
- RFC 8785 canonical bytes, raw `contentDigest`, and length-delimited domain `aasIdentity`;
- every identity input mutation and exclusion;
- envelope negotiation, unknown fields, and extensions;
- target reconciliation, problems, and resolution taxonomy;
- coverage, evidence, stale inputs, and receipts;
- effective policy validity, binding precedence, defaults, and exceptions;
- enforcement modes, rollout scope, diagnostics, and freshness;
- portable paths, hostile repository capture, limits, and privacy;
- conformance claim lifecycle and release manifests.

Every normative `MUST` in a claim requires at least one positive and one negative
vector. A vector record MUST contain a stable case ID, requirement IDs, exact
inputs, expected validity or problem, exact canonical bytes where relevant,
expected identities/results, applicable versions, and rationale.

Vector generation MUST NOT import the reference implementation as its identity
oracle. At least one exact-byte suite MUST be independently authored and
reviewed. A corrected expectation creates a new suite version; published vectors
MUST NOT be silently replaced.

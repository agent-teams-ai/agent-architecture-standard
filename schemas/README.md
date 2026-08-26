# Schema index

Status: normative index; Phase 0 placeholders only; schema IDs provisional

JSON Schema 2020-12 documents will be the sole authority for wire shape,
including fields, requiredness, JSON types, closed objects, and declared bounds.
No schema has been admitted in Phase 0. This empty index is intentional and does
not imply an implemented envelope.

Each future row MUST be added exactly once and MUST include an immutable local
path, provisional or active schema ID, owned claim family, referenced registry
edition, definition vector suites, and lifecycle status. A schema artifact's
own `aasIdentity`, `contentDigest`, byte length, media type, approvals, and
qualification evidence MUST appear only in a later external qualification
sidecar. The schema and this definition index MUST NOT point forward to that
sidecar.

| Local path | Schema ID | Owns | Registry edition | Definition vectors | Status |
| --- | --- | --- | --- | --- | --- |
| — | — | No schema admitted | — | — | provisional scaffold |

Required future schema families are:

- provider description and version negotiation;
- request and per-target input envelopes;
- result and per-target resolution envelopes;
- request/provider problem envelopes;
- artifact, snapshot, coverage, and evidence descriptors;
- profile, effective-policy, binding, and exception documents;
- overlay declarations and validation receipts;
- diagnostic header, decision trace, and pagination cursor;
- conformance claim, conformance report, and release manifest.
- external qualification sidecar for finalized definition and evidence artifacts.

Schemas MUST use closed core objects and explicit bounded extension locations.
They MUST resolve references locally without network access. A schema MUST NOT
embed semantic rules owned by prose as a competing authority.

Admission requires positive and negative vectors, strict JSON cases, a
traceability row for every owned `MUST`, deterministic local reference
resolution, and neutral normative approval. Generated language types are derived
and MUST NOT appear in this index as normative artifacts.

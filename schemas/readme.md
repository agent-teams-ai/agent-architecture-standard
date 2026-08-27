# Schema index

Status: normative index; private Phase 1 artifacts; schema IDs provisional and unpublished

JSON Schema 2020-12 documents are the sole authority for wire shape,
including fields, requiredness, JSON types, closed objects, and declared bounds.
The schemas below are admitted only to this private Phase 1 implementation
slice. They do not activate a public namespace or conformance claim.

Each row MUST be added exactly once and MUST include an immutable local
path, provisional or active schema ID, owned claim family, referenced registry
edition, definition vector suites, and lifecycle status. A schema artifact's
own `aasIdentity`, `contentDigest`, byte length, media type, approvals, and
qualification evidence MUST appear only in a later external qualification
sidecar. The schema and this definition index MUST NOT point forward to that
sidecar.

| Local path | Schema ID | Owns | Registry edition | Definition vectors | Status |
| --- | --- | --- | --- | --- | --- |
| [`artifact-manifest.schema.json`](artifact-manifest.schema.json) | `https://schemas.aas.invalid/private/v0/artifact-manifest.schema.json` | machine-readable private artifact manifest | 1 | schema corpus and clean-generation/package gates | private provisional |
| [`artifacts.schema.json`](artifacts.schema.json) | `https://schemas.aas.invalid/private/v0/artifacts.schema.json` | artifact, snapshot, coverage, and evidence descriptors | 1 | schema corpus | private provisional |
| [`common.schema.json`](common.schema.json) | `https://schemas.aas.invalid/private/v0/common.schema.json` | shared bounded primitives and references | 1 | schema corpus | private provisional |
| [`conformance.schema.json`](conformance.schema.json) | `https://schemas.aas.invalid/private/v0/conformance.schema.json` | claim, report, qualification sidecar, and cohort manifest shapes | 1 | schema corpus and conformance skeleton | private provisional |
| [`envelope.schema.json`](envelope.schema.json) | `https://schemas.aas.invalid/private/v0/envelope.schema.json` | request, result, resolution, diagnostic, and problem envelopes | 1 | `vectors/schema/corpus.json` | private provisional |
| [`identity-documents.schema.json`](identity-documents.schema.json) | `https://schemas.aas.invalid/private/v0/identity-documents.schema.json` | identity-bearing core documents | 1 | schema corpus and strict-JSON corpus | private provisional |
| [`overlay.schema.json`](overlay.schema.json) | `https://schemas.aas.invalid/private/v0/overlay.schema.json` | overlay operations, declarations, and receipts | 1 | `vectors/schema/corpus.json` | private provisional |
| [`policy.schema.json`](policy.schema.json) | `https://schemas.aas.invalid/private/v0/policy.schema.json` | effective policy, bindings, exceptions, and enforcement records | 1 | schema corpus | private provisional |
| [`provider.schema.json`](provider.schema.json) | `https://schemas.aas.invalid/private/v0/provider.schema.json` | provider description and advertised immutable versions | 1 | `vectors/schema/corpus.json` | private provisional |
| [`registry.schema.json`](registry.schema.json) | `https://schemas.aas.invalid/private/v0/registry.schema.json` | registry editions and entries | 1 | registry validation corpus | private provisional |

Schemas MUST use closed core objects and explicit bounded extension locations.
They MUST resolve references locally without network access. A schema MUST NOT
embed semantic rules owned by prose as a competing authority.

Public activation still requires positive and negative vectors, a traceability
row for every owned `MUST`, deterministic local reference resolution, and
neutral normative approval. Those public gates are not complete. Generated
language types are derived and MUST NOT appear in this index as normative
artifacts.

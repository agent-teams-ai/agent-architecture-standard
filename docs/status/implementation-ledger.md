# AAS implementation ledger

Status: current at 2026-08-28; nonnormative; private; unpublished; no
conformance claim.

This page is an operational index. It does not change normative semantics,
activate an identifier, qualify an implementation, authorize publication, or
close D1. Normative authority remains with the owner artifacts indexed by the
[repository README](../../README.md#normative-document-map).

## Source boundary

| Source | Exact revision used | What it establishes |
| --- | --- | --- |
| AAS implementation baseline | `535ca76726da0db6eaac3c0eee98ff68fe34befe` | Audited private implementation and documentation state; see [source provenance](../../SOURCE.md), [private verifier architecture](../architecture/private-verifier-modules.md), and [private conformance slice](../../conformance/README.md). |
| Engineering Foundation current main | [`1105fdbf4535d9518f655a52f2dc12f542533901`](https://github.com/agent-teams-ai/engineering-foundation/commit/1105fdbf4535d9518f655a52f2dc12f542533901) | Read-only integration and release context. |
| Foundation research source | [`75cc49466bb7eebef375b24a870f2a9feeb688cb`](https://github.com/agent-teams-ai/engineering-foundation/commit/75cc49466bb7eebef375b24a870f2a9feeb688cb) | Historical research slice copied unchanged into `docs/research/`; it is not current authority. |
| Orchestrator evidence snapshot | [`fdd47cbc0bc1a2177060200db00bb435e0d79f76`](https://github.com/agent-teams-ai/agent-teams-orchestrator/commit/fdd47cbc0bc1a2177060200db00bb435e0d79f76) | Exact consumer snapshot in Foundation's [commit-addressed evidence fixture](https://github.com/agent-teams-ai/engineering-foundation/blob/1105fdbf4535d9518f655a52f2dc12f542533901/packages/docs-protocol/tests/fixtures/current-consumer-shapes.v1.json); not evidence of later default-branch state. |
| Platform evidence snapshot | [`001dcdc39067be55b93b7faf7b432f901d1d85b5`](https://github.com/agent-teams-ai/agent-teams-platform/commit/001dcdc39067be55b93b7faf7b432f901d1d85b5) | Exact consumer snapshot in Foundation's [commit-addressed evidence fixture](https://github.com/agent-teams-ai/engineering-foundation/blob/1105fdbf4535d9518f655a52f2dc12f542533901/packages/docs-protocol/tests/fixtures/current-consumer-shapes.v1.json); not evidence of later default-branch state. |

## Accepted decisions and authority

Decision packets accept outcomes; they are not implementation, qualification,
or release evidence. The [current Phase 0 packet](../../decisions/phase-0-d0-d11-v2.md)
supersedes version 1 in full while incorporating the rows identified below.

| Decision | Current status | Exact decision record | Normative projection |
| --- | --- | --- | --- |
| D0 naming | Accepted, unpublished | [Incorporated D0 record](../../decisions/phase-0-d0-d11-v1.md#d0-public-naming), controlled by [packet v2](../../decisions/phase-0-d0-d11-v2.md#record-authority-and-provenance) | [Core purpose and boundary](../../spec/core.md#1-purpose-and-boundary) |
| D1 authority home | Accepted; **incomplete** | [Incorporated D1 record](../../decisions/phase-0-d0-d11-v1.md#d1-repository-and-authority-home), corrected by [ADR-0002](../decisions/0002-d1-relocation-status.md) | [Governance current state and neutrality trigger](../../spec/governance.md#1-honest-current-state) |
| D2 artifact authority | Accepted, unpublished | [Incorporated D2 record](../../decisions/phase-0-d0-d11-v1.md#d2-artifact-authority), controlled by packet v2 | [Artifact authority and conflicts](../../spec/core.md#3-artifact-authority-and-conflicts) |
| D3 JSON and identity | Accepted, unpublished | [Incorporated D3 record](../../decisions/phase-0-d0-d11-v1.md#d3-canonical-json-and-identities), controlled by packet v2 | [Identity and canonicalization](../../spec/identity.md) |
| D4 security profile | Accepted, unpublished | [Incorporated D4 record](../../decisions/phase-0-d0-d11-v1.md#d4-snapshot-security-profiles), controlled by packet v2 | [Portable path, capture, and denied-capability requirements](../../spec/security-and-conformance.md#3-portable-path-requirements) |
| D5 operation surface | Accepted replacement | [Packet v2 D5](../../decisions/phase-0-d0-d11-v2.md#d5-first-operation-surface-replacement) | [`validate-overlay@1` initial boundary](../../spec/core.md#initial-public-operation-boundary) |
| D6 policy boundary | Accepted, unpublished | [Incorporated D6 record](../../decisions/phase-0-d0-d11-v1.md#d6-policy-composition-boundary), controlled by packet v2 | [Closed effective-policy boundary](../../spec/policy-and-enforcement.md#1-closed-effective-policy-boundary) |
| D7 consumer adoption | Accepted; no adoption authorized by the record | [Incorporated D7 record](../../decisions/phase-0-d0-d11-v1.md#d7-consumers-and-adoption), controlled by packet v2 | [Foundation and consumers](../../spec/governance.md#6-foundation-and-consumers) |
| D8 enforcement graduation | Accepted, unpublished | [Incorporated D8 record](../../decisions/phase-0-d0-d11-v1.md#d8-enforcement-graduation), controlled by packet v2 | [Enforcement modes and rollout](../../spec/policy-and-enforcement.md#8-enforcement-modes-and-rollout) |
| D9 release sequence | Accepted replacement; privately amended | [Packet v2 D9](../../decisions/phase-0-d0-d11-v2.md#d9-experimental-publication-sequence-replacement) and [current Phase 1 amendment](../../decisions/phase-1-p1-remediation-v1.md#numeric-successor-release-candidate-grammar) | [Release channel sequence](../../spec/security-and-conformance.md#13-release-channel-sequence) |
| D10 dependency/publication DAGs | Accepted, unpublished | [Incorporated D10 record](../../decisions/phase-0-d0-d11-v1.md#d10-dependency-and-publication-dags), controlled by packet v2 | [Separate dependency and publication DAGs](../../spec/security-and-conformance.md#12-separate-dependency-and-publication-dags) |
| D11 governance | Accepted; operational gate unmet | [Incorporated D11 record](../../decisions/phase-0-d0-d11-v1.md#d11-lightweight-governance-before-public-0x), controlled by packet v2 | [Required roles and publication policies](../../spec/governance.md#2-required-lightweight-roles) |

[ADR-0001](../decisions/0001-authority-and-incubation.md) preserves the
artifact-authority split and Foundation's nonnormative role. ADR-0002 supersedes
only its claim that independent conformance authority is already governed here.

## Implemented private machinery

| Status | Machinery | Evidence and boundary |
| --- | --- | --- |
| Implemented, private | Strict JSON, canonical JSON, SHA-256 digests, domain-framed identities, portable paths, and Unicode 17 normalization/case folding | [`lib/`](../../lib/) implementation exercised by the [definition corpora](../../vectors/readme.md); nonnormative code. |
| Implemented, private | Schema, registry, document, release, and result validation | Private modules under [`lib/`](../../lib/) with deterministic offline checks; no public provider runtime. |
| Implemented, private | Binding selection, effective budgets, resource accounting, request/result invariants, and a synchronous injected invocation kernel | [Module boundary](../architecture/private-verifier-modules.md); the 26-name facade and all `lib/` modules remain outside package exports. |
| Implemented, private | Reproducible schema-derived declarations, artifact inventory, index/link checks, corpus checks, package checks, and clean-generation checks | [Package scripts](../../package.json) and [raw-byte inventory](../../artifacts.json); these are verification machinery, not qualification. |
| Implemented, private prototype | Black-box strict-JSON runner, fixed candidate frame, independent example candidate, literal-digest oracle, bounded reports, and hostile-process fixtures | [Private conformance slice](../../conformance/README.md) and [artifact baseline](../../conformance/artifact-baseline.json); narrow, unpublished, and non-claiming. |

Unresolved ownership question: an AAS private verifier kernel exists, but there
is no official packaged reference provider, and deciding whether the verifier
is moved/reused as the reference donor or remains verifier-only is still
required.

## Conformance ledger

| Area | Actual coverage | Missing before a claim |
| --- | --- | --- |
| Strict JSON | The private black-box slice executes all 18 cases in [`vectors/json/corpus.json`](../../vectors/json/corpus.json) against an independent example candidate and literal expected digests. | Independent conformance-maintainer review, neutral authority, a public provider transport, platform qualification, and public immutable suite artifacts. |
| Schema shape and local catalog | Private checks exercise 124 schema cases and 17 offline catalog cases across the 11 provisional schemas. | Qualification vectors bound to finalized profile identities, independent review, and complete semantic—not only shape—coverage. |
| Registries and bindings | Private admission checks cover the checked-in registry corpus and binding-selection permutations; all eight registries remain provisional and contain no active values. | Positive and negative admission evidence for every activated value, collision review, namespace custody, and public lifecycle evidence. |
| Verifier behavior | Repository tests cover identities, result projections/invariants, policy bindings, budgets, release manifests, admission boundaries, and module isolation. | A packaged provider under test, independent black-box expectations, and end-to-end `validate-overlay@1`, capture, policy, negotiation, result, receipt, and release-claim suites. |
| Normative traceability | Structured vector citations resolve to authoritative sections. | Atomic stable requirement IDs and at least one positive and one negative language-neutral vector for every normative `MUST`; the [vector index](../../vectors/readme.md) lists the remaining suite families. |

No AAS implementation is conformant or qualified on this evidence. The private
runner also provides no network containment, universal hostile-code sandbox,
runtime-binary attestation, ancestor-link exclusion, or unconditional Windows
process-tree containment; its exact limits are recorded in the
[slice documentation](../../conformance/README.md#security-and-process-boundary).

## Publication blockers and limitations

- D1 relocation is incomplete; the repository remains private and its schemas,
  identifiers, packages, marks, and claims remain unpublished.
- Independent conformance and release maintainers are unassigned; namespace
  custody and the required separation of approval credentials are not
  operational. See [maintainer state](../../MAINTAINERS.md).
- Public collision checks, traceability, qualification sidecars, cohort release
  evidence, and post-publication receipts are incomplete.
- There is no official packaged reference provider, public transport, Foundation
  adapter, consumer adoption record, or required-mode promotion evidence.
- Provisional schemas, registries, profiles, declarations, manifests, vectors,
  and private test results cannot support a publication or conformance claim.

## Consumer integration state

| Consumer | AAS status | Current evidence |
| --- | --- | --- |
| Foundation | Direction accepted; implementation **not integrated** | The direction was accepted in [`58a37663e84f1225ca4866b71c61ae88a783c8a6`](https://github.com/agent-teams-ai/engineering-foundation/commit/58a37663e84f1225ca4866b71c61ae88a783c8a6); current main is [`1105fdbf4535d9518f655a52f2dc12f542533901`](https://github.com/agent-teams-ai/engineering-foundation/commit/1105fdbf4535d9518f655a52f2dc12f542533901). Foundation retains the accepted incubation direction and historical research, but no AAS package, official reference provider, adapter, dogfood binding, or adoption record is evidenced. |
| Orchestrator | **Not adopted** on the evidence available here | Foundation's exact recorded snapshot is [`fdd47cbc0bc1a2177060200db00bb435e0d79f76`](https://github.com/agent-teams-ai/agent-teams-orchestrator/commit/fdd47cbc0bc1a2177060200db00bb435e0d79f76); it shows repository-local architecture checks and Foundation/Docs consumption, not an AAS advisory binding or adoption record. No later default-branch audit is claimed. |
| Platform | **Not adopted** on the evidence available here | Foundation's exact recorded snapshot is [`001dcdc39067be55b93b7faf7b432f901d1d85b5`](https://github.com/agent-teams-ai/agent-teams-platform/commit/001dcdc39067be55b93b7faf7b432f901d1d85b5); it shows repository-local architecture checks and Foundation/Docs consumption, not an AAS advisory binding or adoption record. No later default-branch audit is claimed. |

### Resolved Foundation release incident (not AAS status)

Foundation release commit
[`775824b32c200663f1076eb9448dafa3f913a4f6`](https://github.com/agent-teams-ai/engineering-foundation/commit/775824b32c200663f1076eb9448dafa3f913a4f6)
introduced
[`@agent-teams/engineering-foundation@0.20.0`](https://www.npmjs.com/package/@agent-teams/engineering-foundation/v/0.20.0)
and
[`@agent-teams/docs-protocol@0.2.0`](https://www.npmjs.com/package/@agent-teams/docs-protocol/v/0.2.0).
The first release run partially published Foundation and failed while npm
visibility was delayed. PR #204 merged as
[`1105fdbf4535d9518f655a52f2dc12f542533901`](https://github.com/agent-teams-ai/engineering-foundation/commit/1105fdbf4535d9518f655a52f2dc12f542533901)
and changed only the bounded observation window. Its automatic release run
completed: both exact versions now resolve from npm and both `latest` tags point
to them.

That operational incident is resolved for the two Foundation-owned packages.
It did not publish AAS, provide AAS conformance evidence, or close D1.

## Next safe vertical slice

Status: private-only and gated by the unresolved verifier/reference ownership
decision above.

After that ownership is recorded without changing current semantics, close one
private end-to-end `validate-overlay@1` path: admit a bounded request through an
explicit provider boundary, validate exact base and overlay inputs, produce the
closed bounded result through the existing kernel ports, and test it black-box
against independently authored positive, negative, stale-base, collision,
budget, and substitution vectors. Keep the package private, reuse only current
provisional identifiers and profiles, and do not activate Foundation or a real
consumer.

Next action: record the verifier/reference ownership decision, then preregister
the private slice's exact inputs, outputs, limits, independent oracle boundary,
and stop conditions before implementation.

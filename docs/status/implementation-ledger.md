# AAS implementation ledger

Status: current at retained observations through 2026-08-29; nonnormative;
private; unpublished; no conformance claim.

This page is an operational index. It does not change normative semantics,
activate an identifier, qualify an implementation, authorize publication, or
close D1. Normative authority remains with the owner artifacts indexed by the
[repository README](../../README.md#normative-document-map).

## Source boundary

The remote observations in this section are commit-scoped operational context.
They were captured in a retained read-only GitHub API snapshot generated at
`2026-08-29T22:09:58Z`; the snapshot retains its own `SHA256SUMS` manifest, and
the independent audit is a separate retained result. Stable commit links
identify the observed remote revisions here; neither the external snapshot nor
a consumer plan establishes AAS semantics, conformance, qualification, or
adoption.

| Source | Exact revision used | What it establishes |
| --- | --- | --- |
| AAS remote main observed | [`d5564cfe1567b302bcf36fd48b931a95b267dfb1`](https://github.com/agent-teams-ai/agent-architecture-standard/commit/d5564cfe1567b302bcf36fd48b931a95b267dfb1) | Exact clean base for this ledger refresh. Its parent `535ca76726da0db6eaac3c0eee98ff68fe34befe` remains implementation provenance for the private machinery, not the current observation head; see [source provenance](../../SOURCE.md), [private verifier architecture](../architecture/private-verifier-modules.md), and [private conformance slice](../../conformance/README.md). |
| Engineering Foundation remote main and release commit observed | [`16e19d1ff82ceb049198c2070d45ec9031ab6cef`](https://github.com/agent-teams-ai/engineering-foundation/commit/16e19d1ff82ceb049198c2070d45ec9031ab6cef) | Read-only Foundation `0.21.0` and Docs Protocol `0.4.1` release context only. |
| Foundation research source | [`75cc49466bb7eebef375b24a870f2a9feeb688cb`](https://github.com/agent-teams-ai/engineering-foundation/commit/75cc49466bb7eebef375b24a870f2a9feeb688cb) | Historical research slice copied unchanged into `docs/research/`; it is not current authority. |
| Orchestrator remote main observed | [`f68d3d391c32d6c58bb0b11b0736831e5057743b`](https://github.com/agent-teams-ai/agent-teams-orchestrator/commit/f68d3d391c32d6c58bb0b11b0736831e5057743b) | Commit-scoped consumer observation; independent of the historical Foundation fixture below. |
| Runtime remote main observed | [`3e1b977d9ab6147eb702b62497bd0be62acb8cf7`](https://github.com/agent-teams-ai/agent-runtime/commit/3e1b977d9ab6147eb702b62497bd0be62acb8cf7) | Commit-scoped consumer observation. |
| Platform remote main observed | [`01abe850fe1a975e6bdcad6edfeb4d5978316bca`](https://github.com/agent-teams-ai/agent-teams-platform/commit/01abe850fe1a975e6bdcad6edfeb4d5978316bca) | Commit-scoped consumer observation; independent of the historical Foundation fixture below. |
| Extension remote main observed | [`5aa3da7ff6f5e202e65115e4712e3ef638895e10`](https://github.com/agent-teams-ai/extension-foundation/commit/5aa3da7ff6f5e202e65115e4712e3ef638895e10) | Commit-scoped consumer observation. |
| Historical Orchestrator Foundation fixture | [`fdd47cbc0bc1a2177060200db00bb435e0d79f76`](https://github.com/agent-teams-ai/agent-teams-orchestrator/commit/fdd47cbc0bc1a2177060200db00bb435e0d79f76) | Snapshot retained in Foundation's [commit-addressed fixture](https://github.com/agent-teams-ai/engineering-foundation/blob/1105fdbf4535d9518f655a52f2dc12f542533901/packages/docs-protocol/tests/fixtures/current-consumer-shapes.v1.json); historical evidence only. |
| Historical Platform Foundation fixture | [`001dcdc39067be55b93b7faf7b432f901d1d85b5`](https://github.com/agent-teams-ai/agent-teams-platform/commit/001dcdc39067be55b93b7faf7b432f901d1d85b5) | Snapshot retained in the same Foundation fixture; historical evidence only. |

A separately retained local recovery archive is evidenced here only by its
verified digest
`sha256:9c8bca1904997c3fe8a1efedafadb151ac3844fd395a9bd9c27bea2854298ef6`.
It was not inspected for this refresh and establishes no remote repository
state, semantics, implementation, conformance, qualification, or adoption. Its
host-local path is intentionally not reproduced.

## Accepted decisions and authority

Decision packets accept outcomes; they are not implementation, qualification,
or release evidence. The [current Phase 0 packet](../../decisions/phase-0-d0-d11-v2.md)
supersedes version 1 in full while incorporating the rows identified below.

| Decision | Current status | Exact decision record | Normative projection |
| --- | --- | --- | --- |
| D0 naming | Accepted, unpublished | [Incorporated D0 record](../../decisions/phase-0-d0-d11-v1.md#d0--public-naming), controlled by [packet v2](../../decisions/phase-0-d0-d11-v2.md#record-authority-and-provenance) | [Core purpose and boundary](../../spec/core.md#1-purpose-and-boundary) |
| D1 authority home | Accepted; **incomplete** | [Incorporated D1 record](../../decisions/phase-0-d0-d11-v1.md#d1--repository-and-authority-home), corrected by [ADR-0002](../decisions/0002-d1-relocation-status.md) | [Governance current state and neutrality trigger](../../spec/governance.md#1-honest-current-state) |
| D2 artifact authority | Accepted, unpublished | [Incorporated D2 record](../../decisions/phase-0-d0-d11-v1.md#d2--artifact-authority), controlled by packet v2 | [Artifact authority and conflicts](../../spec/core.md#3-artifact-authority-and-conflicts) |
| D3 JSON and identity | Accepted, unpublished | [Incorporated D3 record](../../decisions/phase-0-d0-d11-v1.md#d3--canonical-json-and-identities), controlled by packet v2 | [Identity and canonicalization](../../spec/identity.md) |
| D4 security profile | Accepted, unpublished | [Incorporated D4 record](../../decisions/phase-0-d0-d11-v1.md#d4--snapshot-security-profiles), controlled by packet v2 | [Portable path, capture, and denied-capability requirements](../../spec/security-and-conformance.md#3-portable-path-requirements) |
| D5 operation surface | Accepted replacement | [Packet v2 D5](../../decisions/phase-0-d0-d11-v2.md#d5--first-operation-surface-replacement) | [`validate-overlay@1` initial boundary](../../spec/core.md#initial-public-operation-boundary) |
| D6 policy boundary | Accepted, unpublished | [Incorporated D6 record](../../decisions/phase-0-d0-d11-v1.md#d6--policy-composition-boundary), controlled by packet v2 | [Closed effective-policy boundary](../../spec/policy-and-enforcement.md#1-closed-effective-policy-boundary) |
| D7 consumer adoption | Accepted; no adoption authorized by the record | [Incorporated D7 record](../../decisions/phase-0-d0-d11-v1.md#d7--consumers-and-adoption), controlled by packet v2 | [Foundation and consumers](../../spec/governance.md#6-foundation-and-consumers) |
| D8 enforcement graduation | Accepted, unpublished | [Incorporated D8 record](../../decisions/phase-0-d0-d11-v1.md#d8--enforcement-graduation), controlled by packet v2 | [Enforcement modes and rollout](../../spec/policy-and-enforcement.md#8-enforcement-modes-and-rollout) |
| D9 release sequence | Accepted replacement; privately amended | [Packet v2 D9](../../decisions/phase-0-d0-d11-v2.md#d9--experimental-publication-sequence-replacement) and [current Phase 1 amendment](../../decisions/phase-1-p1-remediation-v1.md#numeric-successor-release-candidate-grammar) | [Release channel sequence](../../spec/security-and-conformance.md#13-release-channel-sequence) |
| D10 dependency/publication DAGs | Accepted, unpublished | [Incorporated D10 record](../../decisions/phase-0-d0-d11-v1.md#d10--dependency-and-publication-dags), controlled by packet v2 | [Separate dependency and publication DAGs](../../spec/security-and-conformance.md#12-separate-dependency-and-publication-dags) |
| D11 governance | Accepted; operational gate unmet | [Incorporated D11 record](../../decisions/phase-0-d0-d11-v1.md#d11--lightweight-governance-before-public-0x), controlled by packet v2 | [Required roles and publication policies](../../spec/governance.md#2-required-lightweight-roles) |

[ADR-0001](../decisions/0001-authority-and-incubation.md) preserves the
artifact-authority split and Foundation's nonnormative role. ADR-0002 supersedes
only its claim that independent conformance authority is already governed here.

## Implemented private machinery

| Status | Machinery | Evidence and boundary |
| --- | --- | --- |
| Implemented, private | Strict JSON, canonical JSON, SHA-256 digests, domain-framed identities, portable paths, and Unicode 17 normalization/case folding | [`lib/`](../../lib/) implementation exercised by the [definition corpora](../../vectors/readme.md); nonnormative code. |
| Implemented, private | Schema, registry, document, release, and result validation | Private modules under [`lib/`](../../lib/) with deterministic offline checks; no public provider runtime. |
| **Implemented private machinery only** | Binding selection, effective budgets, resource accounting, request/result invariants, and a synchronous injected invocation kernel | [Module boundary](../architecture/private-verifier-modules.md); the 26-name facade and all `lib/` modules remain outside package exports. This is verifier machinery, not a reference provider, public runtime, or conformance claim. |
| Implemented, private | Reproducible schema-derived declarations, artifact inventory, index/link checks, corpus checks, package checks, and clean-generation checks | [Package scripts](../../package.json) and [raw-byte inventory](../../artifacts.json); these are verification machinery, not qualification. |
| Implemented, private prototype | Black-box strict-JSON runner, fixed candidate frame, independent example candidate, literal-digest oracle, bounded reports, and hostile-process fixtures | [Private conformance slice](../../conformance/README.md) and [artifact baseline](../../conformance/artifact-baseline.json); narrow, unpublished, and non-claiming. |

An AAS private verifier kernel exists, but there is no official packaged
reference provider. The relationship between that kernel and any future
reference implementation has no accepted owner disposition.

## Requirement progress

These operational labels are not normative registry statuses and do not fill
any semantic gap.

| Boundary | Status | Evidence boundary |
| --- | --- | --- |
| Private verifier invocation kernel | `IMPLEMENTED_PRIVATE_MACHINERY_ONLY` | Raw-byte admission, authority closure, identity recomputation, binding selection, budgets, opaque preflight capability, and result reconciliation exist in private unexported modules. |
| Reference-provider ownership | `BLOCKED_BY_DECISION` | No accepted record assigns the kernel/reference relationship, package ownership, composition root, provider runtime, or transport. |
| Overlay-version disposition and semantic ownership | `BLOCKED_BY_DECISION` | `validate-overlay@1` has provisional registry, profile, schema, identity, and verifier mechanics, but no owned end-to-end evaluator. Conflict handling, immutable input closure, precondition meaning, prospective snapshot construction, atomic result mapping, and evaluator relationship remain underdefined. This ledger neither revises `@1` nor selects a successor. |
| Private transfer ownership | `BLOCKED_BY_DECISION` | Reproducible standard-only pack/install mechanics exist, but no owner-approved standard/reference transfer unit, retained exact pair, integrity-bound receipt, or packaged reference provider exists. |
| Full overlay conformance | `NOT_COMPLETE` | The independent private prototype covers strict JSON only; there is no complete overlay, capture, or full-provider black-box suite. |
| Secure Snapshot implementation | `NOT_COMPLETE` | Threat and path requirements, snapshot wire shape, and examples exist; an identity-complete capture profile, deterministic entry-order/duplicate rules, capture ports, platform matrix, filesystem adapter, hostile executable corpus, and independent expectations do not. |
| Public qualification | `NOT_COMPLETE` | There are zero active registry identifiers, zero qualified providers, no public immutable qualification suite, and no completed D1 relocation. |
| AAS consumer adoption | `NOT_COMPLETE` | No AAS adoption record, qualified provider binding, or required-mode promotion is retained for Foundation, Orchestrator, Runtime, Platform, or Extension. |

## Conformance ledger

| Area | Checked-in evidence at the exact base | Missing before a claim |
| --- | --- | --- |
| Strict JSON | The private black-box test source enumerates all 18 cases in [`vectors/json/corpus.json`](../../vectors/json/corpus.json) against an independent example candidate and literal expected digests. | Independent conformance-maintainer review, neutral authority, a public provider transport, platform qualification, and public immutable suite artifacts. |
| Schema shape and local catalog | Private test sources enumerate 124 schema cases and 17 offline catalog cases across the 11 provisional schemas. | Qualification vectors bound to finalized profile identities, independent review, and complete semantic—not only shape—coverage. |
| Registries and bindings | Private admission test sources cover the checked-in registry corpus and binding-selection permutations; all eight registries remain provisional and contain no active values. | Positive and negative admission evidence for every activated value, collision review, namespace custody, and public lifecycle evidence. |
| Verifier behavior | Checked-in repository test sources cover identities, result projections/invariants, policy bindings, budgets, release manifests, admission boundaries, and module isolation. | A packaged provider under test, independent black-box expectations, and end-to-end overlay, capture, policy, negotiation, result, receipt, and release-claim suites after the version and semantic owner decisions. |
| Normative traceability | Checked-in structured vector citations resolve to authoritative sections. | Atomic stable requirement IDs and at least one positive and one negative language-neutral vector for every normative `MUST`; the [vector index](../../vectors/readme.md) lists the remaining suite families. |

No AAS implementation is conformant or qualified on this evidence. The private
runner also provides no network containment, universal hostile-code sandbox,
runtime-binary attestation, ancestor-link exclusion, or unconditional Windows
process-tree containment; its exact limits are recorded in the
[slice documentation](../../conformance/README.md#security-and-process-boundary).
No retained exact-head Linux, macOS, and Windows green receipt was supplied for
`d5564cfe1567b302bcf36fd48b931a95b267dfb1`; test source is not a claim that
those checks passed at that revision.

## Publication blockers and limitations

- D1 relocation is incomplete; the repository remains private and its schemas,
  identifiers, packages, marks, and claims remain unpublished.
- Independent conformance and release maintainers are unassigned; namespace
  custody and the required separation of approval credentials are not
  operational. See [maintainer state](../../MAINTAINERS.md).
- Public collision checks, traceability, qualification sidecars, cohort release
  evidence, and post-publication receipts are incomplete.
- Full overlay conformance and Secure Snapshot implementation are not complete.
- There is no official packaged reference provider, public transport, Foundation
  adapter, consumer adoption record, or required-mode promotion evidence.
- Provisional schemas, registries, profiles, declarations, manifests, vectors,
  and private test results cannot support a publication or conformance claim.

## Consumer integration state

The rows below report exact remote observations, not semantic or adoption
claims.

| Consumer | AAS status | Current evidence |
| --- | --- | --- |
| Foundation | Direction accepted; AAS implementation **not integrated** | The incubation direction was accepted in [`58a37663e84f1225ca4866b71c61ae88a783c8a6`](https://github.com/agent-teams-ai/engineering-foundation/commit/58a37663e84f1225ca4866b71c61ae88a783c8a6); remote main and the current Foundation release commit were observed at [`16e19d1ff82ceb049198c2070d45ec9031ab6cef`](https://github.com/agent-teams-ai/engineering-foundation/commit/16e19d1ff82ceb049198c2070d45ec9031ab6cef). No AAS package, official reference provider, adapter, dogfood binding, or adoption record is evidenced. |
| Orchestrator | No AAS adoption record evidenced | Remote main was observed at [`f68d3d391c32d6c58bb0b11b0736831e5057743b`](https://github.com/agent-teams-ai/agent-teams-orchestrator/commit/f68d3d391c32d6c58bb0b11b0736831e5057743b). The consumer plan uses this as its planning base, not as an adoption receipt. |
| Runtime | No AAS adoption record evidenced | Remote main was observed at [`3e1b977d9ab6147eb702b62497bd0be62acb8cf7`](https://github.com/agent-teams-ai/agent-runtime/commit/3e1b977d9ab6147eb702b62497bd0be62acb8cf7). The consumer plan uses this as its planning base, not as an adoption receipt. |
| Platform | No AAS adoption record evidenced | Remote main was observed at [`01abe850fe1a975e6bdcad6edfeb4d5978316bca`](https://github.com/agent-teams-ai/agent-teams-platform/commit/01abe850fe1a975e6bdcad6edfeb4d5978316bca). The consumer plan uses this as its planning base, not as an adoption receipt. |
| Extension | No AAS adoption record evidenced | Remote main was observed at [`5aa3da7ff6f5e202e65115e4712e3ef638895e10`](https://github.com/agent-teams-ai/extension-foundation/commit/5aa3da7ff6f5e202e65115e4712e3ef638895e10). It is later than the plan-construction base; no retained completion receipt establishes the planned dependency upgrade or AAS adoption at this head. |

The current consumer plan is proposed pending owner confirmation. It describes
a dependency-only Wave 1 for Orchestrator, Runtime, Platform, and Extension,
targeting Foundation `0.21.0` and Docs Protocol `0.4.1`, followed by separately
reviewed semantic work. It expressly excludes AAS `validate-overlay@1`, Secure
Snapshot, and new normative decisions. A plan, release-age exclusion, package
pin, or dependency qualification is not an AAS adoption record.

### Foundation 0.21.0 / Docs Protocol 0.4.1 release context

The retained release evidence binds both versions to Foundation commit
[`16e19d1ff82ceb049198c2070d45ec9031ab6cef`](https://github.com/agent-teams-ai/engineering-foundation/commit/16e19d1ff82ceb049198c2070d45ec9031ab6cef):

| Package | Exact version and release | Registry integrity recorded by the consumer plan |
| --- | --- | --- |
| `@agent-teams/engineering-foundation` | [`0.21.0`](https://github.com/agent-teams-ai/engineering-foundation/releases/tag/%40agent-teams/engineering-foundation%400.21.0) | `sha512-KxNgeIamgbABUamT5XAeVvW8j+j6EZ6GlVk4FMUXZG2IPQsk/y3Po4eLl8cx4HMnwWXQZ7idP1sw5OUmT9FYtA==` |
| `@agent-teams/docs-protocol` | [`0.4.1`](https://github.com/agent-teams-ai/engineering-foundation/releases/tag/%40agent-teams/docs-protocol%400.4.1) | `sha512-hcK886DGz94n+K7aVi5BivO/ZNk4QE2jQfh9WCoWrzVJ1aMSIsTkkebRAHAslSCAWIjZSh/DKOronQddYFPe4A==` |

The commit-scoped GitHub release entries and
[release workflow run 33266765812](https://github.com/agent-teams-ai/engineering-foundation/actions/runs/33266765812)
were retained as successful operational evidence. The plan records Docs
Protocol `0.4.1` as depending exactly on Foundation `0.21.0`. These facts prove
neither completion of a consumer upgrade nor any AAS semantics, conformance,
qualification, publication, or adoption, and they do not close D1.

## Next safe vertical slice

Status: `BLOCKED_BY_DECISION`.

No semantic provider or end-to-end overlay implementation is authorized by this
ledger. An accepted owner record must separately resolve reference-provider
ownership, overlay-version disposition and semantic evaluator ownership, and
private transfer ownership before such implementation is scoped. Until then,
the current `validate-overlay@1` bytes and semantic gaps must not be guessed,
silently revised, or treated as conformance expectations.

After those decisions, any mechanics-only transfer slice, semantic provider,
overlay conformance work, or Secure Snapshot implementation requires a
separately commissioned scope with exact inputs, outputs, owners, independent
oracle boundaries, retained artifacts, and stop conditions. Foundation and real
consumers remain inactive for AAS adoption on the evidence indexed here.

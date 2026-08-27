# AAS Phase 1 remediation vectors v1

Status: private provisional exact vectors; not qualified

This suite corrects and extends Phase 1 expectations without changing the
historical `phase-0-remediation-v1.md` bytes. Machine-readable instances live in
`schema/` and are bounded by the corpus records in `schema/corpus.json`.

## RESULT-SELF-P1-001: complete result projection

- Requirement: `../spec/identity.md` §§5–6.
- Input: `schema/positive/result.json`.
- Limit: 1,048,576 encoded bytes and depth 64.
- Projection: remove only the top-level `aasIdentity` and each embedded
  diagnostic header `resultAasIdentity`; preserve every other field, including
  extension dispositions.
- Expected identity: the `aasIdentity` populated in the input.
- Negative disposition: omitting accounting, coverage, evidence, omissions,
  counters, diagnostics, or extension dispositions is schema-invalid.

## EXTENSION-DISPOSITION-P1-001: understood, preserved, and ignored

- Requirement: `../spec/identity.md` §6 and `../spec/core.md` §6.
- Inputs: `schema/positive/result.json` and the
  `/result-extension-semantic-effect` object in
  `schema/definition-fixtures.json`.
- Limits: at most 128 disposition records and the request's aggregate extension
  byte budget.
- Expected: every disposition is request-bound. Preserved unknown-optional and
  ignored extensions cannot affect core semantics; an understood semantic
  extension may do so. An unknown critical extension never reaches a successful
  result disposition.

## RELEASE-COHORT-P1-001: RC and numeric identities are distinct

- Requirement: `../spec/security-and-conformance.md` §§11–13.
- Inputs: `schema/positive/release-manifest-rc.json` and
  `schema/positive/release-manifest-numeric.json`.
- Expected: both manifests carry their own `aasIdentity` and bind schema,
  registry, vector, profile, claim, traceability, qualification, governance,
  provenance, SBOM, and release-evidence identities. The numeric cohort is a
  distinct artifact and cannot reuse a bare `1`, `1.2`, or relabeled RC version.

## MIXED-COVERAGE-P1-001: target-specific completeness

- Requirement: `../spec/core.md` §5.
- Inputs: `schema/positive/mixed-request.json` and
  `schema/positive/mixed-result.json`.
- Expected: target 1 is decided with complete coverage; target 2 is
  indeterminate with an explicit unknown terminal. Each header copies its own
  target evaluation coverage and the global ledger is their exact aggregate.

## ACCOUNTING-P1-001: canonical executable counters

- Requirement: `../spec/security-and-conformance.md` §6.
- Inputs: `schema/definition-fixtures.json` `/request-positive` and
  `schema/positive/result.json`.
- Expected: `inputBytes` is the exact byte length of the standalone strict-JSON
  request wire, including whitespace; `outputBytes` is the convergent fixed
  point over the complete canonical final envelope including self identities
  and its final counter; `extensionBytes` is the canonical scoped extension-map
  projection. Reported counters must equal these derivations and remain within
  request budgets. Missing raw request length and an 8KB whitespace
  amplification fail closed.

## BINDING-PROVENANCE-P1-002: every target binds its complete decision

- Requirement: `../spec/policy-and-enforcement.md` §§5 and 10.
- Positive inputs: the single-target and mixed request/result pairs under
  `schema/positive/`. The mixed pair selects `binding-1`/policy `333…` for
  target 1 and the disjoint `binding-2`/policy `aaa…` for target 2.
- Positive absent case: replace one target selection and header trace with
  `{ "state": "absent", "reason": "binding-missing",
  "candidateBindings": [] }`, omit selected mode/binding/policy, and resolve
  exactly `needs-input`/`binding-missing`.
- Negative dispositions: an omitted header trace, duplicate candidate ID or
  identity, selected candidate not present exactly once, candidate-set
  substitution, or any request/header/detailed-trace difference fails joint
  validation even when `diagnostics` is empty.

## FRESHNESS-P1-002: stale if and only if stale

- Requirement: `../spec/policy-and-enforcement.md` §10.
- Positive inputs: checked-in non-stale results carry `fresh`; a stale result
  carries a stale header and has no verdict.
- Negative dispositions: `decided`/`freshness: stale` and
  `resolution: stale`/`freshness: fresh` both fail schema and runtime
  validation.

## ACCOUNTING-P1-002: exact units, aggregation, and invocation agreement

- Requirement: `../spec/security-and-conformance.md` §6.
- Positive result: `schema/positive/result.json` has `totalWork = 155`, exactly
  `1 + 1 + 1 + 1 + 1 + 0 + 150 + 0`; the mixed result has `totalWork = 215`.
  Peak counters are not summed into `totalWork`.
- Positive invocation: request, analysis key, and applicable binding use the
  same accounting-profile identity; every effective ceiling is the
  componentwise minimum of request, analysis key, selected bindings, and all
  target overlay limits.
- Negative dispositions: a re-signed accounting-profile substitution, an
  inexact applicable-candidate list, a realized counter above a smaller binding
  ceiling, or a `totalWork` value differing from the exact formula fails.

## RELEASE-RC-P1-002: numeric-successor RC grammar

- Requirement: `../spec/security-and-conformance.md` §13 and current mutable
  decision v2.
- Positive: `0.1.0-rc.1` pairs with separately built `0.1.0`.
- Negative: `1.1.0-rc.1`, build metadata, additional prerelease identifiers,
  zero/leading-zero RC numbers, and bare versions are rejected.

## REGISTRY-EDITION-P1-002: truthful new-ID introduction

- Requirement: `../spec/governance.md` registry evolution rules.
- Positive: a new ID in edition `2` carries `introducedEdition: "2"`.
- Negative: the same new ID carrying `introducedEdition: "1"` fails adjacent
  edition validation as a retroactive allocation.

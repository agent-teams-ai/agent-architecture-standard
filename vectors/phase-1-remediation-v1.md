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

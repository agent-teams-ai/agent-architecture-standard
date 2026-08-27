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
- Inputs: `schema/positive/result.json` and
  `schema/negative/result-extension-semantic-effect.json`.
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

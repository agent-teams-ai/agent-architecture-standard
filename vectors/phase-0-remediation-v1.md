# AAS Phase 0 remediation vectors v1

Status: provisional exact vectors; independently reproducible; not qualified

These cases are projections of the cited normative prose. They introduce no new
semantics and MUST NOT support a conformance claim until an independent oracle
and reviewer reproduce them.

## CANON-UTF16-001: BMP/supplementary ordering inversion

- Requirement: `../spec/identity.md` §§2–3; applicable version `0.1`.
- Limits: 1,048,576 encoded input bytes and nesting depth 64.
- Expected diagnostic: `none` for the expected bytes.
- Input member sequence: U+E000 with integer `1`, then U+1F600 with integer `2`.
- Expected canonical UTF-8 text: `{"😀":2,"":1}`
- Expected canonical byte length: `18`.
- Expected canonical bytes, hexadecimal:
  `7b22f09f9880223a322c22ee8080223a317d`.
- Rationale: RFC 8785 compares unsigned UTF-16 code units. U+1F600 begins with
  `D83D`, which sorts before U+E000's `E000`, although the scalar U+1F600 is
  numerically greater.
- Negative case: canonical text `{"":1,"😀":2}` is invalid because it uses
  scalar-value order.

## IDENTITY-RAW-FRAMED-001: `contentDigest` is not `aasIdentity`

- Requirement: `../spec/identity.md` §4; applicable version `0.1`.
- Limits: 1,048,576 encoded input bytes and nesting depth 64.
- Expected diagnostic: `none` for the expected identities.
- Exact content bytes: UTF-8 `hello`, hexadecimal `68656c6c6f`.
- Expected raw `contentDigest`:
  `sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824`.
- Domain: `aas.artifact.v0`.
- Canonicalization profile:
  `agent-architecture-canonical-json-rfc8785@0`.
- Expected framed preimage, hexadecimal:
  `000000064141532d49440000000f6161732e61727469666163742e76300000002b6167656e742d6172636869746563747572652d63616e6f6e6963616c2d6a736f6e2d726663383738354030000000000000000568656c6c6f`.
- Expected artifact `aasIdentity`:
  `aas:v0:sha256:e9768c1412014df42adf690b733a93a10642f20228a618332a0bc45768a25bc9`.
- Negative cases: placing the raw value in `aasIdentity`, placing the framed value
  in `contentDigest`, or asserting that the two fields are interchangeable MUST
  be rejected.

## RESULT-SELF-001: exact self-identity projection

- Requirement: `../spec/identity.md` §5, “Result self-identity projection”.
- Applicable schema/envelope version: `0.1`.
- Input reference: `schema/positive/result.json`; the referenced bytes and every
  required result, accounting, coverage, evidence, omission, and diagnostic
  field are part of this case.
- Limits: 1,048,576 encoded input bytes and nesting depth 64.
- Domain: `aas.result.v0`.
- Canonicalization profile:
  `agent-architecture-canonical-json-rfc8785@0`.
- Identity projection: remove only the top-level `aasIdentity` and the embedded
  diagnostic header's `resultAasIdentity`, then canonicalize all remaining
  referenced input fields.
- Expected canonical projection byte length: `2131`.
- Expected canonical projection raw SHA-256:
  `sha256:ce1ca70a7985f23b1263c79fb1f23c0841c99390fec676fbe2c38efffbf7d3ae`.
- Expected framed-preimage byte length: `2213`.
- Expected result `aasIdentity`:
  `aas:v0:sha256:5a3ea268fab84004e3f523f7b00d3dc01c5802d491a35fb7a47ce584e5a416aa`.
- Expected diagnostic: `none`.
- Verification: omit the top-level `aasIdentity` and the diagnostic
  `resultAasIdentity`, canonicalize, frame, and hash; the expected value is
  recovered. Hashing either populated self field is invalid.
- Negative case: changing either populated copy by one hex digit makes the wire
  result invalid; it does not create another valid result identity.

## EXCEPTION-REVISION-001: expiry and receipt freshness

- Requirement: `../spec/policy-and-enforcement.md` §§7 and 9; applicable
  version `0.1`.
- Limits: one exception, one receipt, and one integration revision comparison.
- Expected diagnostic: the registered stale reason for `R2`; none for `R1`.
- Given exception `E` binds `validForRevision = R1`, result `X` was evaluated at
  `R1`, and receipt `Q` binds `X`, `E`, and `R1`, required enforcement at exactly
  `R1` MAY accept `Q` if every other identity comparison succeeds.
- At `R2`, even if repository bytes happen to match, `E` is expired and `Q` is
  `stale`; required enforcement denies integration.
- Negative cases: a timestamp, duration, branch, or mutable issue state as the
  expiry condition makes the exception invalid before evaluation.

## HARDLINK-001: in-root hard link

- Requirement: `../spec/security-and-conformance.md` §4; applicable portable-
  bounded profile version `0`.
- Limits: two path entries and one attempted file read.
- Expected diagnostic/resolution: link-count unsupported / `unsupported`.
- Given two in-root names for one relevant regular file and observed link count
  `2` before reading, the affected capture resolution is `unsupported`, the bytes
  are discarded, and relevant coverage is incomplete.
- Negative case: accepting either name as an ordinary link-count-one file fails
  the portable-bounded profile.

## HARDLINK-OUTSIDE-ALIAS-001: outside hard-link alias

- Requirement: `../spec/security-and-conformance.md` §4; applicable portable-
  bounded profile version `0`.
- Limits: one in-root entry, one outside alias, and one attempted file read.
- Expected diagnostic/resolution: link-count unsupported / `unsupported`.
- Given one in-root name hard-linked to an outside name and observed link count
  `2`, the affected capture resolution is `unsupported` even though traversal
  never observes the outside pathname.
- If the platform cannot report a trustworthy link count before and after the
  read, the result is also `unsupported`.
- Negative case: treating root-relative spelling alone as proof of containment
  fails the portable-bounded profile.

## HARDLINK-RACE-001: link count changes during capture

- Requirement: `../spec/security-and-conformance.md` §4; applicable portable-
  bounded profile version `0`.
- Limits: one entry and one bounded before/after read observation.
- Expected diagnostic/resolution: link-count changed / `unstable`.
- Given a relevant regular file whose trustworthy initial link count is exactly
  `1`, and whose trustworthy final link count is `2`, the affected capture
  disposition is `unstable`, not `unsupported`; captured bytes are discarded
  and relevant coverage is incomplete.
- The same `unstable` outcome applies when a trustworthy initial count of `1`
  changes to any other count during the capture.
- Negative cases: reporting `unsupported`, accepting the captured bytes, or
  treating the final count as a fresh count-two static capture fails the
  portable-bounded profile.

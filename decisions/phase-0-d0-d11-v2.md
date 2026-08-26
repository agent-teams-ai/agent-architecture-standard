# AAS Phase 0 accepted decisions D0–D11, version 2

Status: accepted for the unpublished Phase 0 normative scaffold on 2026-08-26;
current decision packet

## Record authority and provenance

This packet supersedes `phase-0-d0-d11-v1.md` in full. Version 1 remains an
immutable historical record; it is not the current decision authority. This
focused packet incorporates D0–D4, D6–D8, and D10–D11 from version 1 without
semantic change and replaces D5 and D9 below. If incorporated text conflicts
with this packet, this packet controls.

The owner, approver, effective scope, research revision, primary evidence, and
disclosed private-incubation role overlap are exactly those recorded in version
1. The record version is `2`; `phase-0-d0-d11-v1.md` is the superseded record.
This packet assigns no public governance role and authorizes no publication,
namespace claim, conformance claim, or consumer change.

For incorporated decisions, lowercase modal wording in version 1 is historical
explanation, not a BCP 14 requirement. The current normative effects are the
uppercase requirements in the indexed specification documents. In particular,
repository relocation MUST preserve immutable history, projections MUST cite
and mechanically track their authority, required consumers MUST select a
profile matching their attacker model, and Foundation dogfood MUST prove a
separate consumer before broader generalization.

## D5 — first operation surface (replacement)

- Outcome: `validate-overlay@1` is the only operation profile admitted to the
  initial public surface. `classify-subjects@1` and
  `evaluate-relations@1` remain internal or MAY be exposed only as explicitly
  experimental capabilities outside every public core conformance claim. A
  nonnormative composed agent workflow MAY use them internally but MUST NOT
  imply that either is public, registered, or independently claimable.
- Additional evidence: Foundation D5 spike evidence, SHA-256
  `c463ca9b877f1218f0fa89b36038644f31e6a0c1a57922d411f11f23220868de`.
- Compatibility effect: `validate-overlay@1` remains independently versioned.
  Moving either internal operation onto the public surface requires a later
  versioned decision, registry admission, complete qualification, and explicit
  compatibility and migration evidence.

## D9 — experimental publication sequence (replacement)

- Outcome: if publication is later authorized, the first public artifact cohort
  MUST use an immutable SemVer version exactly of the form `X.Y.Z-rc.N`, where
  `X`, `Y`, and `Z` are canonical SemVer nonnegative decimal integers without
  leading zeroes except the single digit `0`, and `N` is a canonical positive
  decimal integer (`[1-9][0-9]*`). Build metadata and any other prerelease
  identifiers are forbidden for this cohort. The cohort MUST use a non-`latest`
  dist-tag and MUST remain explicitly experimental.
- Outcome: a numeric 0.x cohort MUST then be separately built with an exact
  SemVer `0.Y.Z` having canonical nonnegative `Y` and `Z` and no prerelease or
  build metadata, assigned its own immutable artifact identities and manifest,
  and independently qualified. It MUST NOT be produced by moving a dist-tag or
  relabeling RC bytes.
- Compatibility effect: RC and numeric cohorts have distinct immutable
  manifests and evidence. This outcome resolves the research brief's
  owner-choice branch but does not authorize publication.

## Packet approval effect

This packet accepts the incorporated and replacement outcomes only. It MUST NOT
be cited as conformance evidence, release approval, namespace ownership, neutral
stewardship, or proof of an implementation. The indexed normative documents
remain authoritative for the semantics that project these outcomes.

# Phase 1 P1 remediation decision v1

Status: current private provisional amendment

This decision preserves the immutable Phase 0 decision records while closing
accepted Phase 1 review findings. Where this amendment conflicts with the
release-channel paragraph in `phase-0-d0-d11-v2.md`, this current Phase 1
decision governs unpublished Phase 1 artifacts.

## Numeric-successor release-candidate grammar

The only admitted release-candidate SemVer grammar is exactly
`0.Y.Z-rc.N`, where `Y` and `Z` are canonical nonnegative decimal integers and
`N` is a canonical positive decimal integer matching `[1-9][0-9]*`. Build
metadata and additional prerelease identifiers are forbidden. Every admitted
RC therefore has the required numeric successor `0.Y.Z`.

The historical Phase 0 v1 and v2 decision bytes remain unchanged. This
amendment changes only the current unpublished Phase 1 publication rule.

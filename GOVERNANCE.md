# Governance

## Honest bootstrap state

The repository is currently stewarded by `@777genius` for Agent Teams AI. This
is a dedicated authority boundary, not yet an independent foundation or a
multi-vendor standards body. We will not claim organizational neutrality,
certification, or broad consensus that does not exist.

Public prerelease publication remains blocked until the roles below have named
owners and the normative author cannot self-approve the conformance result and
release in the same change.

## Roles

- **Normative maintainer:** approves semantic prose, schemas, registries, and
  compatibility consequences.
- **Conformance maintainer:** owns black-box vectors, independent oracles, claim
  withdrawal, and appeals; cannot derive expected results from the reference
  provider under test.
- **Release maintainer:** verifies immutable artifacts, provenance, release
  manifests, registry coordinates, and post-publication receipts.
- **Security responder:** receives private reports and may stop publication or
  withdraw an unsafe conformance claim.

One person may help in several areas during private incubation, but a public
release needs at least two human approvals and cannot have one person author,
conformance-approve, and release the same semantic change.

## Normative changes

Every normative change requires:

1. a public proposal or issue explaining user impact and compatibility;
2. an ADR for identity, security, trust, compatibility, or authority changes;
3. matching schemas, registries, prose, and positive/negative vectors;
4. independent conformance review;
5. a recorded decision with dissent and migration consequences;
6. exact-artifact release evidence before publication.

Published identifiers are never reused. Published meaning is not edited in
place; incompatible meaning receives a new version or identifier. Security may
withdraw a claim but cannot rewrite historical evidence.

## Appeals and conflicts

Conformance disputes are opened publicly unless they contain an embargoed
security issue. The conformance maintainer records the affected version, suite,
evidence, decision, and appeal result. A conflicted reviewer recuses. During
bootstrap, unresolved appeals block the affected public claim.

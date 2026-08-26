# AAS Phase 0 accepted decisions D0–D11, version 1

Status: accepted for the unpublished Phase 0 normative scaffold on 2026-08-26

## Record authority and provenance

These are twelve separate decision records collected in one versioned packet.
The research artifacts are evidence and recommendations; they did not accept
their own options. Acceptance comes from the Phase 0 commissioning objective
that directed this normative stage to preserve the D0–D11 direction. This packet
does not claim that the public governance roles in `../spec/governance.md` are
assigned or operational.

The following fields apply to each D0–D11 record unless its section adds more:

- Owner: Phase 0 commissioning owner; the commissioning artifact does not record
  a personal identity in this repository.
- Approver: Phase 0 normative-stage commissioning approval, conveyed by the same
  commissioning act. This disclosed overlap is sufficient only for private
  incubation and is not neutral normative, conformance, or release approval.
- Effective scope: unpublished Phase 0 specification scaffold only.
- Record version: `1`.
- Supersedes: none.
- Research revision: Foundation research hub commit
  `8edffd543912f9fa43838b3e0d2fd3bcbe72a322`.
- Primary evidence: `../docs/research/agent-architecture-standard-product-decisions.md`,
  SHA-256 `f5f434037a61327b430c983aec28d673a862ecc164b5d539501372e80f5134a9`;
  `../docs/research/agent-architecture-standard-implementation-plan.md`, SHA-256
  `b45f78b2b96a84958f71a5d43e88e75f2fb57f7ea20192e347dc0b157b6b6275`.

## D0 — public naming

- Outcome: use **Agent Architecture Standard (AAS)** as the only umbrella name.
  Agent Architecture Protocol (AAP) is its transport-neutral envelope and
  negotiation component, not a separately promoted brand.
- Compatibility effect: public names are costly to reverse after publication;
  every current identifier remains provisional and this record authorizes no
  namespace claim.

## D1 — repository and authority home

- Outcome: private Foundation incubation is permitted, but normative-standard
  authority and independent conformance authority MUST move to a credibly neutral
  repository and accountable roles before any public 0.x schema, claim, or
  package. This isolated scaffold is not that migration.
- Compatibility effect: repository relocation must preserve immutable history,
  identifiers, and resolution. Publication remains blocked until the migration
  and role assignment are recorded.

## D2 — artifact authority

- Outcome: adopt the claim-specific authority matrix: schemas own wire shape and
  requiredness; registries own identifier allocation; prose owns semantics and
  algorithms; golden vectors own exact named examples. Generated language types
  and implementations are nonnormative.
- Compatibility effect: changing an authority owner or an owned required field is
  a versioned breaking change; projections must cite and mechanically track their
  authority.

## D3 — canonical JSON and identities

- Outcome: use exact RFC 8785 over the strict I-JSON subset in
  `../spec/identity.md`, SHA-256, length-delimited domain separation, distinct raw
  `contentDigest` and framed `aasIdentity` fields, and independent exact-byte
  vectors.
- Compatibility effect: canonicalization, framing, domain, included fields, or
  identity syntax changes require a major version and replacement identities;
  historical identity meaning cannot be reinterpreted.

## D4 — snapshot security profiles

- Outcome: define an honest portable-bounded profile first, with root-relative
  paths, no followed links, single-link regular files, bounded capture, no
  execution, no network, and explicit unsupported/indeterminate outcomes. A
  stronger handle-relative or sandboxed profile requires a separate threat model.
- Compatibility effect: a weaker platform guarantee cannot use the same profile
  identity; required consumers must select a profile matching their attacker
  model.

## D5 — first operation surface

- Outcome: retain three independently claimable operation profiles—
  `classify-subjects@1`, `evaluate-relations@1`, and `validate-overlay@1`—plus one
  nonnormative composed agent workflow. Phase 0 records the surface but does not
  activate these provisional IDs or claim implementations exist.
- Additional evidence: Foundation D5 spike evidence, SHA-256
  `c463ca9b877f1218f0fa89b36038644f31e6a0c1a57922d411f11f23220868de`.
- Compatibility effect: each operation remains independently versioned and
  claimable; composition cannot add hidden runtime semantics.

## D6 — policy composition boundary

- Outcome: v0 standardizes only one closed, fully materialized effective policy,
  its `aasIdentity`, and provenance. Modules, presets, merge rules, and compilation
  remain outside the normative runtime.
- Compatibility effect: admitting normative composition requires a new version
  and multi-consumer evidence; generators cannot become semantic authorities by
  convention.

## D7 — consumers and adoption

- Outcome: consumers own vocabulary, policy, scope, activation, exceptions, and
  integration consequences. Dogfood may begin in Foundation, must prove a
  separate consumer before broader generalization, and requires a separately
  reviewed binding for every consumer. No shared preset exists without parity
  evidence.
- Compatibility effect: consumer behavior cannot silently become AAS semantics.
  This record authorizes no edit to a real consumer project.

## D8 — enforcement graduation

- Outcome: `shadow`, `advisory`, and `required` are the only enforcement modes.
  Rollout scope is an orthogonal identity-bearing binding dimension; limited
  rollout is not a fourth mode. Promotion to required needs an immutable approved
  record, measured evidence, a tested rollback, and integration-boundary
  verification.
- Compatibility effect: mode or scope changes create a new binding
  `aasIdentity`; no installation or automatic threshold crossing promotes a rule.

## D9 — experimental publication sequence

- Outcome: if publication is later authorized, publish an explicitly
  experimental public RC on a non-`latest` channel, then separately build and
  qualify a numeric 0.x cohort. A dist-tag move is not qualification.
- Compatibility effect: RC and numeric cohorts have distinct immutable manifests
  and evidence. This outcome resolves the research brief's owner-choice branch
  for this scaffold but does not itself authorize publication.

## D10 — dependency and publication DAGs

- Outcome: keep the code dependency DAG separate from the qualification and
  publication DAG. The standard precedes reference and consumer adapters;
  conformance depends only on the standard and MUST NOT import reference
  production code. A cohort manifest closes publication.
- Compatibility effect: Foundation dogfood creates no reverse normative or code
  dependency; clean bootstrap and packed-artifact qualification remain required.

## D11 — lightweight governance before public 0.x

- Outcome: establish explicit normative, independent conformance, release,
  security, namespace, and repository authority plus license, contribution,
  conduct, security, support, and change policies before public 0.x. Defer a
  formal standards body, but require the neutral-stewardship trigger in
  `../spec/governance.md`.
- Compatibility effect: provisional private work may continue with disclosed
  role overlap; active identifiers, public claims, marks, and releases remain
  prohibited until operational roles and credentials exist.

## Packet approval effect

This packet accepts outcomes only. It MUST NOT be cited as conformance evidence,
release approval, namespace ownership, neutral stewardship, or proof of an
implementation. The normative documents remain authoritative for the semantics
that project these outcomes.

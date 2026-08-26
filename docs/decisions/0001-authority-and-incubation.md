# ADR-0001: Authority and incubation boundary

Status: Accepted

Date: 2026-08-26

## Decision

This repository is the durable home for Agent Architecture Standard normative
artifacts and independently governed conformance authority. Engineering
Foundation may incubate research and host the first reference implementation,
but it does not own normative semantics.

Schemas own wire shape, registries own identifiers, prose owns semantics, and
vectors own exact observable examples. Generated language bindings are derived.
Conflict between owner artifacts stops publication until one reviewed change
reconciles all affected artifacts and compatibility consequences.

No public 0.x schema identifier or conformance claim is made until the
governance roles, namespace custody, security process, compatibility policy,
traceability matrix, and release evidence gates are operational.

## Consequences

- Foundation can dogfood without creating a normative self-dependency.
- Conformance cannot import reference production code or generate expected
  answers from the provider under test.
- Public claims remain blocked during honest single-maintainer bootstrap.
- Future stewardship expansion changes governance, not historical identifiers.

# AAS Phase 0 governance and change control

Status: normative Phase 0 scaffold; governance roles not yet operational

## 1. Honest current state

This repository is an isolated specification incubation. It is not a foundation,
consortium, certification program, neutral standards body, package publisher, or
public conformance authority. Phase 0 records the minimum governance needed
before any such public claim; it does not pretend those institutions exist.

All identifiers are provisional. Public AAS conformance claims and marks are
prohibited until the roles below are assigned to accountable people or bodies,
their authority is documented, and their access paths are operational.

The [current Phase 0 D0–D11 packet](../decisions/phase-0-d0-d11-v2.md) is an accepted
private commissioning record with disclosed owner/approver overlap. It is not a
neutral normative approval, conformance qualification, release approval, or
assignment of any role below.

## 2. Required lightweight roles

The project MUST name:

- normative maintainers who approve semantic, schema, registry, and vector
  changes through the authority matrix;
- an independent conformance authority that does not report conformance merely
  by reusing reference implementation results;
- release maintainers controlling publication credentials and cohort manifests;
- security contacts able to receive, triage, and coordinate disclosures;
- namespace stewards responsible for identifiers, domains, and marks;
- repository maintainers responsible for contribution review and continuity.

One person MAY hold multiple roles during incubation, but the overlap MUST be
publicly disclosed. Before a public claim, normative approval, conformance
qualification, and release publication MUST require distinct accountable acts
and credentials. A single hidden automation token MUST NOT constitute all three.

## 3. Policies required before publication

Before the first public RC, the project MUST publish an SPDX-identified license,
contribution and DCO-or-CLA policy, Code of Conduct, SECURITY policy, maintainer
list, normative-change procedure, release authority, namespace/support policy,
supported-version policy, and neutral-stewardship trigger.

Package, domain, repository, standards-catalog, acronym, and trademark collision
checks MUST be recorded before activating public identifiers. The descriptive
name does not assert ownership of unrelated uses of AAS or AAP.

## 4. Normative changes

Every normative change MUST identify its authority class, requirement IDs,
compatibility effect, positive and negative vectors, security effect, migration,
and rollback. An approver MUST reject a change that silently changes existing
identity meaning or makes a provisional identifier look active.

Changes to canonicalization, identity inputs, required fields, defaults, or
existing semantics require a major version. Additive immutable profiles and
envelope versions MAY use a minor release. Editorial changes MUST NOT alter
observable conformance behavior.

Urgent security changes MAY suspend claims or disable production, but MUST
preserve historical decoding and publish affected-version guidance. They do not
authorize rewriting a released artifact.

## 5. Neutrality trigger

Before any public 0.x schema, identifier, conformance claim, or package, both
normative-standard authority and independent conformance authority MUST have
moved from private Foundation incubation to a credibly neutral repository and
accountable roles. The move and role assignment MUST be recorded, and repository
relocation MUST preserve immutable history, identifiers, and resolution. A
neutrality review without this completed relocation does not satisfy D1 and
publication remains prohibited.

After that prerequisite is satisfied, neutral stewardship MUST be reviewed
again when any of these occurs: a second independent implementation seeks a
claim; an external maintainer makes sustained normative contributions; one
vendor controls all three approval roles; a conformance mark is proposed; or a
legal/trademark commitment is contemplated.

The review MUST document repository ownership, credential separation,
maintainer succession, namespace custody, conflict resolution, and migration
preservation. Moving files to a neutral-looking repository without changing
authority is not sufficient.

## 6. Foundation and consumers

Engineering Foundation behavior, adapters, presets, and workflows are
nonnormative. Foundation MAY provide a reference implementation or dogfood AAS
only through public boundaries. It MUST NOT become an unpublished oracle for
meaning.

Each consumer owns its policy, vocabulary, scope, exceptions, rollout,
activation, and integration consequences. Two consumers using similar names do
not create a shared normative preset. Shared semantics require independent
evidence and a separate admitted profile.

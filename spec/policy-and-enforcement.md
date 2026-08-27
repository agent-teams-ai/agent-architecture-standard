# AAS v0 effective policy, binding, and enforcement

Status: normative Phase 0 scaffold; unpublished; all identifiers provisional

## 1. Closed effective policy boundary

An AAS v0 provider consumes exactly one closed effective policy for a requested
scope. The policy MUST be immutable, `aasIdentity`-bound, fully materialized, and
valid
without imports, inheritance, presets, generators, callbacks, environment
lookups, or network access.

V0 does not define a normative policy-module compiler. Vocabulary modules,
policy modules, evaluator modules, presets, deep merge, and package-driven
composition are outside the normative runtime. A nonnormative tool MAY generate
an effective policy for human review, but the generated closed document, its
`aasIdentity`, and its provenance are the only policy inputs visible to AAS
evaluation.

Semantically, an effective policy is complete only if it conveys its schema
version, consumer owner, declared scope, exact vocabulary and evaluator profiles,
all rules and parameters, all defaults, all exceptions, and provenance. The JSON
Schema is the sole authority for the fields that project this information and
their requiredness. An omitted semantic rule does not exist. An omitted parameter
is valid only when the effective-policy schema declares an explicit default and
the materialized policy contains the resulting value.

The policy `aasIdentity` MUST be computed as defined in `identity.md`. Policy
source
filenames, local directories, generator version, package installation state,
and environment values MUST NOT affect policy identity. Any generator or review
evidence belongs in provenance, not hidden evaluation behavior.

## 2. Policy validity

A valid effective policy MUST satisfy all of these conditions:

- every object is closed under its versioned schema;
- every rule identifier is unique and exact;
- every referenced profile has an exact ID and `aasIdentity`;
- every parameter is within its schema-defined type and bound;
- every rule has a deterministic applicability expression defined by its
  evaluator profile, not executable consumer text;
- every exception is governed as specified below;
- source provenance entries are immutable artifact references;
- rule and profile dependencies are complete and acyclic;
- no value requires runtime default insertion or external resolution.

An invalid policy is rejected before target evaluation. It produces a policy
problem and no result envelope. A provider MUST NOT skip invalid rules, invent a
default, repair an identifier, or fall back to an older policy.

An otherwise valid policy can be indeterminate for a specific target when the
target's applicability or rule decision requires evidence that is missing,
unreadable, unstable, unsupported, or budget-exhausted. This is not policy
invalidity. The target receives `indeterminate` and the diagnostic names the
missing evidence and attempted coverage.

The distinction is deterministic:

| Condition | Classification |
| --- | --- |
| Schema violation, duplicate rule, unknown required ID, `aasIdentity` mismatch, illegal parameter, invalid exception | invalid policy problem |
| Valid rule whose required observed fact is absent from incomplete coverage | target `indeterminate` |
| Valid rule outside the target's policy-defined applicability | target `decided/not-applicable` |
| Valid rule and complete evidence support its condition | target `decided/pass` or `decided/fail` |
| Every target's expected policy `aasIdentity` differs from its supplied valid policy | every requested target `stale` in one complete result |
| Expected per-target policy `aasIdentity` differs from that target's supplied valid policy | only that target `stale`; other targets resolve normally |

## 3. Provenance

Effective-policy provenance MUST be closed and identity-bearing. It MUST list,
in deterministic order, every authoritative source artifact used to produce the
policy and the exact commissioning decision record from which its semantic
content was derived. That source record does not qualify the effective output.

Each provenance entry is semantically complete only if it conveys a source
artifact `aasIdentity`, media type, semantic role, source owner, and a statement
of which effective information it supports. Its JSON Schema is the sole authority
for field names and requiredness. If a nonnormative generator was used,
provenance SHOULD record its
artifact `aasIdentity`, but that identity MUST NOT grant it semantic authority.

Provenance MUST NOT include a qualifying approval, approval-evidence identity,
or approver identity. Any qualifying approval of the already finalized policy
MUST be carried only by a later external qualification sidecar that the policy
does not reference.

Provenance MUST NOT contain executable locations, mutable URLs, secrets,
environment values, or an instruction to retrieve content. A provider MAY
validate referenced local artifacts supplied by the caller; it MUST NOT fetch a
missing source.

Provenance disagreement does not authorize a provider to recompute policy.
Mismatch between asserted source artifacts and the closed effective fields makes
the policy invalid when the schema declares the assertion verifiable; otherwise
it lowers the declared provenance assurance and MUST be visible in evidence.

## 4. Consumer binding

A binding applies an exact effective policy and profiles to a consumer-owned
scope. A binding is semantically complete only if it conveys all of the following
information; the binding JSON Schema is the sole authority for field names and
requiredness:

- a stable consumer and repository identifier;
- a unique binding identifier and binding schema version;
- an explicit subject or portable-path scope;
- a rollout scope;
- one enforcement mode;
- exact policy, vocabulary, evaluator, and operation profile IDs and
  `aasIdentity` values;
- exact security profile and minimum assurance requirements;
- deterministic resource budgets;
- zero or more governed exceptions;
- an owner;
- its own `aasIdentity`.

The binding MUST NOT contain approval evidence or an approver identity. Any
qualifying approval MUST be recorded only in a later external qualification
sidecar that binds the already finalized binding and that the binding does not
reference.

Bindings are closed inert data. They MUST NOT contain commands, arguments,
module specifiers, imports, package paths, callbacks, environment interpolation,
mutable registry selectors, URLs, scripts, YAML tags, or executable content.
Repository-controlled data MAY select only exact identifiers and `aasIdentity`
values already allowed by the operator's static provider configuration.

Operator selection of provider executables, trust roots, and external analyzer
artifacts is outside repository authority. A repository binding MUST NOT expand
that authority or self-allowlist a provider.

Installing, upgrading, or discovering an implementation MUST NOT create,
modify, activate, widen, or promote a binding. Every binding change is a
reviewed consumer change that produces a new binding `aasIdentity`.

## 5. Scope precedence and overlap

Scope selection is exact and fail-closed. Bindings MAY be disjoint. If multiple
bindings can apply to one target, the following precedence is the only permitted
selection algorithm:

1. A binding with an exact subject identifier outranks a path scope.
2. A deeper portable-path prefix outranks a shallower prefix.
3. At equal specificity, a binding naming the exact rule outranks one applying
   to all rules.
4. At equal specificity in all dimensions, the bindings MUST have identical
   consumer, repository, scope, portable-path profile, rollout scope, mode,
   policy identity, profiles, accounting profile, budgets, exception set, and
   promotion-record identity; otherwise the entire binding set is invalid and produces
   `aas.problem.binding-set-conflict` with no result envelope.

The applicability authority is one complete identity-bound `aas.binding-set.v0`
artifact plus one identity-bearing `aas.target-selection.v0` coordinate for
each request target. Validators MUST recompute the set, member binding, and
coordinate identities and derive applicability internally. A caller-supplied
applicable map is only an exact checked projection, never a completeness
authority. Target keys close exactly and candidates form a complete bijection
with all derived applicable members.

After semantic rank is computed, the wire candidate array is ordered by
descending rank and then ascending binding `aasIdentity`. Equivalent top-rank
bindings use the lowest-identity binding's ID as their sole representative.
Binding identities are lowercase ASCII, and implementations MUST compare them
by ASCII/code-unit order without locale-sensitive collation.
This is representation ordering, not semantic precedence. Every permutation of
one complete set therefore yields one candidate order, selected ID, and request
identity.

Declaration order, filename order, lexical binding ID, installation order, and
last-write-wins MUST NOT resolve ambiguity. Each request target MUST bind the
complete ordered applicable candidate set and the selected binding/policy
identities, or the explicit absent/`binding-missing` state, into the immutable
request identity. Every result header MUST repeat that decision exactly even
when there are zero detailed diagnostics. Joint validation MUST enforce an exact
target bijection, candidate ID/identity/policy bijection, and selected-or-absent
identity equality; a detailed diagnostic MUST repeat the same header decision.

An uncovered target does not inherit a global policy unless a root-scope binding
explicitly exists. With no applicable binding, an enforcement invocation returns
`needs-input` with `binding-missing`; it MUST NOT invent permissive defaults.

## 6. Defaults and overrides

All semantic defaults MUST be explicit in the versioned effective-policy or
binding schema and materialized before `aasIdentity` production. Implementations
MUST NOT maintain private defaults.

An effective policy is already flattened; an implementation MUST NOT apply a
runtime override. A
reviewed policy replacement MAY change values, but it creates a new policy and
binding `aasIdentity`. An exception is not a generic override and can only
suppress or downgrade the exact rule and scope it names.

Provider command-line flags MAY reduce resource ceilings or disclosure, but
MUST NOT broaden scope, lower a required assurance level, change a policy rule,
or convert a failure into a pass. A reduced ceiling that prevents a decision
produces `indeterminate` with budget evidence.

## 7. Governed exceptions

An exception is semantically complete only if it conveys exactly one rule, a
bounded subject/path scope, the exact registered portable-path profile reference
used to validate that scope, owner, reason code, an already-finalized earlier
creation-policy `aasIdentity`, and one exact immutable `validForRevision`. Its
JSON Schema is the sole authority for field names and requiredness.
`validForRevision` is the domain-framed repository-revision `aasIdentity` defined
by `identity.md` at which the exception applies. The exception is expired
for every other revision, including any descendant or content-equivalent revision.
Absolute timestamps, durations, mutable issue states, branch names, and
latest-revision selectors MUST NOT be expiry conditions in v0. A perpetual
exception is invalid.

Every exception embedded in an effective policy MUST use the exact same path
profile ID, version, and `aasIdentity` as that policy. Semantic path collections
in a policy or binding MAY repeat an identical accepted spelling (including the
same scope used by different rules), but MUST reject two distinct spellings
whose Unicode 17 NFC/full-default-case-fold collision keys are equal.

The creation policy MUST have been finalized before the exception bytes were
created and MUST NOT include that exception or any artifact that transitively
depends on it. Any effective policy that includes the exception is necessarily
finalized later than both. Validators MUST reject a policy/exception graph that
does not admit this strict finalization order:

```text
earlier finalized creation policy < exception < later effective policy
```

The corresponding identity-reference edges point only from right to left: the
later policy references the exception, and the exception references the earlier
creation policy. Because every such edge strictly decreases finalization order,
the identity graph is acyclic.

An exception MUST NOT contain approval evidence or an approver identity. A
qualifying approval MAY appear only in an external qualification sidecar
finalized after the exception. The exception and any policy containing it MUST
NOT reference that sidecar.

An exception MUST NOT apply outside its bound scope, across a changed rule
semantic `aasIdentity`, or when the evaluated integration revision differs from
`validForRevision`. Ambiguous overlaps or conflicting dispositions make the
binding invalid. An expired exception does not disappear silently; the decision
trace records its `aasIdentity`, `validForRevision`, observed revision, and
non-applicable disposition.

Exceptions MAY change the bound rule disposition from blocking to advisory or
MAY produce a profile-defined accepted exception verdict. They MUST NOT erase a
finding, claim that evaluation passed without qualification, repair incomplete
coverage, weaken the security profile, or authenticate evidence.

## 8. Enforcement modes and rollout

The only v0 enforcement modes are `shadow`, `advisory`, and `required`.

- `shadow` evaluates and records findings but MUST NOT alter user-visible task
  success, merge status, or developer diagnostics unless explicitly requested.
- `advisory` reports findings and remediation but MUST NOT block integration.
- `required` makes a profile-defined blocking finding or non-successful required
  assurance prevent integration.

The integration consequence is complete and closed:

| Invocation outcome | Shadow | Advisory | Required |
| --- | --- | --- | --- |
| request, policy, binding-set, resource, provider, or corrupt-envelope problem (no valid result) | nonblocking; report problem | nonblocking; report problem | deny integration |
| `decided/pass` | nonblocking | nonblocking | permit if all required assurances succeeded |
| `decided/not-applicable` | nonblocking | nonblocking | permit for that target |
| `decided/fail` with a profile-defined blocking finding | record only | report only | deny integration |
| `decided/fail` with no profile-defined blocking finding | record only | report only | permit for that target |
| `needs-input` | record only | report only | deny integration |
| `indeterminate` | record only | report only | deny integration |
| `unsupported` | record only | report only | deny integration |
| `stale` | record only | report only | deny integration |

The consequence layer MUST preserve the problem, resolution, and verdict exactly
as produced. In particular, it MUST NOT convert a problem, `needs-input`,
`indeterminate`, `unsupported`, or `stale` into `pass` or `fail`. Shadow and
advisory outcomes MUST remain nonblocking; they do not assert that integration is
safe or that a required gate would pass.

Rollout is orthogonal. A cohort, percentage bucket, repository, path, target, or
rule selection belongs to immutable rollout scope. `limited-required` is not an
enforcement mode and MUST NOT appear as one. A required rule applied to a small
cohort is still `required` with a narrow rollout scope.

Rollout selection MUST be deterministic from identity-bearing inputs and MUST
be recorded in the receipt. Random runtime sampling, mutable feature flags, or
server-side cohort changes MUST NOT support a required result.

Mode promotion MUST create a new binding and MUST cite an immutable promotion
record whose qualifying approval is in a later external sidecar. Promotion MUST
NOT occur automatically. A promotion record is
semantically complete only if it conveys the rule, consumer, exact profiles,
policy, analyzer, exposure interval, denominators, escapes, false blocks,
confidence intervals, incidents, owner, thresholds, rollout scope,
previous mode, rollback operation, and response SLA. Its JSON Schema is the sole
authority for field names and requiredness.

The promotion record and binding MUST NOT contain approval evidence, an approver
identity, or the later approval-sidecar identity.

A rule MUST NOT enter `required` without complete observation evidence, tested
rollback, a stable diagnostic code, and a verifier operating at the integration
boundary. Agent invocation and prompts are conveniences, not enforcement.

## 9. Freshness and receipts

A result becomes stale when any identity-bearing input relevant to its decision
changes. This includes base revision, snapshot content or declared observation
coverage, integration state, policy, binding (including its complete rollout
scope), profile, analyzer, bound promotion/evidence artifacts, exception or
`validForRevision`, overlay, request, declared budget, or accounting profile.
Realized counters are result outputs and are compared through result
`aasIdentity`; they are not pre-evaluation freshness inputs.

Pre-write overlay validation does not validate an integrated result. Rebase,
merge, parallel worktree change, policy update, or exception change requires a
new integrated snapshot and receipt. A caller MUST NOT promote or reuse an old
receipt by editing metadata.

Required enforcement MUST compare expected and observed identities immediately
before accepting integration. It MUST also require the integration revision to
equal every applied exception's `validForRevision`. Any mismatch produces
`stale`; the verifier MUST NOT rerun silently under different inputs and present
the new result as the old receipt. Because v0 has no time-based exceptions, an
identity-fresh receipt has no unbound wall-clock expiry horizon.

## 10. Stable agent diagnostic contract

Every target resolution MUST convey the following bounded diagnostic-header
information, even if no detailed findings are returned. The diagnostic-header
JSON Schema is the sole authority for field names and requiredness; this list is
the semantic authority:

- diagnostic contract version and stable code;
- target ID, resolution, and any decided verdict;
- selected enforcement mode and binding/policy `aasIdentity` values when a
  binding exists, or explicit binding-absent state, plus deterministic rollout
  disposition;
- the complete request-bound applicable candidate set and selected/absent
  binding decision;
- snapshot, policy, profile, analyzer, request, result, and applicable overlay
  `aasIdentity` values;
- freshness status;
- coverage summary with denominator and non-included counts;
- severity counts and highest severity;
- omission count and reasons;
- next required action ID or `none`.

The header's semantic information is non-truncatable. If its schema projection
exceeds the declared output budget, the provider returns a resource problem and
no partial result envelope.

The diagnostic header's `resultAasIdentity` is the post-hash self-identity
projection defined by `identity.md`; it MUST equal the top-level result
`aasIdentity` and is not an additional input to result identity.

Header freshness and resolution are coupled in both directions: the resolution
is `stale` if and only if header freshness is `stale`. Every resolution other
than `stale` MUST carry freshness `fresh`; no decided verdict can coexist with
stale freshness.

A diagnostic code is a provisional namespaced identifier registered to one
stable semantic condition. Rendered prose is nonnormative and MAY change without
changing the code. Codes MUST NOT embed paths, line numbers, severity, mode, or
mutable policy values.

Each detailed diagnostic MUST convey a code, severity, target, rule/profile
identity, evidence references, terminal reason, decision trace, and zero or more
closed remediation actions. Its JSON Schema is the sole authority for field names
and requiredness. A semantically complete decision trace conveys the effective
binding, normalized facts, evaluated branch, exception disposition, and
remediation preconditions; its JSON Schema owns field names and requiredness.
Each detailed diagnostic target MUST resolve to exactly one resolution header.
Its binding decision MUST be byte-for-byte canonical-JSON equal to that header's
request-bound decision. Candidate binding IDs and identities MUST each be
unique. In selected state, `selectedBindingId` MUST select exactly one candidate
whose binding and policy identities equal the selection and header. In absent
state the candidate set is empty and the target resolution is exactly
`needs-input` with `binding-missing`. A trace cannot invent a second binding
interpretation for the same target.

Remediation actions MUST come from trusted static profile data and a closed
action registry. Repository or provider prose MUST NOT supply commands. Values
from repositories are untrusted data and MUST be escaped in terminal and human
rendering; controls, OSC sequences, bidi controls, Markdown, and links MUST NOT
be interpreted as instructions.

Pagination MUST be deterministic and stateless. A cursor MUST bind the result
`aasIdentity`, request `aasIdentity`, profile `aasIdentity`, ordering key, and
next position. A provider MUST NOT rely on a hidden session or cache. High-severity findings and
omissions MUST be summarized in the non-truncatable header regardless of page.

## 11. Failure and rollback

Availability or false-positive incidents MAY replace a required binding with a
reviewed advisory binding. Containment, integrity, false-pass, or evidence-trust
incidents MUST disable the affected implementation or restore a known-good
verifier; they MUST NOT be converted into advisory passes.

Rollback creates new binding and receipt artifacts and preserves old evidence.
A security response MAY disable unsafe capability production but MUST NOT
reinterpret policy, snapshot, or historical receipt identities.

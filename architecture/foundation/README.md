# JavaScript quality adoption

AAS pins `@agent-teams/engineering-foundation@1.7.1` and `oxlint@1.85.0`
as development tools. Use pnpm 11.24.0 and Node 24.21.0 for the repository
verification lane. The patch upgrade from Node 24.20.0 enables Foundation's
execution events; the product engine range, existing private Node 26 lane and
historical source evidence remain under their existing owners.

`pnpm quality:scope` checks the complete tracked and intended new JS/TS census,
readable regular inputs, exact routes, generated provenance, config shape and
rejecting mutations. `pnpm quality:source` invokes the installed source boundary,
development-only and registry checks. The source profile selects the root-owned
private verifier, repository tooling and private conformance roots without
splitting packages. Their development dependency mode reflects the unpublished
private implementation: the package exports only artifacts and generated types.
Foundation classifies imports; AAS keeps its existing cycle, facade and kernel
ownership tests. New dependencies require review of this exact allowlist.

`pnpm quality:lint` checks authored JavaScript in `lib/**`, `scripts/**` and
`conformance/private/**` through the unchanged public Node preset. Local rules,
overrides, ignores and weaker budgets are forbidden. Generated Unicode modules
and declarations retain their exact provenance and generation checks. Tests and
candidate fixtures retain their dedicated gates. Source boundary discovery also
inspects governed nested `dist` source; the installed-boundary fixture places a
forbidden import there and must reject it.

`pnpm check:critical` invokes the public `agent-teams-node-test` CLI with the exact
file selection and required identities in `required-node-tests.json`. It protects
decoded-key uniqueness, exact numeric spelling, cheap oversized admission and
resolver/cohort integrity. `quality:scope` binds both selected files and all four
identities; removing a whole entry file must fail even though the shared CLI
protects identities only in selected files. There are no admitted OS exceptions
for these portable consumer tests. Disposable regressions rename and skip an
actual identity, restore completed execution, and exercise a justified exact
platform exception separately. `check:corpus` then runs the remaining tests with
the existing Node runner; private conformance runners keep their own contracts.

| Installed capability | Applicability and enforcement | Command |
| --- | --- | --- |
| Node lint preset | Authored JavaScript production/tooling, with exact Oxlint selection | `pnpm quality:lint` |
| Source dependencies v3 | Root-owned private `lib`, `scripts`, `conformance/private`; preserved topology, exact dependency/builtin edges, missing entrypoints and forbidden governed dist imports reject | `pnpm quality:source`, `pnpm quality:scope` |
| Typed source coverage and default explicit-unknown bridge gate | Not applicable: no authored TypeScript production/tooling. Installed coverage requires nonempty TypeScript production. New typed production fails the census until explicitly adopted. No bridge admissions or disabled bridge option | `pnpm quality:scope`; test projections/declarations: `pnpm typecheck` |
| Required Node test execution | Four exact critical identities across two selected files, completed results required | `pnpm check:critical`, `pnpm quality:scope` |
| Gate DAG and agent-workflow dispatch | Existing exact pnpm chains and CI evidence own dispatch; no separate DAG/profile required | `pnpm check:changed`, `pnpm check:fast`, `pnpm verify` |
| Documentation / ADR capabilities | Existing index and immutable accepted-decision checks own this repository; no documentation collection migration | `pnpm check:index`; edit current owning instructions, then run the index gate |
| JSON schema / public API evolution | Existing private schema corpus, generation and exact artifact/package checks; no released SDK evolution adoption | `pnpm check:schemas`, `pnpm check:generated`, `pnpm check:package` |
| SDK growth authority | Pending; `releaseEligible:false`. No grants, package inventory/history or released API baselines altered | No authority command activated; existing package/conformance checks remain |
| Native production routes / plugin mechanisms | No declared native production source or plugin Host. Installed parser/linter binaries are tooling prerequisites | No new production route; `pnpm verify` checks the existing consumer |
| Scaffolding / mutation lifecycle | No declared scaffolding owner, target catalog or product recipe; no local attach or publication | No mutation/scaffolding command activated |
| Property-testing helpers / protobuf / executable-specification catalog | No adopted helper, protobuf owner or executable-specification profile; retain independent corpus oracles | `pnpm check:corpus`, `pnpm check:conformance` |

AAS has no Consumer Module Standard pin, accepting Assembly ADR or Get Modular
Host. The retained current upstream packet adds an optional lifecycle candidate;
it does not authorize an AAS module-system migration. Accepted ADRs, normative
standard bytes, public baselines and historical receipts stay source-bound.

Run `pnpm check:changed` or `pnpm check:fast` while iterating and `pnpm verify`
before review. The upgrade's result and fresh command receipts are retained in
`.quality-output/upgrade-result.md` and `.quality-output/upgrade-evidence.json`.
A profile or version bump alone does not establish successful qualification.

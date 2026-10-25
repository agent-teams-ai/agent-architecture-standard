# JavaScript quality adoption

AAS selects its exact stable Stack development version only in root
`package.json`; the local installed package must match that declaration and
resolve inside this consumer's `node_modules`. Compatible updates change that
pin and the generated lock, while commands, scopes and profiles stay unchanged.
Each update still requires frozen installation, artifact review and actual CI;
a synthetic future-pin fixture proves binding only. Existing release-age policy
remains unchanged; a fresh version may need to wait. Initial qualification used
`@agent-teams/engineering-foundation@3.0.0` and `stack-toolchain@0.1.1`.
Stack owns its linter, formatter and checker versions through its public manifest;
`typescript@7.0.2` remains explicit for the installed-artifact package probe.
`yaml@2.9.1` reads the two owned YAML configurations through the public parser
with strict syntax and unique keys. Parser errors fail before the unchanged
configuration-shape assertions; ordinary JSON files keep their JSON decoder. Use pnpm 11.24.0 and Node 26.11.1 for default repository
verification. CI retains Node 24.21.0 compatibility verification on all three
operating systems, with separate Node 24 evidence artifacts. Both runtimes
support Foundation's required execution events. The product engine range remains
`>=24`; module boundaries and historical evidence retain their existing owners.
Node 26 does not bundle Corepack. Invoke an existing trusted Corepack JavaScript
entrypoint with the selected Node binary, and expose an owned pnpm shim for nested
commands. Keep frozen installs, engine strictness and strict peer checks enabled.
The pnpm 11 workspace explicitly denies Bun's wrapper postinstall with
`allowBuilds: { bun: false }`; Stack uses the pinned optional native binary
directly. `strictDepBuilds: true` keeps unreviewed scripts fatal. Global build
approval or script-ignore settings must not bypass that review.
A newly introduced dependency build script changes the reviewed installation
capabilities and requires a specific policy review; ordinary compatible version
updates retain this policy.

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
`conformance/private/**` through the public Stack type-aware preset. The primary Stack lane always uses
`--type-aware`; the preset disables semantic rules for JavaScript, so this
consumer still declares `typedCoverage:false`. No authored TypeScript production
or tooling is admitted. Local rules,
overrides, ignores and weaker budgets are forbidden. Generated Unicode modules
and declarations retain their exact provenance and generation checks. Tests and
candidate fixtures retain their dedicated gates. The independent source census
and Oxlint debug selection must agree with the exact `toolchain.config.json`
paths before the public Stack lint API runs. It resolves the linter installed
with Stack rather than a global executable or a separate direct linter pin.

`pnpm typecheck` uses the same ordinary strict `tsconfig.json` through Stack.
That project checks generated declarations and test projections; no production
JavaScript typed assurance is implied. A successful checker ends the chain.
Fallback from tsrs to Bun and then the official TypeScript checker is allowed
only for classified engine failure or unavailability; source diagnostics stop.
The package gate retains its independent installed-artifact compiler probe.

`pnpm format:check` checks the broad maintained-file census, including authored
source, tests, current instructions and configuration. The independent scope gate
rejects dropped maintained files and generated or frozen artifact additions.
Normative artifacts, versioned profiles, registries, schemas, vectors, accepted
decisions, research receipts, generated Unicode/declarations, conformance
candidate bytes and lockfiles keep their byte-owned gates. Formatting does not
rewrite them. Hash-bound private conformance source stays in the format census;
any mechanical change needs explicit review with its existing artifact proof.

The reviewed formatting prerequisite is merged at
`7855315889312026d25f8f57724fbbecec70f55d`. This adoption retains that source and
its compatibility guards, including the current private conformance hashes.
Before merging adoption, require exact-head CI and a real Get Modular canary.
The first canary was accepted at Get Modular commit
`8305ea6409757da8e60dca074dce163d95c85e88`, with the public Node 26 route,
64 native checks and six artifact-matrix checks passing. Source boundary
discovery also inspects governed nested
`dist` source; the installed-boundary fixture places a forbidden import there
and must reject it. A scope configuration alone is not completed qualification.

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

| Installed capability                                                   | Applicability and enforcement                                                                                                                                                                                                         | Command                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Stack lint preset                                                      | Authored JavaScript production/tooling, with exact Oxlint selection and the public Stack route                                                                                                                                        | `pnpm quality:lint`                                                           |
| Source dependencies v3                                                 | Root-owned private `lib`, `scripts`, `conformance/private`; preserved topology, exact dependency/builtin edges, missing entrypoints and forbidden governed dist imports reject                                                        | `pnpm quality:source`, `pnpm quality:scope`                                   |
| Typed source coverage and default explicit-unknown bridge gate         | Not applicable: no authored TypeScript production/tooling. Installed coverage requires nonempty TypeScript production. New typed production fails the census until explicitly adopted. No bridge admissions or disabled bridge option | `pnpm quality:scope`; test projections/declarations: `pnpm typecheck`         |
| Required Node test execution                                           | Four exact critical identities across two selected files, completed results required                                                                                                                                                  | `pnpm check:critical`, `pnpm quality:scope`                                   |
| Maintained-source formatting                                           | Explicit broad maintained census; protected artifacts keep byte-owned checks                                                                                                                                                          | `pnpm format:check`, `pnpm quality:scope`                                     |
| Gate DAG and agent-workflow dispatch                                   | Existing exact pnpm chains and CI evidence own dispatch; no separate DAG/profile required                                                                                                                                             | `pnpm check:changed`, `pnpm check:fast`, `pnpm verify`                        |
| Documentation / ADR capabilities                                       | Existing index and immutable accepted-decision checks own this repository; no documentation collection migration                                                                                                                      | `pnpm check:index`; edit current owning instructions, then run the index gate |
| JSON schema / public API evolution                                     | Existing private schema corpus, generation and exact artifact/package checks; no released SDK evolution adoption                                                                                                                      | `pnpm check:schemas`, `pnpm check:generated`, `pnpm check:package`            |
| SDK growth authority                                                   | Pending; `releaseEligible:false`. No grants, package inventory/history or released API baselines altered                                                                                                                              | No authority command activated; existing package/conformance checks remain    |
| Native production routes / plugin mechanisms                           | No declared native production source or plugin Host. Installed parser/linter binaries are tooling prerequisites                                                                                                                       | No new production route; `pnpm verify` checks the existing consumer           |
| Scaffolding / mutation lifecycle                                       | No declared scaffolding owner, target catalog or product recipe; no local attach or publication                                                                                                                                       | No mutation/scaffolding command activated                                     |
| Property-testing helpers / protobuf / executable-specification catalog | No adopted helper, protobuf owner or executable-specification profile; retain independent corpus oracles                                                                                                                              | `pnpm check:corpus`, `pnpm check:conformance`                                 |

AAS has no Consumer Module Standard pin, accepting Assembly ADR or Get Modular
Host. The current upstream CMS reviewed at `b70ba39304ac71964175c42a77309406a7c30ca2`
(full-document SHA-256
`11a389b223506dc303fa986a7a37350b847013d85beb2de9d74cb8c97363e824`)
is classified not applicable to this tooling-only migration. Its optional lifecycle candidate
does not authorize an AAS module-system migration. Accepted ADRs, normative
standard bytes, public baselines and historical receipts stay source-bound.

Run `pnpm check:changed` or `pnpm check:fast` while iterating and `pnpm verify`
before review. The upgrade's result and fresh command receipts are retained in
`.quality-output/upgrade-result.md` and `.quality-output/upgrade-evidence.json`.
A profile or version bump alone does not establish successful qualification.

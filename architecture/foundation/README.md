# JavaScript quality adoption

This repository pins `@agent-teams/engineering-foundation@1.5.0` and
`oxlint@1.85.0` as development-only quality tools. Oxlint extends the public
Foundation Node preset; the consumer config cannot add rules, overrides, or
ignore patterns.

`pnpm quality:scope` validates the complete tracked JS/TS census, exact routes,
generated provenance, config shape, and rejecting mutations. `pnpm
quality:lint` checks authored production and tooling in `lib/**`, `scripts/**`,
and `conformance/private/**`. Tests, candidate fixtures, and generated type
artifacts retain their dedicated correctness and generation gates.

Foundation's TypeScript production source-coverage capability is not claimed:
AAS production and tooling are JavaScript, while its authored TypeScript is a
test projection and generated declarations retain generation provenance. The
consumer census covers all JS/TS suffixes and rejects unknown source paths.

Run `pnpm check:fast` while iterating and `pnpm verify` before review. Fix a new
diagnostic in the owning source slice. Do not add local lint policy, ignores, or
a typed-coverage claim to bypass the shared preset.

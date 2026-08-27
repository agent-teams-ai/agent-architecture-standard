# Private strict-JSON conformance slice

This directory contains an executable, unpublished, non-claiming black-box
prototype over the 18 cases in `vectors/json/corpus.json`. The adapter is
explicitly private and nonnormative because AAS V0 exposes no public provider
transport. A neutral authority, independent oracle review, and a public
provider transport remain qualification blockers.

Run the independent example candidate with:

```sh
node conformance/private/runner.mjs \
  conformance/candidates/good-strict-json.mjs independent-strict-json
```

Run the slice tests with:

```sh
node --test conformance/test/*.test.mjs
```

## Security boundary

The runner accepts only one bounded regular `.mjs` artifact and reports its
SHA-256 digest. Those exact bytes are copied with exclusive creation into a new
temporary directory, re-hashed, and executed by the current fixed Node binary
with fixed arguments, a fixed temporary working directory, a minimal closed
environment, and no shell. It never reports an arbitrary command or argument
list. Relative multi-file closure and candidate-supplied package state are not
available.

Each invocation has output and wall-clock limits. On POSIX the candidate starts
as a process-group leader and the group is killed; on Windows `taskkill /T /F`
is invoked without a shell. Root exit is reaped and inherited pipes get a
separate bounded settlement deadline. Cross-platform tests spawn a descendant
pipe holder, record every descendant PID outside the report, and verify no PID
survives.

The request and response are closed JSON-line records. Requests carry only a
deterministic opaque token, input, and limits—never corpus case IDs,
expectations, or oracle labels. Successful responses must supply the exact
independently recorded canonical-value digest. Unexpected fields (including
`value` or `data`), unbounded strings, malformed output, and stderr are rejected
without being echoed. Reports use a closed bounded schema and bind the suite,
corpus, oracle, runner, candidate, input, toolchain descriptor, bounds, and
replay ID.

This is process control, not a general hostile-code sandbox. Filesystem and
network isolation, Node runtime-binary attestation, and multi-file closure
attestation are explicitly not provided and are recorded as such in every
report.

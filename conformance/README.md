# Private strict-JSON conformance slice

This directory contains an executable, unpublished, non-claiming black-box
prototype over the 18 cases in `vectors/json/corpus.json`. The adapter is
private and nonnormative because AAS V0 exposes no public provider transport.
A neutral authority, independent oracle review, and a public provider
transport remain qualification blockers.

Run the independent example candidate with Node 24:

```sh
node conformance/private/runner.mjs \
  conformance/candidates/good-strict-json.mjs independent-strict-json
```

Run the slice tests with:

```sh
node --test conformance/test/*.test.mjs
```

## Artifact admission and execution

The runner opens one candidate handle with `O_NOFOLLOW`, verifies regular-file
state with that handle, and reads no more than `candidateBytes + 1`. It checks
the same handle again for concurrent size or metadata changes. The digest is
over the resulting admitted buffer.

No candidate pathname or staged copy is executed. A fixed ESM loader reads the
admitted bytes from inherited FD 3, verifies their length and SHA-256 against a
separate inherited binding record on FD 4, and only then imports their base64
`data:` URL; stdin remains exclusively the JSON-line protocol. Candidates
therefore remain one file and can import only `node:` built-ins under the fixed
permission contract. The exact spawned Node command is feature-tested and the
run fails closed if its permission behavior is unavailable.

## Security and process boundary

Every candidate starts as the current fixed Node 24 binary with `--permission`,
`--no-addons`, no `--allow-*` flags, fixed loader arguments, a minimal closed
environment, no shell, and no filesystem pathname for candidate code. Node's
permission model denies filesystem reads/writes, child processes (including
detached attempts), workers, and addons. Tests exercise the exact command and
prove that ordinary and detached child attempts cannot create a marker.

Node 24 permission mode does not control network access. This slice supplies no
network namespace, firewall policy, Windows Job Object, POSIX cgroup, or other
OS containment. It is not a universal hostile-code sandbox. On POSIX the
runner makes a bounded process-group kill attempt; on Windows it makes a
bounded `taskkill /T /F` attempt and reaps that helper. These are fallback
teardown mechanisms, not confirmed tree containment. The closed report calls
them only `bounded-attempt-complete` or `bounded-attempt-deadline` and records
the absent OS containment and uncontrolled network boundary explicitly.

One absolute deadline covers invocation plus settlement work. Response, root
exit, close, timeout, and pipe errors all enter teardown. Candidate stdin,
stdout, stderr, FDs 3/4, spawn errors, and taskkill errors are handled without
echoing their contents. Fixtures cover malformed and oversized output, early
root exit, delay, pipe holding, and denied ordinary/detached descendants.

## Transport and report bindings

Each run cryptographically randomizes case order and generates a fresh random
128-bit transport token for every invocation. Requests expose only that token,
the input, and limits—never a case ID, expectation, oracle label, replay ID, or
corpus ordinal. Tokens and other nonces are omitted from the report; invocation
results are restored to reviewed corpus order so a conforming run's report is
deterministic. `replayId` remains a deterministic digest of input and observed
toolchain/source evidence, not transport state.

Responses are tiny closed JSON objects with exactly `version`, `token`,
`diagnostic`, and `valueDigest`. A strict parser rejects duplicate keys,
including escape-equivalent spellings, rather than accepting JSON
last-key-wins behavior. Successful cases bind independently reviewed literal
canonical-value digests. Unexpected fields, malformed output, unbounded
strings, stderr, environment values, arbitrary paths, and candidate output are
not copied into the bounded report.

The candidate digest attests the exact admitted and executed buffer. The
`oracleObservedSourceDigest` and `runnerObservedSourceDigest` fields are only
post-load observations of source paths; they do not attest bytes already
executed by Node. Runtime binary/module execution attestation is not provided.
The report remains private, nonnormative, non-claiming, and supplies no public
or neutral qualification.

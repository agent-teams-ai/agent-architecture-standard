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

The runner takes strict pre-open `lstat`/`realpath` evidence, opens one
candidate handle, compares handle `fstat` evidence, and reads no more than
`candidateBytes + 1`. It then compares strict post-open pathname and handle
evidence before admitting the buffer. Nonzero `O_NOFOLLOW` and `O_NONBLOCK`
flags are used where the platform supplies them. This rejects links, reparse
points, junctions, non-files, substitutions, and observable races without
blocking on a POSIX FIFO. Windows supplies no native no-follow flag through
Node, so the runner makes no native no-follow claim there; it uses the
strongest deterministic pure-Node pre/post pathname and opened-handle evidence
available. The digest is over the resulting admitted buffer.

No candidate pathname or staged copy is executed. The parent closes one binary
frame on inherited FD 3: fixed magic, bounded unsigned source length, raw
SHA-256 binding, and exact source bytes. A fixed ESM loader uses exact-length
`readSync` loops, requires EOF immediately after the declared source, validates
the bound digest, and only then imports the verified bytes through a base64
`data:` URL. Truncation, surplus, oversize, and digest mismatch all fail closed;
stdin remains exclusively the JSON-line protocol. The permission probe uses
the same frame. Candidates therefore remain one file and can import only
`node:` built-ins under the fixed permission contract. The exact spawned Node
command is feature-tested and the run fails closed if its permission behavior
is unavailable.

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
runner makes a bounded process-group kill attempt. On Windows it attempts to
terminate the process tree with bounded `taskkill /T /F`, attempts to reap that
helper, and then attempts to observe/reap root-process closure within the same
deadline. No Windows cleanup outcome claims unconditional reaping or process
containment. These are fallback teardown mechanisms, not confirmed tree
containment. The closed report calls them only `bounded-attempt-complete` or
`bounded-attempt-deadline` and records the absent OS containment and
uncontrolled network boundary explicitly.

One absolute deadline covers invocation plus settlement work. Response, root
exit, close, timeout, and pipe errors all enter teardown. Candidate stdin,
stdout, stderr, FD 3, spawn errors, and taskkill errors are handled without
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
`diagnostic`, and `valueDigest`. A strict parser rejects every escape in an
object key (and therefore all escape-equivalent duplicate spellings) rather
than accepting JSON last-key-wins behavior; supported strict escapes remain
available in string values. Successful cases bind independently reviewed literal
canonical-value digests. Unexpected fields, malformed output, unbounded
strings, stderr, environment values, arbitrary paths, and candidate output are
not copied into the bounded report.

The candidate digest attests the exact admitted and executed buffer. The
`oracleObservedSourceDigest` and `runnerObservedSourceDigest` fields are only
post-load observations of source paths; they do not attest bytes already
executed by Node. Runtime binary/module execution attestation is not provided.
The report remains private, nonnormative, non-claiming, and supplies no public
or neutral qualification.

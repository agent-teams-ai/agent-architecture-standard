# Private strict-JSON conformance slice

This directory contains an executable, unpublished, non-claiming black-box
prototype over the 18 cases in `vectors/json/corpus.json`. The adapter is
private and nonnormative because AAS V0 exposes no public provider transport.
A neutral authority, independent oracle review, and a public provider
transport remain qualification blockers.

Run the independent example candidate with Node 26.11.1 (or Node 24.21.0 for compatibility):

```sh
node conformance/private/runner.mjs \
  conformance/candidates/good-strict-json.mjs independent-strict-json
```

Run the slice tests with:

```sh
node --test conformance/test/*.test.mjs
```

Default repository verification uses Node 26.11.1, with explicit Node 24.21.0
compatibility rows and separate evidence retained in CI. CI also runs the private
slice on Node 26.11.1 from `conformance/node26`, using its isolated,
dependency-free pnpm workspace with `engineStrict: true` and
`strictPeerDependencies: true` in `pnpm-workspace.yaml`, where pinned pnpm 11
reads them. The lane's test installs a compatible local dependency with a
frozen lockfile and requires an incompatible Node 24-only dependency to fail
with `ERR_PNPM_UNSUPPORTED_ENGINE`. The root workspace also retains strict
settings. Its public package engine range remains `>=24`, and the pinned
Foundation dependency accepts both Node 24 and Node 26. The isolated lane
checks its private slice; full root qualification requires the separate root
frozen install and `pnpm verify`. Locally, the equivalent Node 26 commands are:

```sh
cd conformance/node26
pnpm install --frozen-lockfile --config.engine-strict=true --config.strict-peer-dependencies=true
pnpm run verify
```

## Artifact admission and execution

The runner takes strict pre-open `lstat`/`realpath` evidence, opens one
candidate handle, compares handle `fstat` evidence, and reads no more than
`candidateBytes + 1`. It then compares strict post-open pathname and handle
evidence before admitting the buffer. Nonzero `O_NOFOLLOW` and `O_NONBLOCK`
flags are used where the platform supplies them. This rejects a recognized
link or reparse point at the final path, non-files, substitutions, and
observable final-path/handle drift without blocking on a POSIX FIFO. It does
not exclude symlink or junction traversal in ancestor path components, nor
claim immunity to a hostile swap that restores the observed evidence before
the next check. Windows supplies no native no-follow flag through
Node, so the runner makes no native no-follow claim there; it uses the
strongest deterministic pure-Node pre/post pathname and opened-handle evidence
available. The digest is over the resulting admitted buffer.

No candidate pathname or staged copy is executed. The trusted parent produces
and closes exactly one binary frame on inherited FD 3: fixed magic, bounded
unsigned source length, raw
SHA-256 binding, and exact source bytes. A fixed ESM loader uses exact-length
`readSync` loops, validates the bound digest, and immediately imports the
verified bytes through a base64 `data:` URL without waiting for FD 3 EOF.
Bad magic, truncation, oversize, and digest mismatch all fail closed. Trailing
bytes from a malicious parent are outside this private parent-owned transport
contract and are not detected by the loader. Stdin remains exclusively the
JSON-line protocol. The permission probe uses
the same frame. Candidates therefore remain one file and can import only
`node:` built-ins under the fixed permission contract. The exact spawned Node
command is feature-tested and the run fails closed if its permission behavior
is unavailable.

## Security and process boundary

Every candidate starts as the current Node 26 default or Node 24 compatibility binary with `--permission`,
`--no-addons`, no `--allow-*` flags, fixed loader arguments, a minimal closed
environment, no shell, and no filesystem pathname for candidate code. Node's
permission model denies filesystem reads/writes, child processes (including
detached attempts), workers, and addons. Tests exercise the exact command and
prove that ordinary and detached child attempts cannot create a marker.

Node 24 permission mode does not control network access. The Node 26 report
does not attest network isolation. This slice supplies no
network namespace, firewall policy, Windows Job Object, POSIX cgroup, or other
OS containment. It is not a universal hostile-code sandbox. On POSIX the
runner makes a bounded process-group kill attempt. On Windows it attempts to
terminate only the root process with `child.kill('SIGKILL')`, then attempts to
observe root-process closure within the same deadline. This is sufficient for
the private permission contract, which denies child-process creation;
it does not provide Windows process-tree containment. No Windows cleanup
outcome claims unconditional termination or closure. The closed report calls
the result only `bounded-attempt-complete` or `bounded-attempt-deadline` and
records the absent Windows process-tree containment and uncontrolled network
boundary explicitly.

An invocation deadline is followed by a distinct bounded settlement deadline.
After the first response line, the runner waits within settlement for process
and stdout closure and validates all captured stdout. Response, root
exit, close, timeout, and pipe errors all enter teardown. Candidate stdin,
stdout, stderr, FD 3, spawn errors, and teardown errors are handled without
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

## Positive-zero regression plan — 2026-11-26

Status: scoped correction implemented; exact-head verification is tracked in
[PR #30](https://github.com/agent-teams-ai/agent-architecture-standard/pull/30).
Base: `08372edb3e30fd23c1d2de499fc6f4c2c77c3aa1`. The owner authorized this
specific repair and its end-to-end review, checks and ordinary PR delivery.

The independent candidate rejects `0.00`, `0e-2`, `0e17` and `0e10000000`
as invalid numbers. They denote positive mathematical zero under the existing
[strict numeric contract](../spec/identity.md#2-strict-i-json-input-profile).
The main parser already accepts them; the retained 18-case corpus misses this
candidate defect. A read-only probe of the exact base sources reproduced the
disagreement on Linux / Node 24.22.3. It was not full repository qualification.

### Scope and independence

- Correct positive-zero handling in the existing single-file
  `conformance/candidates/good-strict-json.mjs`, after rejecting negative zero
  and before exponent/scale limits. Require a syntax-valid numeric token and
  preserve whole-document/trailing-input validation before accepting a result.
  Do not import the main parser or oracle.
- Extend the existing `conformance/test/candidate-frame.test.mjs` process test
  through its framed source loader and the existing permission-mode command.
  Use literal expected diagnostics and the independently fixed digest of `0`.
  Reuse its existing bounded process helper; add no separate runner or library.
  Keep close-observed completion and its whole-child deadline; propagate input
  errors without claiming successful completion before the child closes.
- Update only the corrected candidate's digest in
  `conformance/artifact-baseline.json`. Keep the corpus, oracle, runner, loader,
  normative artifacts, public claims, dependencies and toolchain pins unchanged.
- Keep these localized corrections in the two existing legacy `.mjs` files:
  converting their single-file executed fixture and process suite would expand
  the repair into a source/loader/type-coverage migration. This applies the
  [small-correction rule](https://github.com/agent-teams-ai/.github/blob/main/docs/engineering-quality-standard.md#existing-maintained-javascript),
  introduces no new maintained helper responsibility, and claims no strict
  TypeScript coverage for these legacy files. New unrelated code is out of scope.

### Verification and delivery

1. Record independent first-round critique and a second critique after changes.
2. Add a focused regression and observe it fail on the original candidate.
3. Accept positive-zero decimal/exponent spellings with one exact value digest.
   Keep `-0.00`, `-0e10000000`, tiny nonzero `1e-10000000`, ordinary fractions,
   unsafe integers and malformed exponents (`0e`, `0e+`) rejected. A normal safe
   nonzero integer with a zero-padded exponent must retain its literal expected
   digest. Restore the old zero behavior in a disposable test input and show
   that the same independent expectations detect it.
4. Recompute the one candidate digest; independently verify all other baseline
   entries and normative/artifact bytes remain unchanged.
5. Run focused private tests, then the owning `pnpm verify` route with the pinned
   compiler/tool graph. Existing hosted Node 26.11.1 and Node 24.21.0 OS lanes
   and the strict-install private-conformance lane retain their exact gates.
6. Publish coherent commits immediately, review the exact final diff and checks,
   and hand the green PR to the owner for merge and actual-main verification.

Estimate: production **P=0**; additional TEST/fixture code **T=80–160 lines**,
excluding Markdown and the one digest update. Smaller sufficient changes are
preferred. Complexity **2/10**, expected reliability for this numeric boundary
**9/10**, estimate confidence **7/10**; these are judgments, not readiness claims.

### Critique and implementation checkpoint

Independent round 1 reviewed `33e60f27a109b2ca1c260c8a2da10040afacfb00` and
required the syntax, negative-zero, nonzero-underflow and child-close controls
above. Independent round 2 accepted the revised plan at
`5b6588dc2ff68af880368dafed446837e56b75d2` before implementation.

The candidate correction adds two lines. The existing frame test now checks
16 inputs through the real framed loader and permission-mode command, with
literal zero/one digests and rejecting diagnostics. On Linux / Node 26.11.1,
the new regression first failed on `0.00`; after correction all four frame-file
tests passed with no skips. Temporarily restoring the original candidate made
the same semantic assertion fail again; the corrected bytes were then restored.
All six baseline entries were independently rehashed, with only the corrected
candidate digest changed. Production LOC remain zero; TEST changes are +69/-4
lines before this prose, smaller than the initial estimate. The linked PR owns
the final full-gate, independent diff-review and actual-main delivery receipts.

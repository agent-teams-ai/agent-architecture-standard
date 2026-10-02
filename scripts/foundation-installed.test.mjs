import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repository = fileURLToPath(new URL("../", import.meta.url));
const packageRoot = new URL("../node_modules/@agent-teams/engineering-foundation/", import.meta.url);
const metadata = JSON.parse(await readFile(new URL("package.json", packageRoot), "utf8"));
const sourceCli = fileURLToPath(new URL(metadata.bin["agent-teams-foundation"], packageRoot));
const testCli = fileURLToPath(new URL(metadata.bin["agent-teams-node-test"], packageRoot));
const selected = ["test/strict-json.test.mjs", "test/operator-authority.test.mjs"];
const contractPath = "architecture/foundation/required-node-tests.json";

async function fixture(t, paths) {
  const root = await mkdtemp(join(tmpdir(), "aas-foundation-upgrade-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of paths) {
    await cp(join(repository, path), join(root, path), { recursive: true });
  }
  return root;
}

async function invoke(cli, args, cwd) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
    return { code: 0, output: stdout + stderr };
  } catch (error) {
    if (typeof error.code !== "number") { throw error; }
    return { code: error.code, output: error.stdout + error.stderr };
  }
}

const critical = cwd => invoke(testCli, ["--contract", contractPath, "--", ...selected], cwd);

// Real consumer identities are renamed/skipped in a disposable source copy.
// A successful child process alone cannot satisfy the execution contract.
test("installed Node runner rejects omission and skip of actual critical identities", async t => {
  const root = await fixture(t, ["lib", "schemas", "registries", "vectors", "profiles", "artifacts.json", "test", "architecture/foundation/required-node-tests.json"]);
  // Ajv is existing private verifier tooling; the fixture uses the installed carrier.
  const { symlink } = await import("node:fs/promises");
  await symlink(join(repository, "node_modules"), join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  const path = join(root, selected[0]);
  const source = await readFile(path, "utf8");
  await writeFile(path, source.replace("test('duplicate decoded keys are rejected'", "test('renamed critical identity'"));
  const omitted = await critical(root);
  assert.equal(omitted.code, 1, omitted.output);
  assert.match(omitted.output, /duplicate decoded keys are rejected.*omitted/u);
  await writeFile(path, source.replace("test('duplicate decoded keys are rejected'", "test.skip('duplicate decoded keys are rejected'"));
  const skipped = await critical(root);
  assert.equal(skipped.code, 1, skipped.output);
  assert.match(skipped.output, /duplicate decoded keys are rejected.*skipped/u);
  await writeFile(path, source);
  const completed = await critical(root);
  assert.equal(completed.code, 0, completed.output);
  assert.match(completed.output, /4 required identities completed/u);
});

test("installed Node runner admits only an exact justified platform exception", async t => {
  const root = await fixture(t, []);
  const windows = process.platform === "win32";
  const name = windows ? "POSIX permission bits" : "Windows junction semantics";
  const platforms = windows ? ["win32"] : ["linux", "darwin"];
  const reason = windows ? "POSIX file permission bit semantics are unavailable on Windows." : "Windows junction semantics require a Windows filesystem host.";
  const body = windows
    ? "await writeFile('mode.txt', 'data', {mode: 0o600}); assert.equal((await stat('mode.txt')).mode & 0o777, 0o600);"
    : "await mkdir('target'); await symlink('target', 'junction', 'junction'); assert.equal((await lstat('junction')).isSymbolicLink(), true);";
  await writeFile(join(root, "platform.test.mjs"), `import test from 'node:test'; import assert from 'node:assert/strict'; import {mkdir, symlink, lstat, stat, writeFile} from 'node:fs/promises';\ntest(${JSON.stringify(name)}, {skip: ${windows ? "process.platform === 'win32'" : "process.platform !== 'win32'"}}, async () => {${body}});\n`);
  const identity = { file: "platform.test.mjs", names: [name], kind: "test" };
  const contract = { schemaVersion: 1, required: [identity], exceptions: [{ ...identity, status: "skipped", reason, applicability: { platforms } }] };
  const run = () => invoke(testCli, ["--contract", "contract.json", "--", "platform.test.mjs"], root);
  await writeFile(join(root, "contract.json"), JSON.stringify(contract));
  const admitted = await run();
  assert.equal(admitted.code, 0, admitted.output);
  contract.exceptions[0].applicability.platforms = windows ? ["linux"] : ["win32"];
  await writeFile(join(root, "contract.json"), JSON.stringify(contract));
  const wrongPlatform = await run();
  assert.equal(wrongPlatform.code, 1, wrongPlatform.output);
  assert.match(wrongPlatform.output, /skipped/u);
  contract.exceptions[0].applicability.platforms = ["linux", "darwin", "win32"];
  await writeFile(join(root, "contract.json"), JSON.stringify(contract));
  const blanket = await run();
  assert.equal(blanket.code, 1, blanket.output);
  assert.match(blanket.output, /platform subset/u);
});

test("installed source boundary rejects missing inputs and forbidden governed dist source", async t => {
  const root = await fixture(t, ["package.json", "pnpm-workspace.yaml", "foundation.config.yaml", "architecture/foundation/source-dependencies.yaml", "lib", "scripts", "conformance/private"]);
  const run = () => invoke(sourceCli, ["check", "--format", "json"], root);
  const accepted = await run();
  assert.equal(accepted.code, 0, accepted.output);
  const path = join(root, "lib/strict-json.mjs");
  const bytes = await readFile(path);
  await rm(path);
  const missing = await run();
  assert.equal(missing.code, 1, missing.output);
  assert.match(missing.output, /strict-json|entrypoint|SOURCE_/u);
  await mkdir(path);
  const unreadable = await run();
  assert.equal(unreadable.code, 1, unreadable.output);
  assert.match(unreadable.output, /strict-json|entrypoint|SOURCE_/u);
  await rm(path, { recursive: true });
  await writeFile(path, bytes);
  await mkdir(join(root, "lib/dist"));
  await writeFile(join(root, "lib/dist/forbidden.mjs"), "import net from 'node:net'; export const connect = net.connect;\n");
  const governedDist = await run();
  assert.equal(governedDist.code, 1, governedDist.output);
  assert.match(governedDist.output, /lib\/dist\/forbidden\.mjs/u);
  assert.match(governedDist.output, /node:net/u);
});

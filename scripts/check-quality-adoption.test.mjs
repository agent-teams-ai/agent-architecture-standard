import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  assertQualityAdoption,
  classifyTrackedSources,
  deriveLintPaths,
  readQualityAdoption,
  readStackInstallation,
} from "./check-quality-adoption.mjs";
import { selectOxlintFiles } from "./run-quality-lint.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const accepted = await readQualityAdoption();

test("quality activation retains the accepted Foundation contract", () => {
  assertQualityAdoption(accepted);
});

test("one exact root Stack pin accepts matching future metadata without qualifying future tools", () => {
  const future = structuredClone(accepted);
  future.manifest.devDependencies["stack-toolchain"] = "18.2.7";
  future.installedStack.version = "18.2.7";
  assertQualityAdoption(future); // Binding only; no future engine or installation is exercised.
  for (const pin of [
    "latest",
    "npm:stack-toolchain@1.2.3",
    "file:../stack",
    "git+https://example.invalid/stack",
    "workspace:*",
    "1.2.3-rc.1",
    "1.2.3+build",
    "01.2.3",
    "1.2",
    "v1.2.3",
    "9007199254740992.0.0",
  ]) {
    const value = structuredClone(accepted);
    value.manifest.devDependencies["stack-toolchain"] = pin;
    assert.throws(() => assertQualityAdoption(value), /Stack.*(?:pin|semver)/u);
  }
  for (const section of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    const value = structuredClone(accepted);
    value.manifest[section] = {
      "stack-toolchain": value.manifest.devDependencies["stack-toolchain"],
    };
    assert.throws(() => assertQualityAdoption(value), /only in root devDependencies/u);
  }
});

async function writeStackMetadata(root) {
  const directory = join(root, "node_modules", "stack-toolchain");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({
      name: accepted.installedStack.name,
      version: accepted.installedStack.version,
      exports: {
        "./package.json": "./package.json",
        "./toolchain-manifest.json": "./toolchain-manifest.json",
      },
    }),
  );
  await writeFile(
    join(directory, "toolchain-manifest.json"),
    JSON.stringify(accepted.installedStack.toolchainManifest),
  );
}

test("Stack public metadata rejects missing, ancestor and escaping installations", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "aas-stack-binding-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const missing = join(root, "missing", "consumer");
  await mkdir(missing, { recursive: true });
  await assert.rejects(readStackInstallation(pathToFileURL(`${missing}/`)), {
    code: "MODULE_NOT_FOUND",
  });
  const parent = join(root, "ancestor");
  const consumer = join(parent, "consumer");
  await mkdir(consumer, { recursive: true });
  await writeStackMetadata(parent);
  await assert.rejects(
    readStackInstallation(pathToFileURL(`${consumer}/`)),
    /inside consumer node_modules/u,
  );
  const escaped = join(root, "escaped");
  await mkdir(join(escaped, "node_modules"), { recursive: true });
  await symlink(
    join(parent, "node_modules", "stack-toolchain"),
    join(escaped, "node_modules", "stack-toolchain"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(
    readStackInstallation(pathToFileURL(`${escaped}/`)),
    /inside consumer node_modules/u,
  );
});

test("quality workflow guards accept both quote styles with the same exact values", () => {
  const singleQuoted = accepted.workflow
    .replace('artifact-suffix: ""', "artifact-suffix: ''")
    .replace('artifact-suffix: "-node24"', "artifact-suffix: '-node24'");
  const doubleQuoted = singleQuoted
    .replace("artifact-suffix: ''", 'artifact-suffix: ""')
    .replace("artifact-suffix: '-node24'", 'artifact-suffix: "-node24"');
  assert.notEqual(singleQuoted, doubleQuoted);
  for (const workflow of [singleQuoted, doubleQuoted]) {
    assertQualityAdoption({ ...accepted, workflow });
  }
});

test("generated JavaScript and declarations retain provenance instead of authored-source status", () => {
  const census = classifyTrackedSources(accepted.trackedPaths, accepted.profile);
  for (const path of [
    "lib/unicode-case-fold-17.mjs",
    "lib/unicode-normalization-17.mjs",
    "generated/artifacts.d.ts",
  ]) {
    assert.ok(
      census.classified.some((source) => source.path === path && source.role === "generated"),
      `${path} must be generated`,
    );
  }
  assert.ok(
    census.classified.some(
      (source) => source.path === "test/type-projections.ts" && source.role === "test",
    ),
  );
});

test("lint inputs are exactly production and tooling and match Oxlint selection", async () => {
  const census = assertQualityAdoption(accepted);
  const lintPaths = deriveLintPaths(census, accepted.profile);
  for (const path of [
    "lib/binding-selection.mjs",
    "scripts/check-quality-adoption.mjs",
    "conformance/private/runner.mjs",
  ]) {
    assert.ok(lintPaths.includes(path), `${path} must be linted`);
  }
  for (const path of [
    "lib/unicode-case-fold-17.mjs",
    "lib/unicode-normalization-17.mjs",
    "scripts/check-quality-adoption.test.mjs",
    "scripts/github-heading-slug.test.mjs",
  ]) {
    assert.ok(!lintPaths.includes(path), `${path} must not be linted`);
  }
  assert.deepEqual(await selectOxlintFiles(lintPaths), lintPaths);
});

test("quality entrypoints run from a checkout path containing spaces, #, and %", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "aas quality entrypoints #% -"));
  const checkout = join(temporaryRoot, "checkout#with%characters");
  const marker = join(temporaryRoot, "oxlint-invocations.txt");
  const observer = `data:text/javascript;base64,${Buffer.from(`
import { appendFileSync } from "node:fs";
if (process.argv[1]?.replaceAll("\\\\", "/").endsWith("/node_modules/oxlint/bin/oxlint")) {
  appendFileSync(process.env.AAS_OXLINT_MARKER, "invoked\\n");
}
`).toString("base64")}`;
  try {
    await symlink(repositoryRoot, checkout, process.platform === "win32" ? "junction" : "dir");
    const { stdout } = await execFileAsync(
      process.execPath,
      ["--preserve-symlinks-main", join(checkout, "scripts/check-quality-adoption.mjs")],
      {
        cwd: checkout,
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
      },
    );
    assert.match(stdout, /^AAS quality scope verified:/u);
    const lint = await execFileAsync(
      process.execPath,
      ["--preserve-symlinks-main", join(checkout, "scripts/run-quality-lint.mjs")],
      {
        cwd: checkout,
        encoding: "utf8",
        env: { ...process.env, AAS_OXLINT_MARKER: marker, NODE_OPTIONS: `--import=${observer}` },
        maxBuffer: 2 * 1024 * 1024,
      },
    );
    assert.match(lint.stdout, /Found 0 warnings and 0 errors/u);
    // Stack's typed Node wrapper receives an explicit environment without
    // NODE_OPTIONS; this observer sees only the independent debug wrapper.
    assert.deepEqual((await readFile(marker, "utf8")).trim().split("\n"), ["invoked"]);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("owned formatted YAML keeps its shape and rejects syntax errors and duplicate keys", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "aas-owned-yaml-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = [
    "foundation.config.yaml",
    "architecture/foundation/source-dependencies.yaml",
    "package.json",
    ".gitignore",
    "toolchain.config.json",
    "tsconfig.json",
    "artifacts.json",
    "architecture/foundation/javascript-quality-profile.json",
    "architecture/foundation/required-node-tests.json",
    ".oxlintrc.json",
    ".github/workflows/verify.yml",
  ];
  for (const file of files) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await cp(join(repositoryRoot, file), join(root, file));
  }
  await writeStackMetadata(root);
  await execFileAsync("git", ["init", "--quiet"], { cwd: root });
  const fixtureRoot = pathToFileURL(`${root}/`);
  const parsed = await readQualityAdoption(fixtureRoot);
  assert.deepEqual(parsed.foundationConfig, {
    schemaVersion: 1,
    project: { id: "agent-architecture-standard" },
    capabilities: {
      "architecture.source-dependencies": {
        configPath: "architecture/foundation/source-dependencies.yaml",
      },
    },
  });
  assert.equal(parsed.sourcePolicy.schemaVersion, 3);
  assert.deepEqual(parsed.sourcePolicy.boundaries[1].allow.packages, [
    "ajv",
    "stack-toolchain",
    "yaml",
  ]);
  for (const file of [
    "foundation.config.yaml",
    "architecture/foundation/source-dependencies.yaml",
  ]) {
    const source = await readFile(join(root, file), "utf8");
    for (const malformed of ["value: [\n", "schemaVersion: 1\nschemaVersion: 1\n"]) {
      await writeFile(join(root, file), malformed);
      await assert.rejects(readQualityAdoption(fixtureRoot), /invalid YAML configuration/u);
    }
    await writeFile(join(root, file), source);
  }
});

const mutations = {
  "an incorrect Node 24 artifact suffix": (value) => {
    value.workflow = value.workflow.replace("-node24", "-other");
  },
  "a missing direct YAML parser": (value) => {
    delete value.manifest.devDependencies.yaml;
  },
  "a ranged YAML parser pin": (value) => {
    value.manifest.devDependencies.yaml = "^2.9.1";
  },
  "a detached installed source boundary": (value) => {
    delete value.foundationConfig.capabilities["architecture.source-dependencies"];
  },
  "a dropped governed tooling root": (value) => {
    value.sourcePolicy.governedRoots.pop();
  },
  "TypeScript production without typed quality adoption": (value) => {
    value.trackedPaths.push("lib/new-capability.ts");
  },
  "an older execution-event tooling pin": (value) => {
    value.workflow = value.workflow.replace("node-version: 24.21.0", "node-version: 24.20.0");
  },
  "a dropped mandatory entry file": (value) => {
    value.manifest.scripts["check:critical"] = value.manifest.scripts["check:critical"].replace(
      " test/operator-authority.test.mjs",
      "",
    );
  },
  "a detached critical test command": (value) => {
    value.manifest.scripts["check:corpus"] = "node scripts/run-corpus-tests.mjs";
  },
  "a removed mandatory identity": (value) => {
    value.requiredNodeTests.required.pop();
  },
  "a blanket critical test exception": (value) => {
    value.requiredNodeTests.exceptions.push({
      ...value.requiredNodeTests.required[0],
      status: "skipped",
      reason: "skip all tests",
      applicability: { platforms: ["linux", "darwin", "win32"] },
    });
  },
  "an unclassified source suffix": (value) => {
    value.trackedPaths.push("other/new-source.jsx");
  },
  "hidden formatter inputs": (value) => {
    value.formatterIgnore = "lib/**";
  },
  "repository ignores hiding maintained inputs": (value) => {
    value.gitignore += "lib/**\n";
  },
  "a missing Stack pin": (value) => {
    delete value.manifest.devDependencies["stack-toolchain"];
  },
  "a ranged Stack pin": (value) => {
    value.manifest.devDependencies["stack-toolchain"] = "^0.1.1";
  },
  "an installed Stack version mismatch": (value) => {
    value.installedStack.version = "999.0.0";
  },
  "an installed Stack with the wrong name": (value) => {
    value.installedStack.name = "other";
  },
  "an unsupported public Stack manifest schema": (value) => {
    value.installedStack.toolchainManifest.schemaVersion = 2;
  },
  "an unsupported Stack config schema": (value) => {
    value.toolchainConfig.schemaVersion = 2;
  },
  "a second direct linter pin": (value) => {
    value.manifest.devDependencies.oxlint = "1.85.0";
  },
  "an empty Stack lint scope": (value) => {
    value.toolchainConfig.lint.paths = [];
  },
  "a dropped authored Stack lint input": (value) => {
    value.toolchainConfig.lint.paths.pop();
  },
  "a weakened Stack lint configuration": (value) => {
    value.toolchainConfig.lint.config = "local.json";
  },
  "a detached Stack typecheck": (value) => {
    value.manifest.scripts.typecheck = "true";
  },
  "a second ordinary TypeScript project": (value) => {
    value.toolchainConfig.typecheck.projects.push("tsconfig.local.json");
  },
  "a weakened ordinary TypeScript scope": (value) => {
    value.tsconfig.include = ["test/type-projections.ts"];
  },
  "a no-op format route": (value) => {
    value.manifest.scripts["format:check"] = "true";
  },
  "a detached format gate": (value) => {
    value.manifest.scripts.verify = value.manifest.scripts.verify.replace(
      " && pnpm format:check",
      "",
    );
  },
  "a dropped maintained format input": (value) => {
    value.toolchainConfig.format.paths.pop();
  },
  "a generated format input": (value) => {
    value.toolchainConfig.format.paths.push("lib/unicode-case-fold-17.mjs");
  },
  "a frozen normative format input": (value) => {
    value.toolchainConfig.format.paths.push("spec/core.md");
  },
  "a missing Foundation pin": (value) => {
    delete value.manifest.devDependencies["@agent-teams/engineering-foundation"];
  },
  "a ranged Foundation pin": (value) => {
    value.manifest.devDependencies["@agent-teams/engineering-foundation"] = "^3.0.0";
  },
  "a no-op scope route": (value) => {
    value.manifest.scripts["quality:scope"] = "true";
  },
  "a detached fast route": (value) => {
    value.manifest.scripts["check:fast"] = "pnpm check:index";
  },
  "a removed lint route": (value) => {
    value.manifest.scripts.verify =
      "pnpm check:fast && pnpm check:generated && pnpm check:package && pnpm check:conformance";
  },
  "a removed existing package gate": (value) => {
    value.manifest.scripts.verify = value.manifest.scripts.verify.replace(
      " && pnpm check:package",
      "",
    );
  },
  "a generated artifact reclassified as production": (value) => {
    value.profile.sourceUniverse.generatedFiles.shift();
  },
  "an extra generated lib file": (value) => {
    value.profile.sourceUniverse.generatedFiles.push("lib/binding-selection.mjs");
  },
  "an arbitrary generated root": (value) => {
    value.profile.sourceUniverse.generatedRoots.push("lib");
  },
  "changed included lint roles": (value) => {
    value.profile.lint.includedRoles = ["production"];
  },
  "a local lint rule": (value) => {
    value.lintConfig.rules = { "no-eval": "off" };
  },
  "a local lint override": (value) => {
    value.lintConfig.overrides = [];
  },
  "a local lint ignore": (value) => {
    value.lintConfig.ignorePatterns = ["lib/**"];
  },
  "a replaced Foundation preset": (value) => {
    value.lintConfig.extends = ["./local.json"];
  },
  "a false typed coverage claim": (value) => {
    value.profile.typedCoverage = true;
  },
  "lost generated provenance": (value) => {
    value.manifest.scripts["check:generated"] = "true";
  },
  "a removed CI verify route": (value) => {
    value.workflow = value.workflow.replace("- run: pnpm verify", "- run: pnpm check:fast");
  },
};

for (const [name, mutate] of Object.entries(mutations)) {
  test(`quality activation rejects ${name}`, () => {
    const value = structuredClone(accepted);
    mutate(value);
    assert.throws(() => assertQualityAdoption(value), assert.AssertionError);
  });
}

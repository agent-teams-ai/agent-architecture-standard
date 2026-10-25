import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { parseDocument } from "yaml";

const execFileAsync = promisify(execFile);

const PROFILE_PATH = "architecture/foundation/javascript-quality-profile.json";
const FOUNDATION_PRESET = "./node_modules/stack-toolchain/presets/oxlint/type-aware.json";
const FROZEN_FORMAT_ROOTS = [
  "generated",
  "decisions",
  "spec",
  "profiles",
  "registries",
  "schemas",
  "vectors",
  "docs/research",
  "docs/decisions",
  "conformance/candidates",
];
const FROZEN_FORMAT_FILES = [
  "artifacts.json",
  "version-matrix.json",
  "SOURCE.md",
  "conformance/artifact-baseline.json",
];
const SOURCE_SUFFIXES = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"];
const EXACT_SCRIPTS = {
  "check:critical":
    "agent-teams-node-test --contract architecture/foundation/required-node-tests.json -- test/strict-json.test.mjs test/operator-authority.test.mjs",
  "check:corpus": "pnpm check:critical && node scripts/run-corpus-tests.mjs",
  "quality:source":
    "agent-teams-foundation check && agent-teams-foundation assert-dev-only && agent-teams-foundation assert-registry",
  "quality:scope":
    "node --test scripts/check-quality-adoption.test.mjs scripts/foundation-installed.test.mjs && pnpm quality:source",
  "quality:lint": "node scripts/run-quality-lint.mjs",
  "check:fast":
    "pnpm quality:scope && pnpm check:index && pnpm check:schemas && pnpm check:corpus && pnpm typecheck",
  verify:
    "pnpm check:fast && pnpm check:generated && pnpm check:package && pnpm check:conformance && pnpm quality:lint && pnpm format:check",
  "format:check": "stack-toolchain format:check",
};

const inside = (path, root) => path === root || path.startsWith(`${root}/`);
const isTrackedSource = (path) => SOURCE_SUFFIXES.some((suffix) => path.endsWith(suffix));

function sourceKind(path) {
  if (path.endsWith(".d.ts") || path.endsWith(".d.mts") || path.endsWith(".d.cts")) {
    return "declaration";
  }
  if ([".ts", ".tsx", ".mts", ".cts"].some((suffix) => path.endsWith(suffix))) {
    return "typescript";
  }
  return "javascript";
}

export function classifyTrackedSources(paths, profile) {
  const source = profile.sourceUniverse;
  const classified = [];
  const unclassified = [];
  for (const path of [...new Set(paths)].filter(isTrackedSource).toSorted()) {
    let role;
    if (
      source.generatedFiles.includes(path) ||
      source.generatedRoots.some((root) => inside(path, root))
    ) {
      role = "generated";
    } else if (source.fixtureRoots.some((root) => inside(path, root))) {
      role = "fixture";
    } else if (
      source.testRoots.some((root) => inside(path, root)) ||
      /\.test\.[cm]?[jt]sx?$/u.test(path)
    ) {
      role = "test";
    } else if (source.productionRoots.some((root) => inside(path, root))) {
      role = "production";
    } else if (source.toolingRoots.some((root) => inside(path, root))) {
      role = "tooling";
    }
    if (role === undefined) {
      unclassified.push(path);
    } else {
      classified.push({ path, role, kind: sourceKind(path) });
    }
  }
  return { classified, unclassified };
}

export function deriveLintPaths(census, profile) {
  return census.classified
    .filter((source) => profile.lint.includedRoles.includes(source.role))
    .map((source) => source.path)
    .toSorted();
}

export function deriveFormatPaths(trackedPaths, artifactPaths) {
  const protectedPaths = new Set([
    ...artifactPaths,
    ...FROZEN_FORMAT_FILES,
    "lib/unicode-case-fold-17.mjs",
    "lib/unicode-normalization-17.mjs",
  ]);
  return trackedPaths
    .filter(
      (path) =>
        /\.(?:[cm]?[jt]sx?|json|ya?ml|md)$/u.test(path) &&
        !protectedPaths.has(path) &&
        !FROZEN_FORMAT_ROOTS.some((root) => inside(path, root)) &&
        !path.endsWith("pnpm-lock.yaml"),
    )
    .toSorted();
}

function assertConfig(lintConfig) {
  assert.deepEqual(Object.keys(lintConfig).toSorted(), ["extends", "options"].toSorted());
  assert.deepEqual(lintConfig.extends, [FOUNDATION_PRESET]);
  assert.deepEqual(lintConfig.options, {
    reportUnusedDisableDirectives: "error",
    respectEslintDisableDirectives: false,
  });
}

function assertWorkflow(workflow) {
  assert.match(workflow, /node: \[26, 24\]/u, "Node 26 must be the default matrix lane");
  assert.match(
    workflow,
    /- node: 26\s+node-version: 26\.11\.1\s+job-name: reproducibility\s+artifact-suffix: (['"])\1/u,
    "default verification and evidence must use Node 26.11.1",
  );
  assert.match(
    workflow,
    /- node: 24\s+node-version: 24\.21\.0\s+job-name: Node 24 compatibility reproducibility\s+artifact-suffix: (['"])-node24\1/u,
    "Node 24 compatibility must retain verification and separate evidence",
  );
  assert.match(
    workflow,
    /node26-conformance:[\s\S]*node-version: 26\.11\.1/u,
    "private conformance must use the default Node 26.11.1 runtime",
  );
  assert.equal(
    (workflow.match(/^\s*- run: pnpm verify\s*$/gmu) ?? []).length,
    1,
    "CI must execute pnpm verify exactly once",
  );
  for (const splitGate of [
    "check:fast",
    "check:generated",
    "check:package",
    "check:conformance",
    "quality:lint",
  ]) {
    assert.doesNotMatch(
      workflow,
      new RegExp(`^\\s*- run: pnpm ${splitGate}\\s*$`, "mu"),
      `CI must not split ${splitGate} from verify`,
    );
  }
  assert.equal(
    (workflow.match(/ci-head-evidence\.mjs/gmu) ?? []).length,
    2,
    "CI must retain pre/post exact-head evidence",
  );
  assert.match(workflow, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/u);
}

export function assertStackBinding(manifest, installedStack) {
  const pin = manifest.devDependencies?.["stack-toolchain"];
  assert.equal(typeof pin, "string", "Stack needs one canonical stable exact dev pin");
  assert.match(
    pin,
    /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u,
    "Stack needs one canonical stable exact dev pin",
  );
  assert.ok(
    pin.split(".").every((part) => Number.isSafeInteger(Number(part))),
    "Stack pin must be valid registry semver",
  );
  for (const section of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    assert.equal(
      Object.hasOwn(manifest[section] ?? {}, "stack-toolchain"),
      false,
      "Stack must be declared only in root devDependencies",
    );
  }
  assert.equal(installedStack?.name, "stack-toolchain", "installed Stack package identity");
  assert.equal(installedStack.version, pin, "installed Stack must match the root dev pin");
  assert.equal(
    installedStack.toolchainManifest?.schemaVersion,
    1,
    "supported public Stack manifest schema",
  );
}

function assertContainedStackPath(parent, child) {
  const path = relative(parent, child);
  assert.ok(
    path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path),
    "Stack public metadata must resolve inside consumer node_modules and its package",
  );
}

export async function readStackInstallation(root) {
  const consumer = await realpath(fileURLToPath(root));
  const require = createRequire(join(consumer, "package.json"));
  const metadataPath = await realpath(require.resolve("stack-toolchain/package.json"));
  assertContainedStackPath(join(consumer, "node_modules"), metadataPath);
  const manifestPath = await realpath(require.resolve("stack-toolchain/toolchain-manifest.json"));
  assertContainedStackPath(dirname(metadataPath), manifestPath);
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  return {
    name: metadata.name,
    version: metadata.version,
    toolchainManifest: JSON.parse(await readFile(manifestPath, "utf8")),
  };
}

export function assertQualityAdoption({
  manifest,
  profile,
  lintConfig,
  trackedPaths,
  workflow,
  requiredNodeTests,
  foundationConfig,
  sourcePolicy,
  toolchainConfig,
  tsconfig,
  artifactPaths,
  gitignore,
  formatterIgnore,
  installedStack,
  workspace,
}) {
  assert.equal(manifest.devDependencies?.["@agent-teams/engineering-foundation"], "3.0.0");
  assertStackBinding(manifest, installedStack);
  assert.deepEqual(
    workspace.allowBuilds,
    { bun: false },
    "only Bun's build script is explicitly denied",
  );
  assert.equal(
    workspace.strictDepBuilds,
    true,
    "unreviewed dependency scripts must fail installation",
  );
  for (const name of [
    "dangerouslyAllowAllBuilds",
    "ignoreScripts",
    "onlyBuiltDependencies",
    "onlyBuiltDependenciesFile",
    "neverBuiltDependencies",
    "ignoredBuiltDependencies",
  ]) {
    assert.equal(
      workspace[name],
      undefined,
      "no broad build approval, bypass or obsolete build policy",
    );
  }
  assert.equal(manifest.devDependencies?.yaml, "2.9.1");
  assert.equal(manifest.devDependencies?.oxlint, undefined, "Stack owns the linter pin");
  assert.equal(
    manifest.devDependencies?.typescript,
    "7.0.2",
    "installed package verification retains its compiler",
  );
  assert.equal(profile.schemaVersion, 1);
  assert.deepEqual(profile.adoption, {
    mode: "active-foundation",
    foundationVersion: "3.0.0",
    publicPreset: FOUNDATION_PRESET,
    sourceCoverage: "consumer-exact-js-census",
  });
  assert.deepEqual(profile.sourceUniverse, {
    productionRoots: ["lib"],
    toolingRoots: ["scripts", "conformance/private"],
    testRoots: ["test", "conformance/test"],
    fixtureRoots: ["conformance/candidates"],
    generatedRoots: ["generated"],
    generatedFiles: ["lib/unicode-case-fold-17.mjs", "lib/unicode-normalization-17.mjs"],
    trackedExtensions: SOURCE_SUFFIXES,
  });
  assert.deepEqual(profile.lint, {
    configPath: ".oxlintrc.json",
    includedRoles: ["production", "tooling"],
  });
  assert.deepEqual(foundationConfig, {
    schemaVersion: 1,
    project: { id: "agent-architecture-standard" },
    capabilities: {
      "architecture.source-dependencies": {
        configPath: "architecture/foundation/source-dependencies.yaml",
      },
    },
  });
  assert.equal(sourcePolicy.schemaVersion, 3);
  assert.equal(sourcePolicy.rootPackage, true);
  assert.deepEqual(sourcePolicy.packageRoots, []);
  assert.deepEqual(sourcePolicy.governedRoots, ["lib", "scripts", "conformance/private"]);
  assert.deepEqual(
    sourcePolicy.boundaries.map(({ id, roots }) => ({ id, roots })),
    [
      { id: "private-verifier", roots: ["lib"] },
      { id: "repository-tooling", roots: ["scripts"] },
      { id: "private-conformance", roots: ["conformance/private"] },
    ],
  );
  assert.equal(profile.typedCoverage, false, "JavaScript lint cannot claim typed coverage");
  assert.deepEqual(
    requiredNodeTests,
    {
      schemaVersion: 1,
      required: [
        {
          file: "test/strict-json.test.mjs",
          names: ["duplicate decoded keys are rejected"],
          kind: "test",
        },
        {
          file: "test/strict-json.test.mjs",
          names: ["decimal spelling is validated before binary64 rounding"],
          kind: "test",
        },
        {
          file: "test/operator-authority.test.mjs",
          names: ["oversized admission fails before copying, parsing, or target resolution"],
          kind: "test",
        },
        {
          file: "test/operator-authority.test.mjs",
          names: [
            "resolver coordinates reject mutation, non-NFC paths, forged cohorts, and request resolver lookalikes",
          ],
          kind: "test",
        },
      ],
      exceptions: [],
    },
    "critical identity inventory and platform applicability must stay exact",
  );
  assertConfig(lintConfig);

  for (const [name, command] of Object.entries(EXACT_SCRIPTS)) {
    assert.equal(manifest.scripts?.[name], command, `${name} must stay canonical`);
  }
  assert.equal(manifest.scripts?.[profile.scripts.typecheck], "stack-toolchain typecheck");
  assert.equal(manifest.scripts?.[profile.scripts.generate], "node scripts/generate.mjs");
  assert.equal(
    manifest.scripts?.[profile.scripts.generatedCheck],
    "node scripts/check-clean-generation.mjs",
  );

  const census = classifyTrackedSources(trackedPaths, profile);
  assert.deepEqual(
    census.unclassified,
    [],
    `unclassified JS/TS source: ${census.unclassified.join(", ")}`,
  );
  assert.deepEqual(
    census.classified.filter(
      (source) => ["production", "tooling"].includes(source.role) && source.kind === "typescript",
    ),
    [],
    "TypeScript production requires an explicit typed quality adoption",
  );
  for (const role of ["production", "tooling", "test", "fixture", "generated"]) {
    assert.ok(
      census.classified.some((source) => source.role === role),
      `${role} source census is empty`,
    );
  }
  const lintPaths = deriveLintPaths(census, profile);
  assert.ok(lintPaths.length > 0, "authored lint source census is empty");
  assert.ok(
    census.classified.some(
      (source) => source.role === "generated" && source.kind === "declaration",
    ),
  );
  assert.ok(
    census.classified.some((source) => source.role === "generated" && source.kind === "javascript"),
  );
  assert.ok(
    census.classified.some((source) => source.role === "test" && source.kind === "typescript"),
  );
  assert.deepEqual(
    toolchainConfig,
    {
      schemaVersion: 1,
      profile: "typescript-node",
      typecheck: { projects: ["tsconfig.json"] },
      lint: { config: ".oxlintrc.json", paths: lintPaths },
      format: { paths: deriveFormatPaths(trackedPaths, artifactPaths) },
    },
    "Stack scopes must match the independent source and maintained-file census",
  );
  assert.ok(toolchainConfig.format.paths.length > 0, "maintained format census is empty");
  assert.equal(
    gitignore,
    ".DS_Store\nnode_modules/\ncoverage/\ndist/\n*.log\n*.tgz\n.package-check/\n",
    "review format exclusions before changing repository ignores",
  );
  assert.equal(
    formatterIgnore,
    undefined,
    "a formatter ignore file must not hide maintained inputs",
  );
  assert.deepEqual(
    tsconfig,
    {
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        noEmit: true,
        strict: true,
        target: "ES2024",
        skipLibCheck: true,
      },
      include: ["generated/**/*.d.ts", "test/**/*.ts"],
    },
    "ordinary TypeScript scope and strictness must remain intact",
  );
  assertWorkflow(workflow);
  return census;
}

export async function readQualityAdoption(root = new URL("../", import.meta.url)) {
  const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));
  const readYaml = async (path) => {
    const document = parseDocument(await readFile(new URL(path, root), "utf8"), {
      strict: true,
      uniqueKeys: true,
    });
    assert.equal(document.errors.length, 0, `invalid YAML configuration: ${path}`);
    return document.toJS();
  };
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: new URL(".", root),
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  const trackedPaths = [...new Set(stdout.split("\0").filter(Boolean))];
  for (const path of trackedPaths.filter(isTrackedSource)) {
    const location = new URL(path, root);
    assert.ok((await lstat(location)).isFile(), `declared source is not a regular file: ${path}`);
    await readFile(location);
  }
  return {
    foundationConfig: await readYaml("foundation.config.yaml"),
    sourcePolicy: await readYaml("architecture/foundation/source-dependencies.yaml"),
    manifest: await readJson("package.json"),
    installedStack: await readStackInstallation(root),
    workspace: await readYaml("pnpm-workspace.yaml"),
    gitignore: await readFile(new URL(".gitignore", root), "utf8"),
    formatterIgnore: await readFile(new URL(".prettierignore", root), "utf8").catch((error) => {
      if (error.code === "ENOENT") {
        return;
      }
      throw error;
    }),
    toolchainConfig: await readJson("toolchain.config.json"),
    tsconfig: await readJson("tsconfig.json"),
    artifactPaths: (await readJson("artifacts.json")).artifacts.map((artifact) => artifact.path),
    profile: await readJson(PROFILE_PATH),
    requiredNodeTests: await readJson("architecture/foundation/required-node-tests.json"),
    lintConfig: await readJson(".oxlintrc.json"),
    trackedPaths,
    workflow: await readFile(new URL(".github/workflows/verify.yml", root), "utf8"),
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const census = assertQualityAdoption(await readQualityAdoption());
  const counts = Object.fromEntries(
    ["production", "tooling", "test", "fixture", "generated"].map((role) => [
      role,
      census.classified.filter((source) => source.role === role).length,
    ]),
  );
  console.log(`AAS quality scope verified: ${JSON.stringify(counts)}`);
}

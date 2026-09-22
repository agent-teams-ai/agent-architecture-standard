import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PROFILE_PATH = "architecture/foundation/javascript-quality-profile.json";
const FOUNDATION_PRESET = "./node_modules/@agent-teams/engineering-foundation/presets/oxlint/node.json";
const SOURCE_SUFFIXES = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"];
const EXACT_SCRIPTS = {
  "quality:scope": "node --test scripts/check-quality-adoption.test.mjs",
  "quality:lint": "node scripts/run-quality-lint.mjs",
  "check:fast": "pnpm quality:scope && pnpm check:index && pnpm check:schemas && pnpm check:corpus && pnpm typecheck",
  verify: "pnpm check:fast && pnpm check:generated && pnpm check:package && pnpm check:conformance && pnpm quality:lint"
};

const inside = (path, root) => path === root || path.startsWith(`${root}/`);
const isTrackedSource = path => SOURCE_SUFFIXES.some(suffix => path.endsWith(suffix));

function sourceKind(path) {
  if (path.endsWith(".d.ts") || path.endsWith(".d.mts") || path.endsWith(".d.cts")) {return "declaration";}
  if ([".ts", ".tsx", ".mts", ".cts"].some(suffix => path.endsWith(suffix))) {return "typescript";}
  return "javascript";
}

export function classifyTrackedSources(paths, profile) {
  const source = profile.sourceUniverse;
  const classified = [];
  const unclassified = [];
  for (const path of [...new Set(paths)].filter(isTrackedSource).toSorted()) {
    let role;
    if (source.generatedFiles.includes(path) || source.generatedRoots.some(root => inside(path, root))) {role = "generated";}
    else if (source.fixtureRoots.some(root => inside(path, root))) {role = "fixture";}
    else if (source.testRoots.some(root => inside(path, root)) || /\.test\.[cm]?[jt]sx?$/u.test(path)) {role = "test";}
    else if (source.productionRoots.some(root => inside(path, root))) {role = "production";}
    else if (source.toolingRoots.some(root => inside(path, root))) {role = "tooling";}
    if (role === undefined) {unclassified.push(path);}
    else {classified.push({ path, role, kind: sourceKind(path) });}
  }
  return { classified, unclassified };
}

export function deriveLintPaths(census, profile) {
  return census.classified
    .filter(source => profile.lint.includedRoles.includes(source.role))
    .map(source => source.path)
    .toSorted();
}

function assertConfig(lintConfig) {
  assert.deepEqual(Object.keys(lintConfig).toSorted(), ["$schema", "extends", "options"].toSorted());
  assert.equal(lintConfig.$schema, "./node_modules/oxlint/configuration_schema.json");
  assert.deepEqual(lintConfig.extends, [FOUNDATION_PRESET]);
  assert.deepEqual(lintConfig.options, {
    reportUnusedDisableDirectives: "error",
    respectEslintDisableDirectives: false
  });
}

function assertWorkflow(workflow) {
  assert.equal((workflow.match(/^\s*- run: pnpm verify\s*$/gmu) ?? []).length, 1, "CI must execute pnpm verify exactly once");
  for (const splitGate of ["check:fast", "check:generated", "check:package", "check:conformance", "quality:lint"]) {
    assert.doesNotMatch(workflow, new RegExp(`^\\s*- run: pnpm ${splitGate}\\s*$`, "mu"), `CI must not split ${splitGate} from verify`);
  }
  assert.equal((workflow.match(/ci-head-evidence\.mjs/gmu) ?? []).length, 2, "CI must retain pre/post exact-head evidence");
  assert.match(workflow, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/u);
}

export function assertQualityAdoption({ manifest, profile, lintConfig, trackedPaths, workflow }) {
  assert.equal(manifest.devDependencies?.["@agent-teams/engineering-foundation"], "1.5.0");
  assert.equal(manifest.devDependencies?.oxlint, "1.85.0");
  assert.equal(profile.schemaVersion, 1);
  assert.deepEqual(profile.adoption, {
    mode: "active-foundation",
    foundationVersion: "1.5.0",
    publicPreset: FOUNDATION_PRESET,
    sourceCoverage: "consumer-exact-js-census"
  });
  assert.deepEqual(profile.sourceUniverse, {
    productionRoots: ["lib"],
    toolingRoots: ["scripts", "conformance/private"],
    testRoots: ["test", "conformance/test"],
    fixtureRoots: ["conformance/candidates"],
    generatedRoots: ["generated"],
    generatedFiles: ["lib/unicode-case-fold-17.mjs", "lib/unicode-normalization-17.mjs"],
    trackedExtensions: SOURCE_SUFFIXES
  });
  assert.deepEqual(profile.lint, {
    configPath: ".oxlintrc.json",
    includedRoles: ["production", "tooling"]
  });
  assert.equal(profile.typedCoverage, false, "JavaScript lint cannot claim typed coverage");
  assertConfig(lintConfig);

  for (const [name, command] of Object.entries(EXACT_SCRIPTS)) {assert.equal(manifest.scripts?.[name], command, `${name} must stay canonical`);}
  assert.equal(manifest.scripts?.[profile.scripts.typecheck], "tsc --noEmit");
  assert.equal(manifest.scripts?.[profile.scripts.generate], "node scripts/generate.mjs");
  assert.equal(manifest.scripts?.[profile.scripts.generatedCheck], "node scripts/check-clean-generation.mjs");

  const census = classifyTrackedSources(trackedPaths, profile);
  assert.deepEqual(census.unclassified, [], `unclassified JS/TS source: ${census.unclassified.join(", ")}`);
  for (const role of ["production", "tooling", "test", "fixture", "generated"]) {
    assert.ok(census.classified.some(source => source.role === role), `${role} source census is empty`);
  }
  const lintPaths = deriveLintPaths(census, profile);
  assert.ok(lintPaths.length > 0, "authored lint source census is empty");
  assert.ok(census.classified.some(source => source.role === "generated" && source.kind === "declaration"));
  assert.ok(census.classified.some(source => source.role === "generated" && source.kind === "javascript"));
  assert.ok(census.classified.some(source => source.role === "test" && source.kind === "typescript"));
  assertWorkflow(workflow);
  return census;
}

export async function readQualityAdoption(root = new URL("../", import.meta.url)) {
  const readJson = async path => JSON.parse(await readFile(new URL(path, root), "utf8"));
  const { stdout } = await execFileAsync("git", ["ls-files", "-z"], {
    cwd: new URL(".", root),
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024
  });
  return {
    manifest: await readJson("package.json"),
    profile: await readJson(PROFILE_PATH),
    lintConfig: await readJson(".oxlintrc.json"),
    trackedPaths: stdout.split("\0").filter(Boolean),
    workflow: await readFile(new URL(".github/workflows/verify.yml", root), "utf8")
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const census = assertQualityAdoption(await readQualityAdoption());
  const counts = Object.fromEntries(["production", "tooling", "test", "fixture", "generated"].map(role => [role, census.classified.filter(source => source.role === role).length]));
  console.log(`AAS quality scope verified: ${JSON.stringify(counts)}`);
}

import assert from "node:assert/strict";
import test from "node:test";
import { assertQualityAdoption, classifyTrackedSources, deriveLintPaths, readQualityAdoption } from "./check-quality-adoption.mjs";
import { selectOxlintFiles } from "./run-quality-lint.mjs";

const accepted = await readQualityAdoption();

test("quality activation retains the accepted Foundation contract", () => {
  assertQualityAdoption(accepted);
});

test("generated JavaScript and declarations retain provenance instead of authored-source status", () => {
  const census = classifyTrackedSources(accepted.trackedPaths, accepted.profile);
  for (const path of ["lib/unicode-case-fold-17.mjs", "lib/unicode-normalization-17.mjs", "generated/artifacts.d.ts"]) {
    assert.ok(census.classified.some(source => source.path === path && source.role === "generated"), `${path} must be generated`);
  }
  assert.ok(census.classified.some(source => source.path === "test/type-projections.ts" && source.role === "test"));
});

test("lint inputs are exactly production and tooling and match Oxlint selection", async () => {
  const census = assertQualityAdoption(accepted);
  const lintPaths = deriveLintPaths(census, accepted.profile);
  for (const path of ["lib/binding-selection.mjs", "scripts/check-quality-adoption.mjs", "conformance/private/runner.mjs"]) {
    assert.ok(lintPaths.includes(path), `${path} must be linted`);
  }
  for (const path of [
    "lib/unicode-case-fold-17.mjs",
    "lib/unicode-normalization-17.mjs",
    "scripts/check-quality-adoption.test.mjs",
    "scripts/github-heading-slug.test.mjs"
  ]) {
    assert.ok(!lintPaths.includes(path), `${path} must not be linted`);
  }
  assert.deepEqual(await selectOxlintFiles(lintPaths), lintPaths);
});

const mutations = {
  "an unclassified source suffix": value => { value.trackedPaths.push("other/new-source.jsx"); },
  "a missing Foundation pin": value => { delete value.manifest.devDependencies["@agent-teams/engineering-foundation"]; },
  "a ranged Foundation pin": value => { value.manifest.devDependencies["@agent-teams/engineering-foundation"] = "^1.5.0"; },
  "a no-op scope route": value => { value.manifest.scripts["quality:scope"] = "true"; },
  "a detached fast route": value => { value.manifest.scripts["check:fast"] = "pnpm check:index"; },
  "a removed lint route": value => { value.manifest.scripts.verify = "pnpm check:fast && pnpm check:generated && pnpm check:package && pnpm check:conformance"; },
  "a removed existing package gate": value => { value.manifest.scripts.verify = value.manifest.scripts.verify.replace(" && pnpm check:package", ""); },
  "a generated artifact reclassified as production": value => { value.profile.sourceUniverse.generatedFiles.shift(); },
  "an extra generated lib file": value => { value.profile.sourceUniverse.generatedFiles.push("lib/binding-selection.mjs"); },
  "an arbitrary generated root": value => { value.profile.sourceUniverse.generatedRoots.push("lib"); },
  "changed included lint roles": value => { value.profile.lint.includedRoles = ["production"]; },
  "a local lint rule": value => { value.lintConfig.rules = { "no-eval": "off" }; },
  "a local lint override": value => { value.lintConfig.overrides = []; },
  "a local lint ignore": value => { value.lintConfig.ignorePatterns = ["lib/**"]; },
  "a replaced Foundation preset": value => { value.lintConfig.extends = ["./local.json"]; },
  "a false typed coverage claim": value => { value.profile.typedCoverage = true; },
  "lost generated provenance": value => { value.manifest.scripts["check:generated"] = "true"; },
  "a removed CI verify route": value => { value.workflow = value.workflow.replace("- run: pnpm verify", "- run: pnpm check:fast"); }
};

for (const [name, mutate] of Object.entries(mutations)) {
  test(`quality activation rejects ${name}`, () => {
    const value = structuredClone(accepted);
    mutate(value);
    assert.throws(() => assertQualityAdoption(value), assert.AssertionError);
  });
}

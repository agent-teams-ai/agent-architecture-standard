import assert from "node:assert/strict";
import test from "node:test";
import { assertQualityAdoption, classifyTrackedSources, readQualityAdoption } from "./check-quality-adoption.mjs";

const accepted = await readQualityAdoption();

test("quality activation retains the accepted Foundation contract", () => {
  assertQualityAdoption(accepted);
});

test("generated declarations retain provenance instead of authored-source status", () => {
  const census = classifyTrackedSources(accepted.trackedPaths, accepted.profile);
  assert.ok(census.classified.some(source => source.path === "generated/artifacts.d.ts" && source.role === "generated"));
  assert.ok(census.classified.some(source => source.path === "test/type-projections.ts" && source.role === "test"));
});

const mutations = {
  "an unclassified source suffix": value => { value.trackedPaths.push("other/new-source.jsx"); },
  "a missing Foundation pin": value => { delete value.manifest.devDependencies["@agent-teams/engineering-foundation"]; },
  "a ranged Foundation pin": value => { value.manifest.devDependencies["@agent-teams/engineering-foundation"] = "^1.5.0"; },
  "a no-op scope route": value => { value.manifest.scripts["quality:scope"] = "true"; },
  "a detached fast route": value => { value.manifest.scripts["check:fast"] = "pnpm check:index"; },
  "a removed lint route": value => { value.manifest.scripts.verify = "pnpm check:fast && pnpm check:generated && pnpm check:package && pnpm check:conformance"; },
  "a removed existing package gate": value => { value.manifest.scripts.verify = value.manifest.scripts.verify.replace(" && pnpm check:package", ""); },
  "an uncovered tooling root": value => { value.profile.lint.targets = ["lib", "scripts"]; },
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

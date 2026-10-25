import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runCommand } from "stack-toolchain";
import { promisify } from "node:util";
import {
  assertQualityAdoption,
  deriveLintPaths,
  readQualityAdoption,
} from "./check-quality-adoption.mjs";

const execFileAsync = promisify(execFile);
const root = new URL("../", import.meta.url);
const stackRequire = createRequire(import.meta.resolve("stack-toolchain/package.json"));
const oxlintEntrypoint = fileURLToPath(
  new URL("bin/oxlint", pathToFileURL(stackRequire.resolve("oxlint/package.json"))),
);
const maxBuffer = 2 * 1024 * 1024;

const commonArguments = (paths) => [
  "--config",
  ".oxlintrc.json",
  "--disable-nested-config",
  "--",
  ...paths,
];

export function parseOxlintDebugFiles(stdout) {
  return stdout.split(/\r?\n/u).filter(Boolean).toSorted();
}

export async function selectOxlintFiles(paths) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [oxlintEntrypoint, "--debug=files", ...commonArguments(paths)],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer,
    },
  );
  return parseOxlintDebugFiles(stdout);
}

export async function verifyOxlintSelection(paths) {
  const selected = await selectOxlintFiles(paths);
  assert.deepEqual(
    selected,
    paths,
    "Oxlint file selection differs from the production+tooling census",
  );
  return selected;
}

export async function runQualityLint() {
  const adoption = await readQualityAdoption(root);
  const census = assertQualityAdoption(adoption);
  const paths = deriveLintPaths(census, adoption.profile);
  await verifyOxlintSelection(paths);
  const report = await runCommand({
    command: "lint",
    cwd: fileURLToPath(root),
    signal: new AbortController().signal,
  });
  if (typeof report.details?.stdout === "string") {
    process.stdout.write(report.details.stdout);
  }
  if (typeof report.details?.stderr === "string") {
    process.stderr.write(report.details.stderr);
  }
  assert.equal(report.exitCode, 0, JSON.stringify(report));
  assert.match(
    report.details.stdout,
    /^Found 0 warnings and 0 errors\.$/mu,
    "lint must report zero warnings and errors",
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await runQualityLint();
}

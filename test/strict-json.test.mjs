import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseStrictJson } from "../lib/strict-json.mjs";
import { canonicalJson, canonicalJsonBytes } from "../lib/canonical-json.mjs";

const vectorRoot = new URL("../", import.meta.url);

const reject = async (file, code, limits) => {
  const bytes = await readFile(new URL(`../vectors/json/negative/${file}`, import.meta.url));
  assert.throws(
    () => parseStrictJson(bytes, limits),
    (error) => error.code === code,
  );
};
test("safe objects use a null prototype recursively", async () => {
  const parsed = parseStrictJson(
    await readFile(new URL("../vectors/json/positive/null-prototype.json", import.meta.url)),
  );
  assert.equal(Object.getPrototypeOf(parsed), null);
  assert.equal(Object.getPrototypeOf(parsed.safe), null);
});
test("duplicate decoded keys are rejected", async () => {
  await reject("duplicate-key.json", "aas.json.duplicate-key");
  await reject("duplicate-escaped-key.json", "aas.json.duplicate-key");
});
test("prototype-sensitive keys remain inert on null-prototype objects", async () => {
  const parsed = parseStrictJson(
    await readFile(new URL("../vectors/json/positive/prototype-keys.json", import.meta.url)),
  );
  assert.equal(Object.getPrototypeOf(parsed), null);
  assert.deepEqual(Object.keys(parsed).sort(), ["__proto__", "constructor", "prototype"]);
  assert.equal(parsed.__proto__.polluted, true);
  assert.equal({}.polluted, undefined);
});
test("valid JSON spellings that decode to safe integers are accepted", () => {
  const parsed = parseStrictJson(
    Buffer.from(
      '{"decimal":1.0,"exponent":1e0,"negative":-2.00e+1,"zeroPadded":1e000000000,"zeroPaddedNegative":10e-000000001}',
    ),
  );
  assert.deepEqual(
    { ...parsed },
    { decimal: 1, exponent: 1, negative: -20, zeroPadded: 1, zeroPaddedNegative: 1 },
  );
});
test("non-integer and negative-zero numbers are rejected", async () => {
  await reject("fraction.json", "aas.json.invalid-number");
  await reject("negative-zero.json", "aas.json.invalid-number");
});
test("depth and encoded-size ceilings are deterministic", async () => {
  await reject("depth.json", "aas.json.depth-exceeded", { maxBytes: 1000, maxDepth: 3 });
  const exact = Buffer.from('{"v":1}');
  assert.equal(parseStrictJson(exact, { maxBytes: exact.byteLength, maxDepth: 1 }).v, 1);
  assert.throws(
    () => parseStrictJson(exact, { maxBytes: exact.byteLength - 1, maxDepth: 1 }),
    (error) => error.code === "aas.json.input-too-large",
  );
  assert.doesNotThrow(() => parseStrictJson(Buffer.from("[[[]]]"), { maxBytes: 6, maxDepth: 3 }));
  assert.throws(
    () => parseStrictJson(Buffer.from("[[[[]]]]"), { maxBytes: 8, maxDepth: 3 }),
    (error) => error.code === "aas.json.depth-exceeded",
  );
});
test("deep caller-bounded input uses an explicit stack without losing syntax guarantees", () => {
  const depth = 12000;
  const input = Buffer.from(`${"[".repeat(depth)}0${"]".repeat(depth)}`);
  const limits = { maxBytes: input.length, maxDepth: depth };
  let value = parseStrictJson(input, limits);
  for (let index = 0; index < depth; index += 1) {
    assert(Array.isArray(value), `container ${index}`);
    assert.equal(value.length, 1);
    value = value[0];
  }
  assert.equal(value, 0);
  assert.throws(
    () => parseStrictJson(input, { ...limits, maxDepth: depth - 1 }),
    (error) => error.code === "aas.json.depth-exceeded",
  );
  assert.throws(
    () => parseStrictJson(input),
    (error) => error.code === "aas.json.depth-exceeded",
    "default admission remains bounded at its documented depth",
  );
  for (const token of ['{"a":1,}', '{"a":1 "b":2}', "[1,]", "[1 2]", '{"x":1,"x":2}']) {
    const code = token.includes('"x":2') ? "aas.json.duplicate-key" : "aas.json.invalid-syntax";
    assert.throws(
      () => parseStrictJson(Buffer.from(token)),
      (error) => error.code === code,
      token,
    );
  }
});

test("canonical serialization preserves vectors and is stack safe for deep values", () => {
  const object = Object.assign(Object.create(null), {
    z: [0, { c: "🎯", a: true, b: null }],
    a: { "9": 9, "1": 1, key: "/" },
  });
  const expected = '{"a":{"1":1,"9":9,"key":"/"},"z":[0,{"a":true,"b":null,"c":"🎯"}]}';
  assert.equal(canonicalJson(object), expected);
  assert.equal(canonicalJsonBytes(object), Buffer.byteLength(expected));
  const depth = 12000;
  let nested = 0;
  for (let index = 0; index < depth; index += 1) {
    nested = [nested];
  }
  assert.equal(canonicalJson(nested), `${"[".repeat(depth)}0${"]".repeat(depth)}`);
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalJson(cyclic), /cyclic canonical JSON value/);
  const shared = { child: [1] };
  assert.equal(canonicalJson({ a: shared, b: shared }), '{"a":{"child":[1]},"b":{"child":[1]}}');
});

test("BOM and invalid UTF-8 are rejected", async () => {
  const fixture = await readFile(new URL("../vectors/json/negative/bom.json", import.meta.url));
  assert.throws(
    () => parseStrictJson(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), fixture])),
    (error) => error.code === "aas.json.invalid-utf8",
  );
  assert.throws(
    () => parseStrictJson(Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xff, 0x7d])),
    (error) => error.code === "aas.json.invalid-utf8",
  );
});
test("surrogates, trailing roots, and integer boundaries are exact", async () => {
  await reject("lone-surrogate.json", "aas.json.invalid-syntax");
  await reject("trailing-root.json", "aas.json.invalid-syntax");
  await reject("unsafe-integer.json", "aas.json.invalid-number");
  const parsed = parseStrictJson(
    await readFile(new URL("../vectors/json/positive/integer-boundaries.json", import.meta.url)),
  );
  assert.equal(parsed.minimum, Number.MIN_SAFE_INTEGER);
  assert.equal(parsed.maximum, Number.MAX_SAFE_INTEGER);
});
test("decimal spelling is validated before binary64 rounding", () => {
  for (const token of [
    "9007199254740991.1",
    "1.0000000000000001",
    "9007199254740990.9",
    "9007199254740991e1",
    "1e-100000001",
  ]) {
    assert.throws(
      () => parseStrictJson(Buffer.from(token)),
      (error) => error.code === "aas.json.invalid-number",
      token,
    );
  }
  assert.equal(parseStrictJson(Buffer.from("10000000000000000e-1")), 1000000000000000);
  assert.equal(parseStrictJson(Buffer.from("10.0000000000000000")), 10);
});
test("packaged strict-JSON case records drive declared outcomes", async () => {
  const corpus = parseStrictJson(
    await readFile(new URL("../vectors/json/corpus.json", import.meta.url)),
  );
  const seen = new Set();
  for (const item of corpus.cases) {
    assert(!seen.has(item.caseId), `duplicate case ID: ${item.caseId}`);
    seen.add(item.caseId);
    assert.equal(item.expected.version, corpus.schemaVersion);
    assert.equal(typeof item.requirement, "string");
    assert.equal(typeof item.rationale, "string");
    let bytes;
    if (item.input.constructedToken) {
      const { prefix, repeat, suffix } = item.input.constructedToken;
      assert(
        Number.isSafeInteger(repeat.count) &&
          repeat.count >= 0 &&
          repeat.count <= item.limits.maxBytes,
        `${item.caseId}: bounded repeat`,
      );
      bytes = Buffer.from(prefix + repeat.text.repeat(repeat.count) + suffix);
    } else bytes = await readFile(new URL(item.input.reference, vectorRoot));
    if (item.input.prefixHex)
      bytes = Buffer.concat([Buffer.from(item.input.prefixHex, "hex"), bytes]);
    if (item.input.form === "decoded-text") bytes = bytes.toString("utf8");
    if (item.expected.diagnostic === "none") {
      let parsed;
      assert.doesNotThrow(() => {
        parsed = parseStrictJson(bytes, item.limits);
      }, item.caseId);
      if ("value" in item.expected) assert.equal(parsed, item.expected.value, item.caseId);
    } else
      assert.throws(
        () => parseStrictJson(bytes, item.limits),
        (error) => error.code === item.expected.diagnostic,
        item.caseId,
      );
  }
});

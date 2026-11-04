/** The repository's single narrow canonical-JSON semantic primitive. */
export function canonicalJson(value) {
  let output = "";
  const pending = [{ kind: "value", value }];
  const active = new WeakSet();
  while (pending.length > 0) {
    const frame = pending[pending.length - 1];
    if (frame.kind === "value") {
      if (frame.value === null || typeof frame.value !== "object") {
        const encoded = JSON.stringify(frame.value);
        pending.pop();
        if (encoded === undefined) {
          const parent = pending[pending.length - 1];
          if (!parent) {
            return;
          }
          output += parent.kind === "object" ? "undefined" : "";
        } else {
          output += encoded;
        }
        continue;
      }
      if (active.has(frame.value)) {
        throw new TypeError("cyclic canonical JSON value");
      }
      active.add(frame.value);
      frame.index = 0;
      if (Array.isArray(frame.value)) {
        frame.kind = "array";
        output += "[";
      } else {
        frame.kind = "object";
        frame.keys = Object.keys(frame.value).toSorted();
        output += "{";
      }
      continue;
    }
    const length = frame.kind === "array" ? frame.value.length : frame.keys.length;
    if (frame.index === length) {
      output += frame.kind === "array" ? "]" : "}";
      active.delete(frame.value);
      pending.pop();
      continue;
    }
    if (frame.index > 0) {
      output += ",";
    }
    if (frame.kind === "array") {
      const child = frame.value[frame.index];
      frame.index += 1;
      pending.push({ kind: "value", value: child });
    } else {
      const key = frame.keys[frame.index];
      frame.index += 1;
      output += `${JSON.stringify(key)}:`;
      pending.push({ kind: "value", value: frame.value[key] });
    }
  }
  return output;
}

export const sameCanonicalJson = (left, right) => canonicalJson(left) === canonicalJson(right);
export const canonicalJsonBytes = (value) => Buffer.byteLength(canonicalJson(value), "utf8");

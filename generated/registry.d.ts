/* Generated from schemas/registry.schema.json; JSON Schema is normative. Do not edit. */

export type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };
export type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };
export type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };

export type AASRegistryEdition = ({
  "registry": "envelope-versions";
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": Array<{
  "id"?: import("./common.js").envelopeVersion;
  "kind"?: "envelope-version";
  "orderingRank": JsonInteger;
  "replacement"?: import("./common.js").envelopeVersion;
}>;
  "changes": Array<ConstrainedString>;
}) | ({
  "registry": "actions";
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": Array<{
  "id"?: import("./common.js").identifier;
  "replacement"?: import("./common.js").identifier;
}>;
  "changes": Array<ConstrainedString>;
}) | ({
  "registry": "operations";
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": Array<{
  "id"?: import("./common.js").identifier;
  "replacement"?: import("./common.js").identifier;
}>;
  "changes": Array<ConstrainedString>;
}) | ({
  "registry": "problems";
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": Array<{
  "id"?: import("./common.js").identifier;
  "replacement"?: import("./common.js").identifier;
}>;
  "changes": Array<ConstrainedString>;
}) | ({
  "registry": "resolutions";
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": Array<{
  "id"?: import("./common.js").identifier;
  "replacement"?: import("./common.js").identifier;
}>;
  "changes": Array<ConstrainedString>;
}) | ({
  "registry": "diagnostics";
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": Array<{
  "id"?: import("./common.js").identifier;
  "replacement"?: import("./common.js").identifier;
}>;
  "changes": Array<ConstrainedString>;
}) | ({
  "registry": "profiles";
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": Array<{
  "id"?: import("./common.js").identifier;
  "replacement"?: import("./common.js").identifier;
}>;
  "changes": Array<ConstrainedString>;
}) | ({
  "registry": "extensions";
  "edition": ConstrainedString;
  "previousEdition": ConstrainedString | null;
  "status": "provisional";
  "entries": Array<{
  "id"?: import("./common.js").identifier;
  "replacement"?: import("./common.js").identifier;
}>;
  "changes": Array<ConstrainedString>;
});

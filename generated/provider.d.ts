/* Generated from schemas/provider.schema.json; JSON Schema is normative. Do not edit. */

export type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };
export type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };
export type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };

export type AASProviderDescription = {
  "schemaVersion": "0.1";
  "status": "private-provisional-unpublished";
  "standardVersions": Array<import("./common.js").version>;
  "envelopeVersions": Array<import("./common.js").version>;
  "operations": Array<import("./common.js").profileRef>;
  "profiles": Array<import("./common.js").profileRef>;
  "limits": import("./common.js").budgets;
  "extensions": import("./common.js").extensionMap;
  "criticalExtensions": import("./common.js").extensionMap;
};

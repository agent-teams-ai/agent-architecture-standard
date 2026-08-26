/* Generated from schemas/overlay.schema.json; JSON Schema is normative. Do not edit. */

export type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };
export type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };
export type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };

export type operation = {
  "op": "add" | "replace" | "delete";
  "path": import("./common.js").portablePath;
  "contentAasIdentity"?: import("./common.js").aasIdentity;
  "expectedAasIdentity"?: import("./common.js").aasIdentity;
};

export type overlay = {
  "aasIdentity": import("./common.js").aasIdentity;
  "baseSnapshotAasIdentity": import("./common.js").aasIdentity;
  "operations": Array<operation>;
};

export type receipt = {
  "aasIdentity": import("./common.js").aasIdentity;
  "resultAasIdentity": import("./common.js").aasIdentity;
  "bindingAasIdentity": import("./common.js").aasIdentity;
  "integrationSnapshotAasIdentity": import("./common.js").aasIdentity;
  "integrationRevisionAasIdentity": import("./common.js").aasIdentity;
};

export type AASOverlayDeclarationAndValidationReceipt = (overlay) | (receipt);

import type { AASProvisionalCommonTypes } from '../generated/common.js';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends (1 & T) ? true : false;
type IsExactlyEmptyRecord<T> =
  [T] extends [Record<PropertyKey, never>]
    ? [Record<PropertyKey, never>] extends [T] ? true : false
    : false;

type EmptyProjectionIsNotAny = Assert<IsAny<AASProvisionalCommonTypes> extends false ? true : false>;
type EmptyProjectionIsNarrow = Assert<IsExactlyEmptyRecord<AASProvisionalCommonTypes>>;
type ObjectWithAPropertyIsRejected = Assert<{ unexpected: 1 } extends AASProvisionalCommonTypes ? false : true>;

export type EmptyProjectionAssertions =
  | EmptyProjectionIsNotAny
  | EmptyProjectionIsNarrow
  | ObjectWithAPropertyIsRejected;

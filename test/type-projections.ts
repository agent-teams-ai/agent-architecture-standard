import type { AASProvisionalCommonTypes } from '../generated/common.js';
import type { binding } from '../generated/policy.js';
import type { diagnosticHeader, extensionDisposition, resolution } from '../generated/envelope.js';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends (1 & T) ? true : false;
type IsExactlyEmptyRecord<T> =
  [T] extends [Record<PropertyKey, never>]
    ? [Record<PropertyKey, never>] extends [T] ? true : false
    : false;

type EmptyProjectionIsNotAny = Assert<IsAny<AASProvisionalCommonTypes> extends false ? true : false>;
type EmptyProjectionIsNarrow = Assert<IsExactlyEmptyRecord<AASProvisionalCommonTypes>>;
type ObjectWithAPropertyIsRejected = Assert<{ unexpected: 1 } extends AASProvisionalCommonTypes ? false : true>;
type RequiredBinding = Extract<binding, { mode: 'required' }>;
type NonRequiredBinding = Extract<binding, { mode: 'shadow' | 'advisory' }>;
type RequiredBindingHasPromotion = Assert<'promotionRecordAasIdentity' extends keyof RequiredBinding ? true : false>;
type NonRequiredBindingForbidsPromotion = Assert<'promotionRecordAasIdentity' extends keyof NonRequiredBinding ? false : true>;
type PreservedExtension = Extract<extensionDisposition, { disposition: 'preserved' | 'ignored' }>;
type UnderstoodExtension = Extract<extensionDisposition, { disposition: 'understood' }>;
type PreservedCannotAffectCore = Assert<PreservedExtension['affectsCoreSemantics'] extends false ? true : false>;
type UnderstoodMayAffectCore = Assert<boolean extends UnderstoodExtension['affectsCoreSemantics'] ? true : false>;
type DecidedResolutionHasVerdict = Assert<'verdict' extends keyof Extract<resolution, { resolution: 'decided' }> ? true : false>;
type NonDecidedResolutionForbidsVerdict = Assert<'verdict' extends keyof Extract<resolution, { resolution: 'unsupported' }> ? false : true>;
type DecidedHeaderHasVerdict = Assert<'verdict' extends keyof Extract<diagnosticHeader, { resolution: 'decided' }> ? true : false>;

export type EmptyProjectionAssertions =
  | EmptyProjectionIsNotAny
  | EmptyProjectionIsNarrow
  | ObjectWithAPropertyIsRejected
  | RequiredBindingHasPromotion
  | NonRequiredBindingForbidsPromotion
  | PreservedCannotAffectCore
  | UnderstoodMayAffectCore
  | DecidedResolutionHasVerdict
  | NonDecidedResolutionForbidsVerdict
  | DecidedHeaderHasVerdict;

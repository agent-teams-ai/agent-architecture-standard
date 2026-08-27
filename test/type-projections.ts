import type { AASProvisionalCommonTypes } from '../generated/common.js';
import type { binding } from '../generated/policy.js';
import type { diagnosticHeader, extensionDisposition, resolution } from '../generated/envelope.js';
import type { AASRegistryEdition } from '../generated/registry.js';

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
type RequestExtension = Extract<extensionDisposition, { location: 'request' }>;
type TargetExtension = Extract<extensionDisposition, { location: 'target' }>;
type PreservedCannotAffectCore = Assert<PreservedExtension['affectsCoreSemantics'] extends false ? true : false>;
type UnderstoodMayAffectCore = Assert<boolean extends UnderstoodExtension['affectsCoreSemantics'] ? true : false>;
type RequestExtensionForbidsTarget = Assert<'targetId' extends keyof RequestExtension ? false : true>;
type TargetExtensionRequiresTarget = Assert<'targetId' extends keyof TargetExtension ? true : false>;
type TargetIdRetainsBaseConstraint = Assert<TargetExtension['targetId'] extends import('../generated/common.js').identifier ? true : false>;
type DecidedResolutionHasVerdict = Assert<'verdict' extends keyof Extract<resolution, { resolution: 'decided' }> ? true : false>;
type NonDecidedResolutionForbidsVerdict = Assert<'verdict' extends keyof Extract<resolution, { resolution: 'unsupported' }> ? false : true>;
type DecidedHeaderHasVerdict = Assert<'verdict' extends keyof Extract<diagnosticHeader, { resolution: 'decided' }> ? true : false>;
type EnvelopeRegistry = Extract<AASRegistryEdition, { registry: 'envelope-versions' }>;
type OrdinaryRegistry = Extract<AASRegistryEdition, { registry: 'actions' }>;
type EnvelopeEntry = EnvelopeRegistry['entries'][number];
type OrdinaryEntry = OrdinaryRegistry['entries'][number];
type EnvelopeBranchKeepsBaseEdition = Assert<'edition' extends keyof EnvelopeRegistry ? true : false>;
type EnvelopeBranchKeepsBaseOwner = Assert<'owner' extends keyof EnvelopeEntry ? true : false>;
type EnvelopeBranchRequiresOrderingRank = Assert<undefined extends EnvelopeEntry['orderingRank'] ? false : true>;
type EnvelopeBranchNarrowsKind = Assert<EnvelopeEntry['kind'] extends 'envelope-version' ? true : false>;
type OrdinaryBranchKeepsBaseEntryId = Assert<'id' extends keyof OrdinaryEntry ? true : false>;
type OrdinaryBranchDoesNotRequireRank = Assert<undefined extends OrdinaryEntry['orderingRank'] ? true : false>;

export type EmptyProjectionAssertions =
  | EmptyProjectionIsNotAny
  | EmptyProjectionIsNarrow
  | ObjectWithAPropertyIsRejected
  | RequiredBindingHasPromotion
  | NonRequiredBindingForbidsPromotion
  | PreservedCannotAffectCore
  | UnderstoodMayAffectCore
  | RequestExtensionForbidsTarget
  | TargetExtensionRequiresTarget
  | TargetIdRetainsBaseConstraint
  | DecidedResolutionHasVerdict
  | NonDecidedResolutionForbidsVerdict
  | DecidedHeaderHasVerdict
  | EnvelopeBranchKeepsBaseEdition
  | EnvelopeBranchKeepsBaseOwner
  | EnvelopeBranchRequiresOrderingRank
  | EnvelopeBranchNarrowsKind
  | OrdinaryBranchKeepsBaseEntryId
  | OrdinaryBranchDoesNotRequireRank;

import type { TFunction } from 'i18next';

import type {
  ContractBoundaryMetadata,
  ContractReadKind,
} from '@modules/contract-registry/types/contract-registry.types';

export const contractBoundaryToneMap = {
  COMMERCIAL_LEGAL_SUPPORTED: 'success',
  LEGACY_EMPLOYMENT_DEPRECATED: 'warning',
  UNSUPPORTED_CONTRACT_KIND: 'danger',
} as const;

export const readContractBoundaryLabel = (
  t: TFunction,
  boundaryMetadata: ContractBoundaryMetadata,
): string => t(`contract-registry:boundaries.${boundaryMetadata.kindClassification}.label`);

export const readContractBoundaryHelper = (
  t: TFunction,
  boundaryMetadata: ContractBoundaryMetadata,
): string => t(`contract-registry:boundaries.${boundaryMetadata.kindClassification}.helper`);

export const readContractKindLabel = (
  t: TFunction,
  contractKind: ContractReadKind,
  boundaryMetadata: ContractBoundaryMetadata,
): string => {
  if (boundaryMetadata.kindClassification === 'UNSUPPORTED_CONTRACT_KIND') {
    return readContractBoundaryLabel(t, boundaryMetadata);
  }

  return t(`contract-registry:contractKinds.${contractKind}`);
};

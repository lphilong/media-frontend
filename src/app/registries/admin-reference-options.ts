import { loadCommissionRuleReferenceOptions } from '@modules/commission';
import { loadContractReferenceOptions } from '@modules/contract-registry';
import {
  loadAccessAssignmentLinkedUserOptions,
  loadContextualEmploymentProfileReferenceOptions,
  loadEmploymentProfileReferenceOptions,
  loadUnlinkedUserReferenceOptions,
} from '@modules/employment-profile';
import { loadEventReferenceOptions } from '@modules/event-assignment';
import { loadOrgUnitReferenceOptions } from '@modules/org-unit';
import {
  loadPlatformAccountReferenceOptions,
  loadPlatformOwnerReferenceOptions,
} from '@modules/platform-account';
import { loadRevenueEntryReferenceOptions } from '@modules/revenue-ledger';
import {
  loadStudioResourceReferenceOptions,
  loadStudioResourceReferenceOptionsByIds,
} from '@modules/studio-resource';
import { loadTalentReferenceOptions } from '@modules/talent';
import { loadTalentGroupReferenceOptions } from '@modules/talent-group';
import { loadUserReferenceOptions } from '@modules/user';

export const adminReferenceLoaders = {
  loadAccessAssignmentLinkedUserOptions,
  loadCommissionRuleReferenceOptions,
  loadContextualEmploymentProfileReferenceOptions,
  loadContractReferenceOptions,
  loadEmploymentProfileReferenceOptions,
  loadEventReferenceOptions,
  loadOrgUnitReferenceOptions,
  loadPlatformAccountReferenceOptions,
  loadPlatformOwnerReferenceOptions,
  loadRevenueEntryReferenceOptions,
  loadStudioResourceReferenceOptions,
  loadStudioResourceReferenceOptionsByIds,
  loadTalentGroupReferenceOptions,
  loadTalentReferenceOptions,
  loadUnlinkedUserReferenceOptions,
  loadUserReferenceOptions,
} as const;

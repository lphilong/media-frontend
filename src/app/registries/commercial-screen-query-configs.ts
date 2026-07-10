export {
  commissionRulesByBeneficiaryQueryConfig,
  commissionRulesByContractQueryConfig,
  commissionRulesFlatListQueryConfig,
  commissionRulesScreenQueryConfigs,
  commissionSettlementsByBeneficiaryQueryConfig,
  commissionSettlementsByRevenueEntryQueryConfig,
  commissionSettlementsBySubjectTalentQueryConfig,
  commissionSettlementsFlatListQueryConfig,
  commissionSettlementsScreenQueryConfigs,
} from '@modules/commission';
export {
  contractRegistryByLinkedEntityQueryConfig,
  contractRegistryByOwnerQueryConfig,
  contractRegistryFlatListQueryConfig,
  contractRegistryScreenQueryConfigs,
} from '@modules/contract-registry';
export {
  revenueLedgerByEventQueryConfig,
  revenueLedgerByPlatformQueryConfig,
  revenueLedgerByTalentQueryConfig,
  revenueLedgerFlatListQueryConfig,
} from '@modules/revenue-ledger';

import {
  commissionRulesScreenQueryConfigs,
  commissionSettlementsScreenQueryConfigs,
} from '@modules/commission';
import {
  contractRegistryScreenQueryConfigs,
} from '@modules/contract-registry';
import {
  revenueLedgerScreenQueryConfigs,
} from '@modules/revenue-ledger';

export const commercialScreenQueryConfigs = {
  revenueLedger: revenueLedgerScreenQueryConfigs,
  contractRegistry: contractRegistryScreenQueryConfigs,
  commissionRules: commissionRulesScreenQueryConfigs,
  commissionSettlements: commissionSettlementsScreenQueryConfigs,
} as const;

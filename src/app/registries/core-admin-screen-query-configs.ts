export {
  orgUnitFlatListQueryConfig,
} from '@modules/org-unit';
export {
  employmentProfileDirectReportsQueryConfig,
  employmentProfileFlatListQueryConfig,
} from '@modules/employment-profile';
export { talentFlatListQueryConfig } from '@modules/talent';
export {
  talentGroupByTalentQueryConfig,
  talentGroupFlatListQueryConfig,
} from '@modules/talent-group';

import { orgUnitFlatListQueryConfig } from '@modules/org-unit';
import {
  employmentProfileDirectReportsQueryConfig,
  employmentProfileFlatListQueryConfig,
} from '@modules/employment-profile';
import { talentFlatListQueryConfig } from '@modules/talent';
import {
  talentGroupByTalentQueryConfig,
  talentGroupFlatListQueryConfig,
} from '@modules/talent-group';

export const coreAdminScreenQueryConfigs = {
  orgUnit: {
    flatList: orgUnitFlatListQueryConfig,
  },
  employmentProfile: {
    flatList: employmentProfileFlatListQueryConfig,
    directReports: employmentProfileDirectReportsQueryConfig,
  },
  talent: {
    flatList: talentFlatListQueryConfig,
  },
  talentGroup: {
    flatList: talentGroupFlatListQueryConfig,
    byTalent: talentGroupByTalentQueryConfig,
  },
} as const;

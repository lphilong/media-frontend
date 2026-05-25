import type { TalentRecord } from '@modules/talent/types/talent.types';
import { readReferenceDisplay } from '@shared/formatting/formatters';

export const readTalentPrimaryDisplay = (record: TalentRecord): string => {
  if (record.talentOrigin === 'INTERNAL') {
    return (
      record.displayName ||
      readReferenceDisplay(record.linkedEmploymentProfileRef, record.linkedEmploymentProfileId) ||
      record.stageName ||
      record.talentCode
    );
  }

  return record.displayName || record.displayShortName || record.stageName || record.legalName;
};

export const readTalentPerformanceAlias = (record: TalentRecord): string | null => {
  if (record.talentOrigin === 'INTERNAL') {
    return record.performanceAlias ?? null;
  }

  const primaryDisplay = readTalentPrimaryDisplay(record);
  return record.stageName && record.stageName !== primaryDisplay ? record.stageName : null;
};

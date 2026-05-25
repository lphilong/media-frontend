import type { TalentRecord } from '@modules/talent/types/talent.types';
import { readReferenceDisplay } from '@shared/formatting/formatters';

const readText = (value: string | null | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
};

export const readTalentPrimaryDisplay = (record: TalentRecord): string => {
  if (record.talentOrigin === 'INTERNAL') {
    const linkedProfileDisplay =
      readText(record.displayName) ??
      readText(record.linkedEmploymentProfileRef?.displayName) ??
      (record.linkedEmploymentProfileRef
        ? readReferenceDisplay(record.linkedEmploymentProfileRef, record.linkedEmploymentProfileId)
        : undefined);

    return linkedProfileDisplay && linkedProfileDisplay !== '-'
      ? linkedProfileDisplay
      : record.talentCode;
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

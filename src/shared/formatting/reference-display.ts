export type ReferenceSummary = {
  id: string;
  code?: string;
  name?: string;
  display?: string;
  title?: string;
  displayName?: string;
  handle?: string;
  platform?: string;
  status?: string;
};

const readFirstText = (values: readonly (string | undefined | null)[]): string | undefined => {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
};

const shortenReferenceId = (value: string): string => {
  const normalized = value.trim();

  if (normalized.length <= 16) {
    return normalized;
  }

  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
};

const isReferenceSummary = (value: unknown): value is ReferenceSummary => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return typeof (value as { id?: unknown }).id === 'string';
};

export const readReferenceDisplay = (
  ref: ReferenceSummary | null | undefined,
  fallbackId?: string | null,
): string => {
  const code = ref?.code?.trim();
  const label = readFirstText([ref?.display, ref?.displayName, ref?.name, ref?.title, ref?.handle]);

  if (label) {
    return label;
  }

  if (code) {
    return code;
  }

  const fallback = fallbackId?.trim() || ref?.id.trim();

  return fallback ? shortenReferenceId(fallback) : '-';
};

export const readReferenceDisplayForId = (
  referenceId: string | null | undefined,
  refs: readonly unknown[],
): string => {
  const normalizedId = referenceId?.trim();
  const matchingRef = normalizedId
    ? refs.find((ref): ref is ReferenceSummary => {
        return isReferenceSummary(ref) && ref.id.trim() === normalizedId;
      })
    : undefined;

  return readReferenceDisplay(matchingRef, normalizedId);
};

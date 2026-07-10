import type { ReactNode } from 'react';

type TechnicalDetailsDisclosureProps = {
  label: string;
  details: unknown;
  className?: string;
  defaultOpen?: boolean;
  emptyFallback?: ReactNode;
};

const formatDetails = (details: unknown): string | null => {
  if (details === null || details === undefined || details === '') {
    return null;
  }

  if (typeof details === 'string') {
    return details;
  }

  if (details instanceof Error) {
    return details.message;
  }

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
};

export const TechnicalDetailsDisclosure = ({
  className,
  defaultOpen = false,
  details,
  emptyFallback = null,
  label,
}: TechnicalDetailsDisclosureProps): JSX.Element | null => {
  const formattedDetails = formatDetails(details);

  if (!formattedDetails) {
    return emptyFallback ? <>{emptyFallback}</> : null;
  }

  return (
    <details className={className ?? 'text-left text-xs text-muted'} open={defaultOpen}>
      <summary className="cursor-pointer font-medium text-text">{label}</summary>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-bg p-3 font-mono text-xs text-muted">
        {formattedDetails}
      </pre>
    </details>
  );
};

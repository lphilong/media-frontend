type ErrorStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onRetry?: () => void;
  variant?: 'panel' | 'inline';
  technicalDetails?: unknown;
  technicalDetailsLabel?: string;
};

const OPERATOR_SAFE_MESSAGE =
  'Dữ liệu trả về chưa khớp với định dạng mà giao diện hiện tại hỗ trợ. Vui lòng thử lại hoặc báo người quản trị hệ thống nếu lỗi tiếp tục xảy ra.';

const TECHNICAL_MESSAGE_PATTERN =
  /(\[\s*\{|\{\s*"|ZodError|unrecognized_keys|invalid_enum_value|invalid_type|Expected .* received|Unrecognized key|Invalid enum value|Required at|Parse error)/iu;

const isTechnicalMessage = (message: string): boolean => TECHNICAL_MESSAGE_PATTERN.test(message);

const formatTechnicalDetails = (details: unknown): string | null => {
  if (details === null || details === undefined) {
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

export const ErrorState = ({
  title,
  message,
  actionLabel,
  onRetry,
  variant = 'panel',
  technicalDetails,
  technicalDetailsLabel = 'Chi tiết kỹ thuật',
}: ErrorStateProps): JSX.Element => {
  const wrapperClass =
    variant === 'inline'
      ? 'rounded border border-danger/30 bg-panel px-4 py-3'
      : 'rounded-lg border border-danger/30 bg-panel p-6 text-center shadow-shell';
  const hasTechnicalPrimaryMessage = isTechnicalMessage(message);
  const operatorMessage = hasTechnicalPrimaryMessage ? OPERATOR_SAFE_MESSAGE : message;
  const formattedTechnicalDetails =
    formatTechnicalDetails(technicalDetails) ?? (hasTechnicalPrimaryMessage ? message : null);

  return (
    <div className={wrapperClass}>
      <p className="text-base font-semibold text-danger">{title}</p>
      <p className="mt-1 text-sm text-muted">{operatorMessage}</p>
      {actionLabel && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded border border-border bg-panel px-3 py-2 text-sm font-medium text-text hover:bg-slate-50"
        >
          {actionLabel}
        </button>
      ) : null}
      {formattedTechnicalDetails ? (
        <details className="mt-4 text-left text-xs text-muted">
          <summary className="cursor-pointer font-medium text-text">{technicalDetailsLabel}</summary>
          <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded border border-border bg-bg p-3">
            {formattedTechnicalDetails}
          </pre>
        </details>
      ) : null}
    </div>
  );
};

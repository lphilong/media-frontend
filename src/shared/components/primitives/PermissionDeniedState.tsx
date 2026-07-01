import { useTranslation } from 'react-i18next';

import { ErrorState } from '@shared/components/primitives/ErrorState';

type PermissionDeniedStateProps = {
  message?: string;
  reason?:
    | 'missing-capabilities'
    | 'missing-permission'
    | 'missing-scope'
    | 'missing-account-context'
    | 'unknown';
  requiredPermissions?: readonly string[];
  requiredScopes?: readonly string[];
  requiredAccountContext?: string;
  technicalDetails?: unknown;
};

const formatList = (items: readonly string[]): string => items.join(', ');

const buildRequirementLines = ({
  requiredPermissions,
  requiredScopes,
  requiredAccountContext,
}: Pick<
  PermissionDeniedStateProps,
  'requiredPermissions' | 'requiredScopes' | 'requiredAccountContext'
>): string[] => {
  const lines: string[] = [];

  if (requiredPermissions && requiredPermissions.length > 0) {
    lines.push(`Quyền: ${formatList(requiredPermissions)}`);
  }

  if (requiredScopes && requiredScopes.length > 0) {
    lines.push(`Phạm vi: ${formatList(requiredScopes)}`);
  }

  if (requiredAccountContext) {
    lines.push(`Ngữ cảnh: ${requiredAccountContext}`);
  }

  return lines;
};

export const PermissionDeniedState = ({
  message,
  reason = 'unknown',
  requiredPermissions,
  requiredScopes,
  requiredAccountContext,
  technicalDetails,
}: PermissionDeniedStateProps): JSX.Element => {
  const { t } = useTranslation('errors');
  const requirementLines = buildRequirementLines({
    requiredPermissions,
    requiredScopes,
    requiredAccountContext,
  });
  const reasonMessage =
    reason === 'missing-permission'
      ? t('permission.reason.missingPermission')
      : reason === 'missing-scope'
        ? t('permission.reason.missingScope')
        : reason === 'missing-account-context'
          ? t('permission.reason.missingAccountContext')
          : reason === 'missing-capabilities'
            ? t('permission.reason.missingCapabilities')
            : t('permission.reason.unknown');
  const guidance =
    message ??
    (reason === 'missing-capabilities'
      ? reasonMessage
      : `${reasonMessage}\n\n${t('permission.nextActions')}`);
  const messageWithRequirements =
    requirementLines.length > 0
      ? `${guidance}\n\n${t('permission.requirementsTitle')}\n${requirementLines
          .map((line) => `- ${line}`)
          .join('\n')}`
      : guidance;

  return (
    <ErrorState
      title={t('permission.title')}
      message={messageWithRequirements}
      variant="inline"
      technicalDetails={technicalDetails}
    />
  );
};

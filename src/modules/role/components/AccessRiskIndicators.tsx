import type { StatusBadgeTone } from '@shared/components/primitives';
import { ReadOnlyFieldGrid, StatusBadge } from '@shared/components/primitives';

export type AccessRiskCarrier = {
  isSensitive?: boolean;
  isGlobalLike?: boolean;
  isHighRisk?: boolean;
  requiresReview?: boolean;
  isBreakGlassLike?: boolean;
  sensitiveOrGlobal?: boolean;
  reviewAt?: number | string | null;
  expiresAt?: number | string | null;
  accessRisk?: Record<string, unknown> | null;
};

type AccessRiskBadge = {
  key: string;
  label: string;
  tone: StatusBadgeTone;
};

const riskBadgeDefinitions: Array<{
  key: keyof Pick<
    AccessRiskCarrier,
    'isSensitive' | 'isGlobalLike' | 'isHighRisk' | 'requiresReview' | 'isBreakGlassLike'
  >;
  label: string;
  tone: StatusBadgeTone;
}> = [
  { key: 'isSensitive', label: 'Quyền nhạy cảm', tone: 'privacy' },
  { key: 'isGlobalLike', label: 'Phạm vi toàn cục', tone: 'warning' },
  { key: 'isHighRisk', label: 'Rủi ro cao', tone: 'danger' },
  { key: 'requiresReview', label: 'Cần rà soát', tone: 'warning' },
  { key: 'isBreakGlassLike', label: 'Quyền khẩn cấp', tone: 'danger' },
];

export const AccessRiskBadges = ({
  risk,
  fallback = null,
}: {
  risk?: AccessRiskCarrier | null;
  fallback?: JSX.Element | null;
}): JSX.Element | null => {
  const badges = getAccessRiskBadges(risk);

  if (badges.length === 0) {
    return fallback;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge) => (
        <StatusBadge key={badge.key} label={badge.label} tone={badge.tone} uppercase={false} />
      ))}
    </div>
  );
};

export const AccessRiskSummary = ({
  risk,
  title = 'Đánh giá rủi ro quyền cấp',
  helper = 'Hệ thống là nguồn quyết định cuối cùng; phần này chỉ hiển thị kết quả đánh giá để người vận hành rà soát trước khi thao tác.',
}: {
  risk?: AccessRiskCarrier | null;
  title?: string;
  helper?: string;
}): JSX.Element | null => {
  const badges = getAccessRiskBadges(risk);
  const reviewAt = readRiskDate(risk, 'reviewAt');
  const expiresAt = readRiskDate(risk, 'expiresAt');

  if (badges.length === 0 && !reviewAt && !expiresAt) {
    return null;
  }

  return (
    <div className="rounded border border-border bg-bg p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text">{title}</p>
          <p className="mt-1 text-xs text-muted">{helper}</p>
        </div>
        <AccessRiskBadges risk={risk} />
      </div>
      <ReadOnlyFieldGrid
        columns={2}
        fields={[
          {
            key: 'reviewAt',
            label: 'Ngày rà soát',
            value: formatRiskDate(reviewAt),
          },
          {
            key: 'expiresAt',
            label: 'Ngày hết hiệu lực',
            value: formatRiskDate(expiresAt),
          },
        ]}
      />
    </div>
  );
};

export const ReviewDueBadge = ({
  risk,
  now = Date.now(),
}: {
  risk?: AccessRiskCarrier | null;
  now?: number;
}): JSX.Element | null => {
  const reviewAt = readRiskDate(risk, 'reviewAt');
  const requiresReview = readRiskBoolean(risk, 'requiresReview');

  if (!requiresReview) {
    return null;
  }

  if (!reviewAt) {
    return <StatusBadge label="Thiếu ngày rà soát" tone="danger" uppercase={false} />;
  }

  const reviewTime = readDateMs(reviewAt);
  if (reviewTime === null) {
    return <StatusBadge label="Cần rà soát" tone="warning" uppercase={false} />;
  }

  if (reviewTime < now) {
    return <StatusBadge label="Quá hạn rà soát" tone="danger" uppercase={false} />;
  }

  if (reviewTime - now <= 14 * 24 * 60 * 60 * 1000) {
    return <StatusBadge label="Sắp đến hạn rà soát" tone="warning" uppercase={false} />;
  }

  return <StatusBadge label="Cần rà soát" tone="warning" uppercase={false} />;
};

export function getAccessRiskBadges(risk?: AccessRiskCarrier | null): AccessRiskBadge[] {
  if (!risk) {
    return [];
  }

  return riskBadgeDefinitions.filter((badge) => readRiskBoolean(risk, badge.key));
}

export function readRiskBoolean(
  risk: AccessRiskCarrier | Record<string, unknown> | null | undefined,
  key: keyof Pick<
    AccessRiskCarrier,
    'isSensitive' | 'isGlobalLike' | 'isHighRisk' | 'requiresReview' | 'isBreakGlassLike'
  >,
): boolean {
  if (!risk) {
    return false;
  }

  const direct = risk[key];
  if (typeof direct === 'boolean') {
    return direct;
  }

  const accessRisk = risk.accessRisk;
  if (isRecord(accessRisk) && typeof accessRisk[key] === 'boolean') {
    return accessRisk[key];
  }

  return key === 'isSensitive' && risk.sensitiveOrGlobal === true;
}

export function readRiskDate(
  risk: AccessRiskCarrier | Record<string, unknown> | null | undefined,
  key: 'reviewAt' | 'expiresAt',
): number | string | null {
  if (!risk) {
    return null;
  }

  const direct = risk[key];
  if (typeof direct === 'string' || typeof direct === 'number') {
    return direct;
  }

  const accessRisk = risk.accessRisk;
  if (isRecord(accessRisk)) {
    const nested = accessRisk[key];
    if (typeof nested === 'string' || typeof nested === 'number') {
      return nested;
    }
  }

  return null;
}

export function formatRiskDate(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const dateMs = readDateMs(value);
  if (dateMs === null) {
    return String(value);
  }

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateMs));
}

function readDateMs(value: number | string): number | null {
  const date =
    typeof value === 'number'
      ? new Date(value)
      : /^\d+$/u.test(value)
        ? new Date(Number(value))
        : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

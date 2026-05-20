import { http, HttpResponse } from 'msw';

import {
  generatedFixtureCode,
  providedOrGeneratedFixtureCode,
} from '@test/msw/generated-code-fixtures';

type PlatformAccountStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
type PlatformAccountOwnerKind = 'ORG_UNIT' | 'TALENT' | 'TALENT_GROUP';

type ReferenceSummary = {
  id: string;
  code?: string;
  name?: string;
  displayName?: string;
  status?: string;
};

type PlatformAccountRecord = {
  id: string;
  accountCode: string;
  platform: string;
  platformSurfaceType: string;
  displayName: string;
  handle: string | null;
  externalPlatformId: string | null;
  profileUrl: string | null;
  ownerKind: PlatformAccountOwnerKind;
  ownerOrgUnitId: string | null;
  ownerTalentId: string | null;
  ownerTalentGroupId: string | null;
  operationalStatus: PlatformAccountStatus;
  livestreamEnabled: boolean;
  contentPublishingEnabled: boolean;
  monetizationEnabled: boolean;
  description: string | null;
  externalRef: string | null;
  createdAt: number;
  updatedAt: number;
};

type StudioResourceStatus = 'ACTIVE' | 'OUT_OF_SERVICE' | 'INACTIVE' | 'ARCHIVED';

type StudioResourceRecord = {
  id: string;
  resourceCode: string;
  name: string;
  shortName: string | null;
  resourceClass: string;
  operationalStatus: StudioResourceStatus;
  locationLabel: string | null;
  maxOccupancy: number | null;
  description: string | null;
  externalRef: string | null;
  createdAt: number;
  updatedAt: number;
};

const now = Date.parse('2026-04-22T00:00:00.000Z');
const initialPlatformSeed = 500;
const initialStudioSeed = 700;

let platformSeed = initialPlatformSeed;
let studioSeed = initialStudioSeed;

const initialPlatformAccounts: PlatformAccountRecord[] = [
  {
    id: 'platform-001',
    accountCode: 'PA-000001',
    platform: 'YOUTUBE',
    platformSurfaceType: 'LIVESTREAM',
    displayName: 'Mina Live',
    handle: '@mina',
    externalPlatformId: 'yt-mina-001',
    profileUrl: 'https://example.test/mina',
    ownerKind: 'TALENT',
    ownerOrgUnitId: null,
    ownerTalentId: 'talent-001',
    ownerTalentGroupId: null,
    operationalStatus: 'ACTIVE',
    livestreamEnabled: true,
    contentPublishingEnabled: true,
    monetizationEnabled: true,
    description: 'Primary livestream account',
    externalRef: null,
    createdAt: now - 8_000,
    updatedAt: now - 7_500,
  },
  {
    id: 'platform-002',
    accountCode: 'PA-000002',
    platform: 'TIKTOK',
    platformSurfaceType: 'SHORT_VIDEO',
    displayName: 'Sales Channel',
    handle: '@sales',
    externalPlatformId: null,
    profileUrl: null,
    ownerKind: 'ORG_UNIT',
    ownerOrgUnitId: 'ou-sales',
    ownerTalentId: null,
    ownerTalentGroupId: null,
    operationalStatus: 'INACTIVE',
    livestreamEnabled: false,
    contentPublishingEnabled: true,
    monetizationEnabled: false,
    description: null,
    externalRef: 'PA-SALES',
    createdAt: now - 7_000,
    updatedAt: now - 6_500,
  },
  {
    id: 'platform-003',
    accountCode: 'PA-000003',
    platform: 'INSTAGRAM',
    platformSurfaceType: 'PROFILE',
    displayName: 'A Team Social',
    handle: '@ateam',
    externalPlatformId: null,
    profileUrl: null,
    ownerKind: 'TALENT_GROUP',
    ownerOrgUnitId: null,
    ownerTalentId: null,
    ownerTalentGroupId: 'group-001',
    operationalStatus: 'ACTIVE',
    livestreamEnabled: false,
    contentPublishingEnabled: true,
    monetizationEnabled: false,
    description: null,
    externalRef: null,
    createdAt: now - 6_000,
    updatedAt: now - 5_500,
  },
  {
    id: 'platform-archive',
    accountCode: 'PA-999999',
    platform: 'YOUTUBE',
    platformSurfaceType: 'LIVESTREAM',
    displayName: 'Archived Platform',
    handle: '@archived',
    externalPlatformId: null,
    profileUrl: null,
    ownerKind: 'ORG_UNIT',
    ownerOrgUnitId: 'ou-sales',
    ownerTalentId: null,
    ownerTalentGroupId: null,
    operationalStatus: 'ARCHIVED',
    livestreamEnabled: false,
    contentPublishingEnabled: false,
    monetizationEnabled: false,
    description: 'Archived account',
    externalRef: null,
    createdAt: now - 4_000,
    updatedAt: now - 3_500,
  },
];

const initialStudioResources: StudioResourceRecord[] = [
  {
    id: 'studio-001',
    resourceCode: 'SR-000001',
    name: 'Main Studio',
    shortName: 'Main',
    resourceClass: 'SPACE',
    operationalStatus: 'ACTIVE',
    locationLabel: 'Room A',
    maxOccupancy: 12,
    description: 'Primary production room',
    externalRef: null,
    createdAt: now - 8_000,
    updatedAt: now - 7_500,
  },
  {
    id: 'studio-002',
    resourceCode: 'SR-000002',
    name: 'Camera Kit',
    shortName: 'Cam Kit',
    resourceClass: 'EQUIPMENT',
    operationalStatus: 'OUT_OF_SERVICE',
    locationLabel: 'Storage',
    maxOccupancy: null,
    description: 'Shared camera kit',
    externalRef: 'EQ-CAMERA',
    createdAt: now - 7_000,
    updatedAt: now - 6_500,
  },
  {
    id: 'studio-003',
    resourceCode: 'SR-000003',
    name: 'Podcast Room',
    shortName: null,
    resourceClass: 'SPACE',
    operationalStatus: 'INACTIVE',
    locationLabel: 'Room B',
    maxOccupancy: null,
    description: null,
    externalRef: null,
    createdAt: now - 6_000,
    updatedAt: now - 5_500,
  },
  {
    id: 'studio-archive',
    resourceCode: 'SR-999999',
    name: 'Archived Studio',
    shortName: null,
    resourceClass: 'SPACE',
    operationalStatus: 'ARCHIVED',
    locationLabel: null,
    maxOccupancy: null,
    description: 'Archived resource',
    externalRef: null,
    createdAt: now - 4_000,
    updatedAt: now - 3_500,
  },
];

let platformAccounts = initialPlatformAccounts.map((record) => ({ ...record }));
let studioResources = initialStudioResources.map((record) => ({ ...record }));

export const resetWave5MockData = (): void => {
  platformSeed = initialPlatformSeed;
  studioSeed = initialStudioSeed;
  platformAccounts = initialPlatformAccounts.map((record) => ({ ...record }));
  studioResources = initialStudioResources.map((record) => ({ ...record }));
};

const normalizeText = (value: string): string => value.trim().toLowerCase();

const toPrefixMatch = (value: string | null, search: string): boolean => {
  if (!value) {
    return false;
  }

  return normalizeText(value).startsWith(normalizeText(search));
};

const parsePositiveInt = (value: string | null | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
};

const parseBooleanParam = (value: string | null): boolean | undefined => {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
};

const paginate = <TData>(
  items: TData[],
  searchParams: URLSearchParams,
): { data: TData[]; meta?: { nextCursor?: string } } => {
  const limitParam = parsePositiveInt(searchParams.get('limit'));
  const limit = Math.min(limitParam ?? 20, 100);
  const cursorParam = parsePositiveInt(searchParams.get('cursor'));
  const cursor = cursorParam ?? 0;
  const start = Math.min(cursor, items.length);
  const end = Math.min(start + limit, items.length);
  const data = items.slice(start, end);
  const nextCursor = end < items.length ? String(end) : undefined;

  return {
    data,
    meta: nextCursor ? { nextCursor } : undefined,
  };
};

const parseJsonBody = async (request: Request): Promise<Record<string, unknown>> => {
  const body = (await request.json()) as unknown;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  return {};
};

const toNullableText = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const readPlatformAccount = (platformAccountId: string): PlatformAccountRecord | undefined =>
  platformAccounts.find((item) => item.id === platformAccountId);

const readStudioResource = (studioResourceId: string): StudioResourceRecord | undefined =>
  studioResources.find((item) => item.id === studioResourceId);

const ownerRefs = {
  orgUnits: new Map<string, ReferenceSummary>([
    ['ou-sales', { id: 'ou-sales', code: 'OU-000002', name: 'Sales', status: 'ACTIVE' }],
  ]),
  talents: new Map<string, ReferenceSummary>([
    ['talent-001', { id: 'talent-001', code: 'TAL-000001', name: 'Mina', status: 'ACTIVE' }],
  ]),
  talentGroups: new Map<string, ReferenceSummary>([
    ['group-001', { id: 'group-001', code: 'TG-000001', name: 'A Team', status: 'ACTIVE' }],
  ]),
};

const readOwnerRef = (record: PlatformAccountRecord): ReferenceSummary | null => {
  if (record.ownerKind === 'ORG_UNIT') {
    return record.ownerOrgUnitId ? (ownerRefs.orgUnits.get(record.ownerOrgUnitId) ?? null) : null;
  }

  if (record.ownerKind === 'TALENT') {
    return record.ownerTalentId ? (ownerRefs.talents.get(record.ownerTalentId) ?? null) : null;
  }

  return record.ownerTalentGroupId
    ? (ownerRefs.talentGroups.get(record.ownerTalentGroupId) ?? null)
    : null;
};

const toPlatformListItem = (record: PlatformAccountRecord) => {
  return {
    id: record.id,
    accountCode: record.accountCode,
    platform: record.platform,
    platformSurfaceType: record.platformSurfaceType,
    displayName: record.displayName,
    handle: record.handle,
    externalPlatformId: record.externalPlatformId,
    profileUrl: record.profileUrl,
    ownerKind: record.ownerKind,
    ownerOrgUnitId: record.ownerOrgUnitId,
    ownerTalentId: record.ownerTalentId,
    ownerTalentGroupId: record.ownerTalentGroupId,
    ownerRef: readOwnerRef(record),
    operationalStatus: record.operationalStatus,
    livestreamEnabled: record.livestreamEnabled,
    contentPublishingEnabled: record.contentPublishingEnabled,
    monetizationEnabled: record.monetizationEnabled,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

const toPlatformDetail = (record: PlatformAccountRecord) => {
  return {
    ...toPlatformListItem(record),
    description: record.description,
    externalRef: record.externalRef,
  };
};

const toStudioListItem = (record: StudioResourceRecord) => {
  return {
    id: record.id,
    resourceCode: record.resourceCode,
    name: record.name,
    shortName: record.shortName,
    resourceClass: record.resourceClass,
    operationalStatus: record.operationalStatus,
    locationLabel: record.locationLabel,
    maxOccupancy: record.maxOccupancy,
    createdAt: record.createdAt,
  };
};

const toStudioAvailabilityItem = (record: StudioResourceRecord) => {
  return {
    id: record.id,
    resourceCode: record.resourceCode,
    name: record.name,
    resourceClass: record.resourceClass,
    operationalStatus: record.operationalStatus,
    maxOccupancy: record.maxOccupancy,
  };
};

const toStudioDetail = (record: StudioResourceRecord) => {
  return {
    ...toStudioListItem(record),
    description: record.description,
    externalRef: record.externalRef,
    updatedAt: record.updatedAt,
  };
};

const sortPlatformAccounts = (
  records: PlatformAccountRecord[],
  sortBy: string | null,
  sortDirection: string | null,
): PlatformAccountRecord[] => {
  const directionMultiplier = sortDirection === 'desc' ? -1 : 1;
  return [...records].sort((left, right) => {
    const readValue = (record: PlatformAccountRecord): string | number => {
      switch (sortBy) {
        case 'displayName':
          return record.displayName;
        case 'createdAt':
          return record.createdAt;
        case 'accountCode':
        default:
          return record.accountCode;
      }
    };

    const leftValue = readValue(left);
    const rightValue = readValue(right);
    if (leftValue < rightValue) {
      return -1 * directionMultiplier;
    }
    if (leftValue > rightValue) {
      return 1 * directionMultiplier;
    }
    return left.id.localeCompare(right.id);
  });
};

const sortStudioResources = (
  records: StudioResourceRecord[],
  sortBy: string | null,
  sortDirection: string | null,
): StudioResourceRecord[] => {
  const directionMultiplier = sortDirection === 'desc' ? -1 : 1;
  return [...records].sort((left, right) => {
    const readValue = (record: StudioResourceRecord): string | number => {
      switch (sortBy) {
        case 'name':
          return record.name;
        case 'createdAt':
          return record.createdAt;
        case 'resourceCode':
        default:
          return record.resourceCode;
      }
    };

    const leftValue = readValue(left);
    const rightValue = readValue(right);
    if (leftValue < rightValue) {
      return -1 * directionMultiplier;
    }
    if (leftValue > rightValue) {
      return 1 * directionMultiplier;
    }
    return left.id.localeCompare(right.id);
  });
};

const setOwnerFields = (
  record: PlatformAccountRecord,
  ownerKind: PlatformAccountOwnerKind,
  body: Record<string, unknown>,
): boolean => {
  const ownerOrgUnitId = toNullableText(body.ownerOrgUnitId);
  const ownerTalentId = toNullableText(body.ownerTalentId);
  const ownerTalentGroupId = toNullableText(body.ownerTalentGroupId);

  const nextOwnerId =
    ownerKind === 'ORG_UNIT'
      ? ownerOrgUnitId
      : ownerKind === 'TALENT'
        ? ownerTalentId
        : ownerTalentGroupId;

  if (!nextOwnerId) {
    return false;
  }

  record.ownerKind = ownerKind;
  record.ownerOrgUnitId = ownerKind === 'ORG_UNIT' ? nextOwnerId : null;
  record.ownerTalentId = ownerKind === 'TALENT' ? nextOwnerId : null;
  record.ownerTalentGroupId = ownerKind === 'TALENT_GROUP' ? nextOwnerId : null;
  return true;
};

const isOwnerKind = (value: unknown): value is PlatformAccountOwnerKind =>
  value === 'ORG_UNIT' || value === 'TALENT' || value === 'TALENT_GROUP';

export const wave5Handlers = [
  http.get('*/admin/platform-accounts', ({ request }) => {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const search = searchParams.get('search');
    const operationalStatus = searchParams.get('operationalStatus');
    const livestreamEnabled = parseBooleanParam(searchParams.get('livestreamEnabled'));
    const contentPublishingEnabled = parseBooleanParam(
      searchParams.get('contentPublishingEnabled'),
    );
    const monetizationEnabled = parseBooleanParam(searchParams.get('monetizationEnabled'));

    let rows = [...platformAccounts];

    if (!operationalStatus) {
      rows = rows.filter((item) => item.operationalStatus !== 'ARCHIVED');
    } else {
      rows = rows.filter((item) => item.operationalStatus === operationalStatus);
    }

    const platform = searchParams.get('platform');
    const platformSurfaceType = searchParams.get('platformSurfaceType');
    const ownerKind = searchParams.get('ownerKind');
    const ownerOrgUnitId = searchParams.get('ownerOrgUnitId');
    const ownerTalentId = searchParams.get('ownerTalentId');
    const ownerTalentGroupId = searchParams.get('ownerTalentGroupId');

    if (platform) {
      rows = rows.filter((item) => item.platform === platform);
    }
    if (platformSurfaceType) {
      rows = rows.filter((item) => item.platformSurfaceType === platformSurfaceType);
    }
    if (ownerKind) {
      rows = rows.filter((item) => item.ownerKind === ownerKind);
    }
    if (ownerOrgUnitId) {
      rows = rows.filter((item) => item.ownerOrgUnitId === ownerOrgUnitId);
    }
    if (ownerTalentId) {
      rows = rows.filter((item) => item.ownerTalentId === ownerTalentId);
    }
    if (ownerTalentGroupId) {
      rows = rows.filter((item) => item.ownerTalentGroupId === ownerTalentGroupId);
    }
    if (livestreamEnabled !== undefined) {
      rows = rows.filter((item) => item.livestreamEnabled === livestreamEnabled);
    }
    if (contentPublishingEnabled !== undefined) {
      rows = rows.filter((item) => item.contentPublishingEnabled === contentPublishingEnabled);
    }
    if (monetizationEnabled !== undefined) {
      rows = rows.filter((item) => item.monetizationEnabled === monetizationEnabled);
    }
    if (search) {
      rows = rows.filter(
        (item) =>
          toPrefixMatch(item.accountCode, search) ||
          toPrefixMatch(item.displayName, search) ||
          toPrefixMatch(item.handle, search) ||
          toPrefixMatch(item.profileUrl, search),
      );
    }

    rows = sortPlatformAccounts(
      rows,
      searchParams.get('sortBy'),
      searchParams.get('sortDirection'),
    );

    return HttpResponse.json(paginate(rows.map(toPlatformListItem), searchParams));
  }),

  http.post('*/admin/platform-accounts', async ({ request }) => {
    const body = await parseJsonBody(request);
    const ownerKind = body.ownerKind;
    if (!isOwnerKind(ownerKind)) {
      return HttpResponse.json(
        { message: 'platform-account:validation.required' },
        { status: 422 },
      );
    }

    const locatorValues = [body.handle, body.externalPlatformId, body.profileUrl].map(
      toNullableText,
    );
    if (locatorValues.every((value) => !value)) {
      return HttpResponse.json(
        { message: 'platform-account:validation.locatorRequired' },
        { status: 422 },
      );
    }

    platformSeed += 1;
    const nextRecord: PlatformAccountRecord = {
      id: `platform-${platformSeed}`,
      accountCode: providedOrGeneratedFixtureCode(
        body.accountCode,
        generatedFixtureCode('PA', platformSeed),
      ),
      platform: String(body.platform ?? 'YOUTUBE'),
      platformSurfaceType: String(body.platformSurfaceType ?? 'LIVESTREAM'),
      displayName: String(body.displayName ?? `Platform ${platformSeed}`),
      handle: locatorValues[0],
      externalPlatformId: locatorValues[1],
      profileUrl: locatorValues[2],
      ownerKind,
      ownerOrgUnitId: null,
      ownerTalentId: null,
      ownerTalentGroupId: null,
      operationalStatus: 'ACTIVE',
      livestreamEnabled: Boolean(body.livestreamEnabled),
      contentPublishingEnabled: Boolean(body.contentPublishingEnabled),
      monetizationEnabled: Boolean(body.monetizationEnabled),
      description: toNullableText(body.description),
      externalRef: toNullableText(body.externalRef),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (!setOwnerFields(nextRecord, ownerKind, body)) {
      return HttpResponse.json(
        { message: 'platform-account:validation.required' },
        { status: 422 },
      );
    }

    platformAccounts.push(nextRecord);
    return HttpResponse.json({ data: toPlatformDetail(nextRecord) });
  }),

  http.get('*/admin/platform-accounts/:platformAccountId', ({ params }) => {
    const record = readPlatformAccount(String(params.platformAccountId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    return HttpResponse.json({ data: toPlatformDetail(record) });
  }),

  http.patch('*/admin/platform-accounts/:platformAccountId', async ({ params, request }) => {
    const record = readPlatformAccount(String(params.platformAccountId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.operationalStatus === 'ARCHIVED') {
      return HttpResponse.json(
        { message: 'platform-account:detail.archivedReadOnly' },
        { status: 422 },
      );
    }

    const body = await parseJsonBody(request);
    if (typeof body.displayName === 'string') {
      record.displayName = body.displayName;
    }
    if ('handle' in body) {
      record.handle = toNullableText(body.handle);
    }
    if ('externalPlatformId' in body) {
      record.externalPlatformId = toNullableText(body.externalPlatformId);
    }
    if ('profileUrl' in body) {
      record.profileUrl = toNullableText(body.profileUrl);
    }
    if ('description' in body) {
      record.description = toNullableText(body.description);
    }
    if ('externalRef' in body) {
      record.externalRef = toNullableText(body.externalRef);
    }
    record.updatedAt = Date.now();

    return HttpResponse.json({ data: toPlatformDetail(record) });
  }),

  http.post(
    '*/admin/platform-accounts/:platformAccountId/ownership-transfer',
    async ({ params, request }) => {
      const record = readPlatformAccount(String(params.platformAccountId));
      if (!record) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (record.operationalStatus === 'ARCHIVED') {
        return HttpResponse.json(
          { message: 'platform-account:detail.archivedReadOnly' },
          { status: 422 },
        );
      }

      const body = await parseJsonBody(request);
      if (!isOwnerKind(body.ownerKind) || !setOwnerFields(record, body.ownerKind, body)) {
        return HttpResponse.json(
          { message: 'platform-account:validation.required' },
          { status: 422 },
        );
      }
      record.updatedAt = Date.now();

      return HttpResponse.json({ data: toPlatformDetail(record) });
    },
  ),

  http.post(
    '*/admin/platform-accounts/:platformAccountId/capabilities',
    async ({ params, request }) => {
      const record = readPlatformAccount(String(params.platformAccountId));
      if (!record) {
        return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
      }
      if (record.operationalStatus === 'ARCHIVED') {
        return HttpResponse.json(
          { message: 'platform-account:detail.archivedReadOnly' },
          { status: 422 },
        );
      }

      const body = await parseJsonBody(request);
      record.livestreamEnabled = Boolean(body.livestreamEnabled);
      record.contentPublishingEnabled = Boolean(body.contentPublishingEnabled);
      record.monetizationEnabled = Boolean(body.monetizationEnabled);
      record.updatedAt = Date.now();

      return HttpResponse.json({ data: toPlatformDetail(record) });
    },
  ),

  http.post('*/admin/platform-accounts/:platformAccountId/:action', ({ params }) => {
    const record = readPlatformAccount(String(params.platformAccountId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    const action = String(params.action);
    if (action === 'activate' && record.operationalStatus === 'INACTIVE') {
      record.operationalStatus = 'ACTIVE';
    } else if (action === 'deactivate' && record.operationalStatus === 'ACTIVE') {
      record.operationalStatus = 'INACTIVE';
    } else if (action === 'archive' && record.operationalStatus === 'INACTIVE') {
      record.operationalStatus = 'ARCHIVED';
      record.livestreamEnabled = false;
      record.contentPublishingEnabled = false;
      record.monetizationEnabled = false;
    } else {
      return HttpResponse.json(
        { message: 'platform-account:validation.lifecycleInvalid' },
        { status: 422 },
      );
    }
    record.updatedAt = Date.now();

    return HttpResponse.json({ data: toPlatformDetail(record) });
  }),

  http.get('*/admin/studio-resources/availability', ({ request }) => {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const rows = filterStudioResources(searchParams);

    return HttpResponse.json(paginate(rows.map(toStudioAvailabilityItem), searchParams));
  }),

  http.get('*/admin/studio-resources', ({ request }) => {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const rows = filterStudioResources(searchParams);

    return HttpResponse.json(paginate(rows.map(toStudioListItem), searchParams));
  }),

  http.post('*/admin/studio-resources', async ({ request }) => {
    const body = await parseJsonBody(request);
    const resourceClass = String(body.resourceClass ?? 'SPACE');
    const maxOccupancy = parseMaxOccupancy(body.maxOccupancy);
    if (resourceClass !== 'SPACE' && maxOccupancy !== null) {
      return HttpResponse.json(
        { message: 'studio-resource:validation.maxOccupancySpaceOnly' },
        { status: 422 },
      );
    }

    studioSeed += 1;
    const nextRecord: StudioResourceRecord = {
      id: `studio-${studioSeed}`,
      resourceCode: providedOrGeneratedFixtureCode(
        body.resourceCode,
        generatedFixtureCode('SR', studioSeed),
      ),
      name: String(body.name ?? `Studio ${studioSeed}`),
      shortName: toNullableText(body.shortName),
      resourceClass,
      operationalStatus: 'ACTIVE',
      locationLabel: toNullableText(body.locationLabel),
      maxOccupancy,
      description: toNullableText(body.description),
      externalRef: toNullableText(body.externalRef),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    studioResources.push(nextRecord);
    return HttpResponse.json({ data: toStudioDetail(nextRecord) });
  }),

  http.get('*/admin/studio-resources/:studioResourceId', ({ params }) => {
    const record = readStudioResource(String(params.studioResourceId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    return HttpResponse.json({ data: toStudioDetail(record) });
  }),

  http.patch('*/admin/studio-resources/:studioResourceId', async ({ params, request }) => {
    const record = readStudioResource(String(params.studioResourceId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }
    if (record.operationalStatus === 'ARCHIVED') {
      return HttpResponse.json(
        { message: 'studio-resource:detail.archivedReadOnly' },
        { status: 422 },
      );
    }

    const body = await parseJsonBody(request);
    if (typeof body.name === 'string') {
      record.name = body.name;
    }
    if ('shortName' in body) {
      record.shortName = toNullableText(body.shortName);
    }
    if ('locationLabel' in body) {
      record.locationLabel = toNullableText(body.locationLabel);
    }
    if ('description' in body) {
      record.description = toNullableText(body.description);
    }
    if ('externalRef' in body) {
      record.externalRef = toNullableText(body.externalRef);
    }
    if ('maxOccupancy' in body) {
      const maxOccupancy = parseMaxOccupancy(body.maxOccupancy);
      if (record.resourceClass !== 'SPACE' && maxOccupancy !== null) {
        return HttpResponse.json(
          { message: 'studio-resource:validation.maxOccupancySpaceOnly' },
          { status: 422 },
        );
      }
      record.maxOccupancy = maxOccupancy;
    }
    record.updatedAt = Date.now();

    return HttpResponse.json({ data: toStudioDetail(record) });
  }),

  http.post('*/admin/studio-resources/:studioResourceId/:action', ({ params }) => {
    const record = readStudioResource(String(params.studioResourceId));
    if (!record) {
      return HttpResponse.json({ message: 'errors:notFound.message' }, { status: 404 });
    }

    const action = String(params.action);
    if (action === 'out-of-service' && record.operationalStatus === 'ACTIVE') {
      record.operationalStatus = 'OUT_OF_SERVICE';
    } else if (action === 'restore-to-active' && record.operationalStatus === 'OUT_OF_SERVICE') {
      record.operationalStatus = 'ACTIVE';
    } else if (
      action === 'deactivate' &&
      (record.operationalStatus === 'ACTIVE' || record.operationalStatus === 'OUT_OF_SERVICE')
    ) {
      record.operationalStatus = 'INACTIVE';
    } else if (action === 'activate' && record.operationalStatus === 'INACTIVE') {
      record.operationalStatus = 'ACTIVE';
    } else if (action === 'archive' && record.operationalStatus === 'INACTIVE') {
      record.operationalStatus = 'ARCHIVED';
    } else {
      return HttpResponse.json(
        { message: 'studio-resource:validation.lifecycleInvalid' },
        { status: 422 },
      );
    }
    record.updatedAt = Date.now();

    return HttpResponse.json({ data: toStudioDetail(record) });
  }),
];

const filterStudioResources = (searchParams: URLSearchParams): StudioResourceRecord[] => {
  const operationalStatus = searchParams.get('operationalStatus');
  const resourceClass = searchParams.get('resourceClass');
  const hasMaxOccupancy = parseBooleanParam(searchParams.get('hasMaxOccupancy'));
  const search = searchParams.get('search');

  let rows = [...studioResources];
  if (!operationalStatus) {
    rows = rows.filter((item) => item.operationalStatus !== 'ARCHIVED');
  } else {
    rows = rows.filter((item) => item.operationalStatus === operationalStatus);
  }
  if (resourceClass) {
    rows = rows.filter((item) => item.resourceClass === resourceClass);
  }
  if (hasMaxOccupancy !== undefined) {
    rows = rows.filter((item) =>
      hasMaxOccupancy ? item.maxOccupancy !== null : item.maxOccupancy === null,
    );
  }
  if (search) {
    rows = rows.filter(
      (item) =>
        toPrefixMatch(item.resourceCode, search) ||
        toPrefixMatch(item.name, search) ||
        toPrefixMatch(item.shortName, search),
    );
  }

  return sortStudioResources(rows, searchParams.get('sortBy'), searchParams.get('sortDirection'));
};

const parseMaxOccupancy = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

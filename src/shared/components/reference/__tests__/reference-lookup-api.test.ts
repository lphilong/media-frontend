import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  loadPlatformAccountReferenceOptions,
  loadPlatformOwnerReferenceOptions,
  loadStudioResourceReferenceOptionsByIds,
  loadTalentReferenceOptions,
} from '@shared/components/reference/admin-reference-options';
import { fetchReferenceLookupOptions } from '@shared/components/reference/reference-lookup.api';
import { server } from '@test/msw/server';

describe('reference lookup API', () => {
  it('loads finance form talent options from narrow lookup, not broad Talent read', async () => {
    server.use(
      http.get('*/admin/talents', () => {
        return HttpResponse.json({ message: 'Forbidden broad read' }, { status: 403 });
      }),
      http.get('*/admin/reference/talents', () => {
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 'talent-finance-1',
                label: 'Mina',
                code: 'TAL-000001',
                status: 'ACTIVE',
              },
            ],
          },
        });
      }),
    );

    await expect(loadTalentReferenceOptions('Mina')).resolves.toEqual([
      expect.objectContaining({
        id: 'talent-finance-1',
        label: 'Mina - TAL-000001',
      }),
    ]);
  });

  it('loads selected studio resource labels through lookup ids without broad Studio Resource read', async () => {
    const capturedUrls: URL[] = [];
    server.use(
      http.get('*/admin/studio-resources/:studioResourceId', () => {
        return HttpResponse.json({ message: 'Forbidden broad read' }, { status: 403 });
      }),
      http.get('*/admin/reference/studio-resources', ({ request }) => {
        capturedUrls.push(new URL(request.url));
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 'studio-hr-1',
                label: 'Main Studio',
                code: 'SR-000001',
                status: 'ACTIVE',
                type: 'ROOM',
              },
            ],
          },
        });
      }),
    );

    await expect(loadStudioResourceReferenceOptionsByIds(['studio-hr-1'])).resolves.toEqual([
      expect.objectContaining({
        id: 'studio-hr-1',
        label: 'Main Studio - SR-000001',
      }),
    ]);
    expect(capturedUrls[0]?.searchParams.get('ids')).toBe('studio-hr-1');
  });

  it('loads ops platform options from narrow lookup without unrelated module read', async () => {
    server.use(
      http.get('*/admin/platform-accounts', () => {
        return HttpResponse.json({ message: 'Forbidden broad read' }, { status: 403 });
      }),
      http.get('*/admin/reference/platform-accounts', () => {
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 'platform-ops-1',
                label: 'Mina Live',
                secondaryLabel: 'YOUTUBE',
                code: 'PA-000001',
                status: 'ACTIVE',
                type: 'CHANNEL',
              },
            ],
          },
        });
      }),
    );

    await expect(loadPlatformAccountReferenceOptions('Mina')).resolves.toEqual([
      expect.objectContaining({
        id: 'platform-ops-1',
        label: 'Mina Live - PA-000001',
      }),
    ]);
  });

  it('loads platform OrgUnit owners through narrow lookup without broad OrgUnit read', async () => {
    server.use(
      http.get('*/admin/org-units', () => {
        return HttpResponse.json({ message: 'Forbidden broad read' }, { status: 403 });
      }),
      http.get('*/admin/reference/org-units', () => {
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 'ou-production',
                label: 'Production',
                code: 'OU-PROD',
                status: 'ACTIVE',
                type: 'DEPARTMENT',
              },
            ],
          },
        });
      }),
    );

    await expect(loadPlatformOwnerReferenceOptions('ORG_UNIT', 'Production')).resolves.toEqual([
      expect.objectContaining({
        id: 'ou-production',
        label: 'Production - OU-PROD',
      }),
    ]);
  });

  it('rejects unsafe extra fields in lookup responses', async () => {
    server.use(
      http.get('*/admin/reference/talents', () => {
        return HttpResponse.json({
          data: {
            items: [
              {
                id: 'talent-unsafe',
                label: 'Unsafe Talent',
                code: 'TAL-UNSAFE',
                unsafeExtraField: 'must-not-parse',
              },
            ],
          },
        });
      }),
    );

    await expect(fetchReferenceLookupOptions('talents', { limit: 20 })).rejects.toThrow();
  });
});

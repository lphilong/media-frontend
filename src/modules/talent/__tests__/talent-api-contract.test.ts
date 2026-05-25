import { http, HttpResponse } from 'msw';

import { fetchTalents } from '@modules/talent/api/talent.api';
import { server } from '@test/msw/server';

const talentListItem = {
  id: 'talent-contract-001',
  talentCode: 'TAL-CONTRACT-001',
  displayName: 'Contract Talent',
  performanceAlias: null,
  stageName: 'Contract Talent',
  legalName: 'Contract Talent Legal',
  displayShortName: null,
  talentOrigin: 'INTERNAL',
  operationalStatus: 'ACTIVE',
  managerEmploymentProfileId: null,
  linkedEmploymentProfileId: null,
  commercialParticipationStatus: 'ELIGIBLE',
  livestreamEligible: true,
  eventEligible: true,
  createdAt: 1,
  updatedAt: 1,
};

describe('talent API contract', () => {
  it('accepts the backend commercial participation enum values exactly', async () => {
    server.use(
      http.get('*/admin/talents', () =>
        HttpResponse.json({
          data: [
            talentListItem,
            {
              ...talentListItem,
              id: 'talent-contract-002',
              talentCode: 'TAL-CONTRACT-002',
              commercialParticipationStatus: 'RESTRICTED',
            },
            {
              ...talentListItem,
              id: 'talent-contract-003',
              talentCode: 'TAL-CONTRACT-003',
              commercialParticipationStatus: 'BLOCKED',
              livestreamEligible: false,
              eventEligible: false,
            },
          ],
        }),
      ),
    );

    await expect(fetchTalents({})).resolves.toEqual({
      data: expect.arrayContaining([
        expect.objectContaining({ commercialParticipationStatus: 'ELIGIBLE' }),
        expect.objectContaining({ commercialParticipationStatus: 'RESTRICTED' }),
        expect.objectContaining({ commercialParticipationStatus: 'BLOCKED' }),
      ]),
    });
  });

  it('rejects stale commercial participation values from responses', async () => {
    const staleCommercialParticipationStatus = ['ALL', 'OWED'].join('');

    server.use(
      http.get('*/admin/talents', () =>
        HttpResponse.json({
          data: [
            {
              ...talentListItem,
              commercialParticipationStatus: staleCommercialParticipationStatus,
            },
          ],
        }),
      ),
    );

    await expect(fetchTalents({})).rejects.toThrow();
  });
});

import i18n from 'i18next';
import type { ReactElement } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import {
  createWorkShift,
  fetchWorkShifts,
  performWorkShiftLifecycleAction,
  reassignWorkShiftSubject,
} from '@modules/work-schedule/api/work-schedule.api';
import { createWorkShiftActionRailItems } from '@modules/work-schedule/actions/work-schedule-action-rail';
import {
  WorkShiftCreateSurface,
  WorkShiftEditSurface,
  WorkShiftReassignSubjectSurface,
  WorkShiftReplaceResourcesSurface,
  WorkShiftRescheduleSurface,
} from '@modules/work-schedule/forms/work-schedule-mutation-forms';
import type { WorkShiftRecord } from '@modules/work-schedule/types/work-schedule.types';
import { apiRequest } from '@shared/api';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import {
  parseScreenQueryParams,
  serializeScreenQueryParams,
  workShiftByResourceQueryConfig,
  workShiftBySubjectQueryConfig,
  workShiftFlatListQueryConfig,
} from '@shared/query';

vi.mock('@shared/api', () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(apiRequest);

const renderWithRouter = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const mockReferencePickerRequests = (): void => {
  apiRequestMock.mockImplementation(async ({ url }) => {
    if (url === '/admin/employment-profiles') {
      return {
        data: [
          {
            id: 'ep-001',
            employeeCode: 'EMP001',
            legalName: 'Employee One',
            displayName: 'Employee One',
            employmentKind: 'FULL_TIME',
            jobTitle: 'Operator',
            orgUnitId: 'ou-sales',
            managerEmploymentProfileId: null,
            linkedUserId: null,
            employmentStatus: 'ACTIVE',
            contractStatus: 'ACTIVE',
            createdAt: 1,
          },
        ],
        meta: undefined,
      };
    }
    if (url === '/admin/talents') {
      return {
        data: [
          {
            id: 'talent-001',
            talentCode: 'TAL001',
            legalName: 'Talent One',
            stageName: 'Talent One',
            displayShortName: 'Talent',
            talentOrigin: 'INTERNAL',
            operationalStatus: 'ACTIVE',
            managerEmploymentProfileId: null,
            linkedEmploymentProfileId: null,
            commercialParticipationStatus: 'ALLOWED',
            livestreamEligible: true,
            eventEligible: true,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        meta: undefined,
      };
    }
    if (url === '/admin/talent-groups') {
      return {
        data: [
          {
            id: 'group-001',
            groupCode: 'GRP001',
            name: 'Group One',
            shortName: 'Group',
            status: 'ACTIVE',
            displayOrder: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        meta: undefined,
      };
    }
    if (url === '/admin/studio-resources') {
      return {
        data: [
          {
            id: 'studio-001',
            resourceCode: 'STUDIO001',
            name: 'Studio One',
            shortName: 'Studio 1',
            resourceClass: 'ROOM',
            operationalStatus: 'ACTIVE',
            locationLabel: null,
            maxOccupancy: null,
            createdAt: 1,
          },
          {
            id: 'studio-002',
            resourceCode: 'STUDIO002',
            name: 'Studio Two',
            shortName: 'Studio 2',
            resourceClass: 'ROOM',
            operationalStatus: 'ACTIVE',
            locationLabel: null,
            maxOccupancy: null,
            createdAt: 1,
          },
          {
            id: 'studio-003',
            resourceCode: 'STUDIO003',
            name: 'Studio Three',
            shortName: 'Studio 3',
            resourceClass: 'ROOM',
            operationalStatus: 'ACTIVE',
            locationLabel: null,
            maxOccupancy: null,
            createdAt: 1,
          },
        ],
        meta: undefined,
      };
    }
    return { data: [], meta: undefined };
  });
};

const findPicker = async (pickerId: string): Promise<HTMLElement> => {
  await waitFor(() => {
    expect(
      screen
        .getAllByTestId('picker-surface')
        .some((surface) => surface.getAttribute('data-picker-id') === pickerId),
    ).toBe(true);
  });
  const picker = screen
    .getAllByTestId('picker-surface')
    .find((surface) => surface.getAttribute('data-picker-id') === pickerId);
  if (!picker) {
    throw new Error(`Picker not found: ${pickerId}`);
  }
  return picker;
};

const selectPickerOption = async (
  user: ReturnType<typeof userEvent.setup>,
  pickerId: string,
  optionText: RegExp,
): Promise<void> => {
  const picker = await findPicker(pickerId);
  await user.click(await within(picker).findByText(optionText));
};

const detailRecord: WorkShiftRecord = {
  id: 'work-shift-001',
  shiftCode: 'SHIFT001',
  title: 'Main shift',
  subjectKind: 'EMPLOYMENT_PROFILE',
  subjectEmploymentProfileId: 'ep-001',
  subjectTalentId: null,
  subjectTalentGroupId: null,
  studioResourceIds: ['studio-001'],
  status: 'ACTIVE',
  shiftStartAt: 1_900_000_000_000,
  shiftEndAt: 1_900_003_600_000,
  description: null,
  externalRef: null,
  createdAt: 1,
  updatedAt: 2,
};

describe('work schedule wave 6 query and payload shaping', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setLocale(DEFAULT_LOCALE);
  });

  it('parses and serializes only documented flat-list query keys', () => {
    const query = parseScreenQueryParams(
      new URLSearchParams(
        'status=ACTIVE&subjectKind=EMPLOYMENT_PROFILE&subjectEmploymentProfileId=ep-001&containsStudioResourceId=studio-001&windowStartAt=&windowEndAt=200&limit=50&cursor=opaque&search=SHIFT&sortBy=shiftStartAt&sortDirection=desc&page=2&scope=team&scopeGrants=x',
      ),
      workShiftFlatListQueryConfig,
    );

    expect(query).toEqual({
      status: 'ACTIVE',
      subjectKind: 'EMPLOYMENT_PROFILE',
      subjectEmploymentProfileId: 'ep-001',
      containsStudioResourceId: 'studio-001',
      windowEndAt: 200,
      limit: 50,
      cursor: 'opaque',
      search: 'SHIFT',
      sortBy: 'shiftStartAt',
      sortDirection: 'desc',
      scope: 'team',
    });
    expect(query.windowStartAt).toBeUndefined();

    const params = serializeScreenQueryParams(
      {
        ...query,
        page: 2,
        scopeGrants: 'x',
      },
      workShiftFlatListQueryConfig,
    );
    expect(Array.from(params.keys()).sort()).toEqual([
      'containsStudioResourceId',
      'cursor',
      'limit',
      'scope',
      'search',
      'sortBy',
      'sortDirection',
      'status',
      'subjectEmploymentProfileId',
      'subjectKind',
      'windowEndAt',
    ]);
    expect(params.get('page')).toBeNull();
    expect(params.get('scopeGrants')).toBeNull();
  });

  it('normalizes by-subject and by-resource queries fail-closed for scope and identity', () => {
    const talentQuery = parseScreenQueryParams(
      new URLSearchParams(
        'view=by-subject&subjectKind=TALENT&subjectTalentId=talent-001&scope=self&search=nope&page=2',
      ),
      workShiftBySubjectQueryConfig,
    );
    expect(talentQuery).toEqual({
      view: 'by-subject',
      subjectKind: 'TALENT',
      subjectTalentId: 'talent-001',
    });

    const employmentQuery = parseScreenQueryParams(
      new URLSearchParams(
        'view=by-subject&subjectKind=EMPLOYMENT_PROFILE&subjectEmploymentProfileId=ep-001&scope=department',
      ),
      workShiftBySubjectQueryConfig,
    );
    expect(employmentQuery.scope).toBe('department');

    const missingIdentity = parseScreenQueryParams(
      new URLSearchParams('view=by-resource&scope=global'),
      workShiftByResourceQueryConfig,
    );
    expect(missingIdentity.view).toBeUndefined();
    expect(missingIdentity.scope).toBe('global');

    const resourceParams = serializeScreenQueryParams(
      {
        view: 'by-resource',
        studioResourceId: 'studio-001',
        status: 'ACTIVE',
        windowStartAt: '',
        search: 'not-supported',
        page: 1,
        scope: 'global',
      },
      workShiftByResourceQueryConfig,
    );
    expect(Array.from(resourceParams.keys()).sort()).toEqual([
      'scope',
      'status',
      'studioResourceId',
      'view',
    ]);
  });

  it('keeps Work Schedule scope in query params only for API calls', async () => {
    apiRequestMock.mockResolvedValue({ data: [], meta: undefined });
    await fetchWorkShifts({
      status: 'ACTIVE',
      scope: 'team',
      scopeGrants: ['forbidden'],
    } as Parameters<typeof fetchWorkShifts>[0]);
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/admin/work-shifts',
        params: expect.objectContaining({
          status: 'ACTIVE',
          scope: 'team',
        }),
      }),
    );
    expect(apiRequestMock.mock.calls.at(-1)?.[0].params).not.toHaveProperty('scopeGrants');

    apiRequestMock.mockResolvedValue({ data: detailRecord });
    await performWorkShiftLifecycleAction('work-shift-001', 'cancel', 'department');
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/work-shifts/work-shift-001/cancel',
        params: { scope: 'department' },
        data: {},
      }),
    );
  });

  it('sanitizes Work Schedule mutation bodies so scope fields never leak into payloads', async () => {
    apiRequestMock.mockResolvedValue({ data: detailRecord });

    await createWorkShift(
      {
        shiftCode: 'SHIFT902',
        title: 'Scoped create',
        subjectKind: 'EMPLOYMENT_PROFILE',
        subjectEmploymentProfileId: 'ep-001',
        subjectTalentId: 'talent-forbidden',
        shiftStartAt: 1000,
        shiftEndAt: 2000,
        studioResourceIds: ['studio-001'],
        description: null,
        externalRef: null,
        scope: 'team',
        scopeGrants: ['forbidden'],
      } as Parameters<typeof createWorkShift>[0],
      'team',
    );
    expect(apiRequestMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/work-shifts',
        params: { scope: 'team' },
        data: {
          shiftCode: 'SHIFT902',
          title: 'Scoped create',
          subjectKind: 'EMPLOYMENT_PROFILE',
          subjectEmploymentProfileId: 'ep-001',
          shiftStartAt: 1000,
          shiftEndAt: 2000,
          studioResourceIds: ['studio-001'],
          description: null,
          externalRef: null,
        },
      }),
    );
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('scope');
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('scopeGrants');
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('subjectTalentId');

    await reassignWorkShiftSubject(
      'work-shift-001',
      {
        newSubjectKind: 'TALENT',
        newSubjectTalentId: 'talent-001',
        newSubjectEmploymentProfileId: 'ep-forbidden',
        scope: 'global',
        scopeGrants: ['forbidden'],
      } as Parameters<typeof reassignWorkShiftSubject>[1],
      'global',
    );
    expect(apiRequestMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/work-shifts/work-shift-001/reassign-subject',
        params: { scope: 'global' },
        data: {
          newSubjectKind: 'TALENT',
          newSubjectTalentId: 'talent-001',
        },
      }),
    );
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('scope');
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('scopeGrants');
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty(
      'newSubjectEmploymentProfileId',
    );
  });

  it('omits blank create shiftCode so backend can generate it', async () => {
    apiRequestMock.mockResolvedValue({ data: detailRecord });

    await createWorkShift({
      shiftCode: '   ',
      title: 'Generated code create',
      subjectKind: 'EMPLOYMENT_PROFILE',
      subjectEmploymentProfileId: 'ep-001',
      shiftStartAt: 1000,
      shiftEndAt: 2000,
      studioResourceIds: [],
      description: null,
      externalRef: null,
    });

    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).toEqual({
      title: 'Generated code create',
      subjectKind: 'EMPLOYMENT_PROFILE',
      subjectEmploymentProfileId: 'ep-001',
      shiftStartAt: 1000,
      shiftEndAt: 2000,
      studioResourceIds: [],
      description: null,
      externalRef: null,
    });
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('shiftCode');
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('scopeGrants');
  });

  it.each(['self', 'team', 'department'] as const)(
    'allows Employment Profile create under %s scope and blocks Talent/Talent Group create',
    async (currentScope) => {
      const user = userEvent.setup();
      mockReferencePickerRequests();

      const onCreate = vi.fn();
      const createRender = renderWithRouter(
        <WorkShiftCreateSurface
          currentScope={currentScope}
          onCancel={() => undefined}
          onSubmit={onCreate}
        />,
      );
      await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.title')), 'Scoped shift');
      await selectPickerOption(user, 'work-shift-admin-subject', /EMP001/);
      await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.shiftStartAt')), '1000');
      await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.shiftEndAt')), '2000');
      await user.click(
        screen.getByRole('button', { name: i18n.t('work-schedule:mutations.create.submit') }),
      );
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectKind: 'EMPLOYMENT_PROFILE',
          subjectEmploymentProfileId: 'ep-001',
        }),
      );
      createRender.unmount();

      for (const subjectKind of ['TALENT', 'TALENT_GROUP'] as const) {
        const blockedSubmit = vi.fn();
        const blockedRender = renderWithRouter(
          <WorkShiftCreateSurface
            currentScope={currentScope}
            onCancel={() => undefined}
            onSubmit={blockedSubmit}
          />,
        );
        await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.title')), 'Bad shift');
        await user.selectOptions(
          screen.getByLabelText(i18n.t('work-schedule:fields.subjectKind')),
          subjectKind,
        );
        await selectPickerOption(
          user,
          'work-shift-admin-subject',
          subjectKind === 'TALENT' ? /TAL001/ : /GRP001/,
        );
        await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.shiftStartAt')), '1000');
        await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.shiftEndAt')), '2000');
        await user.click(
          screen.getByRole('button', { name: i18n.t('work-schedule:mutations.create.submit') }),
        );
        expect(blockedSubmit).not.toHaveBeenCalled();
        expect(
          screen.getByText(i18n.t('work-schedule:validation.nonGlobalEmploymentProfileOnly')),
        ).toBeInTheDocument();
        blockedRender.unmount();
      }
    },
    20_000,
  );

  it.each(['self', 'team', 'department'] as const)(
    'allows Employment Profile reassign under %s scope and blocks Talent/Talent Group reassign',
    async (currentScope) => {
      const user = userEvent.setup();
      mockReferencePickerRequests();

      const onReassign = vi.fn();
      const allowedRender = renderWithRouter(
        <WorkShiftReassignSubjectSurface
          currentScope={currentScope}
          initialValues={detailRecord}
          onCancel={() => undefined}
          onSubmit={onReassign}
        />,
      );
      await user.click(
        screen.getByRole('button', {
          name: i18n.t('work-schedule:mutations.reassignSubject.submit'),
        }),
      );
      expect(onReassign).toHaveBeenCalledWith({
        newSubjectKind: 'EMPLOYMENT_PROFILE',
        newSubjectEmploymentProfileId: 'ep-001',
      });
      allowedRender.unmount();

      for (const subjectKind of ['TALENT', 'TALENT_GROUP'] as const) {
        const blockedSubmit = vi.fn();
        const blockedRender = renderWithRouter(
          <WorkShiftReassignSubjectSurface
            currentScope={currentScope}
            initialValues={detailRecord}
            onCancel={() => undefined}
            onSubmit={blockedSubmit}
          />,
        );
        await user.selectOptions(
          screen.getByLabelText(i18n.t('work-schedule:fields.newSubjectKind')),
          subjectKind,
        );
        await selectPickerOption(
          user,
          'work-shift-reassign-subject',
          subjectKind === 'TALENT' ? /TAL001/ : /GRP001/,
        );
        await user.click(
          screen.getByRole('button', {
            name: i18n.t('work-schedule:mutations.reassignSubject.submit'),
          }),
        );
        expect(blockedSubmit).not.toHaveBeenCalled();
        expect(
          screen.getByText(i18n.t('work-schedule:validation.nonGlobalEmploymentProfileOnly')),
        ).toBeInTheDocument();
        blockedRender.unmount();
      }
    },
    20_000,
  );

  it.each([undefined, 'global'] as const)(
    'allows Talent and Talent Group create/reassign when scope is %s',
    async (currentScope) => {
      const user = userEvent.setup();
      mockReferencePickerRequests();
      const onCreate = vi.fn();
      const createRender = renderWithRouter(
        <WorkShiftCreateSurface
          currentScope={currentScope}
          onCancel={() => undefined}
          onSubmit={onCreate}
        />,
      );
      await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.title')), 'Global shift');
      await user.selectOptions(
        screen.getByLabelText(i18n.t('work-schedule:fields.subjectKind')),
        'TALENT',
      );
      await selectPickerOption(user, 'work-shift-admin-subject', /TAL001/);
      await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.shiftStartAt')), '1000');
      await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.shiftEndAt')), '2000');
      await user.click(
        screen.getByRole('button', { name: i18n.t('work-schedule:mutations.create.submit') }),
      );
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({ subjectKind: 'TALENT', subjectTalentId: 'talent-001' }),
      );
      createRender.unmount();

      const onReassign = vi.fn();
      renderWithRouter(
        <WorkShiftReassignSubjectSurface
          currentScope={currentScope}
          initialValues={detailRecord}
          onCancel={() => undefined}
          onSubmit={onReassign}
        />,
      );
      await user.selectOptions(
        screen.getByLabelText(i18n.t('work-schedule:fields.newSubjectKind')),
        'TALENT_GROUP',
      );
      await selectPickerOption(user, 'work-shift-reassign-subject', /GRP001/);
      await user.click(
        screen.getByRole('button', {
          name: i18n.t('work-schedule:mutations.reassignSubject.submit'),
        }),
      );
      expect(onReassign).toHaveBeenCalledWith({
        newSubjectKind: 'TALENT_GROUP',
        newSubjectTalentGroupId: 'group-001',
      });
    },
    20_000,
  );

  it('submits create, edit, reschedule, reassign, and replacement payloads exactly', async () => {
    const user = userEvent.setup();
    mockReferencePickerRequests();

    const onCreate = vi.fn();
    const createRender = renderWithRouter(
      <WorkShiftCreateSurface onCancel={() => undefined} onSubmit={onCreate} />,
    );
    await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.title')), 'Wave 6 shift');
    await selectPickerOption(user, 'work-shift-admin-subject', /EMP001/);
    await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.shiftStartAt')), '1000');
    await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.shiftEndAt')), '2000');
    await selectPickerOption(user, 'work-shift-admin-studio-resources', /STUDIO001/);
    await selectPickerOption(user, 'work-shift-admin-studio-resources', /STUDIO002/);
    await user.click(
      screen.getByRole('button', { name: i18n.t('work-schedule:mutations.create.submit') }),
    );
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Wave 6 shift',
      subjectKind: 'EMPLOYMENT_PROFILE',
      subjectEmploymentProfileId: 'ep-001',
      shiftStartAt: 1000,
      shiftEndAt: 2000,
      studioResourceIds: ['studio-001', 'studio-002'],
      description: null,
      externalRef: null,
    });
    createRender.unmount();

    const onEdit = vi.fn();
    const editRender = renderWithRouter(
      <WorkShiftEditSurface
        initialValues={{ title: 'Wave 6 shift', description: 'old', externalRef: 'EXT' }}
        onCancel={() => undefined}
        onSubmit={onEdit}
      />,
    );
    await user.clear(screen.getByLabelText(i18n.t('work-schedule:fields.description')));
    await user.click(
      screen.getByRole('button', { name: i18n.t('work-schedule:mutations.edit.submit') }),
    );
    expect(onEdit).toHaveBeenCalledWith({
      title: 'Wave 6 shift',
      description: null,
      externalRef: 'EXT',
    });
    editRender.unmount();

    const onReschedule = vi.fn();
    const rescheduleRender = renderWithRouter(
      <WorkShiftRescheduleSurface
        initialValues={{ shiftStartAt: 1000, shiftEndAt: 2000 }}
        onCancel={() => undefined}
        onSubmit={onReschedule}
      />,
    );
    await user.clear(screen.getByLabelText(i18n.t('work-schedule:fields.newShiftStartAt')));
    await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.newShiftStartAt')), '3000');
    await user.clear(screen.getByLabelText(i18n.t('work-schedule:fields.newShiftEndAt')));
    await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.newShiftEndAt')), '4000');
    await user.click(
      screen.getByRole('button', { name: i18n.t('work-schedule:mutations.reschedule.submit') }),
    );
    expect(onReschedule).toHaveBeenCalledWith({
      newShiftStartAt: 3000,
      newShiftEndAt: 4000,
    });
    rescheduleRender.unmount();

    const onReassign = vi.fn();
    const reassignRender = renderWithRouter(
      <WorkShiftReassignSubjectSurface
        initialValues={detailRecord}
        onCancel={() => undefined}
        onSubmit={onReassign}
      />,
    );
    await user.selectOptions(
      screen.getByLabelText(i18n.t('work-schedule:fields.newSubjectKind')),
      'TALENT_GROUP',
    );
    await selectPickerOption(user, 'work-shift-reassign-subject', /GRP001/);
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('work-schedule:mutations.reassignSubject.submit'),
      }),
    );
    expect(onReassign).toHaveBeenCalledWith({
      newSubjectKind: 'TALENT_GROUP',
      newSubjectTalentGroupId: 'group-001',
    });
    reassignRender.unmount();

    const onReplace = vi.fn();
    renderWithRouter(
      <WorkShiftReplaceResourcesSurface
        initialResourceIds={[]}
        onCancel={() => undefined}
        onSubmit={onReplace}
      />,
    );
    await selectPickerOption(user, 'work-shift-replace-studio-resources', /STUDIO003/);
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('work-schedule:mutations.replaceResources.submit'),
      }),
    );
    expect(onReplace).toHaveBeenCalledWith({
      newStudioResourceIds: ['studio-003'],
    });
  }, 20_000);

  it('gates lifecycle actions and keeps archived records read-only', () => {
    const activeItems = createWorkShiftActionRailItems(i18n.t, detailRecord, {
      onEdit: vi.fn(),
      onReschedule: vi.fn(),
      onReassignSubject: vi.fn(),
      onReplaceResources: vi.fn(),
      onLifecycleAction: vi.fn(),
    });
    expect(activeItems.find((item) => item.id === 'cancel')?.disabled).toBeFalsy();
    expect(activeItems.find((item) => item.id === 'archive')?.disabled).toBe(true);

    const archivedItems = createWorkShiftActionRailItems(
      i18n.t,
      { ...detailRecord, status: 'ARCHIVED' },
      {
        onEdit: vi.fn(),
        onReschedule: vi.fn(),
        onReassignSubject: vi.fn(),
        onReplaceResources: vi.fn(),
        onLifecycleAction: vi.fn(),
      },
    );
    expect(archivedItems.every((item) => item.disabled)).toBe(true);
  });
});

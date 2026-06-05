import i18n from 'i18next';
import type { ReactElement } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import {
  approveWorkScheduleRequest,
  cancelWorkScheduleRequest,
  createWorkScheduleRequest,
  createWorkShift,
  fetchWorkShifts,
  fetchWorkScheduleRequests,
  performWorkShiftLifecycleAction,
  reassignWorkShiftSubject,
  rejectWorkScheduleRequest,
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
const businessStartInput = '2026-05-20T14:14';
const businessEndInput = '2026-05-20T15:14';
const rescheduleStartInput = '2026-05-21T09:30';
const rescheduleEndInput = '2026-05-21T10:30';
const businessStartUtcMs = Date.parse('2026-05-20T07:14:00.000Z');
const businessEndUtcMs = Date.parse('2026-05-20T08:14:00.000Z');
const rescheduleStartUtcMs = Date.parse('2026-05-21T02:30:00.000Z');
const rescheduleEndUtcMs = Date.parse('2026-05-21T03:30:00.000Z');

const renderWithRouter = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const mockReferencePickerRequests = (): void => {
  apiRequestMock.mockImplementation(async ({ url }) => {
    if (url === '/admin/reference/employment-profiles') {
      return {
        data: {
          items: [
            {
              id: 'ep-001',
              label: 'Employee One',
              code: 'EP-000001',
              status: 'ACTIVE',
              type: 'FULL_TIME',
            },
          ],
        },
      };
    }
    if (url === '/admin/reference/talents') {
      return {
        data: {
          items: [
            {
              id: 'talent-001',
              label: 'Talent One',
              code: 'TAL-000001',
              status: 'ACTIVE',
              type: 'INTERNAL',
            },
          ],
        },
      };
    }
    if (url === '/admin/reference/talent-groups') {
      return {
        data: {
          items: [
            {
              id: 'group-001',
              label: 'Group One',
              code: 'TG-000001',
              status: 'ACTIVE',
            },
          ],
        },
      };
    }
    if (url === '/admin/reference/studio-resources') {
      return {
        data: {
          items: [
            {
              id: 'studio-001',
              label: 'Studio One',
              code: 'SR-000001',
              status: 'ACTIVE',
              type: 'ROOM',
            },
            {
              id: 'studio-002',
              label: 'Studio Two',
              code: 'SR-000002',
              status: 'ACTIVE',
              type: 'ROOM',
            },
            {
              id: 'studio-003',
              label: 'Studio Three',
              code: 'SR-000003',
              status: 'ACTIVE',
              type: 'ROOM',
            },
          ],
        },
      };
    }
    return { data: { items: [] } };
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
        description: 'Manual exception',
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
          description: 'Manual exception',
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
      description: 'Manual exception',
      externalRef: null,
    });

    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).toEqual({
      title: 'Generated code create',
      subjectKind: 'EMPLOYMENT_PROFILE',
      subjectEmploymentProfileId: 'ep-001',
      shiftStartAt: 1000,
      shiftEndAt: 2000,
      studioResourceIds: [],
      description: 'Manual exception',
      externalRef: null,
    });
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('shiftCode');
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('scopeGrants');
  });

  it('shapes WorkSchedule request API payloads strictly', async () => {
    const requestRecord = {
      id: 'request-1',
      requestCode: 'WSR-202605-000001',
      requestType: 'CREATE_SHIFT',
      status: 'PENDING',
      targetKind: 'EMPLOYMENT_PROFILE_WORK_SHIFT',
      requestSource: 'TEAM_MANAGER',
      targetEmploymentProfileId: 'ep-001',
      targetEmploymentProfileRef: null,
      targetWorkShiftId: null,
      targetWorkShiftRef: null,
      requestedByUserId: 'manager-user',
      requestedByEmploymentProfileId: 'ep-manager',
      reason: 'Coverage needed',
      proposedStartAt: 1000,
      proposedEndAt: 2000,
      proposedTitle: 'Coverage',
      proposedStudioResourceIds: [],
      proposedDescription: null,
      proposedExternalRef: null,
      approvedByUserId: null,
      approvedAt: null,
      approvalNote: null,
      rejectedByUserId: null,
      rejectedAt: null,
      rejectionReason: null,
      cancelledByUserId: null,
      cancelledAt: null,
      cancellationReason: null,
      appliedWorkShiftId: null,
      appliedWorkShiftRef: null,
      createdAt: 1,
      updatedAt: 1,
    };

    apiRequestMock.mockResolvedValue({ data: [requestRecord], meta: undefined });
    await fetchWorkScheduleRequests({
      status: 'PENDING',
      requestType: 'CREATE_SHIFT',
      limit: 10,
    });
    expect(apiRequestMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        method: 'GET',
        url: '/admin/work-schedule/requests',
        params: {
          status: 'PENDING',
          requestType: 'CREATE_SHIFT',
          limit: 10,
        },
      }),
    );

    apiRequestMock.mockResolvedValue({ data: requestRecord });
    await createWorkScheduleRequest({
      requestType: 'CREATE_SHIFT',
      targetEmploymentProfileId: ' ep-001 ',
      targetWorkShiftId: ' ',
      reason: ' Coverage needed ',
      proposedStartAt: 1000,
      proposedEndAt: 2000,
      proposedTitle: ' Coverage ',
      proposedStudioResourceIds: [],
      proposedDescription: null,
      proposedExternalRef: undefined,
      scopeGrants: ['forbidden'],
    } as Parameters<typeof createWorkScheduleRequest>[0]);
    expect(apiRequestMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/work-schedule/requests',
        data: {
          requestType: 'CREATE_SHIFT',
          targetEmploymentProfileId: 'ep-001',
          reason: 'Coverage needed',
          proposedStartAt: 1000,
          proposedEndAt: 2000,
          proposedTitle: 'Coverage',
          proposedStudioResourceIds: [],
          proposedDescription: null,
        },
      }),
    );
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('scopeGrants');
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('targetWorkShiftId');

    await approveWorkScheduleRequest('request-1', { approvalNote: ' Approved ' });
    expect(apiRequestMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/work-schedule/requests/request-1/approve',
        data: { approvalNote: 'Approved' },
      }),
    );

    await rejectWorkScheduleRequest('request-1', { rejectionReason: ' No coverage ' });
    expect(apiRequestMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/work-schedule/requests/request-1/reject',
        data: { rejectionReason: 'No coverage' },
      }),
    );

    await cancelWorkScheduleRequest('request-1', { cancellationReason: ' Replaced ' });
    expect(apiRequestMock.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/work-schedule/requests/request-1/cancel',
        data: { cancellationReason: 'Replaced' },
      }),
    );
  });

  it.each(['self', 'team', 'department'] as const)(
    'allows only Employment Profile create under %s scope',
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
      expect(
        screen.getByText(i18n.t('work-schedule:mutations.create.exceptionCopy')),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('combobox', { name: i18n.t('work-schedule:fields.subjectKind') }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(i18n.t('work-schedule:subjectKinds.TALENT')),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(i18n.t('work-schedule:subjectKinds.TALENT_GROUP')),
      ).not.toBeInTheDocument();
      await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.title')), 'Scoped shift');
      await selectPickerOption(user, 'work-shift-admin-subject', /EP-000001/);
      await user.type(
        screen.getByLabelText(i18n.t('work-schedule:fields.shiftStartAt')),
        businessStartInput,
      );
      await user.type(
        screen.getByLabelText(i18n.t('work-schedule:fields.shiftEndAt')),
        businessEndInput,
      );
      await user.type(
        screen.getByLabelText(i18n.t('work-schedule:fields.description')),
        'Manual exception',
      );
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
          subjectKind === 'TALENT' ? /TAL-000001/ : /TG-000001/,
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
    'hides Talent and Talent Group create while preserving global reassign when scope is %s',
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
      expect(
        screen.queryByRole('combobox', { name: i18n.t('work-schedule:fields.subjectKind') }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(i18n.t('work-schedule:subjectKinds.TALENT')),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(i18n.t('work-schedule:subjectKinds.TALENT_GROUP')),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(i18n.t('work-schedule:mutations.create.exceptionCopy')),
      ).toBeInTheDocument();
      expect(onCreate).not.toHaveBeenCalled();
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
      await selectPickerOption(user, 'work-shift-reassign-subject', /TG-000001/);
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
    await selectPickerOption(user, 'work-shift-admin-subject', /EP-000001/);
    await user.type(
      screen.getByLabelText(i18n.t('work-schedule:fields.shiftStartAt')),
      businessStartInput,
    );
    await user.type(
      screen.getByLabelText(i18n.t('work-schedule:fields.shiftEndAt')),
      businessEndInput,
    );
    await selectPickerOption(user, 'work-shift-admin-studio-resources', /SR-000001/);
    await selectPickerOption(user, 'work-shift-admin-studio-resources', /SR-000002/);
    await user.type(
      screen.getByLabelText(i18n.t('work-schedule:fields.description')),
      'Manual exception',
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('work-schedule:mutations.create.submit') }),
    );
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Wave 6 shift',
      subjectKind: 'EMPLOYMENT_PROFILE',
      subjectEmploymentProfileId: 'ep-001',
      shiftStartAt: businessStartUtcMs,
      shiftEndAt: businessEndUtcMs,
      studioResourceIds: ['studio-001', 'studio-002'],
      description: 'Manual exception',
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
        initialValues={{ shiftStartAt: businessStartUtcMs, shiftEndAt: businessEndUtcMs }}
        onCancel={() => undefined}
        onSubmit={onReschedule}
      />,
    );
    expect(screen.getByLabelText(i18n.t('work-schedule:fields.newShiftStartAt'))).toHaveValue(
      businessStartInput,
    );
    await user.clear(screen.getByLabelText(i18n.t('work-schedule:fields.newShiftStartAt')));
    await user.type(
      screen.getByLabelText(i18n.t('work-schedule:fields.newShiftStartAt')),
      rescheduleStartInput,
    );
    await user.clear(screen.getByLabelText(i18n.t('work-schedule:fields.newShiftEndAt')));
    await user.type(
      screen.getByLabelText(i18n.t('work-schedule:fields.newShiftEndAt')),
      rescheduleEndInput,
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('work-schedule:mutations.reschedule.submit') }),
    );
    expect(onReschedule).toHaveBeenCalledWith({
      newShiftStartAt: rescheduleStartUtcMs,
      newShiftEndAt: rescheduleEndUtcMs,
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
    await selectPickerOption(user, 'work-shift-reassign-subject', /TG-000001/);
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
    await selectPickerOption(user, 'work-shift-replace-studio-resources', /SR-000003/);
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

import i18n from 'i18next';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  createEvent,
  fetchEventAssignments,
  fetchEventDetail,
  fetchEvents,
  performEventLifecycleAction,
  replaceEventAssignments,
} from '@modules/event-assignment/api/event-assignment.api';
import { createEventActionRailItems } from '@modules/event-assignment/actions/event-assignment-action-rail';
import {
  EventCompletionEvidenceSurface,
  EventCreateSurface,
  EventEditSurface,
  EventReplaceAssignmentsSurface,
  EventReplacePlatformAccountsSurface,
  EventRescheduleSurface,
} from '@modules/event-assignment/forms/event-assignment-mutation-forms';
import {
  EVENT_COMPLETION_EVIDENCE_NOTE_MAX_LENGTH,
  EVENT_COMPLETION_EVIDENCE_REF_LABEL_MAX_LENGTH,
  EVENT_COMPLETION_EVIDENCE_REF_REFERENCE_ID_MAX_LENGTH,
  EVENT_COMPLETION_EVIDENCE_REF_URL_MAX_LENGTH,
  type EventAssignmentInput,
  type EventRecord,
} from '@modules/event-assignment/types/event-assignment.types';
import { apiRequest } from '@shared/api';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import {
  eventByAssignmentQueryConfig,
  eventByPlatformQueryConfig,
  eventByResourceQueryConfig,
  eventFlatListQueryConfig,
  parseScreenQueryParams,
  serializeScreenQueryParams,
} from '@shared/query';

vi.mock('@shared/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('@shared/components/reference/admin-reference-options', () => ({
  loadEmploymentProfileReferenceOptions: vi.fn(async () => [
    { id: 'ep-001', label: 'Employee One - EP-000001' },
  ]),
  loadTalentReferenceOptions: vi.fn(async () => [
    { id: 'talent-001', label: 'Talent One - TAL-000001' },
  ]),
  loadTalentGroupReferenceOptions: vi.fn(async () => [
    { id: 'group-001', label: 'Group One - TG-000001' },
  ]),
  loadStudioResourceReferenceOptions: vi.fn(async () => [
    { id: 'studio-001', label: 'Studio One - SR-000001' },
    { id: 'studio-002', label: 'Studio Two - SR-000002' },
  ]),
  loadPlatformAccountReferenceOptions: vi.fn(async () => [
    { id: 'platform-001', label: 'Platform One - PA-000001' },
    { id: 'platform-003', label: 'Platform Three - PA-000003' },
  ]),
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

const eventRecord: EventRecord = {
  id: 'event-001',
  eventCode: 'EVT-202605-000001',
  title: 'Launch event',
  ownerEmploymentProfileId: 'ep-001',
  studioResourceIds: ['studio-001'],
  platformAccountIds: ['platform-001'],
  status: 'PLANNED',
  eventStartAt: 100,
  eventEndAt: 200,
  description: null,
  externalRef: null,
  createdAt: 1,
  updatedAt: 2,
};

const replacementAssignments: EventAssignmentInput[] = [
  {
    assignmentKind: 'EMPLOYMENT_PROFILE',
    assignmentEmploymentProfileId: 'ep-001',
  },
  {
    assignmentKind: 'TALENT',
    assignmentTalentId: 'talent-001',
  },
  {
    assignmentKind: 'TALENT_GROUP',
    assignmentTalentGroupId: 'group-001',
  },
];

describe('event assignment wave 6 query and payload shaping', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setLocale(DEFAULT_LOCALE);
  });

  it('parses and serializes only documented flat-list query keys without scope', () => {
    const query = parseScreenQueryParams(
      new URLSearchParams(
        'status=PLANNED&assignmentKind=EMPLOYMENT_PROFILE&assignmentEmploymentProfileId=ep-001&containsStudioResourceId=studio-001&containsPlatformAccountId=platform-001&windowStartAt=&windowEndAt=200&limit=50&cursor=opaque&search=EVT-202605-000001&sortBy=eventStartAt&sortDirection=desc&page=2&scope=global&scopeGrants=x',
      ),
      eventFlatListQueryConfig,
    );

    expect(query).toEqual({
      status: 'PLANNED',
      assignmentKind: 'EMPLOYMENT_PROFILE',
      assignmentEmploymentProfileId: 'ep-001',
      containsStudioResourceId: 'studio-001',
      containsPlatformAccountId: 'platform-001',
      windowEndAt: 200,
      limit: 50,
      cursor: 'opaque',
      search: 'EVT-202605-000001',
      sortBy: 'eventStartAt',
      sortDirection: 'desc',
    });

    const params = serializeScreenQueryParams(
      {
        ...query,
        page: 2,
        scope: 'global',
        scopeGrants: 'x',
      },
      eventFlatListQueryConfig,
    );
    expect(Array.from(params.keys()).sort()).toEqual([
      'assignmentEmploymentProfileId',
      'assignmentKind',
      'containsPlatformAccountId',
      'containsStudioResourceId',
      'cursor',
      'limit',
      'search',
      'sortBy',
      'sortDirection',
      'status',
      'windowEndAt',
    ]);
    expect(params.get('scope')).toBeNull();
    expect(params.get('scopeGrants')).toBeNull();
    expect(params.get('page')).toBeNull();
  });

  it('accepts additive Event target-filter deep links and serializes them to URL/API params', async () => {
    const query = parseScreenQueryParams(
      new URLSearchParams(
        'statusGroup=ACTIVE&eventOverlapStartAt=1000&eventOverlapEndAt=2000&eventStartFromAt=3000&eventStartToAt=4000&status=PLANNED&windowStartAt=5000&windowEndAt=6000',
      ),
      eventFlatListQueryConfig,
    );

    expect(query).toEqual({
      status: 'PLANNED',
      statusGroup: 'ACTIVE',
      windowStartAt: 5000,
      windowEndAt: 6000,
      eventOverlapStartAt: 1000,
      eventOverlapEndAt: 2000,
      eventStartFromAt: 3000,
      eventStartToAt: 4000,
    });

    const params = serializeScreenQueryParams(query, eventFlatListQueryConfig);
    expect(params.get('statusGroup')).toBe('ACTIVE');
    expect(params.get('eventOverlapStartAt')).toBe('1000');
    expect(params.get('eventOverlapEndAt')).toBe('2000');
    expect(params.get('eventStartFromAt')).toBe('3000');
    expect(params.get('eventStartToAt')).toBe('4000');
    expect(params.get('status')).toBe('PLANNED');
    expect(params.get('windowStartAt')).toBe('5000');
    expect(params.get('windowEndAt')).toBe('6000');

    const invalid = serializeScreenQueryParams(
      {
        statusGroup: 'INACTIVE',
        eventOverlapStartAt: 2000,
        eventOverlapEndAt: 1000,
        eventStartFromAt: 'not-a-number',
        eventStartToAt: 4000,
      },
      eventFlatListQueryConfig,
    );
    expect(invalid.get('statusGroup')).toBeNull();
    expect(invalid.get('eventOverlapStartAt')).toBeNull();
    expect(invalid.get('eventOverlapEndAt')).toBeNull();
    expect(invalid.get('eventStartFromAt')).toBeNull();
    expect(invalid.get('eventStartToAt')).toBe('4000');

    apiRequestMock.mockResolvedValue({ data: [], meta: undefined });
    await fetchEvents(query);
    expect(apiRequestMock.mock.calls.at(-1)?.[0].params).toMatchObject({
      status: 'PLANNED',
      statusGroup: 'ACTIVE',
      windowStartAt: 5000,
      windowEndAt: 6000,
      eventOverlapStartAt: 1000,
      eventOverlapEndAt: 2000,
      eventStartFromAt: 3000,
      eventStartToAt: 4000,
    });
  });

  it('normalizes every related Event query without search or scope', () => {
    const byAssignment = parseScreenQueryParams(
      new URLSearchParams(
        'view=by-assignment&assignmentKind=TALENT&assignmentTalentId=talent-001&search=nope&scope=global',
      ),
      eventByAssignmentQueryConfig,
    );
    expect(byAssignment).toEqual({
      view: 'by-assignment',
      assignmentKind: 'TALENT',
      assignmentTalentId: 'talent-001',
    });

    const byResource = parseScreenQueryParams(
      new URLSearchParams('view=by-resource&studioResourceId=studio-001&search=nope&scope=global'),
      eventByResourceQueryConfig,
    );
    expect(byResource).toEqual({
      view: 'by-resource',
      studioResourceId: 'studio-001',
    });

    const byPlatformParams = serializeScreenQueryParams(
      {
        view: 'by-platform',
        platformAccountId: 'platform-001',
        status: 'PLANNED',
        search: 'nope',
        containsPlatformAccountId: 'alias-not-supported',
        scope: 'global',
      },
      eventByPlatformQueryConfig,
    );
    expect(Array.from(byPlatformParams.keys()).sort()).toEqual([
      'platformAccountId',
      'status',
      'view',
    ]);
  });

  it('never emits Event scope or scopeGrants through the API layer', async () => {
    apiRequestMock.mockResolvedValue({ data: [], meta: undefined });
    await fetchEvents({
      status: 'PLANNED',
      scope: 'global',
      scopeGrants: ['forbidden'],
    } as Parameters<typeof fetchEvents>[0]);
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/admin/events',
        params: {
          status: 'PLANNED',
          statusGroup: undefined,
          assignmentKind: undefined,
          assignmentEmploymentProfileId: undefined,
          assignmentTalentId: undefined,
          assignmentTalentGroupId: undefined,
          containsStudioResourceId: undefined,
          containsPlatformAccountId: undefined,
          windowStartAt: undefined,
          windowEndAt: undefined,
          eventOverlapStartAt: undefined,
          eventOverlapEndAt: undefined,
          eventStartFromAt: undefined,
          eventStartToAt: undefined,
          limit: undefined,
          cursor: undefined,
          search: undefined,
          sortBy: undefined,
          sortDirection: undefined,
        },
      }),
    );
    expect(apiRequestMock.mock.calls.at(-1)?.[0].params).not.toHaveProperty('scope');
    expect(apiRequestMock.mock.calls.at(-1)?.[0].params).not.toHaveProperty('scopeGrants');

    apiRequestMock.mockResolvedValue({ data: eventRecord });
    await performEventLifecycleAction('event-001', 'plan');
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/events/event-001/plan',
        data: {},
      }),
    );
    expect(apiRequestMock.mock.calls.at(-1)?.[0]).not.toHaveProperty('params');

    await performEventLifecycleAction('event-001', 'complete', {
      evidenceNote: 'Delivered recap and operational handoff.',
      evidenceRefs: [
        {
          type: 'URL',
          label: 'Delivery URL',
          url: 'https://example.com/evidence/event-001',
        },
        {
          type: 'INTERNAL_REFERENCE',
          label: 'Ops ticket',
          referenceId: 'OPS-123',
        },
      ],
    });
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/events/event-001/complete',
        data: {
          evidenceNote: 'Delivered recap and operational handoff.',
          evidenceRefs: [
            {
              type: 'URL',
              label: 'Delivery URL',
              url: 'https://example.com/evidence/event-001',
            },
            {
              type: 'INTERNAL_REFERENCE',
              label: 'Ops ticket',
              referenceId: 'OPS-123',
            },
          ],
        },
      }),
    );
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('completedAt');
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('completedBy');
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('completedByActorId');
  });

  it('rejects over-limit completion evidence before sending lifecycle API payloads', async () => {
    apiRequestMock.mockResolvedValue({ data: eventRecord });

    await expect(
      performEventLifecycleAction('event-001', 'complete', {
        evidenceNote: 'n'.repeat(EVENT_COMPLETION_EVIDENCE_NOTE_MAX_LENGTH + 1),
      }),
    ).rejects.toThrow();
    expect(apiRequestMock).not.toHaveBeenCalled();

    await expect(
      performEventLifecycleAction('event-001', 'complete', {
        evidenceNote: 'Delivered recap.',
        evidenceRefs: [
          {
            type: 'URL',
            url: makeEvidenceUrl(EVENT_COMPLETION_EVIDENCE_REF_URL_MAX_LENGTH + 1),
          },
        ],
      }),
    ).rejects.toThrow();
    expect(apiRequestMock).not.toHaveBeenCalled();

    await expect(
      performEventLifecycleAction('event-001', 'complete', {
        evidenceNote: 'Delivered recap.',
        evidenceRefs: [
          {
            type: 'INTERNAL_REFERENCE',
            referenceId: 'r'.repeat(EVENT_COMPLETION_EVIDENCE_REF_REFERENCE_ID_MAX_LENGTH + 1),
          },
        ],
      }),
    ).rejects.toThrow();
    expect(apiRequestMock).not.toHaveBeenCalled();

    await expect(
      performEventLifecycleAction('event-001', 'complete', {
        evidenceNote: 'Delivered recap.',
        evidenceRefs: [
          {
            type: 'EXTERNAL_REFERENCE',
            label: 'l'.repeat(EVENT_COMPLETION_EVIDENCE_REF_LABEL_MAX_LENGTH + 1),
            referenceId: 'EXT-123',
          },
        ],
      }),
    ).rejects.toThrow();
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it('accepts additive Event reference summaries while preserving raw IDs and API serialization', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: {
        ...eventRecord,
        studioResourceIds: ['studio-002', 'missing-studio', 'studio-001'],
        platformAccountIds: ['platform-003', 'missing-platform', 'platform-001'],
        studioResourceRefs: [
          { id: 'studio-002', code: 'SR-002', name: 'Studio Two', status: 'ACTIVE' },
          { id: 'missing-studio' },
          { id: 'studio-001', code: 'SR-001', name: 'Studio One', status: 'ACTIVE' },
        ],
        platformAccountRefs: [
          {
            id: 'platform-003',
            code: 'PA-003',
            displayName: 'Platform Three',
            handle: '@platform3',
            platform: 'YOUTUBE',
            status: 'ACTIVE',
          },
          { id: 'missing-platform' },
          {
            id: 'platform-001',
            code: 'PA-001',
            displayName: 'Platform One',
            platform: 'TIKTOK',
            status: 'ACTIVE',
          },
        ],
      },
    });
    const detail = await fetchEventDetail('event-001');
    expect(detail.studioResourceIds).toEqual(['studio-002', 'missing-studio', 'studio-001']);
    expect(detail.studioResourceRefs?.map((ref) => ref.id)).toEqual([
      'studio-002',
      'missing-studio',
      'studio-001',
    ]);
    expect(detail.platformAccountIds).toEqual(['platform-003', 'missing-platform', 'platform-001']);
    expect(detail.platformAccountRefs?.map((ref) => ref.id)).toEqual([
      'platform-003',
      'missing-platform',
      'platform-001',
    ]);
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/admin/events/event-001',
      }),
    );
    expect(apiRequestMock.mock.calls.at(-1)?.[0]).not.toHaveProperty('params');

    apiRequestMock.mockResolvedValueOnce({
      data: [
        {
          id: 'assignment-001',
          eventId: 'event-001',
          assignmentKind: 'EMPLOYMENT_PROFILE',
          assignmentEmploymentProfileId: 'ep-001',
          assignmentTalentId: null,
          assignmentTalentGroupId: null,
          assignmentSubjectRef: {
            id: 'ep-001',
            code: 'EMP-001',
            displayName: 'Employee One',
            status: 'ACTIVE',
          },
          assignmentStatus: 'ACTIVE',
          createdAt: 1,
        },
        {
          id: 'assignment-002',
          eventId: 'event-001',
          assignmentKind: 'TALENT',
          assignmentEmploymentProfileId: null,
          assignmentTalentId: 'missing-talent',
          assignmentTalentGroupId: null,
          assignmentSubjectRef: null,
          assignmentStatus: 'ACTIVE',
          createdAt: 2,
        },
      ],
    });
    const assignments = await fetchEventAssignments('event-001');
    expect(assignments[0].assignmentEmploymentProfileId).toBe('ep-001');
    expect(assignments[0].assignmentSubjectRef?.code).toBe('EMP-001');
    expect(assignments[1].assignmentTalentId).toBe('missing-talent');
    expect(assignments[1].assignmentSubjectRef).toBeNull();
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/admin/events/event-001/assignments',
      }),
    );
    expect(apiRequestMock.mock.calls.at(-1)?.[0]).not.toHaveProperty('params');
  });

  it('sanitizes Event assignment replacement payloads to the exact full-set contract', async () => {
    apiRequestMock.mockResolvedValue({ data: eventRecord });

    await replaceEventAssignments('event-001', {
      replacementAssignments: [
        {
          assignmentKind: 'EMPLOYMENT_PROFILE',
          assignmentEmploymentProfileId: 'ep-001',
          assignmentTalentId: 'talent-forbidden',
          id: 'assignment-forbidden',
          assignmentStatus: 'ACTIVE',
          removedAt: 123,
          createdAt: 456,
          scope: 'global',
          scopeGrants: ['forbidden'],
        },
        {
          assignmentKind: 'TALENT_GROUP',
          assignmentTalentGroupId: 'group-001',
          assignmentEmploymentProfileId: 'ep-forbidden',
        },
      ],
      scope: 'global',
      scopeGrants: ['forbidden'],
    } as Parameters<typeof replaceEventAssignments>[1]);

    expect(apiRequestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/admin/events/event-001/assignments',
        data: {
          replacementAssignments: [
            {
              assignmentKind: 'EMPLOYMENT_PROFILE',
              assignmentEmploymentProfileId: 'ep-001',
            },
            {
              assignmentKind: 'TALENT_GROUP',
              assignmentTalentGroupId: 'group-001',
            },
          ],
        },
      }),
    );
    expect(apiRequestMock.mock.calls.at(-1)?.[0]).not.toHaveProperty('params');
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('scope');
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('scopeGrants');
  });

  it('submits the full initialized assignment replacement set when no rows are removed', async () => {
    const user = userEvent.setup();
    const onAssignments = vi.fn();
    render(
      <EventReplaceAssignmentsSurface
        initialAssignments={replacementAssignments}
        onCancel={() => undefined}
        onSubmit={onAssignments}
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: i18n.t('event-assignment:mutations.replaceAssignments.submit'),
      }),
    );

    expect(onAssignments).toHaveBeenCalledWith({
      replacementAssignments,
    });
  }, 20_000);

  it('requires completion evidence and submits structured references only', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<EventCompletionEvidenceSurface onCancel={() => undefined} onSubmit={onComplete} />);

    await user.click(
      screen.getByRole('button', { name: i18n.t('event-assignment:mutations.complete.submit') }),
    );
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByText(i18n.t('event-assignment:validation.required'))).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(i18n.t('event-assignment:fields.evidenceNote')),
      'Delivered recap package.',
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('event-assignment:actions.addEvidenceRef') }),
    );
    await user.type(
      screen.getByLabelText(i18n.t('event-assignment:fields.evidenceRefLabel')),
      'Ops handoff',
    );
    await user.type(
      screen.getByLabelText(i18n.t('event-assignment:fields.evidenceRefUrl')),
      'https://example.com/evidence/event-001',
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('event-assignment:mutations.complete.submit') }),
    );

    expect(onComplete).toHaveBeenCalledWith({
      evidenceNote: 'Delivered recap package.',
      evidenceRefs: [
        {
          type: 'URL',
          label: 'Ops handoff',
          url: 'https://example.com/evidence/event-001',
          referenceId: null,
        },
      ],
    });
  }, 20_000);

  it('blocks over-limit completion evidence fields before submit', async () => {
    const submitWithValues = async (values: {
      evidenceNote: string;
      ref?: {
        type?: string;
        label?: string;
        url?: string;
        referenceId?: string;
      };
    }) => {
      const user = userEvent.setup();
      const onComplete = vi.fn();
      const view = render(
        <EventCompletionEvidenceSurface onCancel={() => undefined} onSubmit={onComplete} />,
      );

      fireEvent.change(screen.getByLabelText(i18n.t('event-assignment:fields.evidenceNote')), {
        target: { value: values.evidenceNote },
      });

      if (values.ref) {
        await user.click(
          screen.getByRole('button', { name: i18n.t('event-assignment:actions.addEvidenceRef') }),
        );
        if (values.ref.type) {
          await user.selectOptions(
            screen.getByLabelText(i18n.t('event-assignment:fields.evidenceRefType')),
            values.ref.type,
          );
        }
        if (values.ref.label !== undefined) {
          fireEvent.change(
            screen.getByLabelText(i18n.t('event-assignment:fields.evidenceRefLabel')),
            { target: { value: values.ref.label } },
          );
        }
        if (values.ref.url !== undefined) {
          fireEvent.change(
            screen.getByLabelText(i18n.t('event-assignment:fields.evidenceRefUrl')),
            {
              target: { value: values.ref.url },
            },
          );
        }
        if (values.ref.referenceId !== undefined) {
          fireEvent.change(
            screen.getByLabelText(i18n.t('event-assignment:fields.evidenceRefReferenceId')),
            { target: { value: values.ref.referenceId } },
          );
        }
      }

      await user.click(
        screen.getByRole('button', { name: i18n.t('event-assignment:mutations.complete.submit') }),
      );

      expect(onComplete).not.toHaveBeenCalled();
      view.unmount();
    };

    await submitWithValues({
      evidenceNote: 'n'.repeat(EVENT_COMPLETION_EVIDENCE_NOTE_MAX_LENGTH + 1),
    });
    await submitWithValues({
      evidenceNote: 'Delivered recap.',
      ref: {
        url: makeEvidenceUrl(EVENT_COMPLETION_EVIDENCE_REF_URL_MAX_LENGTH + 1),
      },
    });
    await submitWithValues({
      evidenceNote: 'Delivered recap.',
      ref: {
        type: 'INTERNAL_REFERENCE',
        referenceId: 'r'.repeat(EVENT_COMPLETION_EVIDENCE_REF_REFERENCE_ID_MAX_LENGTH + 1),
      },
    });
    await submitWithValues({
      evidenceNote: 'Delivered recap.',
      ref: {
        type: 'EXTERNAL_REFERENCE',
        label: 'l'.repeat(EVENT_COMPLETION_EVIDENCE_REF_LABEL_MAX_LENGTH + 1),
        referenceId: 'EXT-123',
      },
    });
  }, 20_000);

  it('submits create, edit, reschedule, and replacement payloads exactly', async () => {
    const user = userEvent.setup();

    const onCreate = vi.fn();
    const createRender = render(
      <EventCreateSurface onCancel={() => undefined} onSubmit={onCreate} />,
    );
    expect(
      screen.queryByLabelText(i18n.t('event-assignment:fields.eventCode')),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('event-assignment:generatedCode.description')),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(i18n.t('event-assignment:fields.title')), 'Wave 6 event');
    const employeeOptions = await screen.findAllByRole('button', { name: /Employee One/ });
    await user.click(employeeOptions[0]);
    await user.click(employeeOptions[1]);
    await user.type(
      screen.getByLabelText(i18n.t('event-assignment:fields.eventStartAt')),
      businessStartInput,
    );
    await user.type(
      screen.getByLabelText(i18n.t('event-assignment:fields.eventEndAt')),
      businessEndInput,
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('event-assignment:actions.addPlatformAccount') }),
    );
    await user.click(await screen.findByRole('button', { name: /Platform One/ }));
    await user.click(
      screen.getByRole('button', { name: i18n.t('event-assignment:mutations.create.submit') }),
    );
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Wave 6 event',
      ownerEmploymentProfileId: 'ep-001',
      assignments: [
        {
          assignmentKind: 'EMPLOYMENT_PROFILE',
          assignmentEmploymentProfileId: 'ep-001',
        },
      ],
      eventStartAt: businessStartUtcMs,
      eventEndAt: businessEndUtcMs,
      platformAccountIds: ['platform-001'],
      description: null,
      externalRef: null,
    });
    expect(onCreate.mock.calls.at(-1)?.[0]).not.toHaveProperty('eventCode');
    createRender.unmount();

    const onEdit = vi.fn();
    const editRender = render(
      <EventEditSurface
        initialValues={{
          title: 'Wave 6 event',
          ownerEmploymentProfileId: 'ep-001',
          description: 'old',
          externalRef: 'EXT',
        }}
        onCancel={() => undefined}
        onSubmit={onEdit}
      />,
    );
    await user.clear(screen.getByLabelText(i18n.t('event-assignment:fields.description')));
    await user.click(
      screen.getByRole('button', { name: i18n.t('event-assignment:mutations.edit.submit') }),
    );
    expect(onEdit).toHaveBeenCalledWith({
      title: 'Wave 6 event',
      ownerEmploymentProfileId: 'ep-001',
      description: null,
      externalRef: 'EXT',
    });
    expect(onEdit.mock.calls.at(-1)?.[0]).not.toHaveProperty('eventCode');
    editRender.unmount();

    const onReschedule = vi.fn();
    const rescheduleRender = render(
      <EventRescheduleSurface
        initialValues={{ eventStartAt: businessStartUtcMs, eventEndAt: businessEndUtcMs }}
        onCancel={() => undefined}
        onSubmit={onReschedule}
      />,
    );
    expect(screen.getByLabelText(i18n.t('event-assignment:fields.newEventStartAt'))).toHaveValue(
      businessStartInput,
    );
    await user.clear(screen.getByLabelText(i18n.t('event-assignment:fields.newEventStartAt')));
    await user.type(
      screen.getByLabelText(i18n.t('event-assignment:fields.newEventStartAt')),
      rescheduleStartInput,
    );
    await user.clear(screen.getByLabelText(i18n.t('event-assignment:fields.newEventEndAt')));
    await user.type(
      screen.getByLabelText(i18n.t('event-assignment:fields.newEventEndAt')),
      rescheduleEndInput,
    );
    await user.type(screen.getByLabelText(i18n.t('event-assignment:fields.reason')), 'Ops change');
    await user.click(
      screen.getByRole('button', { name: i18n.t('event-assignment:mutations.reschedule.submit') }),
    );
    expect(onReschedule).toHaveBeenCalledWith({
      newEventStartAt: rescheduleStartUtcMs,
      newEventEndAt: rescheduleEndUtcMs,
      reason: 'Ops change',
    });
    expect(onReschedule.mock.calls.at(-1)?.[0]).not.toHaveProperty('eventCode');
    rescheduleRender.unmount();

    const onAssignments = vi.fn();
    const assignmentRender = render(
      <EventReplaceAssignmentsSurface
        initialAssignments={replacementAssignments}
        onCancel={() => undefined}
        onSubmit={onAssignments}
      />,
    );
    expect(screen.getByText('ep-001')).toBeInTheDocument();
    expect(screen.getByText('talent-001')).toBeInTheDocument();
    expect(screen.getByText('group-001')).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText(i18n.t('event-assignment:fields.assignmentKindIndexed', { index: 2 })),
      'TALENT_GROUP',
    );
    const groupOptions = await screen.findAllByRole('button', { name: /Group One/ });
    await user.click(groupOptions[0]);
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('event-assignment:mutations.replaceAssignments.submit'),
      }),
    );
    expect(onAssignments).toHaveBeenCalledWith({
      replacementAssignments: [
        {
          assignmentKind: 'EMPLOYMENT_PROFILE',
          assignmentEmploymentProfileId: 'ep-001',
        },
        {
          assignmentKind: 'TALENT_GROUP',
          assignmentTalentGroupId: 'group-001',
        },
        {
          assignmentKind: 'TALENT_GROUP',
          assignmentTalentGroupId: 'group-001',
        },
      ],
    });
    assignmentRender.unmount();

    const onPlatforms = vi.fn();
    render(
      <EventReplacePlatformAccountsSurface
        initialPlatformAccountIds={['platform-001']}
        onCancel={() => undefined}
        onSubmit={onPlatforms}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: /Gỡ tài khoản nền tảng 1|Remove platform account 1/ }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('event-assignment:actions.addPlatformAccount') }),
    );
    await user.click(await screen.findByRole('button', { name: /Platform Three/ }));
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('event-assignment:mutations.replacePlatformAccounts.submit'),
      }),
    );
    expect(onPlatforms).toHaveBeenCalledWith({
      newPlatformAccountIds: ['platform-003'],
    });
  }, 20_000);

  it('omits Event code by default while preserving explicit internal custom-code payloads', async () => {
    apiRequestMock.mockResolvedValue({ data: eventRecord });

    await createEvent({
      title: 'Generated event',
      ownerEmploymentProfileId: 'ep-001',
      assignments: replacementAssignments.slice(0, 1),
      eventStartAt: 1000,
      eventEndAt: 2000,
      platformAccountIds: [],
      description: null,
      externalRef: null,
    });
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).not.toHaveProperty('eventCode');

    await createEvent({
      eventCode: 'EVTCUSTOM',
      title: 'Custom event',
      ownerEmploymentProfileId: 'ep-001',
      assignments: replacementAssignments.slice(0, 1),
      eventStartAt: 1000,
      eventEndAt: 2000,
      platformAccountIds: [],
      description: null,
      externalRef: null,
    });
    expect(apiRequestMock.mock.calls.at(-1)?.[0].data).toHaveProperty('eventCode', 'EVTCUSTOM');
  });

  it('makes assignment removal explicit and blocks blind replacement when the roster is unavailable', async () => {
    const user = userEvent.setup();

    const onAssignments = vi.fn();
    const assignmentRender = render(
      <EventReplaceAssignmentsSurface
        initialAssignments={replacementAssignments}
        onCancel={() => undefined}
        onSubmit={onAssignments}
      />,
    );
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('event-assignment:actions.removeAssignment', { index: 2 }),
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('event-assignment:mutations.replaceAssignments.submit'),
      }),
    );
    expect(onAssignments).toHaveBeenCalledWith({
      replacementAssignments: [
        {
          assignmentKind: 'EMPLOYMENT_PROFILE',
          assignmentEmploymentProfileId: 'ep-001',
        },
        {
          assignmentKind: 'TALENT_GROUP',
          assignmentTalentGroupId: 'group-001',
        },
      ],
    });
    assignmentRender.unmount();

    const blockedSubmit = vi.fn();
    render(
      <EventReplaceAssignmentsSurface
        initialAssignments={[]}
        rosterAvailable={false}
        onCancel={() => undefined}
        onSubmit={blockedSubmit}
      />,
    );
    expect(
      screen.getByText(i18n.t('event-assignment:validation.rosterUnavailable')),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: i18n.t('event-assignment:mutations.replaceAssignments.submit'),
      }),
    ).toBeDisabled();
  }, 20_000);

  it('gates lifecycle actions including empty roster plan and archived read-only behavior', () => {
    const draftRecord: EventRecord = { ...eventRecord, status: 'DRAFT' };
    const scheduledItems = createEventActionRailItems(i18n.t, draftRecord, {
      onEdit: vi.fn(),
      onReschedule: vi.fn(),
      onReplaceAssignments: vi.fn(),
      onReplacePlatformAccounts: vi.fn(),
      onLifecycleAction: vi.fn(),
      assignmentRosterKnown: true,
      hasActiveAssignments: true,
    });
    expect(scheduledItems.find((item) => item.id === 'plan')?.disabled).toBeFalsy();

    const emptyRosterItems = createEventActionRailItems(i18n.t, draftRecord, {
      onEdit: vi.fn(),
      onReschedule: vi.fn(),
      onReplaceAssignments: vi.fn(),
      onReplacePlatformAccounts: vi.fn(),
      onLifecycleAction: vi.fn(),
      assignmentRosterKnown: true,
      hasActiveAssignments: false,
    });
    expect(emptyRosterItems.find((item) => item.id === 'plan')?.disabled).toBe(true);

    const unknownRosterItems = createEventActionRailItems(i18n.t, eventRecord, {
      onEdit: vi.fn(),
      onReschedule: vi.fn(),
      onReplaceAssignments: vi.fn(),
      onReplacePlatformAccounts: vi.fn(),
      onLifecycleAction: vi.fn(),
      assignmentRosterKnown: false,
      hasActiveAssignments: false,
    });
    expect(unknownRosterItems.find((item) => item.id === 'replace-assignments')?.disabled).toBe(
      true,
    );

    const archivedItems = createEventActionRailItems(
      i18n.t,
      { ...eventRecord, status: 'ARCHIVED' },
      {
        onEdit: vi.fn(),
        onReschedule: vi.fn(),
        onReplaceAssignments: vi.fn(),
        onReplacePlatformAccounts: vi.fn(),
        onLifecycleAction: vi.fn(),
      },
    );
    expect(archivedItems.every((item) => item.disabled)).toBe(true);
  });
});

const makeEvidenceUrl = (length: number): string => {
  const prefix = 'https://example.com/';
  return `${prefix}${'a'.repeat(length - prefix.length)}`;
};

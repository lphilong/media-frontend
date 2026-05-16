import i18n from 'i18next';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  createTalentKpiRecord,
  fetchTalentKpiRecords,
  fetchTalentKpiRecordsByTalent,
  performTalentKpiLifecycleAction,
  replaceTalentKpiMetrics,
  updateTalentKpiDraftCore,
} from '@modules/talent-kpi/api/talent-kpi.api';
import { createTalentKpiActionRailItems } from '@modules/talent-kpi/actions/talent-kpi-action-rail';
import {
  TalentKpiCreateSurface,
  TalentKpiMetricsSurface,
} from '@modules/talent-kpi/forms/talent-kpi-mutation-forms';
import type { TalentKpiRecord } from '@modules/talent-kpi/types/talent-kpi.types';
import { apiRequest } from '@shared/api';
import { setLocale } from '@shared/i18n/i18n';

vi.mock('@shared/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('@shared/components/reference/admin-reference-options', () => ({
  loadTalentReferenceOptions: vi.fn(async () => [
    { id: 'talent-001', label: 'Talent One - TAL-000001' },
  ]),
  loadPlatformAccountReferenceOptions: vi.fn(async () => [
    { id: 'platform-001', label: 'Platform One - PLA001' },
  ]),
  loadEventReferenceOptions: vi.fn(async () => [
    { id: 'event-001', label: 'Event One - EVT-202605-000001' },
  ]),
}));

const now = Date.parse('2026-04-22T00:00:00.000Z');

const kpiDetail: TalentKpiRecord = {
  id: 'talent-kpi-record-001',
  kpiRecordCode: 'KPI-202604-000001',
  title: 'April KPI',
  subjectTalentId: 'talent-001',
  attributionPlatformAccountId: 'platform-001',
  attributionEventId: 'event-001',
  measurementSource: 'MANUAL',
  status: 'DRAFT',
  periodStartAt: now - 1000,
  periodEndAt: now,
  publishedAt: null,
  description: null,
  externalRef: null,
  createdAt: now - 1000,
  updatedAt: now,
};

describe('Talent KPI Wave 8 payloads and lifecycle seams', () => {
  const mockedApiRequest = vi.mocked(apiRequest);

  afterEach(() => {
    mockedApiRequest.mockReset();
  });

  it('submits create form payloads with exact supported keys and null clearing', async () => {
    await setLocale('en');
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<TalentKpiCreateSurface onCancel={() => undefined} onSubmit={onSubmit} />);

    expect(
      screen.queryByLabelText(i18n.t('talent-kpi:fields.kpiRecordCode')),
    ).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('talent-kpi:generatedCode.description'))).toBeInTheDocument();
    await user.type(screen.getByLabelText(i18n.t('talent-kpi:fields.title')), 'Wave 8 KPI');
    await user.click(await screen.findByRole('button', { name: /Talent One/ }));
    await user.type(screen.getByLabelText(i18n.t('talent-kpi:fields.periodStartAt')), '1000');
    await user.type(screen.getByLabelText(i18n.t('talent-kpi:fields.periodEndAt')), '2000');
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('talent-kpi:mutations.create.submit'),
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Wave 8 KPI',
      subjectTalentId: 'talent-001',
      attributionPlatformAccountId: null,
      attributionEventId: null,
      measurementSource: 'MANUAL',
      periodStartAt: 1000,
      periodEndAt: 2000,
      metrics: [{ metricCode: 'ENGAGEMENT_COUNT', numericValue: 0 }],
      description: null,
      externalRef: null,
    });
    expect(onSubmit.mock.calls.at(-1)?.[0]).not.toHaveProperty('kpiRecordCode');
  });

  it('rejects duplicate metric codes and invalid metric-specific numeric values', async () => {
    await setLocale('en');
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<TalentKpiCreateSurface onCancel={() => undefined} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(i18n.t('talent-kpi:fields.title')), 'Bad KPI');
    await user.click(await screen.findByRole('button', { name: /Talent One/ }));
    await user.type(screen.getByLabelText(i18n.t('talent-kpi:fields.periodStartAt')), '1000');
    await user.type(screen.getByLabelText(i18n.t('talent-kpi:fields.periodEndAt')), '2000');
    await user.click(screen.getByRole('button', { name: i18n.t('talent-kpi:actions.addMetric') }));
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('talent-kpi:mutations.create.submit'),
      }),
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(i18n.t('talent-kpi:validation.duplicateMetricCode')),
    ).toBeInTheDocument();
  });

  it('submits metric replacement as one full canonical metrics body', async () => {
    await setLocale('en');
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <TalentKpiMetricsSurface
        initialMetrics={[{ metricCode: 'FOLLOWER_DELTA', numericValue: -2 }]}
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: i18n.t('talent-kpi:mutations.metrics.submit'),
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      metrics: [{ metricCode: 'FOLLOWER_DELTA', numericValue: -2 }],
    });
  });

  it('sends exact API payloads without scope fields or partial metric patching', async () => {
    mockedApiRequest.mockResolvedValue({ data: kpiDetail });

    await createTalentKpiRecord({
      title: 'API KPI',
      subjectTalentId: 'talent-001',
      attributionPlatformAccountId: undefined,
      attributionEventId: null,
      measurementSource: 'MANUAL',
      periodStartAt: 1000,
      periodEndAt: 2000,
      metrics: [{ metricCode: 'ENGAGEMENT_COUNT', numericValue: 1 }],
      description: undefined,
      externalRef: null,
    });
    await updateTalentKpiDraftCore('talent-kpi-record-001', {
      title: 'Updated KPI',
      subjectTalentId: 'talent-001',
      attributionPlatformAccountId: null,
      attributionEventId: null,
      periodStartAt: 1000,
      periodEndAt: 2000,
      description: null,
      externalRef: null,
    });
    await replaceTalentKpiMetrics('talent-kpi-record-001', {
      metrics: [{ metricCode: 'ENGAGEMENT_COUNT', numericValue: 2 }],
    });
    await performTalentKpiLifecycleAction('talent-kpi-record-001', 'finalize');

    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, {
      method: 'POST',
      url: '/admin/talent-kpi-records',
      data: {
        title: 'API KPI',
        subjectTalentId: 'talent-001',
        attributionPlatformAccountId: null,
        attributionEventId: null,
        measurementSource: 'MANUAL',
        periodStartAt: 1000,
        periodEndAt: 2000,
        metrics: [{ metricCode: 'ENGAGEMENT_COUNT', numericValue: 1 }],
        description: null,
        externalRef: null,
      },
    });
    expect(mockedApiRequest.mock.calls[0]?.[0].data).not.toHaveProperty('kpiRecordCode');
    expect(mockedApiRequest).toHaveBeenNthCalledWith(3, {
      method: 'POST',
      url: '/admin/talent-kpi-records/talent-kpi-record-001/metrics',
      data: {
        metrics: [{ metricCode: 'ENGAGEMENT_COUNT', numericValue: 2 }],
      },
    });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(4, {
      method: 'POST',
      url: '/admin/talent-kpi-records/talent-kpi-record-001/finalize',
      data: {},
    });
    expect(mockedApiRequest.mock.calls[1]?.[0].data).not.toHaveProperty('kpiRecordCode');
  });

  it('never sends scope, scopeGrants, or related-search from Talent KPI query builders', async () => {
    mockedApiRequest.mockResolvedValue({ data: [], meta: {} });

    await fetchTalentKpiRecords({
      subjectTalentId: 'talent-001',
      search: 'KPI-202604-000001',
      scope: 'global',
      scopeGrants: 'x',
    } as never);
    await fetchTalentKpiRecordsByTalent({
      view: 'by-talent',
      subjectTalentId: 'talent-001',
      search: 'not-supported',
      scope: 'global',
      scopeGrants: 'x',
    } as never);

    expect(mockedApiRequest.mock.calls[0]?.[0].params).toMatchObject({
      subjectTalentId: 'talent-001',
      search: 'KPI-202604-000001',
    });
    expect(mockedApiRequest.mock.calls[0]?.[0].params).not.toHaveProperty('scope');
    expect(mockedApiRequest.mock.calls[0]?.[0].params).not.toHaveProperty('scopeGrants');
    expect(mockedApiRequest.mock.calls[1]?.[0].params).toMatchObject({
      subjectTalentId: 'talent-001',
    });
    expect(mockedApiRequest.mock.calls[1]?.[0].params).not.toHaveProperty('search');
    expect(mockedApiRequest.mock.calls[1]?.[0].params).not.toHaveProperty('scope');
    expect(mockedApiRequest.mock.calls[1]?.[0].params).not.toHaveProperty('scopeGrants');
  });

  it('gates actions by lifecycle and exposes no unsupported action ids', async () => {
    await setLocale('en');
    const handlers = {
      onDraftCoreEdit: vi.fn(),
      onReplaceMetrics: vi.fn(),
      onLifecycleAction: vi.fn(),
    };

    const draftItems = createTalentKpiActionRailItems(i18n.t, kpiDetail, handlers);
    const archivedItems = createTalentKpiActionRailItems(
      i18n.t,
      { ...kpiDetail, status: 'ARCHIVED' },
      handlers,
    );

    expect(draftItems.map((item) => item.id)).toEqual([
      'draft-core',
      'replace-metrics',
      'finalize',
      'archive',
    ]);
    expect(draftItems.some((item) => item.id.includes('delete'))).toBe(false);
    expect(archivedItems.every((item) => item.disabled)).toBe(true);
  });
});

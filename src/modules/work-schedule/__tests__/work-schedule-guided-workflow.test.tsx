import i18n from 'i18next';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { appRoutes } from '@app/router/router';
import { WorkShiftGuidedWorkflow } from '@modules/work-schedule/components/WorkShiftGuidedWorkflow';
import {
  parseVietnamLocalDateTimeToUtcTimestamp,
  formatVietnamLocalDisplay,
} from '@modules/work-schedule/utils/vietnam-datetime';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  return renderAppWithProviders(<RouterProvider router={router} />);
};

const renderWorkflow = (props?: Partial<Parameters<typeof WorkShiftGuidedWorkflow>[0]>) => {
  const onSubmit = props?.onSubmit ?? vi.fn();
  const onCancel = props?.onCancel ?? vi.fn();

  renderAppWithProviders(
    <MemoryRouter>
      <WorkShiftGuidedWorkflow {...props} onSubmit={onSubmit} onCancel={onCancel} />
    </MemoryRouter>,
  );

  return { onSubmit, onCancel };
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

describe('work schedule guided shift workflow', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it('renders the guided entry point without exposing the technical admin create path', async () => {
    const user = userEvent.setup();
    renderRoute('/work-schedule/global-ops');

    const guidedAction = await screen.findByRole('button', {
      name: i18n.t('work-schedule:actions.scheduleWorkShift'),
    });
    expect(guidedAction).toHaveAttribute('data-action-priority', 'primary');
    expect(
      screen.queryByRole('button', { name: /admin|technical|kỹ thuật|ky thuat/i }),
    ).not.toBeInTheDocument();

    await user.click(guidedAction);
    expect(
      await screen.findByRole('heading', { name: i18n.t('work-schedule:task.title') }),
    ).toBeInTheDocument();
  });

  it('selects Employment Profile and studio resources, reviews Vietnam-local and UTC values, then submits without shiftCode', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWorkflow({ onSubmit });

    expect(
      screen.getByText(
        i18n.t('work-schedule:task.authorityNote', {
          timezone: 'Asia/Ho_Chi_Minh',
          offset: 'UTC+7',
        }),
      ),
    ).not.toHaveTextContent(/\bbackend\b|\bpermission\b|\bscope\b|\bsource of authority\b/i);
    expect(
      screen.getByText(i18n.t('work-schedule:task.generatedShiftCodeLabel')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('work-schedule:task.generatedShiftCodeValue')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('work-schedule:task.generatedShiftCodeHelp')),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(i18n.t('work-schedule:fields.shiftCode')),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {
        name: i18n.t('work-schedule:task.generatedShiftCodeLabel'),
      }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.title')), 'Guided shift');
    const employmentScopeSelect = screen.getByLabelText(i18n.t('work-schedule:task.scopeLabel'));
    expect(within(employmentScopeSelect).getAllByRole('option')).toHaveLength(4);
    await user.selectOptions(employmentScopeSelect, 'team');

    const subjectPicker = await findPicker('work-shift-subject-EMPLOYMENT_PROFILE');
    await user.click(await within(subjectPicker).findByText(/EP-000001/));

    await user.type(
      screen.getByLabelText(i18n.t('work-schedule:task.startVietnamLocal')),
      '2026-05-03T08:30',
    );
    await user.type(
      screen.getByLabelText(i18n.t('work-schedule:task.endVietnamLocal')),
      '2026-05-03T10:00',
    );

    const resourcePicker = await findPicker('work-shift-studio-resources');
    await user.click(await within(resourcePicker).findByText(/SR-000001/));
    await user.type(
      screen.getByLabelText(i18n.t('work-schedule:fields.description')),
      'Operator note',
    );
    expect(
      screen.getByText(i18n.t('work-schedule:task.additionalInformation')),
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t('work-schedule:task.externalRefHelp'))).toBeInTheDocument();
    await user.type(
      screen.getByLabelText(i18n.t('work-schedule:task.externalRefLabel')),
      'EXT-777',
    );

    await user.click(
      screen.getByRole('button', { name: i18n.t('work-schedule:task.reviewAction') }),
    );

    const startTimestamp = Date.UTC(2026, 4, 3, 1, 30);
    const endTimestamp = Date.UTC(2026, 4, 3, 3, 0);
    const localStartReview = screen.getByText(
      new RegExp(formatVietnamLocalDisplay(startTimestamp)),
    );
    expect(localStartReview).toBeInTheDocument();
    expect(localStartReview).not.toHaveTextContent(/AM|PM/i);
    expect(screen.getAllByText(new RegExp(String(startTimestamp))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(new RegExp(String(endTimestamp))).length).toBeGreaterThan(0);
    expect(
      screen.getByText(i18n.t('work-schedule:task.generatedShiftCodeValue')),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('work-shift-guided-review-summary')).queryByText(
        i18n.t('work-schedule:fields.shiftCode'),
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/"shiftCode"/)).not.toBeInTheDocument();
    expect(screen.queryByText(/"scope"/)).not.toBeInTheDocument();
    expect(screen.queryByText(/"scopeGrants"/)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: i18n.t('work-schedule:task.submitAction') }),
    );

    expect(onSubmit).toHaveBeenCalledWith(
      {
        title: 'Guided shift',
        subjectKind: 'EMPLOYMENT_PROFILE',
        subjectEmploymentProfileId: 'ep-001',
        shiftStartAt: startTimestamp,
        shiftEndAt: endTimestamp,
        studioResourceIds: ['studio-001'],
        description: 'Operator note',
        externalRef: 'EXT-777',
      },
      'team',
    );
  }, 20_000);

  it('requires description or external reference for manual create', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWorkflow({ onSubmit });

    await user.type(screen.getByLabelText(i18n.t('work-schedule:fields.title')), 'Missing reason');
    const subjectPicker = await findPicker('work-shift-subject-EMPLOYMENT_PROFILE');
    await user.click(await within(subjectPicker).findByText(/EP-000001/));
    await user.type(
      screen.getByLabelText(i18n.t('work-schedule:task.startVietnamLocal')),
      '2026-05-03T08:30',
    );
    await user.type(
      screen.getByLabelText(i18n.t('work-schedule:task.endVietnamLocal')),
      '2026-05-03T10:00',
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('work-schedule:task.reviewAction') }),
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(i18n.t('work-schedule:validation.manualCreateReasonRequired')),
    ).toBeInTheDocument();
  }, 20_000);

  it('only exposes Employment Profile create and points group scheduling to Monthly Rosters', async () => {
    renderWorkflow();

    expect(screen.queryByRole('combobox', { name: i18n.t('work-schedule:fields.subjectKind') }))
      .not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('work-schedule:task.individualExceptionCopy'))).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(i18n.t('work-schedule:subjectKinds.EMPLOYMENT_PROFILE')),
    ).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('work-schedule:subjectKinds.TALENT'))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('work-schedule:subjectKinds.TALENT_GROUP'))).not.toBeInTheDocument();
    await expect(findPicker('work-shift-subject-EMPLOYMENT_PROFILE')).resolves.toBeInTheDocument();
  });

  it('shows normalized backend rejection details honestly', async () => {
    renderWorkflow({
      error: {
        status: 422,
        code: 'WORK_SCHEDULE_CONFLICT',
        message: 'Schedule overlap detected',
        fieldErrors: { shiftStartAt: ['overlaps existing shift'] },
        details: { conflictKind: 'resource' },
        retryable: false,
        permissionDenied: false,
        notFound: false,
      },
    });

    expect(
      await screen.findByText(i18n.t('work-schedule:task.backendRejectedTitle')),
    ).toBeInTheDocument();
    expect(screen.getByText('Schedule overlap detected')).toBeInTheDocument();
    expect(screen.getByText('conflictKind')).toBeInTheDocument();
    expect(screen.getByText('overlaps existing shift')).toBeInTheDocument();
  });

  it('converts Vietnam-local datetime to backend UTC millisecond timestamps', () => {
    const timestamp = parseVietnamLocalDateTimeToUtcTimestamp('2026-05-03T08:30');

    expect(timestamp).toBe(Date.UTC(2026, 4, 3, 1, 30));
    expect(formatVietnamLocalDisplay(timestamp ?? 0)).toBe('03/05/2026 08:30');
    expect(parseVietnamLocalDateTimeToUtcTimestamp('2026-02-30T08:30')).toBeNull();
  });
});

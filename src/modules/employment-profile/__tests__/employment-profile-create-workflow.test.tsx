import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { EmploymentProfileCreateWorkflow } from '@modules/employment-profile/components/EmploymentProfileCreateWorkflow';
import type { EmploymentProfileRecord } from '@modules/employment-profile/types/employment-profile.types';
import type { NormalizedApiError } from '@shared/api';
import { setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';

const loadOrgUnits = vi.fn(async () => [
  { id: '00000000-0000-4000-8000-000000000001', label: 'Sales · OU-SALES', status: 'ACTIVE' },
]);
const loadUsers = vi.fn(async () => [
  {
    id: '00000000-0000-4000-8000-000000000002',
    label: 'Admin User · admin@example.test',
    status: 'ACTIVE',
  },
]);
const loadProfiles = vi.fn(async () => [
  {
    id: '00000000-0000-4000-8000-000000000003',
    label: 'Recruiter Person · EP-RECRUITER',
    status: 'ACTIVE',
  },
]);

vi.mock('@modules/org-unit', async () => {
  const actual = await vi.importActual<typeof import('@modules/org-unit')>('@modules/org-unit');
  return { ...actual, loadOrgUnitReferenceOptions: () => loadOrgUnits() };
});

vi.mock('@modules/employment-profile', async () => {
  const actual = await vi.importActual<typeof import('@modules/employment-profile')>(
    '@modules/employment-profile',
  );
  return {
    ...actual,
    loadEmploymentProfileReferenceOptions: () => loadProfiles(),
    loadUnlinkedUserReferenceOptions: () => loadUsers(),
  };
});

const createdRecord: EmploymentProfileRecord = {
  id: '00000000-0000-4000-8000-000000000099',
  employeeCode: 'EP-000099',
  legalName: 'Nguyen Example',
  displayName: 'Example Person',
  employmentKind: 'EMPLOYEE',
  jobTitle: 'Producer',
  orgUnitId: '00000000-0000-4000-8000-000000000001',
  orgUnitRef: { id: 'ou-sales', code: 'OU-SALES', name: 'Sales', status: 'ACTIVE' },
  employmentStatus: 'ACTIVE',
  contractStatus: 'NONE',
  employmentStartDate: Date.UTC(2026, 6, 1),
  createdAt: Date.UTC(2026, 6, 1),
};

const renderWorkflow = async (
  onSubmit: (payload: Record<string, unknown>) => Promise<EmploymentProfileRecord>,
) => {
  await setLocale('en');
  await act(async () => {
    renderAppWithProviders(
      <MemoryRouter>
        <EmploymentProfileCreateWorkflow onSubmit={onSubmit} />
      </MemoryRouter>,
    );
  });
};

const chooseOption = async (pickerId: string, index = 0) => {
  const picker = await waitFor(() => {
    const match = screen
      .getAllByTestId('picker-surface')
      .find((surface) => surface.getAttribute('data-picker-id') === pickerId);
    expect(match).toBeTruthy();
    return match!;
  });
  await act(async () => {
    fireEvent.click((await within(picker).findAllByRole('option'))[index]!);
  });
};

const reachReview = async () => {
  fireEvent.change(screen.getByLabelText('Employment Kind · Required'), {
    target: { value: 'EMPLOYEE' },
  });
  fireEvent.change(screen.getByLabelText('Legal Name · Required'), {
    target: { value: 'Nguyen Example' },
  });
  fireEvent.change(screen.getByLabelText('Display Name · Required'), {
    target: { value: 'Example Person' },
  });
  fireEvent.change(screen.getByLabelText('Job Title · Required'), {
    target: { value: 'Producer' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  await chooseOption('employment-profile-create-org-unit');
  fireEvent.change(screen.getByLabelText('Employment Start Date · Required'), {
    target: { value: '2026-07-01' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue to review' }));
  expect(
    await screen.findByRole('heading', { name: 'Review Employment Profile' }),
  ).toBeInTheDocument();
};

const reachPopulatedReview = async () => {
  fireEvent.change(screen.getByLabelText(/Employment Kind.*Required/), {
    target: { value: 'CONTRACTOR' },
  });
  fireEvent.change(screen.getByLabelText(/Legal Name.*Required/), {
    target: { value: 'Avery Payload Legal' },
  });
  fireEvent.change(screen.getByLabelText(/Display Name.*Required/), {
    target: { value: 'Avery Payload Display' },
  });
  fireEvent.change(screen.getByLabelText(/Job Title.*Required/), {
    target: { value: 'Principal Production Architect' },
  });
  fireEvent.change(screen.getByLabelText(/External Reference.*Optional/), {
    target: { value: 'EXT-AVERY-2026' },
  });
  fireEvent.change(screen.getByLabelText(/Title Description.*Optional/), {
    target: { value: 'Owns the cross-functional production architecture and review line.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  await chooseOption('employment-profile-create-org-unit');
  await chooseOption('employment-profile-create-linked-user');
  fireEvent.change(screen.getByLabelText(/Employment Start Date.*Required/), {
    target: { value: '2026-07-01' },
  });
  fireEvent.change(screen.getByLabelText(/External labor contract status.*Required/), {
    target: { value: 'PENDING_SIGNATURE' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  await chooseOption('employment-profile-create-recruiter', 0);
  await chooseOption('employment-profile-create-hr-owner', 1);
  await chooseOption('employment-profile-create-onboarding-owner', 2);
  await chooseOption('employment-profile-create-sourced-by', 3);
  fireEvent.change(screen.getByLabelText(/Hired Date.*Optional/), {
    target: { value: '2026-06-15' },
  });
  fireEvent.change(screen.getByLabelText(/Onboarded Date.*Optional/), {
    target: { value: '2026-06-20' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to review' }));
  expect(
    await screen.findByRole('heading', { name: 'Review Employment Profile' }),
  ).toBeInTheDocument();
};

describe('Employment Profile complex create workflow', () => {
  beforeEach(() => {
    loadOrgUnits.mockReset();
    loadOrgUnits.mockResolvedValue([
      { id: '00000000-0000-4000-8000-000000000001', label: 'Sales · OU-SALES', status: 'ACTIVE' },
    ]);
    loadUsers.mockReset();
    loadUsers.mockResolvedValue([]);
    loadProfiles.mockReset();
    loadProfiles.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000003',
        label: 'Recruiter Person Â· EP-RECRUITER',
        status: 'ACTIVE',
      },
      { id: '00000000-0000-4000-8000-000000000004', label: 'HR Owner Â· EP-HR', status: 'ACTIVE' },
      {
        id: '00000000-0000-4000-8000-000000000005',
        label: 'Onboarding Owner Â· EP-ONBOARD',
        status: 'ACTIVE',
      },
      {
        id: '00000000-0000-4000-8000-000000000006',
        label: 'Source Lead Â· EP-SOURCE',
        status: 'ACTIVE',
      },
    ]);
  });

  it('provides distinct EN, VI, and ZH workflow, validation, and completion semantics', async () => {
    const expected = {
      en: ['Required', 'Review Employment Profile', 'Create Another'],
      vi: ['Bắt buộc', 'Rà soát hồ sơ nhân sự', 'Tạo hồ sơ khác'],
      zh: ['必填', '复核员工档案', '继续创建'],
    } as const;

    for (const [locale, values] of Object.entries(expected) as Array<
      [keyof typeof expected, (typeof expected)[keyof typeof expected]]
    >) {
      await setLocale(locale);
      expect(i18n.t('employment-profile:createWorkflow.fieldState.required')).toBe(values[0]);
      expect(i18n.t('employment-profile:createWorkflow.review.title')).toBe(values[1]);
      expect(i18n.t('employment-profile:createWorkflow.actions.createAnother')).toBe(values[2]);
      expect(i18n.t('employment-profile:createWorkflow.errors.validationSummary')).not.toMatch(
        /^createWorkflow\./,
      );
    }
  });

  it('uses a full-width ordered workflow with visible field-state semantics and review', async () => {
    await renderWorkflow(vi.fn(async () => createdRecord));

    const workflow = screen.getByTestId('employment-profile-complex-create');
    expect(workflow).toHaveAttribute('data-container', 'dedicated-page');
    expect(workflow).not.toHaveAttribute('data-mutation-presentation', 'drawer');
    expect(
      within(workflow)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining('Profile identity'),
      expect.stringContaining('Employment relationship'),
      expect.stringContaining('HR attribution'),
      expect.stringContaining('Review'),
    ]);
    expect(screen.getByText('Required fields')).toBeInTheDocument();
    expect(screen.getByText('Optional fields')).toBeInTheDocument();
    expect(screen.getByText('System-generated')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findAllByText('This field is required.')).not.toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Profile identity' })).toBeInTheDocument();

    await reachReview();
    expect(screen.getByText('Example Person')).toBeInTheDocument();
    expect(screen.getByText('Sales · OU-SALES')).toBeInTheDocument();
    expect(screen.queryByText('00000000-0000-4000-8000-000000000001')).not.toBeInTheDocument();
    expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument();
  });

  it('guards same-tick confirmation, shows pending, completes terminally, and resets cleanly', async () => {
    const user = userEvent.setup();
    let resolveCreate: (record: EmploymentProfileRecord) => void = () => undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<EmploymentProfileRecord>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    await renderWorkflow(onSubmit);
    await reachReview();

    const confirm = screen.getByRole('button', { name: 'Confirm and create' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      legalName: 'Nguyen Example',
      displayName: 'Example Person',
      employmentKind: 'EMPLOYEE',
      jobTitle: 'Producer',
      orgUnitId: '00000000-0000-4000-8000-000000000001',
      contractStatus: 'NONE',
      employmentStartDate: '2026-07-01',
      linkedUserId: null,
      recruiterEmploymentProfileId: null,
      hrOwnerEmploymentProfileId: null,
      onboardingOwnerEmploymentProfileId: null,
      sourcedByEmploymentProfileId: null,
      hiredAt: null,
      onboardedAt: null,
      externalRef: null,
      titleDescription: null,
    });
    expect(screen.getByRole('button', { name: 'Creating Employment Profile...' })).toBeDisabled();

    await act(async () => resolveCreate(createdRecord));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Employment profile created successfully',
    );
    expect(screen.getByRole('heading', { name: 'Employment Profile created' })).toBeInTheDocument();
    expect(screen.getByText('EP-000099')).toBeInTheDocument();
    expect(screen.getByText('Sales · OU-SALES')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm and create' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Profile' })).toHaveAttribute(
      'href',
      '/employment-profiles/00000000-0000-4000-8000-000000000099',
    );
    expect(screen.getByRole('link', { name: 'Return to People' })).toHaveAttribute(
      'href',
      '/employment-profiles',
    );

    await user.click(screen.getByRole('button', { name: 'Create Another' }));
    expect(screen.getByRole('heading', { name: 'Profile identity' })).toBeInTheDocument();
    expect(screen.getByLabelText('Legal Name · Required')).toHaveValue('');
    expect(screen.queryByText('EP-000099')).not.toBeInTheDocument();
  });

  it('reviews every populated payload field with business labels and submits the exact 16-field payload', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => createdRecord);
    loadUsers.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000002',
        label: 'Admin User Â· admin@example.test',
        status: 'ACTIVE',
      },
    ]);
    await renderWorkflow(onSubmit);
    await reachPopulatedReview();

    const review = screen
      .getByRole('heading', { name: 'Review Employment Profile' })
      .closest('section');
    expect(review).not.toBeNull();
    const expectedReviewValues: Array<string | RegExp> = [
      'Avery Payload Legal',
      'Avery Payload Display',
      'Contractor',
      'Principal Production Architect',
      /Sales.*OU-SALES/,
      'Pending Signature',
      'Jul 1, 2026',
      /Admin User.*admin@example\.test/,
      /Recruiter Person.*EP-RECRUITER/,
      /HR Owner.*EP-HR/,
      /Onboarding Owner.*EP-ONBOARD/,
      /Source Lead.*EP-SOURCE/,
      'Jun 15, 2026',
      'Jun 20, 2026',
      'EXT-AVERY-2026',
    ];
    for (const value of expectedReviewValues) {
      expect(within(review as HTMLElement).getByText(value)).toBeInTheDocument();
    }
    expect(
      within(review as HTMLElement).getByText(
        'Owns the cross-functional production architecture and review line.',
      ),
    ).toBeInTheDocument();
    for (const rawId of [
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000004',
      '00000000-0000-4000-8000-000000000005',
      '00000000-0000-4000-8000-000000000006',
    ]) {
      expect(within(review as HTMLElement).queryByText(rawId)).not.toBeInTheDocument();
    }
    expect(within(review as HTMLElement).queryByText('PENDING_SIGNATURE')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm and create' }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        legalName: 'Avery Payload Legal',
        displayName: 'Avery Payload Display',
        employmentKind: 'CONTRACTOR',
        jobTitle: 'Principal Production Architect',
        orgUnitId: '00000000-0000-4000-8000-000000000001',
        contractStatus: 'PENDING_SIGNATURE',
        employmentStartDate: '2026-07-01',
        linkedUserId: '00000000-0000-4000-8000-000000000002',
        recruiterEmploymentProfileId: '00000000-0000-4000-8000-000000000003',
        hrOwnerEmploymentProfileId: '00000000-0000-4000-8000-000000000004',
        onboardingOwnerEmploymentProfileId: '00000000-0000-4000-8000-000000000005',
        sourcedByEmploymentProfileId: '00000000-0000-4000-8000-000000000006',
        hiredAt: '2026-06-15',
        onboardedAt: '2026-06-20',
        externalRef: 'EXT-AVERY-2026',
        titleDescription: 'Owns the cross-functional production architecture and review line.',
      });
    });
  });

  it('maps safe validation feedback, retains input, releases the lock, and retries', async () => {
    const user = userEvent.setup();
    const validationError: NormalizedApiError = {
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Raw backend validation message',
      fieldErrors: { legalName: ['Raw field message'] },
      requestId: 'req-create-1',
      retryable: false,
      permissionDenied: false,
      notFound: false,
    };
    const onSubmit = vi
      .fn<() => Promise<EmploymentProfileRecord>>()
      .mockRejectedValueOnce(validationError)
      .mockResolvedValueOnce(createdRecord);
    await renderWorkflow(onSubmit);
    await reachReview();

    await user.click(screen.getByRole('button', { name: 'Confirm and create' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Review the highlighted fields');
    expect(screen.queryByText('Raw backend validation message')).not.toBeInTheDocument();
    expect(screen.queryByText('Raw field message')).not.toBeInTheDocument();
    const technicalDisclosure = screen.getByText('Technical details').closest('details');
    expect(technicalDisclosure).not.toHaveAttribute('open');
    expect(technicalDisclosure?.querySelector('pre')).not.toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Legal Name · Required')).toHaveValue('Nguyen Example');
    expect(screen.getByText('The server could not accept this field.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue to review' }));
    await user.click(screen.getByRole('button', { name: 'Confirm and create' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByRole('heading', { name: 'Employment Profile created' }),
    ).toBeInTheDocument();
  });

  it('distinguishes retryable failures and releases the confirmation lock', async () => {
    const user = userEvent.setup();
    const retryableError: NormalizedApiError = {
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Raw infrastructure detail',
      fieldErrors: {},
      requestId: 'req-create-retry',
      retryable: true,
      permissionDenied: false,
      notFound: false,
    };
    const onSubmit = vi
      .fn<() => Promise<EmploymentProfileRecord>>()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValueOnce(createdRecord);
    await renderWorkflow(onSubmit);
    await reachReview();

    await user.click(screen.getByRole('button', { name: 'Confirm and create' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The Employment Profile could not be created. Your entries are preserved; try again.',
    );
    expect(screen.queryByText('Raw infrastructure detail')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm and create' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Confirm and create' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByRole('heading', { name: 'Employment Profile created' }),
    ).toBeInTheDocument();
  });

  it('settles picker error, Retry, empty, listbox, selected, and clear states without raw values', async () => {
    const user = userEvent.setup();
    loadOrgUnits.mockRejectedValueOnce(new Error('lookup failed'));
    await renderWorkflow(vi.fn(async () => createdRecord));

    fireEvent.change(screen.getByLabelText('Employment Kind · Required'), {
      target: { value: 'EMPLOYEE' },
    });
    fireEvent.change(screen.getByLabelText('Legal Name · Required'), {
      target: { value: 'Nguyen Example' },
    });
    fireEvent.change(screen.getByLabelText('Display Name · Required'), {
      target: { value: 'Example Person' },
    });
    fireEvent.change(screen.getByLabelText('Job Title · Required'), {
      target: { value: 'Producer' },
    });
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    const option = await screen.findByRole('option', { name: /Sales/ });
    expect(option).toBeInTheDocument();
    await user.click(option);
    expect(screen.getAllByText('Sales · OU-SALES').length).toBeGreaterThan(1);
    expect(screen.queryByText('00000000-0000-4000-8000-000000000001')).not.toBeInTheDocument();
    expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear organization unit' }));
    expect(screen.getByRole('option', { name: /Sales/ })).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByText('Selected reference')).not.toBeInTheDocument();

    expect(await screen.findByText('No matching options')).toBeInTheDocument();
  });
});
import i18n from 'i18next';

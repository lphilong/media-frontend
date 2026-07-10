import i18n from 'i18next';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  StudioResourceCreateSurface,
  StudioResourceEditSurface,
} from '@modules/studio-resource/forms/studio-resource-mutation-forms';
import {
  performStudioResourceAvailabilityAction,
  performStudioResourceLifecycleAction,
} from '@modules/studio-resource/api/studio-resource.api';
import { apiRequest } from '@shared/api';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { studioResourceAvailabilityQueryConfig, studioResourceFlatListQueryConfig } from '@modules/studio-resource';
import { parseScreenQueryParams, serializeScreenQueryParams } from '@shared/query/screen-query-config';

vi.mock('@shared/api', () => ({
  apiRequest: vi.fn(),
}));

const renderWithProviders = (ui: JSX.Element) => render(ui);

describe('studio-resource wave 5 query and payload seams', () => {
  const mockedApiRequest = vi.mocked(apiRequest);

  afterEach(() => {
    mockedApiRequest.mockReset();
  });

  it('parses/builds only supported flat-list and availability query keys', () => {
    const parsed = parseScreenQueryParams(
      new URLSearchParams('resourceClass=SPACE&scope=global&sortBy=createdAt&sortDirection=desc'),
      studioResourceFlatListQueryConfig,
    );

    expect(parsed).toEqual({
      resourceClass: 'SPACE',
      sortBy: 'createdAt',
      sortDirection: 'desc',
    });

    const serialized = serializeScreenQueryParams(
      {
        view: 'availability',
        resourceClass: 'SPACE',
        hasMaxOccupancy: true,
        bookingCalendar: true,
      },
      studioResourceAvailabilityQueryConfig,
    );

    expect(serialized.get('view')).toBe('availability');
    expect(serialized.get('resourceClass')).toBe('SPACE');
    expect(serialized.get('hasMaxOccupancy')).toBe('true');
    expect(serialized.get('bookingCalendar')).toBeNull();
  });

  it('submits create payloads and enforces maxOccupancy only for SPACE', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <StudioResourceCreateSurface onCancel={() => undefined} onSubmit={onSubmit} />,
    );

    expect(screen.queryByLabelText(i18n.t('studio-resource:fields.resourceCode'))).toBeNull();
    expect(
      screen.getByText(i18n.t('studio-resource:generatedCode.description')),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(i18n.t('studio-resource:fields.name')), 'Wave Studio');
    await user.type(screen.getByLabelText(i18n.t('studio-resource:fields.shortName')), 'Wave');
    await user.type(
      screen.getByLabelText(i18n.t('studio-resource:fields.locationLabel')),
      'Room W',
    );
    await user.clear(screen.getByLabelText(i18n.t('studio-resource:fields.maxOccupancy')));
    await user.type(screen.getByLabelText(i18n.t('studio-resource:fields.maxOccupancy')), '9');
    await user.type(screen.getByLabelText(i18n.t('studio-resource:fields.externalRef')), 'EXT-SR');
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('studio-resource:mutations.create.submit'),
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Wave Studio',
      resourceClass: 'SPACE',
      shortName: 'Wave',
      locationLabel: 'Room W',
      description: null,
      externalRef: 'EXT-SR',
      maxOccupancy: 9,
    });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('resourceCode');

    onSubmit.mockReset();
    await user.selectOptions(
      screen.getByLabelText(i18n.t('studio-resource:fields.resourceClass')),
      'EQUIPMENT',
    );
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('studio-resource:mutations.create.submit'),
      }),
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(i18n.t('studio-resource:validation.maxOccupancySpaceOnly')),
    ).toBeInTheDocument();
  });

  it('normalizes edit-surface cleared optional values to null and hides occupancy for non-SPACE', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    const view = renderWithProviders(
      <StudioResourceEditSurface
        resourceClass="SPACE"
        initialValues={{
          name: 'Main Studio',
          shortName: 'Main',
          locationLabel: 'Room A',
          description: 'Desc',
          externalRef: 'EXT',
          maxOccupancy: 12,
        }}
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await user.clear(screen.getByLabelText(i18n.t('studio-resource:fields.shortName')));
    await user.clear(screen.getByLabelText(i18n.t('studio-resource:fields.locationLabel')));
    await user.clear(screen.getByLabelText(i18n.t('studio-resource:fields.description')));
    await user.clear(screen.getByLabelText(i18n.t('studio-resource:fields.externalRef')));
    await user.clear(screen.getByLabelText(i18n.t('studio-resource:fields.maxOccupancy')));
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('studio-resource:mutations.edit.submit'),
      }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Main Studio',
      shortName: null,
      locationLabel: null,
      description: null,
      externalRef: null,
      maxOccupancy: null,
    });

    onSubmit.mockReset();
    view.unmount();
    renderWithProviders(
      <StudioResourceEditSurface
        resourceClass="EQUIPMENT"
        initialValues={{
          name: 'Camera Kit',
          shortName: null,
          locationLabel: null,
          description: null,
          externalRef: null,
          maxOccupancy: null,
        }}
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.queryByLabelText(i18n.t('studio-resource:fields.maxOccupancy'))).toBeNull();
  });

  it('sends availability and lifecycle API requests as zero-body actions', async () => {
    mockedApiRequest.mockResolvedValue({
      data: {
        id: 'studio-001',
        resourceCode: 'SR-000001',
        name: 'Main Studio',
        shortName: 'Main',
        resourceClass: 'SPACE',
        operationalStatus: 'OUT_OF_SERVICE',
        locationLabel: 'Room A',
        maxOccupancy: 12,
        description: null,
        externalRef: null,
        createdAt: 1_000,
        updatedAt: 2_000,
      },
    });

    await performStudioResourceAvailabilityAction('studio-001', 'out-of-service');
    await performStudioResourceLifecycleAction('studio-001', 'deactivate');

    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, {
      method: 'POST',
      url: '/admin/studio-resources/studio-001/out-of-service',
      data: {},
    });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(2, {
      method: 'POST',
      url: '/admin/studio-resources/studio-001/deactivate',
      data: {},
    });
  });
});

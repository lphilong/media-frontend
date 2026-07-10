import { http, HttpResponse } from 'msw';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { setLocale } from '@shared/i18n/i18n';
import {
  getMockCurrentActorCapabilities,
  setMockCurrentActorCapabilities,
} from '@test/msw/identity-access-handlers';
import {
  setEmploymentTermsEmpty,
  setEmploymentTermsRedacted,
} from '@test/msw/employment-terms-handlers';
import { renderAppWithProviders } from '@test/render-app-route';
import { server } from '@test/msw/server';

const grantEmploymentTermsAccess = (): void => {
  const base = getMockCurrentActorCapabilities();
  setMockCurrentActorCapabilities({
    ...base,
    permissions: [
      ...base.permissions,
      'orgUnit.read',
      'employmentProfile.read',
      'employmentTerms.read',
      'employmentTerms.readSensitive',
    ],
  });
};

const renderWorkspace = async (locale: 'en' | 'vi' = 'en'): Promise<void> => {
  await setLocale(locale);
  grantEmploymentTermsAccess();
  const router = createMemoryRouter(appRoutes, { initialEntries: ['/employment-terms'] });
  await act(async () => {
    renderAppWithProviders(<RouterProvider router={router} />);
  });
};

const emptyListResponse = () => ({
  data: {
    items: [],
    nextCursor: null,
    appliedFilters: { effectiveOn: Date.UTC(2026, 0, 1) },
  },
});

describe('Employment Terms admin workspace', () => {
  it('renders the real workspace route, structured-terms notice, list, and HRET anchor links', async () => {
    const user = userEvent.setup();
    await renderWorkspace('vi');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Điều khoản làm việc / lương' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Điều khoản làm việc / lương' })).toHaveLength(1);
    expect(await screen.findByText(/liệt kê điều khoản làm việc có cấu trúc/i)).toBeInTheDocument();
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('EP-000001')).toBeInTheDocument();
    expect(screen.queryByText('HRET-2026-000001')).not.toBeInTheDocument();
    await user.click(screen.getAllByText('Chi tiết kỹ thuật')[0]);
    expect(screen.getByText(/HRET-2026-000001/)).toBeVisible();
    expect(screen.getAllByText('Đủ điều kiện làm nguồn bảng lương').length).toBeGreaterThan(0);
    expect(screen.getByText(/20\.000\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Meal allowance: 500\.000/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Mở hồ sơ' })[0]).toHaveAttribute(
      'href',
      '/employment-profiles/ep-001#employment-terms',
    );
    expect(screen.queryByText(/Upload/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PDF/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/e-sign/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Payment/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Contract Registry/i)).not.toBeInTheDocument();
  });

  it('shows safe redaction copy and does not render salary or allowance amounts as zero', async () => {
    setEmploymentTermsRedacted(true);
    await renderWorkspace('vi');

    expect(await screen.findAllByText('Đã ẩn theo quyền truy cập')).not.toHaveLength(0);
    expect(screen.getAllByText('Cần quyền xem dữ liệu lương')).not.toHaveLength(0);
    expect(screen.queryByText(/20\.000\.000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/500\.000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
  });

  it('renders the empty state', async () => {
    setEmploymentTermsEmpty();
    await renderWorkspace('vi');

    expect(await screen.findByText('Không có điều khoản phù hợp bộ lọc')).toBeInTheDocument();
  });

  it('renders the initial load error state', async () => {
    server.use(
      http.get('*/admin/employment-terms', () =>
        HttpResponse.json(
          { error: { code: 'EMPLOYMENT_TERMS_LIST_FAILED', message: 'List failed' } },
          { status: 500 },
        ),
      ),
    );
    await renderWorkspace('en');

    expect(
      await screen.findByText('Employment Terms could not be loaded', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('sends backend-supported filters from quick filters and filter controls', async () => {
    let capturedUrl: URL | null = null;
    server.use(
      http.get('*/admin/employment-terms', ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(emptyListResponse());
      }),
    );
    const user = userEvent.setup();
    await renderWorkspace('en');

    await user.click(await screen.findByRole('button', { name: 'Has overlap' }));
    await user.type(screen.getByLabelText('Search'), 'A');
    await user.selectOptions(screen.getByLabelText('Terms status'), 'APPROVED');
    await user.selectOptions(screen.getByLabelText('Payroll source'), 'true');
    await user.type(screen.getByLabelText('Effective on'), '2026-01-01');
    await user.type(screen.getByLabelText('Expiring before'), '2026-12-31');

    await waitFor(() => {
      expect(capturedUrl?.searchParams.get('readiness')).toBe('OVERLAPPING');
      expect(capturedUrl?.searchParams.get('search')).toBe('A');
      expect(capturedUrl?.searchParams.get('status')).toBe('APPROVED');
      expect(capturedUrl?.searchParams.get('payrollEligible')).toBe('true');
      expect(capturedUrl?.searchParams.get('effectiveOn')).toBe('2026-01-01');
      expect(capturedUrl?.searchParams.get('expiringBefore')).toBe('2026-12-31');
    });
  });

  it('uses nextCursor for the next page and resets cursor when filters change', async () => {
    const requests: URL[] = [];
    server.use(
      http.get('*/admin/employment-terms', ({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        return HttpResponse.json({
          data: {
            items: [],
            nextCursor: url.searchParams.get('cursor') ? null : 'cursor:next',
            appliedFilters: { effectiveOn: Date.UTC(2026, 0, 1) },
          },
        });
      }),
    );
    const user = userEvent.setup();
    await renderWorkspace('en');

    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(requests.at(-1)?.searchParams.get('cursor')).toBe('cursor:next');
    });

    await user.type(screen.getByLabelText('Search'), 'B');
    await waitFor(() => {
      expect(requests.at(-1)?.searchParams.get('search')).toBe('B');
      expect(requests.at(-1)?.searchParams.get('cursor')).toBeNull();
    });

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByLabelText('Search')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });
});

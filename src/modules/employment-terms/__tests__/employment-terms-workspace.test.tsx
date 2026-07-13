import i18n from 'i18next';
import { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import { setLocale } from '@shared/i18n/i18n';
import {
  getMockCurrentActorCapabilities,
  setMockCurrentActorCapabilities,
} from '@test/msw/identity-access-handlers';
import {
  setEmploymentTermsAdminListErrorNext,
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

const renderWorkspace = async (locale: 'en' | 'vi' | 'zh' = 'en'): Promise<QueryClient> => {
  await setLocale(locale);
  grantEmploymentTermsAccess();
  const router = createMemoryRouter(appRoutes, { initialEntries: ['/employment-terms'] });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  await act(async () => {
    renderAppWithProviders(<RouterProvider router={router} />, { queryClient });
  });
  return queryClient;
};

const emptyListResponse = () => ({
  data: {
    items: [],
    nextCursor: null,
    appliedFilters: { effectiveOn: Date.UTC(2026, 0, 1) },
  },
});

describe('Employment Terms admin workspace', () => {
  it('provides distinct EN, VI, and ZH pagination and empty-state semantics', async () => {
    const expected = {
      en: ['Rows per page', 'No employment terms yet'],
      vi: ['Số dòng mỗi trang', 'Chưa có điều khoản làm việc'],
      zh: ['每页行数', '暂无工作条款'],
    } as const;

    for (const [locale, values] of Object.entries(expected) as Array<
      [keyof typeof expected, (typeof expected)[keyof typeof expected]]
    >) {
      await setLocale(locale);
      expect(i18n.t('employment-terms:filters.rowsPerPage')).toBe(values[0]);
      expect(i18n.t('employment-terms:states.initialEmptyTitle')).toBe(values[1]);
    }
  });
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

  it('distinguishes the initial empty state from a filtered empty result', async () => {
    setEmploymentTermsEmpty();
    await renderWorkspace('en');

    expect(await screen.findByText('No employment terms yet')).toBeInTheDocument();
    expect(
      screen.getByText('No employment terms are available in this workspace.'),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search'), 'missing');

    expect(await screen.findByText('No matching employment terms')).toBeInTheDocument();
    expect(screen.getByText('No terms match the current filters.')).toBeInTheDocument();
  });

  it('keeps filters and applied values mounted while a cold filter loads, then reuses warm data', async () => {
    let resolveCold: (() => void) | undefined;
    let coldRequests = 0;
    server.use(
      http.get('*/admin/employment-terms', ({ request }) => {
        const search = new URL(request.url).searchParams.get('search');
        if (search !== 'cold-filter') {
          return HttpResponse.json(emptyListResponse());
        }

        coldRequests += 1;
        return new Promise<Response>((resolve) => {
          resolveCold = () => resolve(HttpResponse.json(emptyListResponse()));
        });
      }),
    );
    await renderWorkspace('en');

    expect(await screen.findByText('No employment terms yet')).toBeInTheDocument();
    const search = screen.getByLabelText('Search');
    fireEvent.change(search, { target: { value: 'cold-filter' } });

    await waitFor(() => expect(coldRequests).toBe(1));
    expect(screen.getByRole('region', { name: 'Quick filters' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Employment Terms filters' })).toBeInTheDocument();
    expect(search).toHaveValue('cold-filter');
    expect(screen.queryByText('No employment terms yet')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Employment Terms results' })).toHaveAttribute(
      'aria-live',
      'polite',
    );

    await act(async () => resolveCold?.());
    expect(await screen.findByText('No matching employment terms')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: '' } });
    expect(await screen.findByText('No employment terms yet')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'cold-filter' } });
    expect(await screen.findByText('No matching employment terms')).toBeInTheDocument();
    expect(search).toHaveValue('cold-filter');
  });

  it('renders the initial load error state', async () => {
    let requestCount = 0;
    server.use(
      http.get('*/admin/employment-terms', () => {
        requestCount += 1;
        return requestCount === 1
          ? HttpResponse.json(
              { error: { code: 'EMPLOYMENT_TERMS_LIST_FAILED', message: 'List failed' } },
              { status: 500 },
            )
          : HttpResponse.json(emptyListResponse());
      }),
    );
    await renderWorkspace('en');

    expect(
      await screen.findByText('Employment Terms could not be loaded', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('List failed')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No employment terms yet')).toBeInTheDocument();
    expect(requestCount).toBe(2);
  }, 10_000);

  it('keeps retained results and shows only safe localized copy when a refresh fails', async () => {
    const rawBackendMessage =
      'SQLSTATE[42P01]: select * from employment_terms at https://api.example.test/admin/employment-terms';
    const queryClient = await renderWorkspace('en');

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    setEmploymentTermsAdminListErrorNext(rawBackendMessage);
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['employment-terms'] });
    });

    expect(await screen.findByText('Refresh failed')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText(rawBackendMessage)).not.toBeInTheDocument();
    expect(screen.queryByText(/SQLSTATE|api\.example\.test/i)).not.toBeInTheDocument();

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['employment-terms'] });
    });
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Refresh failed')).not.toBeInTheDocument();
  });

  it('maps an initial 404 to the terminal localized Not Found state without Retry', async () => {
    const rawBackendMessage = 'Employment terms table missing for tenant 8d3d0507-ae86-42fc-a9c3';
    server.use(
      http.get('*/admin/employment-terms', () =>
        HttpResponse.json(
          { error: { code: 'EMPLOYMENT_TERMS_NOT_FOUND', message: rawBackendMessage } },
          { status: 404 },
        ),
      ),
    );
    await renderWorkspace('en');

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.queryByText('Employment Terms could not be loaded')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(screen.queryByText(rawBackendMessage)).not.toBeInTheDocument();
  });

  it('settles a backend permission denial without leaking the backend message', async () => {
    server.use(
      http.get('*/admin/employment-terms', () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Raw backend denial' } },
          { status: 403 },
        ),
      ),
    );
    await renderWorkspace('en');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByText('Raw backend denial')).not.toBeInTheDocument();
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

    const quickFilters = await screen.findByRole('region', { name: 'Quick filters' });
    expect(quickFilters).toHaveAttribute('data-layout', 'compact-filter-strip');
    const filterRegion = screen.getByRole('region', { name: 'Employment Terms filters' });
    expect(within(filterRegion).queryByLabelText('Rows per page')).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Rows per page')).toHaveValue('20');

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

  it('formats result dates with the active locale', async () => {
    await renderWorkspace('en');
    expect((await screen.findAllByText('Jan 1, 2026')).length).toBeGreaterThan(0);

    cleanup();
    await renderWorkspace('zh');
    expect((await screen.findAllByText('2026年1月1日')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Jan 1, 2026')).not.toBeInTheDocument();
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
